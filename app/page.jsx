"use client";

import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';

// --- 安全升級：使用最嚴格的 try-catch 動態防禦，徹底解決瀏覽器編譯時的 ReferenceError: process is not defined ---
let safeApiKey = "AIzaSyC4YdF_pAKyMFuQVDCau_g3fP9zsMTcOcE"; // 安全降級備用金鑰
try {
  if (typeof window !== 'undefined' && typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    safeApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  }
} catch (e) {
  // 靜默降級，防範部分 bundler 靜態解析失敗
}

const firebaseConfig = {
  apiKey: safeApiKey, 
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

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [threadsUsername, setThreadsUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [restaurants, setRestaurants] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [isLoading, setIsLoading] = useState(false);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRestName, setNewRestName] = useState("");
  const [newRestAddress, setNewRestAddress] = useState("");
  const [newRestCategory, setNewRestCategory] = useState("日式甜點 • 咖啡廳");
  const [newRestNote, setNewRestNote] = useState("");

  const [inputUsername, setInputUsername] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authError, setAuthError] = useState(null); 
  const [isSandbox, setIsSandbox] = useState(false); // 偵測是否為開發/沙盒測試環境

  // 環境偵測：採用極嚴格的顯性網址過濾，確保 Vercel 生產環境 (Production) 絕對不亮起黃色警告
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      // 只有在 localhost、127.0.0.1、或包含 usercontent.goog (Canvas 沙盒) 的網址下，才顯示提示
      const isSand = hostname.includes('usercontent.goog') || 
                     hostname.includes('localhost') || 
                     hostname.includes('127.0.0.1');
      setIsSandbox(isSand);
    }
  }, []);

  // Firebase 驗證 (RULE 3) - 增加錯誤捕捉與本地降級模擬
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Firebase Auth Error:", err);
        setAuthError(err.code || err.message);
        
        // 【降級防禦】如果 Firebase 匿名驗證尚未啟用，設定一個模擬 guest 使用者，確保網頁不卡死
        setFirebaseUser({ uid: "local-temp-guest", isAnonymous: true });
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
      }
    });
    return () => unsubscribe();
  }, []);

  // 實時數據監聽 (RULE 1 & RULE 2)
  useEffect(() => {
    if (!firebaseUser || !isLoggedIn || !threadsUsername) return;
    if (firebaseUser.uid === "local-temp-guest") return; 

    setIsLoading(true);
    
    const cleanUsername = threadsUsername.replace("@", "").trim().toLowerCase();
    const userRestaurantsRef = collection(db, 'artifacts', appId, 'users', cleanUsername, 'restaurants');

    const unsubscribe = onSnapshot(userRestaurantsRef, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      
      const sortedList = list.sort((a, b) => {
        const timeA = a.savedAt?.seconds ? a.savedAt.seconds : 0;
        const timeB = b.savedAt?.seconds ? b.savedAt.seconds : 0;
        return timeB - timeA;
      });

      setRestaurants(sortedList);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore loading error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseUser, isLoggedIn, threadsUsername]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!inputUsername.trim()) {
      setLoginError("請輸入您的 Threads ID");
      return;
    }
    
    let formatted = inputUsername.trim();
    if (!formatted.startsWith("@")) {
      formatted = "@" + formatted;
    }
    
    setThreadsUsername(formatted);
    setIsLoggedIn(true);
    setLoginError("");
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setThreadsUsername("");
    setInputUsername("");
    setRestaurants([]);
  };

  const getFreeMapEmbedUrl = (name, address) => {
    const hasValidAddress = address && address !== "僅提供店名定位" && address.trim() !== "";
    const queryText = hasValidAddress ? `${name} ${address}` : name;
    return `https://maps.google.com/maps?q=${encodeURIComponent(queryText)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  };

  const getFreeMapAppUrl = (name, address) => {
    const hasValidAddress = address && address !== "僅提供店名定位" && address.trim() !== "";
    const queryText = hasValidAddress ? `${name} ${address}` : name;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryText)}`;
  };

  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    if (!newRestName.trim()) return;

    if (firebaseUser?.uid === "local-temp-guest") {
      const mockDoc = {
        id: Math.random().toString(),
        name: newRestName,
        address: newRestAddress || "僅提供店名定位",
        category: newRestCategory,
        note: newRestNote || "手動快速儲存的口袋名單。",
        savedAt: { seconds: Math.floor(Date.now() / 1000) },
        threadsUrl: ""
      };
      setRestaurants(prev => [mockDoc, ...prev]);
      setNewRestName("");
      setNewRestAddress("");
      setNewRestNote("");
      setShowAddModal(false);
      return;
    }

    try {
      const cleanUsername = threadsUsername.replace("@", "").trim().toLowerCase();
      const userRestaurantsRef = collection(db, 'artifacts', appId, 'users', cleanUsername, 'restaurants');

      await addDoc(userRestaurantsRef, {
        name: newRestName,
        address: newRestAddress || "僅提供店名定位",
        category: newRestCategory,
        note: newRestNote || "手動快速儲存的口袋名單。",
        savedAt: serverTimestamp(),
        threadsUrl: ""
      });

      setNewRestName("");
      setNewRestAddress("");
      setNewRestNote("");
      setShowAddModal(false);
    } catch (err) {
      console.error("Error adding document to Firestore:", err);
    }
  };

  const categories = ["全部", ...new Set(restaurants.map(r => r.category ? r.category.split(" • ")[0] : "未分類"))];
  const filteredRestaurants = restaurants.filter(restaurant => {
    const name = restaurant.name || "";
    const address = restaurant.address || "";
    const note = restaurant.note || "";
    const category = restaurant.category || "";

    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          note.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "全部" || category.startsWith(selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-[#1D1D1F] tracking-tight selection:bg-[#0071E3]/20 selection:text-[#0071E3] font-sans antialiased">
      
      {!isLoggedIn ? (
        /* ==================== Apple ID 風格極簡極美登入頁 ==================== */
        <div className="min-h-screen flex flex-col justify-between px-6 py-10 max-w-sm mx-auto">
          
          {/* 上半部：品牌 Logo 與輸入區域組合（黃金比例居中） */}
          <div className="flex-1 flex flex-col justify-center space-y-10 py-8">
            <div className="text-center space-y-5">
              <div className="w-16 h-16 bg-black rounded-[20px] mx-auto flex items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.15)] transform hover:scale-105 transition-all duration-300">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <circle cx="12" cy="11" r="3" strokeWidth="1.5"/>
                </svg>
              </div>
              
              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold tracking-tight text-black">Foodie</h1>
                <p className="text-sm text-[#86868B] font-medium leading-relaxed max-w-xs mx-auto">
                  您的專屬美食足跡庫。<br />
                  在 Threads 提及 <span className="text-[#1D1D1F] font-semibold">@fabrica</span> 即可自動寫入。
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* ⚠️ 僅在 顯性沙盒環境 (isSandbox) 下，才顯示 Firebase 警告 */}
              {isSandbox && (authError === 'auth/configuration-not-found' || authError === 'auth/operation-not-allowed') && (
                <div className="bg-[#FF9500]/10 border border-[#FF9500]/25 rounded-2xl p-4 text-xs text-[#D97300] font-medium leading-relaxed flex items-start gap-2.5 animate-in fade-in slide-in-from-top-4 duration-300">
                  <span className="text-sm mt-0.5">⚠️</span>
                  <div>
                    <p className="font-bold text-[#C96300]">Firebase 匿名登入尚未啟用</p>
                    <p className="mt-1 opacity-90">
                      請前往 Firebase 控制台 ➔ <span className="font-semibold">Authentication</span> ➔ <span className="font-semibold">Sign-in method</span> 啟用「匿名 (Anonymous)」驗證。
                    </p>
                    <p className="mt-1.5 text-[10px] font-semibold underline opacity-80">已為您自動開啟「本地防禦降級模式」，您仍可登入並流暢測試功能！</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {/* 經過黃金比例校正、絕不重疊的精緻輸入框軌道 */}
                <div className="relative flex items-center w-full">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-base font-semibold text-[#86868B] select-none pointer-events-none">
                    @
                  </span>
                  <input 
                    type="text" 
                    placeholder="輸入您的 Threads 帳號" 
                    value={inputUsername}
                    onChange={(e) => setInputUsername(e.target.value.replace("@", ""))}
                    className="w-full bg-white text-base font-medium rounded-2xl py-4 pl-12 pr-5 border border-[#D2D2D7] focus:border-black focus:ring-1 focus:ring-black outline-none transition-all duration-200 placeholder-[#86868B]/70 shadow-[0_2px_8px_rgba(0,0,0,0.01)]"
                  />
                </div>
                {loginError && (
                  <p className="text-xs text-[#FF3B30] font-medium pl-3.5 flex items-center gap-1.5 animate-in fade-in duration-200">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    {loginError}
                  </p>
                )}
              </div>

              <button 
                type="submit"
                className="w-full bg-[#1D1D1F] hover:bg-black active:scale-[0.98] transition-all duration-200 text-white py-4 rounded-2xl font-semibold text-sm tracking-wide shadow-md"
              >
                進入美食檔案
              </button>
            </form>
          </div>

          {/* 下半部：品牌聲明 */}
          <footer className="text-center text-xs text-[#86868B] pt-4 border-t border-[#E5E5EA]/40">
            <p className="font-semibold text-black/30">© Fabrica</p>
          </footer>
        </div>
      ) : (
        /* ==================== Apple Premium 主檔案庫看板 ==================== */
        <div className="pb-32">
          {/* iOS 高端磨砂玻璃頂部導覽列 */}
          <header className="sticky top-0 z-40 bg-white/60 backdrop-blur-xl border-b border-[#E5E5EA] px-6 py-4">
            <div className="max-w-md mx-auto flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold tracking-wider text-[#86868B] uppercase">FABRICA MAPS</span>
                <h1 className="text-lg font-bold tracking-tight text-black mt-0.5">
                  {threadsUsername}
                </h1>
              </div>
              <button 
                onClick={handleLogout}
                className="text-xs font-semibold text-[#86868B] hover:text-black hover:bg-[#E8E8ED] bg-[#F5F5F7] px-3.5 py-1.5 rounded-full transition-all duration-200"
              >
                登出
              </button>
            </div>
          </header>

          <main className="max-w-md mx-auto px-4 mt-8 space-y-8">
            {/* 降級模式小提示（同樣限定僅在 isSandbox 啟用時才對開發者展示） */}
            {isSandbox && firebaseUser?.uid === "local-temp-guest" && (
              <div className="bg-[#FF9500]/10 border border-[#FF9500]/20 rounded-2xl p-4 text-xs text-[#D97300] font-medium leading-relaxed animate-in fade-in duration-300">
                📢 <span className="font-bold">目前處於本地預覽模式：</span>新增的餐廳足跡將暫存在本地記憶體中。若要啟用多裝置實時雲端同步與 Threads 機器人自動寫入，請記得在 Firebase Authentication 啟用「匿名登入 (Anonymous)」功能。
              </div>
            )}

            <section className="space-y-4">
              <div className="relative flex items-center w-full">
                {/* 絕對垂直置中且修正尺寸比例的標準放大鏡圖示 */}
                <svg className="w-5 h-5 text-[#86868B] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none select-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input 
                  type="text" 
                  placeholder="搜尋餐廳、分類或推薦..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white text-sm rounded-2xl py-3.5 pl-11 pr-4 border border-[#E5E5EA] shadow-[0_2px_12px_rgba(0,0,0,0.02)] focus:outline-none focus:border-[#86868B] placeholder-[#86868B] transition-all"
                />
              </div>

              {categories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                        selectedCategory === cat 
                          ? 'bg-black text-white shadow-sm' 
                          : 'bg-white text-[#1D1D1F] border border-[#E5E5EA] hover:bg-[#F5F5F7]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-8">
              {isLoading && firebaseUser?.uid !== "local-temp-guest" ? (
                <div className="text-center py-20 space-y-3">
                  <svg className="animate-spin h-5 w-5 text-black mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-xs text-[#86868B] font-semibold">正在讀取雲端美食資料庫...</p>
                </div>
              ) : filteredRestaurants.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-[28px] border border-[#E5E5EA] p-8 space-y-4 shadow-sm">
                  <div className="w-12 h-12 bg-[#F5F5F7] rounded-full flex items-center justify-center mx-auto text-[#86868B]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-black">您的專屬美食地圖尚未收集足跡</p>
                    <p className="text-xs text-[#86868B] max-w-[240px] mx-auto leading-relaxed">
                      請在下方手動新增，或者讓 @fabrica 機器人自動為您收集 Threads 串文！
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-black hover:bg-black/90 text-white px-4 py-2 rounded-full transition-all"
                  >
                    手動新增第一筆
                  </button>
                </div>
              ) : (
                filteredRestaurants.map((restaurant) => (
                  <div 
                    key={restaurant.id}
                    className="bg-white rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-[#E5E5EA]/80 overflow-hidden hover:shadow-[0_12px_40px_rgb(0,0,0,0.05)] hover:border-[#D2D2D7]/80 transition-all duration-300 transform hover:-translate-y-0.5"
                  >
                    <div className="p-6 pb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold tracking-wider text-[#86868B] bg-[#F5F5F7] px-2.5 py-1 rounded-md uppercase">
                          {restaurant.category || "美食 • 精選"}
                        </span>
                        {restaurant.savedAt && (
                          <span className="text-[10px] font-medium text-[#86868B]">
                            {restaurant.savedAt.seconds 
                              ? new Date(restaurant.savedAt.seconds * 1000).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })
                              : "剛剛"}
                          </span>
                        )}
                      </div>
                      
                      <h2 className="text-xl font-bold text-black mt-3 flex items-center justify-between tracking-tight">
                        {restaurant.name}
                        {restaurant.threadsUrl && (
                          <a 
                            href={restaurant.threadsUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-[#86868B] hover:text-black transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                            </svg>
                          </a>
                        )}
                      </h2>
                      
                      <p className="text-xs text-[#86868B] mt-2 flex items-center gap-1.5 font-medium">
                        <svg className="w-4 h-4 text-[#86868B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        {restaurant.address || "僅提供店名定位"}
                      </p>
                    </div>

                    <div className="mx-6 mb-5 p-4.5 bg-[#F5F5F7] rounded-2xl border border-[#E5E5EA]/40">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#86868B] uppercase tracking-wider mb-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 .364l-.707 .707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                        </svg>
                        Fabrica AI Insight
                      </div>
                      <p className="text-xs text-[#3A3A3C] leading-relaxed font-medium">
                        {restaurant.note}
                      </p>
                    </div>

                    <div className="w-full h-44 bg-[#E5E5EA] relative overflow-hidden border-t border-[#F2F2F7]">
                      <iframe
                        title={`Map for ${restaurant.name}`}
                        src={getFreeMapEmbedUrl(restaurant.name, restaurant.address)}
                        className="w-full h-full border-0 grayscale hover:grayscale-0 transition-all duration-500"
                        allowFullScreen=""
                        loading="lazy"
                      ></iframe>
                    </div>

                    <div className="p-4 bg-white border-t border-[#F2F2F7] flex gap-3">
                      <a 
                        href={getFreeMapAppUrl(restaurant.name, restaurant.address)}
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full py-3 text-center text-xs font-semibold text-black bg-[#F5F5F7] hover:bg-[#E8E8ED] active:scale-95 transition-all rounded-xl flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        </svg>
                        在地圖中開啟
                      </a>
                    </div>
                  </div>
                ))
              )}
            </section>
          </main>

          <div className="fixed bottom-6 left-0 right-0 z-40 flex justify-center pointer-events-none">
            <button 
              onClick={() => setShowAddModal(true)}
              className="pointer-events-auto bg-black hover:bg-black/90 active:scale-95 transition-all text-white font-semibold text-xs tracking-wide px-5 py-3 rounded-full flex items-center gap-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
              </svg>
              手動新增足跡
            </button>
          </div>

          <footer className="text-center mt-20 mb-8 text-[11px] text-[#86868B] space-y-1">
            <p className="font-semibold text-[#1D1D1F]">© Fabrica</p>
          </footer>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form 
            onSubmit={handleAddRestaurant}
            className="bg-white w-full max-w-sm rounded-[32px] p-6 space-y-5 shadow-2xl border border-[#E5E5EA] text-left animate-in zoom-in-95 slide-in-from-bottom-8 duration-300"
          >
            <div className="flex justify-between items-center pb-2 border-b border-[#F5F5F7]">
              <h3 className="text-base font-bold text-black tracking-tight">
                手動新增足跡
              </h3>
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#86868B] hover:text-black font-semibold rounded-full flex items-center justify-center text-xs transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-[#1D1D1F]">餐廳名稱 *</label>
                <input 
                  type="text" 
                  required
                  value={newRestName}
                  onChange={(e) => setNewRestName(e.target.value)}
                  placeholder="例如：熟成宇治"
                  className="w-full bg-[#F5F5F7] rounded-xl p-3 border-0 focus:ring-1 focus:ring-black outline-none font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#1D1D1F]">地址（選填）</label>
                <input 
                  type="text" 
                  value={newRestAddress}
                  onChange={(e) => setNewRestAddress(e.target.value)}
                  placeholder="例如：台北市大安區永康街4巷8號"
                  className="w-full bg-[#F5F5F7] rounded-xl p-3 border-0 focus:ring-1 focus:ring-black outline-none font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#1D1D1F]">餐飲分類</label>
                <select 
                  value={newRestCategory}
                  onChange={(e) => setNewRestCategory(e.target.value)}
                  className="w-full bg-[#F5F5F7] rounded-xl p-3 border-0 focus:ring-1 focus:ring-black outline-none font-semibold text-[#1D1D1F] appearance-none"
                >
                  <option value="日式甜點 • 咖啡廳">日式甜點 • 咖啡廳</option>
                  <option value="義式料理 • 自然酒">義式料理 • 自然酒</option>
                  <option value="台灣傳統 • 小吃">台灣傳統 • 小吃</option>
                  <option value="美味肉食 • 鍋物">美味肉食 • 鍋物</option>
                  <option value="異國料理 • 餐酒">異國料理 • 餐酒</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#1D1D1F]">美食短評</label>
                <textarea 
                  type="text"
                  value={newRestNote}
                  onChange={(e) => setNewRestNote(e.target.value)}
                  placeholder="輸入你對這家店的評價..."
                  className="w-full bg-[#F5F5F7] rounded-xl p-3 border-0 focus:ring-1 focus:ring-black outline-none h-16 resize-none font-medium"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full py-3.5 bg-black text-white text-xs font-semibold rounded-2xl hover:bg-black/90 active:scale-[0.98] transition-all"
            >
              同步儲存至個人地圖
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
