"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';

// ── Lib ───────────────────────────────────────────────────────────────────────
import { auth, db, APP_ID } from '../lib/firebase';
import {
  getSmartTag, generateAIReview, extractThreadsAuthor,
  getMasterUid, getFoodImage, getFreeMapAppUrl,
} from '../lib/helpers';

// ── Hooks ─────────────────────────────────────────────────────────────────────
import { useAuth, useRestaurants, useDrag, useNearby, useToast } from '../hooks';

// ── Components ────────────────────────────────────────────────────────────────
import {
  GlobalStyles, AppleButton, LiquidGlassCard,
  BlurVignette, ColorfulBackground, GooeyLoader,
  Toast, ModalSheet,
} from '../components/ui';
import LoginPage from '../components/LoginPage';
import BindModal from '../components/BindModal';
import { RestaurantCard, RecommendationCard, RestaurantDetailModal, GyroPermissionButton } from '../components/RestaurantCards';
import MapView from '../components/MapView';

// ── Firebase imports for food actions ────────────────────────────────────────
import { addDoc, updateDoc, deleteDoc, doc, collection, serverTimestamp } from 'firebase/firestore';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth_ = useAuth();
  const {
    firebaseUser, masterUid, setMasterUid,
    threadsUsername, setThreadsUsername,
    isLoggedIn, setIsLoggedIn,
    isThreadsBound, setIsThreadsBound,
    isGoogleAuthPending, loginStep, verificationCode, loginError,
    inputUsername, setInputUsername, isGlobalTransitioning,
    handleGenerateCode, handleVerifyCrawler, handleResetLogin,
    handleGoogleSignIn, handleLogout,
  } = auth_;

  // ── Toast ─────────────────────────────────────────────────────────────────
  const { toastMessage, toastType, showToast } = useToast();

  // ── Restaurants ───────────────────────────────────────────────────────────
  const { restaurants, isLoading, addRestaurant, updateRestaurant, deleteRestaurant } = useRestaurants(masterUid, isLoggedIn);

  // ── Nearby ────────────────────────────────────────────────────────────────
  const { activeRecommendations, dismiss: dismissRec } = useNearby(isLoggedIn);

  // ── UI state (declare BEFORE useDrag) ─────────────────────────────────────
  const [displayRestaurants, setDisplayRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [animatingRecId, setAnimatingRecId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBindModal, setShowBindModal] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // ── Add form state ────────────────────────────────────────────────────────
  const [newRestName, setNewRestName] = useState("");
  const [newRestAddress, setNewRestAddress] = useState("");
  const [newRestCategory, setNewRestCategory] = useState("");
  const [newRestNote, setNewRestNote] = useState("");
  const [newRestRecommender, setNewRestRecommender] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [isTypingName, setIsTypingName] = useState(false);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);

  // ── Import state ──────────────────────────────────────────────────────────
  const [importText, setImportText] = useState("");
  const [isImportingThread, setIsImportingThread] = useState(false);

  // ── Drag ──────────────────────────────────────────────────────────────────
  const { draggingId, dragState, handlePointerDown } = useDrag(setDisplayRestaurants, setSelectedRestaurant);

  // ── Store Firebase token for bookmarklet ─────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) return;
    auth.currentUser.getIdToken().then(token => {
      const exp = Math.floor(Date.now() / 1000) + 3500; // ~1hr
      localStorage.setItem('fabrica_fb_token', JSON.stringify({ token, exp }));
    }).catch(() => {});
  }, [isLoggedIn]);

  // ── Geolocation (populate userLocation for MapView) ─────────────────────────
  useEffect(() => {
    if (!isLoggedIn || userLocation || typeof window === 'undefined') return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setUserLocation({ lat: coords.latitude, lng: coords.longitude }),
      () => {} // user denied or unavailable — MapView falls back to Taiwan center
    );
  }, [isLoggedIn]);
  
  // ── Resume pending share after login (from Threads share → /share) ────────
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) return;
    const pending = sessionStorage.getItem('fabrica_pending_share');
    if (!pending) return;
    sessionStorage.removeItem('fabrica_pending_share');
    (async () => {
      showToast("✨ 正在分析剛剛分享的貼文...", "info");
      try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch('/api/share-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: pending, idToken: token }),
        });
        const data = await res.json();
        if (data.success) showToast(`🎉 已存入 ${data.count} 家餐廳！`, "success");
        else showToast(data.error || "分析失敗", "error");
      } catch { showToast("分析失敗，請稍後再試", "error"); }
    })();
  }, [isLoggedIn]);

  // ── Login 3D bg ───────────────────────────────────────────────────────────
  const canvasContainerRef = useRef(null);

  const vertexShaderLogin = `uniform float u_intensity;uniform float u_time;uniform float u_noiseScale;uniform float u_noiseSpeed;varying vec2 vUv;varying float vDisplacement;vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}vec3 fade(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}float cnoise(vec3 P){vec3 Pi0=floor(P);vec3 Pi1=Pi0+vec3(1.0);Pi0=mod(Pi0,289.0);Pi1=mod(Pi1,289.0);vec3 Pf0=fract(P);vec3 Pf1=Pf0-vec3(1.0);vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x);vec4 iy=vec4(Pi0.yy,Pi1.yy);vec4 iz0=Pi0.zzzz;vec4 iz1=Pi1.zzzz;vec4 ixy=permute(permute(ix)+iy);vec4 ixy0=permute(ixy+iz0);vec4 ixy1=permute(ixy+iz1);vec4 gx0=ixy0/7.0;vec4 gy0=fract(floor(gx0)/7.0)-0.5;gx0=fract(gx0);vec4 gz0=vec4(0.5)-abs(gx0)-abs(gy0);vec4 sz0=step(gz0,vec4(0.0));gx0-=sz0*(step(0.0,gx0)-0.5);gy0-=sz0*(step(0.0,gy0)-0.5);vec4 gx1=ixy1/7.0;vec4 gy1=fract(floor(gx1)/7.0)-0.5;gx1=fract(gx1);vec4 gz1=vec4(0.5)-abs(gx1)-abs(gy1);vec4 sz1=step(gz1,vec4(0.0));gx1-=sz1*(step(0.0,gx1)-0.5);gy1-=sz1*(step(0.0,gy1)-0.5);vec3 g000=vec3(gx0.x,gy0.x,gz0.x);vec3 g100=vec3(gx0.y,gy0.y,gz0.y);vec3 g010=vec3(gx0.z,gy0.z,gz0.z);vec3 g110=vec3(gx0.w,gy0.w,gz0.w);vec3 g001=vec3(gx1.x,gy1.x,gz1.x);vec3 g101=vec3(gx1.y,gy1.y,gz1.y);vec3 g011=vec3(gx1.z,gy1.z,gz1.z);vec3 g111=vec3(gx1.w,gy1.w,gz1.w);vec4 norm0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));g000*=norm0.x;g010*=norm0.y;g100*=norm0.z;g110*=norm0.w;vec4 norm1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));g001*=norm1.x;g011*=norm1.y;g101*=norm1.z;g111*=norm1.w;float n000=dot(g000,Pf0);float n100=dot(g100,vec3(Pf1.x,Pf0.yz));float n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z));float n110=dot(g110,vec3(Pf1.xy,Pf0.z));float n001=dot(g001,vec3(Pf0.xy,Pf1.z));float n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z));float n011=dot(g011,vec3(Pf0.x,Pf1.yz));float n111=dot(g111,Pf1);vec3 fade_xyz=fade(Pf0);vec4 n_z=mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);vec2 n_yz=mix(n_z.xy,n_z.zw,fade_xyz.y);float n_xyz=mix(n_yz.x,n_yz.y,fade_xyz.x);return 2.2*n_xyz;}float turbulence(vec3 p){float t=0.0;float f=1.0;float a=1.0;for(int i=0;i<4;i++){t+=abs(cnoise(p*f))*a;f*=2.0;a*=0.5;}return t;}void main(){vUv=uv;float n1=cnoise(position*u_noiseScale+vec3(u_time*u_noiseSpeed));float n2=cnoise(position*(u_noiseScale*2.0)+vec3(u_time*u_noiseSpeed*1.5))*0.5;float tn=turbulence(position+vec3(u_time))*0.3;vDisplacement=n1+n2+tn;vec3 np=position+normal*(u_intensity*vDisplacement);vec4 mp=modelMatrix*vec4(np,1.0);gl_Position=projectionMatrix*viewMatrix*mp;}`;
  const fragmentShaderLogin = `uniform float u_intensity;uniform float u_time;varying vec2 vUv;varying float vDisplacement;void main(){float d=2.0*vDisplacement*u_intensity*sin(vUv.y*10.0+u_time);vec3 bc=vec3(0.96,0.96,0.97);vec3 wc=vec3(0.05,0.05,0.06);vec3 color=mix(bc,wc,clamp(abs(d)*1.8,0.0,1.0));gl_FragColor=vec4(color,1.0);}`;

  // GSAP refs
  const mainRef       = useRef(null);
  const cardsRef      = useRef(null);
  const headerRef     = useRef(null);
  const sidebarRef    = useRef(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MAPTILER_KEY) {
      window._maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    }
  }, []);

  // GSAP: header shrink on scroll
  useEffect(() => {
    if (!isLoggedIn || !headerRef.current) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        start: 'top top-=60',
        onUpdate: (self) => {
          if (!headerRef.current) return;
          const shrink = self.progress > 0;
          gsap.to(headerRef.current, {
            paddingTop: shrink ? '8px' : '16px',
            paddingBottom: shrink ? '8px' : '16px',
            duration: 0.3,
            ease: 'power2.out',
          });
        },
      });
    });
    return () => ctx.revert();
  }, [isLoggedIn]);

  // GSAP: sidebar entrance
  useEffect(() => {
    if (!isLoggedIn || !sidebarRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(sidebarRef.current, {
        x: -40, opacity: 0, duration: 0.7,
        ease: 'power3.out', delay: 0.1,
      });
    });
    return () => ctx.revert();
  }, [isLoggedIn]);

  // GSAP: cards stagger on load / filter change
  useEffect(() => {
    if (!cardsRef.current || !isLoggedIn) return;
    const ctx = gsap.context(() => {
      const cards = cardsRef.current.querySelectorAll('[data-restaurant-id]');
      if (!cards.length) return;
      gsap.fromTo(cards,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.06,
          ease: 'power3.out', clearProps: 'opacity,y' }
      );
    }, cardsRef);
    return () => ctx.revert();
  }, [displayRestaurants, isLoggedIn]);

  useEffect(() => {
    if (!mounted || isLoggedIn) return;
    const container = canvasContainerRef.current;
    if (!container) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 8);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    const uniforms = { u_time: { value: 0 }, u_intensity: { value: 0.25 }, u_noiseScale: { value: 1.5 }, u_noiseSpeed: { value: 0.8 } };
    const material = new THREE.ShaderMaterial({ vertexShader: vertexShaderLogin, fragmentShader: fragmentShaderLogin, uniforms, transparent: true });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(2, 64, 64), material);
    mesh.position.set(0, 0, -1); mesh.scale.setScalar(2.4); scene.add(mesh);
    const mouse = { x: 0, y: 0 };
    const targetPos = new THREE.Vector3(0, 0, -1);
    const currentPos = new THREE.Vector3(0, 0, -1);
    const onMouseMove = (e) => { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -(e.clientY / window.innerHeight) * 2 + 1; };
    window.addEventListener('mousemove', onMouseMove);
    const onResize = () => { if (!container) return; camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight); };
    window.addEventListener('resize', onResize);
    let rafId; const clock = new THREE.Clock();
    const animate = () => { const e = clock.getElapsedTime(); uniforms.u_time.value = 0.25 * e; uniforms.u_noiseScale.value = Math.sin(e * 0.1) * 0.5 + 1.2; targetPos.set(mouse.x * 1.2, mouse.y * 1.2, -1); currentPos.lerp(targetPos, 0.05); mesh.position.copy(currentPos); renderer.render(scene, camera); rafId = requestAnimationFrame(animate); };
    animate();
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('resize', onResize); cancelAnimationFrame(rafId); if (container && renderer.domElement) container.removeChild(renderer.domElement); material.dispose(); renderer.dispose(); };
  }, [mounted, isLoggedIn]);

  // ── Place autocomplete ────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    const fetchPlaces = async () => {
      if (!newRestName.trim() || !isTypingName) { setNameSuggestions([]); return; }
      setIsSearchingPlaces(true);
      try {
        let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(newRestName)}&format=json&addressdetails=1&limit=5&countrycodes=tw`;
        if (userLocation) { const d = 0.05; url += `&viewbox=${userLocation.lng-d},${userLocation.lat+d},${userLocation.lng+d},${userLocation.lat-d}&bounded=0`; }
        const res = await fetch(url, { headers: { 'Accept-Language': 'zh-TW,zh;q=0.9' }, signal: controller.signal });
        setNameSuggestions(await res.json() || []);
      } catch (err) { if (err.name !== "AbortError") console.error(err); }
      finally { if (!controller.signal.aborted) setIsSearchingPlaces(false); }
    };
    const t = setTimeout(fetchPlaces, 800);
    return () => { clearTimeout(t); controller.abort(); };
  }, [newRestName, isTypingName, userLocation]);

  const handleSelectSuggestion = (place) => {
    const name = place.name || place.display_name.split(',')[0].trim();
    setNewRestName(name); setNewRestAddress(place.display_name || "");
    setNewRestCategory(getSmartTag(name, place.type === "cafe" ? "咖啡廳" : "餐廳"));
    setIsTypingName(false); setNameSuggestions([]);
  };

  // ── Duplicate check ───────────────────────────────────────────────────────
  const isDuplicate = (name) => {
    if (!name) return false;
    const t = name.replace(/\s+/g, "").toLowerCase();
    return restaurants.some(r => r.name && r.name.replace(/\s+/g, "").toLowerCase() === t);
  };

  // ── Food actions ──────────────────────────────────────────────────────────
  const handleDeleteRestaurant = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', masterUid, 'restaurants', id));
      showToast("已從美食庫移除", "info");
    } catch (err) { console.error(err); }
  };

  const handleUpdateRestaurant = async (id, fields) => {
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'users', masterUid, 'restaurants', id), fields);
    } catch (err) {
      console.error(err);
      showToast("更新失敗，請稍後再試", "error");
      throw err;
    }
  };

  const saveRecommendation = async (rec) => {
    if (isDuplicate(rec.name)) { showToast(`⚠️ ${rec.name} 已在您的口袋名單中！`, "error"); return; }
    setAnimatingRecId(rec.id);
    if (navigator.vibrate) navigator.vibrate(40);
    showToast("✨ 正在收藏並撰寫專屬 AI 短評...", "info");
    let savedDocId = null;
    try {
      const docRef = await addDoc(collection(db, 'artifacts', APP_ID, 'users', masterUid, 'restaurants'), { name: rec.name, address: rec.address, category: getSmartTag(rec.name, rec.category), note: "✨ Fabrica AI 正在為您撰寫專屬短評中，請稍候...", recommendedBy: "系統探索", savedAt: serverTimestamp() });
      savedDocId = docRef.id;
    } catch (err) { console.error(err); }
    dismissRec(rec.id); setAnimatingRecId(null);
    generateAIReview(rec.name, rec.address).then(async (aiNote) => {
      if (savedDocId) { try { await updateDoc(doc(db, 'artifacts', APP_ID, 'users', masterUid, 'restaurants', savedDocId), { note: aiNote || rec.note }); } catch {} }
      showToast(`🎉 AI 已為 ${rec.name} 寫好美味筆記！`, "success");
    });
  };

  const handleImport = async (e) => {
    e.preventDefault();
    const rawText = importText.trim();
    if (!rawText) { showToast("請貼上 Threads 文字、心得或連結。", "error"); return; }
    setIsImportingThread(true);
    try {
      const res = await fetch('/api/analyze-food', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: rawText }) });
      const result = await res.json();
      if (!res.ok) {
        if (result.urlOnly) {
          showToast("貼連結無法自動取得內容，請同時貼上貼文文字。", "error");
        } else {
          throw new Error(result.error || 'Import failed');
        }
        return;
      }

      // data is now an ARRAY of restaurants
      const list = Array.isArray(result.data) ? result.data : [result.data];
      const sourceUrl = rawText.match(/https?:\/\/\S+/)?.[0] || "";
      const sourceAuthor = extractThreadsAuthor(sourceUrl);

      let savedCount = 0;
      let skipped = 0;
      for (const ai of list) {
        if (!ai?.name) continue;
        if (isDuplicate(ai.name)) { skipped++; continue; }
        await addDoc(collection(db, 'artifacts', APP_ID, 'users', masterUid, 'restaurants'), {
          name: ai.name || "待確認美食",
          address: ai.address || "",
          areaHint: ai.areaHint || "",
          category: ai.category || "美食收藏",
          note: ai.aiNote || "已從 Threads 貼文匯入，等待補充店家資訊。",
          latitude: ai.latitude || "",
          longitude: ai.longitude || "",
          confidence: Math.max(0, Math.min(1, Number(ai.confidence || 0))),
          placeStatus: ai.placeStatus || (ai.address ? "needs_review" : "unverified"),
          source: "manual_threads_import",
          sourceText: rawText.slice(0, 500),
          threadsUrl: sourceUrl,
          sourceAuthor,
          recommendedBy: sourceAuthor || threadsUsername.replace("@", "") || "google-user",
          savedAt: serverTimestamp(),
        });
        savedCount++;
      }

      setImportText(""); setShowImportModal(false);
      if (savedCount > 0) {
        showToast(`🎉 已匯入 ${savedCount} 家餐廳${skipped > 0 ? `（${skipped} 家已存在）` : ''}！`, "success");
      } else if (skipped > 0) {
        showToast(`⚠️ 這 ${skipped} 家都已在您的名單中。`, "error");
      } else {
        showToast("找不到可匯入的餐廳。", "error");
      }
    } catch (err) { console.error(err); showToast("匯入失敗，請稍後再試。", "error"); }
    finally { setIsImportingThread(false); }
  };

  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    if (!newRestName?.trim()) { showToast("⚠️ 請先輸入店名！", "error"); return; }
    if (isDuplicate(newRestName)) { showToast(`⚠️ ${newRestName} 已在您的口袋名單中！`, "error"); return; }
    setShowAddModal(false);
    showToast("✨ 正在收藏並撰寫專屬 AI 短評...", "info");
    let savedDocId = null;
    try {
      const docRef = await addDoc(collection(db, 'artifacts', APP_ID, 'users', masterUid, 'restaurants'), { name: newRestName, address: newRestAddress || "僅提供店名定位", category: getSmartTag(newRestName, newRestCategory), note: "✨ Fabrica AI 正在為您撰寫專屬短評中，請稍候...", recommendedBy: newRestRecommender.replace("@", "").trim(), savedAt: serverTimestamp() });
      savedDocId = docRef.id;
    } catch (err) { console.error(err); }
    const tempName = newRestName; const tempAddress = newRestAddress;
    setNewRestName(""); setNewRestAddress(""); setNewRestCategory(""); setNewRestRecommender(""); setNewRestNote("");
    generateAIReview(tempName, tempAddress).then(async (aiNote) => {
      if (savedDocId) { try { await updateDoc(doc(db, 'artifacts', APP_ID, 'users', masterUid, 'restaurants', savedDocId), { note: aiNote || "暫無 AI 分析結果。" }); } catch {} }
      showToast(`🎉 AI 已為 ${tempName} 寫好美味筆記！`, "success");
    });
  };

  const handleShare = async (restaurant) => {
    const url = new URL(window.location.href);
    url.searchParams.set('share_name', restaurant.name || ''); url.searchParams.set('share_address', restaurant.address || ''); url.searchParams.set('share_note', restaurant.note || ''); url.searchParams.set('share_by', restaurant.recommendedBy || threadsUsername.replace('@', ''));
    const shareText = `這家感覺不錯！📍 ${restaurant.name}\n🏠 ${restaurant.address}\n✨ ${restaurant.note}\n\n— 來自 Fabrica Foodie`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Fabrica Foodie 推薦', text: shareText, url: url.toString() }); }
      else { await navigator.clipboard.writeText(`${shareText}\n${url.toString()}`); showToast("專屬連結已複製到剪貼簿！", "success"); }
    } catch {}
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const categories = useMemo(() => ["全部", ...new Set(restaurants.map(r => getSmartTag(r.name, r.category).split(" • ")[0]))], [restaurants]);
  const filteredRestaurants = useMemo(() => restaurants.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchSearch = (r.name || "").toLowerCase().includes(q) || (r.address || "").toLowerCase().includes(q) || (r.note || "").toLowerCase().includes(q) || (r.recommendedBy || "").toLowerCase().includes(q.replace("@", ""));
    const matchCat = selectedCategory === "全部" || getSmartTag(r.name, r.category).startsWith(selectedCategory);
    return matchSearch && matchCat;
  }), [restaurants, searchQuery, selectedCategory]);
  useEffect(() => { setDisplayRestaurants(filteredRestaurants); }, [filteredRestaurants]);

  // ─────────────────────────────────────────────────────────────────────────
  if (!mounted) return (
    <div style={{ minHeight:'100vh', background:'#F2F2F7', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:36, height:36, border:'2px solid #1D1D1F', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div className="relative min-h-screen text-[#1D1D1F] tracking-tight font-sans antialiased overflow-x-hidden overflow-y-scroll bg-[#F4F4F6] touch-manipulation">
      <GlobalStyles />

      {/* Backgrounds */}
      {(isLoggedIn || isGlobalTransitioning) && (
        <BlurVignette blur="0px" vignetteOpacity={0.5} className="fixed inset-0 z-0 pointer-events-none opacity-100">
          <ColorfulBackground show={true} />
        </BlurVignette>
      )}
      {!isLoggedIn && (
        <div ref={canvasContainerRef} className={`fixed inset-0 z-0 w-screen h-screen pointer-events-auto transition-opacity duration-1000 ${isGlobalTransitioning ? 'opacity-0 invisible' : 'opacity-100 visible'}`} />
      )}

      {/* Global loader */}
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/40 backdrop-blur-3xl transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isGlobalTransitioning ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        <GooeyLoader />
      </div>

      <div className={`relative z-10 w-full min-h-screen flex flex-col ${!isLoggedIn ? 'items-center justify-center' : 'items-center'}`}>

        {/* ── LOGIN ── */}
        {!isLoggedIn ? (
          <LoginPage
            loginStep={loginStep}
            inputUsername={inputUsername}
            setInputUsername={setInputUsername}
            loginError={loginError}
            verificationCode={verificationCode}
            isGoogleAuthPending={isGoogleAuthPending}
            isGlobalTransitioning={isGlobalTransitioning}
            onGenerateCode={handleGenerateCode}
            onVerifyCrawler={handleVerifyCrawler}
            onResetLogin={handleResetLogin}
            onGoogleSignIn={handleGoogleSignIn}
          />

        ) : (
          /* ── MAIN APP ── */
          <div className="w-full min-h-screen flex flex-col items-center">

            {/* Header */}
            <header ref={headerRef} className="w-full sticky top-0 z-40 bg-white/40 backdrop-blur-2xl border-b border-white/30 px-6 py-4 shadow-[0_4px_30px_rgba(0,0,0,0.05)] flex justify-center transition-all duration-300">
              <div className="w-full max-w-6xl flex justify-between items-center gap-3">
                <div className="flex flex-col animate-bounce-in min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold tracking-wider text-[#555] uppercase">FABRICA MAPS</span>
                    <span className="inline-flex items-center text-[9px] font-semibold text-[#34C759] bg-[#34C759]/20 px-2 py-0.5 rounded-md">
                      <span className="w-1 h-1 bg-[#34C759] rounded-full mr-1 animate-pulse-badge"/>雲端連線
                    </span>
                    {/* Bind button */}
                    {!isThreadsBound && firebaseUser && !firebaseUser.uid.startsWith("threads_") && (
                      <AppleButton onClick={() => setShowBindModal(true)}
                        className="inline-flex items-center text-[9px] font-semibold text-[#FF9500] bg-[#FF9500]/15 px-2 py-0.5 rounded-md gap-1 hover:bg-[#FF9500]/25 transition-all duration-300">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                        綁定 Threads
                      </AppleButton>
                    )}
                    {isThreadsBound && (
                      <span className="inline-flex items-center text-[9px] font-semibold text-[#007AFF] bg-[#007AFF]/15 px-2 py-0.5 rounded-md gap-1 animate-fade-in">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                        Threads 已綁定
                      </span>
                    )}
                  </div>
                  <h1 className="text-lg font-bold tracking-tight text-black mt-0.5 truncate">{threadsUsername}</h1>
                </div>
                <div className="flex items-center gap-2">
                  <AppleButton onClick={() => setShowMap(true)}
                    className="flex-shrink-0 text-xs font-semibold text-[#555] hover:text-black bg-white/40 backdrop-blur-md border border-white/50 px-3 py-1.5 rounded-full shadow-sm transition-all duration-300 hover:bg-white/70 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                    地圖
                  </AppleButton>
                  <AppleButton onClick={handleLogout}
                    className="flex-shrink-0 text-xs font-semibold text-[#555] hover:text-black bg-white/40 backdrop-blur-md border border-white/50 px-3.5 py-1.5 rounded-full shadow-sm transition-all duration-300 hover:bg-white/70">
                    登出
                  </AppleButton>
                </div>
              </div>
            </header>

            <main ref={mainRef} className="w-full max-w-6xl px-4 lg:px-8 mt-6 relative z-10">

              {/* ── Desktop: 2-col layout ── */}
              <div className="flex flex-col lg:flex-row lg:gap-8 lg:items-start">

                {/* ── Sidebar (desktop only) ── */}
                <aside ref={sidebarRef} className="hidden lg:flex flex-col gap-4 w-72 flex-shrink-0 sticky top-24">
                  {/* Actions */}
                  <div className="flex flex-col gap-3">
                    <LiquidGlassCard onClick={() => setShowAddModal(true)} className="py-4 text-sm font-bold text-[#1D1D1F] flex items-center justify-center gap-2 bg-white/30">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                      手動新增
                    </LiquidGlassCard>
                    <LiquidGlassCard onClick={() => setShowImportModal(true)} className="py-4 text-sm font-bold text-white flex items-center justify-center gap-2 bg-[#E8821A] border-[#E8821A]/40 backdrop-blur-none">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      Threads 匯入
                    </LiquidGlassCard>
                  </div>

                  {/* Search */}
                  <div className="relative flex items-center w-full group">
                    <svg className="w-4 h-4 text-[#86868B] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
                    <input type="text" placeholder="搜尋餐廳..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white/60 backdrop-blur-xl text-sm font-medium rounded-2xl py-3 pl-10 pr-4 border border-white/50 focus:bg-white/90 focus:ring-2 focus:ring-black/10 outline-none transition-all duration-300 shadow-sm placeholder-[#86868B]"/>
                  </div>

                  {/* Category filter */}
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] px-1">分類</p>
                    {categories.map(cat => (
                      <LiquidGlassCard key={cat} onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 text-left ${selectedCategory === cat ? 'bg-[#E8821A] text-white shadow-md border-transparent' : 'bg-white/40 text-[#555] border-white/45'}`}>
                        {cat}
                      </LiquidGlassCard>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="bg-white/40 backdrop-blur-xl rounded-2xl border border-white/50 p-4 mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] mb-3">收藏統計</p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[#555] font-medium">總收藏</span>
                        <span className="text-sm font-bold text-black">{restaurants.length} 間</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[#555] font-medium">已篩選</span>
                        <span className="text-sm font-bold text-black">{displayRestaurants.length} 間</span>
                      </div>
                    </div>
                  </div>
                </aside>

                {/* ── Main content ── */}
                <div className="flex-1 min-w-0 space-y-6">

              {/* Mobile: Action buttons */}
              <div className="grid grid-cols-2 gap-3 lg:hidden">
                <LiquidGlassCard onClick={() => setShowAddModal(true)} className="py-4 text-sm font-bold text-[#1D1D1F] flex items-center justify-center gap-2 bg-white/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                  手動新增
                </LiquidGlassCard>
                <LiquidGlassCard onClick={() => setShowImportModal(true)} className="py-4 text-sm font-bold text-white flex items-center justify-center gap-2 bg-[#E8821A] border-[#E8821A]/40 backdrop-blur-none">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  Threads 匯入
                </LiquidGlassCard>
              </div>

              {/* Mobile: Search + filter */}
              <section className="space-y-4 lg:hidden">
                <div className="relative flex items-center w-full group">
                  <svg className="w-4 h-4 text-[#86868B] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
                  <input type="text" placeholder="搜尋餐廳、地址或推薦人..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/60 backdrop-blur-xl text-sm font-medium rounded-2xl py-3 pl-10 pr-4 border border-white/50 focus:bg-white/90 focus:ring-2 focus:ring-black/10 outline-none transition-all duration-300 shadow-sm placeholder-[#86868B]"/>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                  {categories.map(cat => (
                    <LiquidGlassCard key={cat} onClick={() => setSelectedCategory(cat)}
                      className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${selectedCategory === cat ? 'bg-[#E8821A] text-white shadow-md border-transparent scale-[1.05]' : 'bg-white/40 text-[#555] border-white/45'}`}>
                      {cat}
                    </LiquidGlassCard>
                  ))}
                  <div className="w-2 flex-shrink-0"/>
                </div>
              </section>

              {/* Nearby */}
              {activeRecommendations.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-[13px] font-bold text-[#555] uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    附近探索與精選名店
                  </h2>
                  <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                    {activeRecommendations.map(rec => (
                      <RecommendationCard key={rec.id} rec={rec} animatingRecId={animatingRecId} onDismiss={dismissRec} onSave={saveRecommendation} />
                    ))}
                    <div className="w-6 flex-shrink-0"/>
                  </div>
                </section>
              )}

              {/* Restaurant list */}
              <section className="pb-10">
                {isLoading ? (
                  <div className="text-center py-10"><div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto opacity-50"/></div>
                ) : displayRestaurants.length > 0 ? (
                  <div ref={cardsRef} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {displayRestaurants.map((restaurant, index) => (
                      <RestaurantCard
                        key={restaurant.id}
                        restaurant={restaurant}
                        index={index}
                        draggingId={draggingId}
                        dragState={dragState}
                        onPointerDown={handlePointerDown}
                        onDelete={handleDeleteRestaurant}
                        onShare={handleShare}
                        onUpdate={handleUpdateRestaurant}
                        onSelect={setSelectedRestaurant}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 px-4 bg-white rounded-[24px] border border-[#E5E5EA] animate-fade-in">
                    <div className="w-16 h-16 bg-neutral-100 rounded-full mx-auto flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                    </div>
                    <h3 className="text-neutral-900 font-bold mb-1">找不到相關餐廳</h3>
                    <p className="text-sm text-neutral-500 font-medium">嘗試不同的搜尋關鍵字或分類</p>
                  </div>
                )}
              </section>

              <footer className="text-center text-xs text-[#86868B]/60 pt-8 pb-4 mix-blend-overlay">
                <p className="font-black tracking-widest text-[11px] uppercase mb-1">FABRICA FOODIE</p>
                <p className="font-semibold">© Fabrica All Rights Reserved.</p>
              </footer>

                </div>{/* end main content */}
              </div>{/* end 2-col */}
            </main>
          </div>
        )}
      </div>

      {/* ── Import Modal ── */}
      <ModalSheet show={showImportModal} onClose={() => setShowImportModal(false)} disableClose={isImportingThread} zIndex={125}>
        <div className="p-6 sm:p-8">
          <div className="flex justify-between items-center mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B]">Threads Import</p>
              <h2 className="text-xl font-bold text-black tracking-tight">貼文匯入美食庫</h2>
            </div>
            <AppleButton disabled={isImportingThread} onClick={() => setShowImportModal(false)}
              className="w-8 h-8 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-full text-[#555] disabled:opacity-40">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </AppleButton>
          </div>
          <form onSubmit={handleImport} className="space-y-4">
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
              placeholder="貼上 Threads 貼文文字、心得、店名，或貼文連結。"
              className="w-full bg-black/5 text-sm font-bold rounded-xl py-3.5 px-4 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all min-h-[180px] resize-none shadow-inner"/>
            <AppleButton type="submit" dark disabled={isImportingThread} className="w-full h-14 bg-[#E8821A] text-white font-bold rounded-xl shadow-xl disabled:opacity-60">
              {isImportingThread
                ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>分析並匯入中...</span>
                : "分析並存進美食庫"}
            </AppleButton>
          </form>
        </div>
      </ModalSheet>

      {/* ── Add Modal ── */}
      <ModalSheet show={showAddModal} onClose={() => setShowAddModal(false)} zIndex={120}>
        <div className="p-6 sm:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-black tracking-tight">新增口袋名單</h2>
            <AppleButton onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-full text-[#555]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </AppleButton>
          </div>
          <form onSubmit={handleAddRestaurant} className="space-y-4">
            {/* Name with autocomplete */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#86868B] ml-1 uppercase tracking-wider">店名 *</label>
              <div className="relative w-full">
                <input type="text" placeholder="例如：詹記麻辣火鍋" value={newRestName}
                  onChange={(e) => { setNewRestName(e.target.value); setIsTypingName(true); }}
                  className="w-full bg-black/5 text-sm font-bold rounded-xl py-3.5 px-4 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all shadow-inner"/>
                {isTypingName && (nameSuggestions.length > 0 || isSearchingPlaces) && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-black/10 overflow-hidden z-50 max-h-48 overflow-y-auto animate-dropdown-in">
                    {isSearchingPlaces
                      ? <div className="p-3 text-xs text-center text-[#86868B] animate-pulse">搜尋地圖座標中...</div>
                      : nameSuggestions.map(place => (
                        <div key={place.place_id} onClick={() => handleSelectSuggestion(place)}
                          className="p-3 hover:bg-black/5 cursor-pointer border-b border-black/5 last:border-0 transition-all active:bg-black/10">
                          <div className="font-bold text-sm text-[#1D1D1F]">{place.name || place.display_name.split(',')[0]}</div>
                          <div className="text-[11px] text-[#86868B] mt-0.5 line-clamp-1 font-medium">{place.display_name}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#86868B] ml-1 uppercase tracking-wider">分類</label>
              <input type="text" placeholder="例如：日式甜點 • 咖啡廳" value={newRestCategory} onChange={(e) => setNewRestCategory(e.target.value)}
                className="w-full bg-black/5 text-sm font-bold rounded-xl py-3.5 px-4 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all shadow-inner"/>
            </div>
            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#86868B] ml-1 uppercase tracking-wider">地址或區域</label>
              <input type="text" placeholder="例如：台北市中山區" value={newRestAddress} onChange={(e) => setNewRestAddress(e.target.value)}
                className="w-full bg-black/5 text-sm font-bold rounded-xl py-3.5 px-4 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all shadow-inner"/>
            </div>
            {/* Recommender */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#86868B] ml-1 uppercase tracking-wider">推薦人</label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#86868B] group-focus-within:text-black transition-colors">@</span>
                <input type="text" placeholder="推薦人帳號" value={newRestRecommender} onChange={(e) => setNewRestRecommender(e.target.value)}
                  className="w-full bg-black/5 text-sm font-bold rounded-xl py-3.5 pl-9 pr-4 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all shadow-inner"/>
              </div>
            </div>
            {/* Note */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-[#86868B] uppercase tracking-wider ml-1">筆記與短評</label>
              <textarea placeholder="寫下你想記住的餐點或特色，或留白讓 AI 幫你總結..." value={newRestNote} onChange={(e) => setNewRestNote(e.target.value)}
                className="w-full bg-black/5 text-sm font-bold rounded-xl py-3.5 px-4 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all min-h-[100px] resize-none shadow-inner"/>
            </div>
            <AppleButton type="submit" dark className="w-full h-14 bg-black/90 text-white font-bold rounded-xl shadow-xl">
              儲存至地圖
            </AppleButton>
          </form>
        </div>
      </ModalSheet>

      {/* ── Bind Modal ── */}
      <BindModal
        show={showBindModal}
        firebaseUser={firebaseUser}
        onClose={(boundUsername) => {
          setShowBindModal(false);
          if (boundUsername) {
            setIsThreadsBound(true);
            setThreadsUsername(`@${boundUsername}`);
            showToast(`🎉 @${boundUsername} 已成功綁定！`, "success");
          }
        }}
      />

      {/* ── Restaurant detail modal ── */}
      {selectedRestaurant && !isGlobalTransitioning && (
        <RestaurantDetailModal restaurant={selectedRestaurant} onClose={() => setSelectedRestaurant(null)} />
      )}
     
      {/* ── Map View ── */}
      <MapView
        restaurants={restaurants}
        isOpen={showMap}
        onClose={() => setShowMap(false)}
        userLocation={userLocation}
      />

      {/* ── Toast ── */}
      <GyroPermissionButton isLoggedIn={isLoggedIn} /> <Toast message={toastMessage} type={toastType} />
    </div>
  );
}
