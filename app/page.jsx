"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  setDoc,
  serverTimestamp,
  doc,          
  deleteDoc     
} from 'firebase/firestore';
import * as THREE from 'three';

// --- 安全環境變數 ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "mock-key-for-build", 
  authDomain: "fabrica-foodie.firebaseapp.com",
  projectId: "fabrica-foodie",
  storageBucket: "fabrica-foodie.firebasestorage.app",
  messagingSenderId: "635499185101",
  appId: "1:635499185101:web:e5b4dcba1c57e782467a84",
  measurementId: "G-MPYBH4KBER"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'fabrica-foodie-app'; 
const FABRICA_THREADS_HANDLE = '@fabrica_tw';

const createVerificationCode = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `FAB-${num}`;
};

// ==========================================
// 🌟 3D 星空背景元件 (完整保留原創動態與渲染邏輯)
// ==========================================
function ThreeBackground() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0c, 0.015);

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const starsCount = 1800;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starsCount * 3);
    const colors = new Float32Array(starsCount * 3);

    const baseColor = new THREE.Color('#FF304F');
    const accentColor = new THREE.Color('#FF7B02');

    for (let i = 0; i < starsCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 120;
      positions[i + 1] = (Math.random() - 0.5) * 120;
      positions[i + 2] = (Math.random() - 0.5) * 120;

      const mixedColor = baseColor.clone().lerp(accentColor, Math.random());
      colors[i] = mixedColor.r;
      colors[i + 1] = mixedColor.g;
      colors[i + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const starField = new THREE.Points(geometry, material);
    scene.add(starField);

    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      starField.rotation.y = elapsedTime * 0.025;
      starField.rotation.x = elapsedTime * 0.012;

      const posArr = geometry.attributes.position.array;
      for (let i = 0; i < starsCount * 3; i += 3) {
        posArr[i + 1] -= 0.03;
        if (posArr[i + 1] < -60) {
          posArr[i + 1] = 60;
        }
      }
      geometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none" />;
}

// ==========================================
// 🌟 跑馬燈元件 (完整保留原創排版與橫向無限滾動)
// ==========================================
function MarqueeRow({ items, direction = 'up' }) {
  const doubledItems = useMemo(() => [...items, ...items, ...items, ...items], [items]);
  const animationClass = direction === 'up' ? 'animate-marquee-up' : 'animate-marquee-down';

  return (
    <div className="w-full overflow-hidden relative h-7 flex items-center bg-white/[0.02] border-y border-white/[0.04]">
      <div className={`flex whitespace-nowrap space-x-6 uppercase tracking-widest text-[10px] font-bold text-white/20 ${animationClass}`}>
        {doubledItems.map((item, idx) => (
          <span key={idx} className="flex items-center space-x-2">
            <span>{item}</span>
            <span className="inline-block w-1 h-1 rounded-full bg-[#FF304F]/40" />
          </span>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 🌟 主應用元件
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [authStep, setAuthStep] = useState('welcome'); // welcome -> threads_binding -> dashboard
  const [threadsUsername, setThreadsUsername] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // 爬蟲驗證狀態
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlerMessage, setCrawlerMessage] = useState('');

  // 美食清單資料流
  const [restaurants, setRestaurants] = useState([]);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [selectedRes, setSelectedRes] = useState(null);

  // 抽屜控制
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [newRes, setNewRes] = useState({ name: '', category: '咖啡', address: '', areaHint: '', note: '' });
  const [isSavingRes, setIsSavingRes] = useState(false);

  const categories = ['全部', '咖啡', '甜點', '火鍋', '拉麵', '小吃', '其他'];

  // 跑馬燈關鍵字庫
  const marqueeItems1 = useMemo(() => ['THREADS FOODIE ARCHIVE', 'AI EXTRACTION', '@FABRICA_TW', 'AUTOMATIC MAPS', 'TAIPEI CAFE', 'CURATED LISTS'], []);
  const marqueeItems2 = useMemo(() => ['TAIWAN BITES', 'GEMINI 2.5 FLASH', 'EXPLORE LOCAL', 'CURATE YOUR LIFE', 'POCKET LIBRARY', 'NEVER FORGET A PLACE'], []);

  // 監聽 Firebase 驗證狀態與回傳結果
  useEffect(() => {
    setIsAuthLoading(true);
    
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        setUser(result.user);
      }
    }).catch((err) => {
      console.error("Redirect Auth Error:", err);
    });

    let unsubscribeUser = () => {};
    let unsubscribeRes = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // 實時綁定使用者中介 Meta 資料夾
        const userDocRef = doc(db, 'artifacts', appId, 'users', firebaseUser.uid);
        unsubscribeUser = onSnapshot(userDocRef, (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.data();
            if (userData?.verified && userData?.threadsUsername) {
              setThreadsUsername(userData.threadsUsername);
              setAuthStep('dashboard');
            } else if (userData?.verificationCode) {
              setVerifyCode(userData.verificationCode);
              setAuthStep('threads_binding');
            } else {
              setAuthStep('threads_binding');
            }
          } else {
            setAuthStep('threads_binding');
          }
          setIsAuthLoading(false);
        }, (err) => {
          console.error(err);
          setIsAuthLoading(false);
        });

        // 實時綁定使用者的專屬口袋美食清單
        const resRef = collection(db, 'artifacts', appId, 'users', firebaseUser.uid, 'restaurants');
        unsubscribeRes = onSnapshot(resRef, (snapshot) => {
          const list = [];
          snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
          // 按時間由新到舊排序
          list.sort((a, b) => {
            const tA = a.savedAt?.seconds || 0;
            const tB = b.savedAt?.seconds || 0;
            return tB - tA;
          });
          setRestaurants(list);
        });

      } else {
        setUser(null);
        setAuthStep('welcome');
        setRestaurants([]);
        setIsAuthLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUser();
      unsubscribeRes();
    };
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithRedirect(auth, provider);
    } catch (err) {
      console.error(err);
      alert("無法發起 Google 登入，請檢查網路。");
    }
  };

  const handleLogout = async () => {
    if (confirm("確定要登出 Fabrica Foodie 嗎？")) {
      await signOut(auth);
    }
  };

  // ==========================================
  // 核心邏輯修正：生成驗證碼並寫入 (使用 setDoc 兼容全新用戶)
  // ==========================================
  const handleBindThreads = async () => {
    if (!threadsUsername.trim()) return;
    setIsVerifying(true);
    try {
      const cleanUsername = threadsUsername.replace('@', '').trim().toLowerCase();
      const code = createVerificationCode();
      
      // 使用 setDoc 與 merge: true 確保文件不存在時自動創建，免除無端錯誤
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), {
        verificationCode: code,
        threadsUsername: cleanUsername,
        verified: false,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setVerifyCode(code);
    } catch (err) {
      console.error(err);
      alert("綁定失敗，請重試");
    } finally {
      setIsVerifying(false);
    }
  };

  // ==========================================
  // 核心邏輯新增：呼叫後端自建小爬蟲進行手動即時核對
  // ==========================================
  const handleCrawlerVerify = async () => {
    if (isCrawling) return;
    setIsCrawling(true);
    setCrawlerMessage("🔍 小爬蟲正在前往您的 Threads 主頁巡邏中，請稍候...");

    try {
      const res = await fetch('/api/verify-crawler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          username: threadsUsername,
          expectedCode: verifyCode
        })
      });

      const data = await res.json();
      if (data.success) {
        setCrawlerMessage("🎉 驗證成功！正在為您開啟美食宇宙...");
        // 備註：此處免手動跳轉，上方 Firestore 的實時 onSnapshot 偵測到 verified 變更後會自動將畫面切入 dashboard
      } else {
        setCrawlerMessage(`❌ ${data.message}`);
      }
    } catch (err) {
      console.error(err);
      setCrawlerMessage("⚠️ 連線失敗，伺服器爬蟲模組異常，請稍後再試。");
    } finally {
      setIsCrawling(false);
    }
  };

  // 手動新增美食名單
  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    if (!newRes.name.trim()) return;
    setIsSavingRes(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'restaurants'), {
        ...newRes,
        confidence: 1.0,
        placeStatus: newRes.address ? 'needs_review' : 'unverified',
        source: 'manual',
        savedAt: serverTimestamp()
      });
      setNewRes({ name: '', category: '咖啡', address: '', areaHint: '', note: '' });
      setIsAddDrawerOpen(false);
    } catch (err) {
      console.error(err);
      alert("新增失敗");
    } finally {
      setIsSavingRes(false);
    }
  };

  // 刪除美食檔案
  const handleDeleteRestaurant = async (id, e) => {
    e.stopPropagation();
    if (!confirm("確定要刪除這筆美食收藏嗎？")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'restaurants', id));
      if (selectedRes?.id === id) setSelectedRes(null);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredRestaurants = useMemo(() => {
    if (activeCategory === '全部') return restaurants;
    return restaurants.filter(r => r.category === activeCategory);
  }, [restaurants, activeCategory]);

  // 全域 Loading 全螢幕讀取骨架屏
  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0C] flex flex-col items-center justify-center space-y-4 z-50">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-[#FF304F] border-r-[#FF7B02] rounded-full animate-spin" />
        </div>
        <p className="text-xs uppercase tracking-widest text-white/40 font-semibold animate-pulse">FABRICA FOODIE ENGINE INITIALIZING...</p>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-[#0A0A0C] text-[#F2F2F7] font-sans antialiased overflow-x-hidden selection:bg-[#FF304F]/30 selection:text-white">
      {/* 內嵌流線動態動畫 CSS */}
      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.2,0.8,0.2,1) forwards; }
        @keyframes fade-in-up { from { opacity: 0; transform: translate(-50%, 20px) scale(0.95); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
        .animate-fade-in-up { animation: fade-in-up 0.5s cubic-bezier(0.2,0.8,0.2,1) forwards; }
        @keyframes bounce-in { 0% { opacity: 0; transform: scale(0.9) translateY(10px); } 60% { opacity: 1; transform: scale(1.02) translateY(-2px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-bounce-in { animation: bounce-in 0.6s cubic-bezier(0.2,0.8,0.2,1) forwards; }
        
        @keyframes marquee-up { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        @keyframes marquee-down { 0% { transform: translateX(-50%); } 100% { transform: translateX(0%); } }
        .animate-marquee-up { animation: marquee-up 12s linear infinite; }
        .animate-marquee-down { animation: marquee-down 12s linear infinite; }
      `}</style>

      {/* 3D 渲染背景層 */}
      <ThreeBackground />

      {/* ==========================================
          第一階段：歡迎進入 (Google 登入牆)
          ========================================== */}
      {authStep === 'welcome' && (
        <div className="relative z-10 min-h-screen flex flex-col justify-between px-6 py-12 max-w-md mx-auto animate-fade-in">
          <div className="w-full space-y-2 pt-12">
            <div className="flex items-center space-x-2">
              <span className="h-[2px] w-8 bg-gradient-to-r from-[#FF304F] to-[#FF7B02]" />
              <span className="text-[10px] font-bold tracking-widest uppercase text-white/50 bg-white/5 px-2 py-0.5 rounded border border-white/10">BETA MVP</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">
              Fabrica<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF304F] to-[#FF7B02]">Foodie</span>
            </h1>
            <p className="text-xs text-white/60 font-medium tracking-wide leading-relaxed pt-2 max-w-[280px]">
              專屬於您的 Threads 美食情報庫。在 Threads 上標記 {FABRICA_THREADS_HANDLE}，AI 自動化為您淬煉出乾淨、無廣告的口袋美食清單。
            </p>
          </div>

          <div className="w-full space-y-8 pb-8">
            <div className="space-y-2">
              <MarqueeRow items={marqueeItems1} direction="up" />
              <MarqueeRow items={marqueeItems2} direction="down" />
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full bg-white text-[#0A0A0C] font-semibold text-sm tracking-wide py-4 px-6 rounded-2xl shadow-[0_4px_24px_rgba(255,255,255,0.12)] hover:bg-[#F2F2F7] active:scale-[0.99] transition-all duration-200 flex items-center justify-center space-x-3"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>使用 Google 帳號安全登入</span>
            </button>
            
            <p className="text-[10px] text-center text-white/30 tracking-wide">
              登入即代表您同意本應用的服務與隱私條款，我們絕不向第三方洩漏您的個人足跡。
            </p>
          </div>
        </div>
      )}

      {/* ==========================================
          第二階段：Threads 帳號綁定核對
          ========================================== */}
      {authStep === 'threads_binding' && (
        <div className="relative z-10 min-h-screen flex flex-col justify-center px-6 py-12 max-w-sm mx-auto animate-fade-in">
          <div className="w-full bg-white/[0.03] border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative">
            <div className="absolute -top-3 -right-3 bg-gradient-to-tr from-[#FF304F] to-[#FF7B02] text-[9px] font-black tracking-widest text-white px-2.5 py-1 rounded-full uppercase shadow-lg">
              SECURE BIND
            </div>

            {verifyCode ? (
              /* 已產生驗證碼：引導使用者進行手動爬蟲核對 */
              <div className="space-y-6 text-center animate-bounce-in">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-white tracking-wide">最後一步：發文驗證</h2>
                  <p className="text-xs text-white/60 leading-relaxed max-w-[280px] mx-auto">
                    請至您的 Threads 發佈一篇公開串文，內容必須包含標記我們的帳號與下方專屬代碼：
                  </p>
                </div>

                <div className="p-6 bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#FF304F] to-[#FF7B02]" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-white/40 block mb-1">您的專屬驗證內容</span>
                  <div className="text-sm font-medium text-white select-all break-all tracking-wide">
                    {FABRICA_THREADS_HANDLE} verify {verifyCode}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${FABRICA_THREADS_HANDLE} verify ${verifyCode}`);
                      alert("已複製驗證內容！");
                    }}
                    className="mt-3 text-[11px] text-[#FF7B02] hover:text-[#FF304F] font-medium transition-colors"
                  >
                    點擊複製完整內容 📋
                  </button>
                </div>

                {/* 🌟 核心變更：將原先等待 Webhook 的轉圈圈，更換為極富操作感的即時爬蟲驗證按鈕 */}
                <div className="space-y-4">
                  <button
                    onClick={handleCrawlerVerify}
                    disabled={isCrawling}
                    className={`w-full py-4 px-6 rounded-2xl font-medium tracking-wide transition-all duration-300 flex items-center justify-center space-x-2 ${
                      isCrawling 
                        ? 'bg-white/10 text-white/40 cursor-not-allowed'
                        : 'bg-gradient-to-r from-[#FF304F] to-[#FF7B02] text-white shadow-[0_4px_20px_rgba(255,48,79,0.3)] hover:shadow-[0_4px_30px_rgba(255,48,79,0.5)] hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    {isCrawling ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>小爬蟲前往巡邏中...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀 我已完成發文，立即核對驗證</span>
                      </>
                    )}
                  </button>

                  {crawlerMessage ? (
                    <div className={`text-xs p-3 rounded-xl border text-left leading-relaxed animate-fade-in ${
                      crawlerMessage.includes('❌') 
                        ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                        : crawlerMessage.includes('🎉')
                          ? 'bg-green-500/10 border-green-500/20 text-green-400'
                          : 'bg-white/5 border-white/10 text-white/70'
                    }`}>
                      {crawlerMessage}
                    </div>
                  ) : (
                    <p className="text-[11px] text-white/40 leading-relaxed max-w-[280px] mx-auto text-center">
                      💡 提示：Threads 的公開貼文大約需要 3-5 秒建立索引，發文完成後點擊按鈕，系統將自動至您的 Threads 檔案牆核對。
                    </p>
                  )}
                </div>

                <button
                  onClick={async () => {
                    if (confirm("確定要取消當前驗證並更換帳號嗎？")) {
                      setVerifyCode('');
                      setCrawlerMessage('');
                      try {
                        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid), {
                          verificationCode: null
                        });
                      } catch (e) {}
                    }
                  }}
                  className="text-[11px] text-white/40 hover:text-white/70 transition-colors uppercase tracking-wider block mx-auto pt-2"
                >
                  返回修改 Threads 帳號
                </button>
              </div>
            ) : (
              /* 未輸入帳號：填寫 Threads 帳號 */
              <div className="space-y-5 animate-fade-in">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white tracking-wide">連結 Threads 帳號</h2>
                  <p className="text-xs text-white/50 leading-relaxed">
                    請輸入您的 Threads ID 以利系統為您配對並解析專屬的美食收藏夾。
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-white/30">@</span>
                    <input
                      type="text"
                      placeholder="您的 Threads 使用者代號 (例如: food_lover)"
                      value={threadsUsername}
                      onChange={(e) => setThreadsUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-9 pr-4 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF7B02] focus:ring-1 focus:ring-[#FF7B02] transition-all"
                    />
                  </div>

                  <button
                    onClick={handleBindThreads}
                    disabled={isVerifying || !threadsUsername.trim()}
                    className="w-full bg-gradient-to-r from-[#FF304F] to-[#FF7B02] text-white font-semibold text-sm tracking-wide py-4 px-6 rounded-2xl hover:opacity-90 active:scale-[0.99] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center space-x-2"
                  >
                    {isVerifying ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>正在生成安全憑證...</span>
                      </>
                    ) : (
                      <span>下一步：獲取驗證代碼</span>
                    )}
                  </button>
                </div>

                <div className="h-[1px] bg-white/10 my-2" />
                <button 
                  onClick={() => signOut(auth)}
                  className="w-full text-center text-xs text-white/40 hover:text-white/60 transition-colors py-1"
                >
                  登出 Google 帳號
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          第三階段：美食大盤點主儀表板 (Dashboard Layout)
          ========================================== */}
      {authStep === 'dashboard' && (
        <div className="relative z-10 max-w-lg mx-auto px-5 py-8 min-h-screen flex flex-col justify-between animate-fade-in">
          {/* 上半部：頂部 Header 欄位 */}
          <div className="w-full">
            <header className="flex items-center justify-between pb-6 border-b border-white/[0.06]">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold tracking-widest text-[#FF7B02] uppercase bg-[#FF7B02]/10 px-2 py-0.5 rounded-md">LIVE REPOSITORY</span>
                <h1 className="text-xl font-black text-white uppercase tracking-tight flex items-center space-x-1.5">
                  <span>@{threadsUsername}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                </h1>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-white/60 hover:text-white"
                title="安全登出系統"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              </button>
            </header>

            {/* 數據看板統計數據總覽 */}
            <div className="grid grid-cols-2 gap-3 my-6">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col justify-between h-24 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#FF304F]/10 to-transparent rounded-bl-full pointer-events-none" />
                <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">口袋名單總數</span>
                <span className="text-3xl font-black text-white leading-none">{restaurants.length} <span className="text-xs font-normal text-white/40">間</span></span>
              </div>
              <div 
                onClick={() => setIsAddDrawerOpen(true)}
                className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-4 flex flex-col justify-between h-24 text-left hover:border-[#FF7B02]/40 transition-all cursor-pointer group relative"
              >
                <span className="text-[10px] font-bold tracking-widest text-[#FF7B02] uppercase group-hover:text-white transition-colors">QUICK ADD</span>
                <span className="text-sm font-semibold text-white/80 flex items-center space-x-1">
                  <span>手動新增收藏 ➔</span>
                </span>
              </div>
            </div>

            {/* 分類滑動過濾器 (不佔用滾動條) */}
            <div className="flex space-x-1.5 overflow-x-auto no-scrollbar pb-3 mb-4">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium tracking-wide whitespace-nowrap transition-all ${
                    activeCategory === cat
                      ? 'bg-white text-[#0A0A0C] font-semibold shadow-lg'
                      : 'bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 核心內容區：卡片列表清單 */}
            <div className="space-y-3 pb-24">
              {filteredRestaurants.length === 0 ? (
                <div className="text-center py-16 bg-white/[0.01] border border-dashed border-white/10 rounded-2xl p-6">
                  <p className="text-sm text-white/40 font-medium">當前分類無任何收藏美食</p>
                  <p className="text-xs text-white/20 mt-1">在 Threads 標記 {FABRICA_THREADS_HANDLE}，或點擊上方手動新增。</p>
                </div>
              ) : (
                filteredRestaurants.map((res) => (
                  <div
                    key={res.id}
                    onClick={() => setSelectedRes(res)}
                    className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 hover:border-white/20 hover:bg-white/[0.05] active:scale-[0.99] transition-all duration-200 cursor-pointer flex justify-between items-start group relative overflow-hidden"
                  >
                    {/* 信心指數彩色左側邊條 */}
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#FF304F] to-[#FF7B02]" />

                    <div className="space-y-1.5 pl-2 pr-4 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-1.5 py-0.5 bg-white/5 rounded border border-white/5">
                          {res.category || '未分類'}
                        </span>
                        {res.areaHint && (
                          <span className="text-[10px] font-medium text-white/50 flex items-center">
                            📍 {res.areaHint}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-white tracking-tight group-hover:text-[#FF7B02] transition-colors line-clamp-1">
                        {res.name}
                      </h3>
                      {res.note && (
                        <p className="text-xs text-white/50 line-clamp-1 leading-relaxed font-light">
                          {res.note}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={(e) => handleDeleteRestaurant(res.id, e)}
                      className="p-2 text-white/20 hover:text-[#FF304F] transition-colors rounded-xl hover:bg-white/5 opacity-0 group-hover:opacity-100"
                      title="移除此筆收藏"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 頁尾版權告示 */}
          <footer className="w-full text-center py-4 border-t border-white/[0.04]">
            <p className="text-[10px] text-white/20 tracking-widest uppercase font-bold">FABRICA FOODIE ENGINE © 2026</p>
          </footer>
        </div>
      )}

      {/* ==========================================
          側欄抽屜 A：手動新增美食表單彈窗 (Add Drawer)
          ========================================== */}
      {isAddDrawerOpen && (
        <div className="fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-[#0A0A0C]/80 backdrop-blur-sm" onClick={() => setIsAddDrawerOpen(false)} />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-[#121216] border-t border-white/10 rounded-t-3xl p-6 shadow-2xl animate-fade-in-up">
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" onClick={() => setIsAddDrawerOpen(false)} />
            
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-black text-white uppercase tracking-tight">手動建立美食索引檔案</h2>
              <button onClick={() => setIsAddDrawerOpen(false)} className="text-xs text-white/40 hover:text-white">關閉</button>
            </div>

            <form onSubmit={handleAddRestaurant} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">美食店家名稱 *</label>
                <input
                  type="text"
                  required
                  placeholder="例如：熱情咖啡小館"
                  value={newRes.name}
                  onChange={(e) => setNewRes({...newRes, name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#FF7B02]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">主分類</label>
                  <select
                    value={newRes.category}
                    onChange={(e) => setNewRes({...newRes, category: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3 text-sm text-white focus:outline-none focus:border-[#FF7B02] appearance-none"
                  >
                    {categories.filter(c => c !== '全部').map(c => (
                      <option key={c} value={c} className="bg-[#121216]">{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">概略地區</label>
                  <input
                    type="text"
                    placeholder="例如：台北大安"
                    value={newRes.areaHint}
                    onChange={(e) => setNewRes({...newRes, areaHint: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#FF7B02]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">明確詳細地址</label>
                <input
                  type="text"
                  placeholder="選填，地址完整會為您產生地圖連結"
                  value={newRes.address}
                  onChange={(e) => setNewRes({...newRes, address: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#FF7B02]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">隨手心得筆記</label>
                <textarea
                  placeholder="50字以內推薦理由..."
                  rows="2"
                  value={newRes.note}
                  onChange={(e) => setNewRes({...newRes, note: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#FF7B02] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingRes}
                className="w-full bg-gradient-to-r from-[#FF304F] to-[#FF7B02] text-white font-semibold text-sm py-3.5 rounded-xl hover:opacity-90 transition-opacity mt-2"
              >
                {isSavingRes ? '正在歸檔建立中...' : '確認新增至口袋檔案庫 ✨'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          側欄抽屜 B：美食精細詳情閱覽 (Detail Slide Modal)
          ========================================== */}
      {selectedRes && (
        <div className="fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-[#0A0A0C]/80 backdrop-blur-sm" onClick={() => setSelectedRes(null)} />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-[#121216] border-t border-white/10 rounded-t-3xl p-6 shadow-2xl animate-fade-in-up">
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" onClick={() => setSelectedRes(null)} />

            <div className="space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF7B02] px-2 py-0.5 bg-[#FF7B02]/10 rounded border border-[#FF7B02]/20">
                    {selectedRes.category}
                  </span>
                  <span className="text-[10px] font-medium text-white/40">
                    來源管道：{selectedRes.source === 'manual' ? '手動建立' : `Threads (@${selectedRes.recommendedBy || threadsUsername})`}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">{selectedRes.name}</h2>
              </div>

              {/* 核心描述區塊 */}
              <div className="space-y-3 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold tracking-widest text-white/30 uppercase block">AI 淬煉推薦摘錄</span>
                  <p className="text-sm text-white/80 leading-relaxed font-light">{selectedRes.note || '無填寫心得筆記。'}</p>
                </div>
                
                {selectedRes.address && (
                  <div className="pt-2 border-t border-white/[0.04] space-y-1">
                    <span className="text-[9px] font-bold tracking-widest text-white/30 uppercase block">精確位置</span>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedRes.name + ' ' + selectedRes.address)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-[#FF7B02] hover:underline flex items-center space-x-1"
                    >
                      <span>📍 {selectedRes.address}</span>
                      <span className="text-[10px] text-white/30">外部地圖 ↗</span>
                    </a>
                  </div>
                )}
              </div>

              {/* 多維度擴充資料卡片 */}
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[8px] font-bold text-white/30 uppercase block">招牌必點項目</span>
                  <span className="text-xs font-semibold text-white/70 mt-0.5 block">經典招牌特調 / 焦糖脆脆</span>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[8px] font-bold text-white/30 uppercase block">近期優惠活動</span>
                  <span className="text-xs font-semibold text-white/70 mt-0.5 block">平日外帶現折 $20</span>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[8px] font-bold text-white/30 uppercase block">社群口碑總結</span>
                  <span className="text-xs font-semibold text-green-400 mt-0.5 block">高評價 · 氣氛悠閒 (4.6★)</span>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[8px] font-bold text-white/30 uppercase block">建議營業時間</span>
                  <span className="text-xs font-semibold text-white/70 mt-0.5 block">11:00 - 19:00 (週二休)</span>
                </div>
              </div>

              {/* 如果是從 Threads 發掘的，附帶原生外部連結 */}
              {selectedRes.threadsUrl && (
                <a
                  href={selectedRes.threadsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-medium text-center text-white/70 hover:text-white hover:bg-white/10 transition-all block"
                >
                  前往 Threads 檢視原始討論串 ↗
                </a>
              )}

              <button
                onClick={() => setSelectedRes(null)}
                className="w-full py-3.5 bg-white text-[#0A0A0C] font-semibold text-xs tracking-wider rounded-xl hover:bg-[#F2F2F7] transition-colors uppercase"
              >
                返回口袋大盤點
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
