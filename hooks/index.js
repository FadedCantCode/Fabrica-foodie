"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import {
  auth, db, googleProvider, consumeGoogleRedirectResult,
  APP_ID, createVerificationCode,
} from '../lib/firebase';
import { getMasterUid, getSmartTag, TAIWAN_TRENDY_RECS } from '../lib/helpers';

// ─── useToast ─────────────────────────────────────────────────────────────────
export function useToast() {
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const showToast = useCallback((msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(""), 3500);
  }, []);
  return { toastMessage, toastType, showToast };
}

// ─── useAuth ──────────────────────────────────────────────────────────────────
export function useAuth() {
  const [firebaseUser, setFirebaseUser]               = useState(null);
  const [masterUid, setMasterUid]                     = useState("");
  const [threadsUsername, setThreadsUsername]         = useState("");
  const [isLoggedIn, setIsLoggedIn]                   = useState(false);
  const [isThreadsBound, setIsThreadsBound]           = useState(false);
  const [isGoogleAuthPending, setIsGoogleAuthPending] = useState(false);
  const [loginStep, setLoginStep]                     = useState("idle");
  const [verificationCode, setVerificationCode]       = useState("");
  const [loginError, setLoginError]                   = useState("");
  const [inputUsername, setInputUsername]             = useState("");
  const [isGlobalTransitioning, setIsGlobalTransitioning] = useState(false);

  // Keep a ref so async callbacks can check if still mounted
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const getGoogleAuthErrorMessage = (error) => {
    const code = error?.code || "";
    if (code.includes("unauthorized-domain"))   return `Google 登入失敗 (${code})。請在 Firebase Auth > Authorized domains 加入此網域。`;
    if (code.includes("invalid-api-key"))       return `Google 登入失敗 (${code})。請確認 NEXT_PUBLIC_FIREBASE_API_KEY。`;
    if (code.includes("popup-blocked"))         return "瀏覽器封鎖了彈出視窗，請再試一次。";
    if (code.includes("popup-closed-by-user"))  return "Google 登入已取消。";
    return code ? `Google 登入失敗：${code}` : "Google 登入失敗，請稍後再試。";
  };

  useEffect(() => {
    // ── Check if Google redirect is in progress ──────────────────────────────
    if (typeof window !== 'undefined' &&
        window.localStorage.getItem('fabrica_auth_mode') === 'google' &&
        !auth.currentUser) {
      setIsGoogleAuthPending(true);
    }

    // ── Consume any pending redirect result ──────────────────────────────────
    consumeGoogleRedirectResult()
      .then(result => {
        if (!mountedRef.current) return;
        if (result?.user) {
          setLoginError("");
          setIsGoogleAuthPending(false);
        }
      })
      .catch(err => {
        if (!mountedRef.current || !err) return;
        setIsGoogleAuthPending(false);
        setLoginError(getGoogleAuthErrorMessage(err));
      });

    // ── Main auth state listener ─────────────────────────────────────────────
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!mountedRef.current) return;

      const savedThreadsUsername =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('fabrica_threads_username') || ""
          : "";
      const savedAuthMode =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('fabrica_auth_mode') || ""
          : "";

      setFirebaseUser(user || null);

      if (user) {
        // ── Signed in ────────────────────────────────────────────────────────
        const isThreadsUser = user.uid.startsWith("threads_");
        const cleanUsername = isThreadsUser
          ? user.uid.replace("threads_", "")
          : (savedThreadsUsername || "");

        const displayName = cleanUsername
          ? `@${cleanUsername}`
          : (user.displayName || user.email?.split("@")[0] || "User");

        const bound = !isThreadsUser && !!savedThreadsUsername;

        // Set everything we know synchronously first
        setFirebaseUser(user);
        setThreadsUsername(displayName);
        setInputUsername(cleanUsername || "");
        setIsThreadsBound(bound);
        setIsGoogleAuthPending(false);
        setLoginError("");

        // ── Clear auth_mode so the else-if branch never fires again ──────────
        // This prevents the "正在完成 Google 登入" loop after successful login
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('fabrica_auth_mode');
        }

        // If Threads user, resolve masterUid async WITHOUT blocking isLoggedIn
        if (isThreadsUser && cleanUsername) {
          // Set masterUid to temporary value so Firestore listener can start
          setMasterUid(user.uid);
          setIsLoggedIn(true);

          // Then update masterUid in background
          getMasterUid(cleanUsername).then(resolved => {
            if (!mountedRef.current) return;
            setMasterUid(resolved);
          }).catch(() => {
            if (!mountedRef.current) return;
            setMasterUid(user.uid);
          });
        } else {
          setMasterUid(user.uid);
          setIsLoggedIn(true);
        }

      } else if (savedAuthMode === 'google') {
        // Google redirect in progress
        setIsGoogleAuthPending(true);
        setIsLoggedIn(false);
      } else {
        // Fully signed out
        setIsGoogleAuthPending(false);
        setIsLoggedIn(false);
        setMasterUid("");
        setThreadsUsername("");
      }
    });

    return () => unsubscribe();
  }, []);

  // ── Threads login ─────────────────────────────────────────────────────────
  const handleGenerateCode = (e) => {
    e.preventDefault();
    const clean = inputUsername.replace("@", "").trim().toLowerCase();
    if (!clean) { setLoginError("請輸入您的 Threads 帳號"); return; }
    const code = createVerificationCode();
    setVerificationCode(code);
    setLoginError("");
    setLoginStep("code_shown");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "fabrica_threads_verification",
        JSON.stringify({ username: clean, code })
      );
    }
  };

  const handleVerifyCrawler = async (e) => {
    e.preventDefault();
    const clean = inputUsername.replace("@", "").trim().toLowerCase();
    if (!clean || !verificationCode) return;
    setLoginStep("verifying");
    setLoginError("");
    try {
      const res = await fetch("/api/verify-crawler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: clean,
          expectedCode: verificationCode,
          uid: firebaseUser?.uid ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.success) {
        if (data.customToken) {
          try {
            await signInWithCustomToken(auth, data.customToken);
            // onAuthStateChanged fires → sets isLoggedIn automatically
          } catch {
            if (!mountedRef.current) return;
            setLoginStep("code_shown");
            setLoginError("登入失敗，請稍後再試。");
            return;
          }
        }
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            "fabrica_auth_mode",
            firebaseUser ? "google_threads" : "threads"
          );
          window.localStorage.setItem("fabrica_threads_username", clean);
          window.localStorage.removeItem("fabrica_threads_verification");
        }
        if (!mountedRef.current) return;
        setLoginStep("done");
        setLoginError("");
        setIsGlobalTransitioning(true);
        setTimeout(() => {
          if (mountedRef.current) setIsGlobalTransitioning(false);
        }, 800);
      } else {
        if (!mountedRef.current) return;
        setLoginStep("code_shown");
        setLoginError(data.message || "驗證失敗，請稍後再試。");
      }
    } catch {
      if (!mountedRef.current) return;
      setLoginStep("code_shown");
      setLoginError("網路錯誤，請確認連線後再試。");
    }
  };

  const handleResetLogin = () => {
    setLoginStep("idle");
    setVerificationCode("");
    setLoginError("");
    setInputUsername("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("fabrica_threads_verification");
    }
  };

  // ── Google login ──────────────────────────────────────────────────────────
  const handleGoogleSignIn = async (e) => {
    e.preventDefault();
    setLoginError("");
    setIsGoogleAuthPending(true);

    // Set auth_mode so onAuthStateChanged knows what's happening
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('fabrica_auth_mode', 'google');
    }

    try {
      // Always use popup — never redirect
      // The COOP "warning" in console is harmless, login still succeeds
      // signInWithRedirect causes iOS Safari ITP sessionStorage issues
      await signInWithPopup(auth, googleProvider);

      // Success — onAuthStateChanged will fire and call setIsLoggedIn(true)
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('fabrica_auth_mode');
      }
      if (mountedRef.current) setIsGoogleAuthPending(false);

    } catch (err) {
      if (!mountedRef.current) return;

      // Clean up pending state
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('fabrica_auth_mode');
      }
      setIsGoogleAuthPending(false);

      const code = err?.code || "";

      // User closed the popup — not an error
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }

      // Popup blocked — show helpful message instead of trying redirect
      if (code === 'auth/popup-blocked') {
        setLoginError("瀏覽器封鎖了登入視窗。請允許此網站開啟彈出視窗，或嘗試其他瀏覽器。");
        return;
      }

      setLoginError(getGoogleAuthErrorMessage(err));
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    setIsGlobalTransitioning(true);
    setTimeout(async () => {
      const isThreadsUser = auth.currentUser?.uid?.startsWith("threads_");

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('fabrica_auth_mode');
        // Keep threads_username so next visit auto-restores session
        if (!isThreadsUser) {
          window.localStorage.removeItem('fabrica_threads_username');
        }
      }

      // Threads users: preserve Firebase session so next visit auto-logs in
      // Google users: full signOut
      if (!isThreadsUser) {
        await signOut(auth).catch(console.error);
      }

      if (!mountedRef.current) return;
      setIsGoogleAuthPending(false);
      setIsLoggedIn(false);
      setFirebaseUser(null);
      setThreadsUsername("");
      setInputUsername("");
      setMasterUid("");
      setLoginStep("idle");
      setVerificationCode("");
      setLoginError("");
      setIsGlobalTransitioning(false);
    }, 800);
  };

  return {
    firebaseUser, masterUid, setMasterUid,
    threadsUsername, setThreadsUsername,
    isLoggedIn, setIsLoggedIn,
    isThreadsBound, setIsThreadsBound,
    isGoogleAuthPending,
    loginStep, verificationCode, loginError,
    inputUsername, setInputUsername,
    isGlobalTransitioning,
    handleGenerateCode, handleVerifyCrawler, handleResetLogin,
    handleGoogleSignIn, handleLogout,
  };
}

// ─── useRestaurants ───────────────────────────────────────────────────────────
export function useRestaurants(masterUid, isLoggedIn) {
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading]     = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !masterUid) return;
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'artifacts', APP_ID, 'users', masterUid, 'restaurants'),
      (snapshot) => {
        const list = [];
        snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
        setRestaurants(
          list.sort((a, b) => (b.savedAt?.seconds || 0) - (a.savedAt?.seconds || 0))
        );
        setIsLoading(false);
      },
      (error) => {
        console.error("Firestore error:", error);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [isLoggedIn, masterUid]);

  return { restaurants, isLoading };
}

// ─── useDrag ──────────────────────────────────────────────────────────────────
export function useDrag(setDisplayRestaurants, setSelectedRestaurant) {
  const dragRef    = useRef({ id: null, startX: 0, startY: 0, el: null, hoveredIndex: -1, isDragging: false });
  const [draggingId, setDraggingId] = useState(null);
  const pressTimer = useRef(null);
  const [dragState, setDragState]   = useState({ draggingId: null, startIndex: -1, hoveredIndex: -1 });

  const handlePointerDown = (e, restaurant, index) => {
    if (e.target.closest("button") || e.target.closest("a")) return;
    e.preventDefault();
    const cardEl = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    dragRef.current = { id: restaurant.id, startX, startY, el: cardEl, hoveredIndex: index, isDragging: false };

    const startDrag = () => {
      dragRef.current.isDragging = true;
      cardEl.setPointerCapture(pointerId);
      if (navigator.vibrate) navigator.vibrate(40);
      cardEl.style.transition  = 'none';
      cardEl.style.zIndex      = "100";
      cardEl.style.boxShadow   = "0 35px 70px rgba(0,0,0,0.35)";
      document.body.style.userSelect = 'none';
      setDragState({ draggingId: restaurant.id, startIndex: index, hoveredIndex: index });
      setDraggingId(restaurant.id);
    };

    if (e.pointerType === 'touch') pressTimer.current = setTimeout(startDrag, 300);

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragRef.current.isDragging) {
        if (e.pointerType === 'touch') {
          if (Math.sqrt(dx*dx+dy*dy) > 15 && pressTimer.current) clearTimeout(pressTimer.current);
        } else {
          if (Math.sqrt(dx*dx+dy*dy) > 8) startDrag();
        }
        return;
      }
      ev.preventDefault();
      dragRef.current.el.style.transform = `translate3d(${dx}px,${dy}px,0) scale(1.05) rotate(${dx*0.04}deg)`;
      dragRef.current.el.style.pointerEvents = 'none';
      const elements = document.elementsFromPoint(ev.clientX, ev.clientY);
      dragRef.current.el.style.pointerEvents = 'auto';
      const dropTarget = elements.find(
        el => el.hasAttribute('data-sort-index') &&
              el.getAttribute('data-restaurant-id') !== dragRef.current.id
      );
      if (dropTarget) {
        const targetIdx = parseInt(dropTarget.getAttribute('data-sort-index'), 10);
        if (!isNaN(targetIdx) && targetIdx !== dragRef.current.hoveredIndex) {
          if (navigator.vibrate) navigator.vibrate(15);
          dragRef.current.hoveredIndex = targetIdx;
          setDragState(prev => ({ ...prev, hoveredIndex: targetIdx }));
          setDisplayRestaurants(prev => {
            const arr    = [...prev];
            const oldIdx = arr.findIndex(r => r.id === dragRef.current.id);
            if (oldIdx !== -1) {
              const item = arr.splice(oldIdx, 1)[0];
              arr.splice(targetIdx, 0, item);
            }
            return arr;
          });
        }
      }
    };

    const onUp = (ev) => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragRef.current.isDragging && Math.sqrt(dx*dx+dy*dy) < 8) {
        setSelectedRestaurant(restaurant);
      }
      if (dragRef.current.el) {
        dragRef.current.el.style.transition = 'transform 0.5s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.4s ease';
        dragRef.current.el.style.transform  = 'translate3d(0,0,0) scale(1) rotate(0deg)';
        dragRef.current.el.style.zIndex     = "1";
        dragRef.current.el.style.boxShadow  = "none";
      }
      document.body.style.userSelect = 'auto';
      dragRef.current = { id: null, startX: 0, startY: 0, el: null, hoveredIndex: -1, isDragging: false };
      setDragState({ draggingId: null, startIndex: -1, hoveredIndex: -1 });
      setDraggingId(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return { draggingId, dragState, handlePointerDown };
}

// ─── useNearby ────────────────────────────────────────────────────────────────
export function useNearby(isLoggedIn) {
  const [nearbyRecommendations, setNearbyRecommendations] = useState([]);
  const [dismissedIds, setDismissedIds]                   = useState([]);
  const hasSearchedRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || hasSearchedRef.current) return;
    if (typeof window !== 'undefined' && navigator.geolocation) {
      hasSearchedRef.current = true;
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => triggerSearch(coords.latitude, coords.longitude),
        ()           => setNearbyRecommendations(TAIWAN_TRENDY_RECS)
      );
    }
  }, [isLoggedIn]);

  const triggerSearch = async (lat, lng) => {
    let results = [];
    try {
      const q = `[out:json][timeout:10];(node["amenity"~"restaurant|cafe|fast_food|ice_cream"](around:5000,${lat},${lng});way["amenity"~"restaurant|cafe|fast_food|ice_cream"](around:5000,${lat},${lng});node["shop"~"bakery|beverages|pastry"](around:5000,${lat},${lng}););out center 12;`;
      const res  = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q });
      const data = await res.json();
      if (data?.elements?.length > 0) {
        results = data.elements.map(el => {
          const tags = el.tags || {};
          const name = tags.name || tags['name:zh'];
          if (!name || name.includes("歇業") || name.includes("停業")) return null;
          return {
            id:       el.id.toString(),
            name,
            address:  tags['addr:street']
              ? `${tags['addr:city']||''}${tags['addr:street']}${tags['addr:housenumber']||''}`
              : "點擊查看地圖定位",
            category: getSmartTag(name, tags.amenity || tags.shop || "在地美食"),
            note:     "📍 透過智慧地理雷達探測到的精選店家。",
          };
        }).filter(Boolean);
      }
    } catch {}

    if (results.length === 0) {
      try {
        const d = 0.02;
        const [r1, r2] = await Promise.all([
          fetch(`https://nominatim.openstreetmap.org/search?amenity=restaurant&format=json&addressdetails=1&limit=6&viewbox=${lng-d},${lat+d},${lng+d},${lat-d}&bounded=1`, { headers: { 'Accept-Language': 'zh-TW,zh;q=0.9' } }),
          fetch(`https://nominatim.openstreetmap.org/search?amenity=cafe&format=json&addressdetails=1&limit=4&viewbox=${lng-d},${lat+d},${lng+d},${lat-d}&bounded=1`, { headers: { 'Accept-Language': 'zh-TW,zh;q=0.9' } }),
        ]);
        const merged = [...await r1.json(), ...await r2.json()];
        results = merged.map(p => {
          const name = p.name || p.display_name.split(',')[0].trim();
          if (!name || name === "餐廳" || name === "咖啡廳") return null;
          return {
            id:       p.place_id.toString(),
            name,
            address:  p.display_name.split(',').slice(0, 3).join(',').trim(),
            category: getSmartTag(name, p.type === "cafe" ? "咖啡甜點" : "精選美食"),
            note:     "📍 透過智慧地理雷達探測到的精選店家。",
          };
        }).filter(Boolean);
      } catch {}
    }

    setNearbyRecommendations(results.length > 0 ? results : TAIWAN_TRENDY_RECS);
  };

  const dismiss = (id) => setDismissedIds(prev => [...prev, id]);
  const activeRecommendations = nearbyRecommendations.filter(r => !dismissedIds.includes(r.id));

  return { activeRecommendations, dismiss };
}
