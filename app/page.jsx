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

// --- 安全升級：將 API Key 改由 Next.js 環境變數讀取，不再直接暴露於代碼中 ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, // 藉由 Vercel 在建置時安全注入
  authDomain: "fabrica-foodie.firebaseapp.com",
  projectId: "fabrica-foodie",
  storageBucket: "fabrica-foodie.firebasestorage.app",
  messagingSenderId: "635499185101",
  appId: "1:635499185101:web:e5b4dcba1c57e782467a84",
  measurementId: "G-MPYBH4KBER"
};

// 安全防禦：如果環境變數尚未載入完成，預先宣告空實例避免程式崩潰
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

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Firebase Auth Error:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser || !isLoggedIn || !threadsUsername) return;

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
    <div className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E] font-sans antialiased">
      {!isLoggedIn ? (
        <div className="min-h-screen flex flex-col justify-between px-6 py-12 max-w-md mx-auto">
          <div className="text-center pt-16 space-y-2">
            <span className="text-xs font-black tracking-widest text-[#007AFF] uppercase bg-[#007AFF]/10 px-3 py-1 rounded-full">
              @fabrica Tech Studio
            </span>
            <h1 className="text-4xl font-black tracking-tight text-black mt-4">Foodie</h1>
            <p className="text-sm text-[#8E8E93] leading-relaxed max-w-xs mx-auto">
              專屬於您的 Threads 美食收藏庫。在 Threads 標記 <span className="font-semibold text-black">@fabrica</span>，AI 將自動為您彙整地圖。
            </p>
          </div>

          <form onSubmit={handleLogin} className="bg-white rounded-3xl p-6 shadow-sm border border-[#E5E5EA] space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#8E8E93] block">輸入您的 Threads 帳號</label>
              <div className="relative">
                <span className="absolute left-4.5 top-3.5 text-base font-bold text-[#8E8E93]">@</span>
                <input 
                  type="text" 
                  placeholder="username" 
                  value={inputUsername}
                  onChange={(e) => setInputUsername(e.target.value.replace("@", ""))}
                  className="w-full bg-[#F2F2F7] text-base font-semibold rounded-2xl py-3.5 pl-9 pr-4 border-0 focus:ring-2 focus:ring-[#007AFF] placeholder-[#C7C7CC]"
                />
              </div>
              {loginError && <p className="text-xs text-[#FF3B30] font-semibold">{loginError}</p>}
            </div>

            <button 
              type="submit"
              className="w-full bg-[#007AFF] hover:bg-[#0066CC] active:scale-[0.98] transition-all text-white py-4 rounded-2xl font-bold text-sm tracking-wide shadow-md"
            >
              進入我的美食地圖
            </button>
          </form>

          <footer className="text-center text-xs text-[#C7C7CC] space-y-1">
            <p>© 2026 @fabrica Tech Studio</p>
            <p className="font-mono text-[10px]">Active Database Connected</p>
          </footer>
        </div>
      ) : (
        <div className="pb-24">
          <header className="sticky top-0 z-40 bg-[#F2F2F7]/85 backdrop-blur-lg border-b border-[#D1D1D6]/40 px-6 py-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold tracking-widest text-[#8E8E93] uppercase">收藏專區</span>
                <h1 className="text-xl font-black tracking-tight text-black">
                  {threadsUsername} 的美食檔案
                </h1>
              </div>
              <button 
                onClick={handleLogout}
                className="text-xs font-bold text-[#FF3B30] bg-[#FF3B30]/10 px-3 py-1.5 rounded-full active:scale-95 transition-all"
              >
                登出
              </button>
            </div>
          </header>

          <main className="max-w-md mx-auto px-4 mt-6 space-y-6">
            <button 
              onClick={() => setShowAddModal(true)}
              className="w-full bg-white hover:bg-[#F2F2F7] active:scale-[0.99] transition-all py-3.5 rounded-2xl border border-dashed border-[#C7C7CC] text-sm font-bold text-[#007AFF] flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/>
              </svg>
              手動新增美食口袋名單
            </button>

            <section className="space-y-3">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="搜尋店名、分類或個人筆記..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white text-xs rounded-2xl py-3.5 pl-11 pr-4 border border-[#E5E5EA] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF] placeholder-[#8E8E93]"
                />
                <svg className="w-5 h-5 text-[#8E8E93] absolute left-4.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              </div>

              {categories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                        selectedCategory === cat 
                          ? 'bg-[#007AFF] text-white shadow-sm' 
                          : 'bg-white text-[#1C1C1E] border border-[#E5E5EA] hover:bg-[#F2F2F7]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-6">
              {isLoading ? (
                <div className="text-center py-12">
                  <svg className="animate-spin h-6 w-6 text-[#007AFF] mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-xs text-[#8E8E93] mt-3 font-semibold">正在讀取您在 Firestore 的美食庫...</p>
                </div>
              ) : filteredRestaurants.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border border-[#E5E5EA] p-8 space-y-2">
                  <p className="text-sm font-semibold text-[#8E8E93]">您的美食地圖目前沒有資料</p>
                  <p className="text-xs text-[#C7C7CC] max-w-xs mx-auto leading-relaxed">
                    試著在上方手動新增一筆，或者是讓 `@fabrica` 的 Threads 機器人自動幫您儲存第一筆美食！
                  </p>
                </div>
              ) : (
                filteredRestaurants.map((restaurant) => (
                  <div 
                    key={restaurant.id}
                    className="bg-white rounded-3xl shadow-sm border border-[#E5E5EA] overflow-hidden transition-all duration-300 hover:shadow-md"
                  >
                    <div className="p-5 pb-3">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-extrabold tracking-tight text-[#007AFF] bg-[#007AFF]/10 px-2.5 py-1 rounded-lg">
                          {restaurant.category || "美食 • 精選"}
                        </span>
                        {restaurant.savedAt && (
                          <span className="text-[10px] font-medium text-[#8E8E93]">
                            {restaurant.savedAt.seconds 
                              ? new Date(restaurant.savedAt.seconds * 1000).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })
                              : "剛剛"}
                          </span>
                        )}
                      </div>
                      
                      <h2 className="text-lg font-black text-black mt-2.5 tracking-tight flex items-center justify-between">
                        {restaurant.name}
                        {restaurant.threadsUrl && (
                          <a 
                            href={restaurant.threadsUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-[#8E8E93] hover:text-black transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.53c-.26-.81-1-1.4-1.9-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                            </svg>
                          </a>
                        )}
                      </h2>
                      
                      <p className="text-xs text-[#48484A] mt-1.5 flex items-center gap-1.5 font-medium">
                        <svg className="w-3.5 h-3.5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        {restaurant.address || "僅提供店名定位"}
                      </p>
                    </div>

                    <div className="mx-5 mb-4 p-3.5 bg-[#F2F2F7] rounded-2xl border border-[#E5E5EA]/50">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 .364l-.707 .707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                        </svg>
                        Fabrica AI Insight
                      </div>
                      <p className="text-xs text-[#3A3A3C] leading-relaxed">
                        {restaurant.note}
                      </p>
                    </div>

                    <div className="w-full h-44 bg-[#E5E5EA] relative overflow-hidden border-t border-[#F2F2F7]">
                      <iframe
                        title={`Map for ${restaurant.name}`}
                        src={getFreeMapEmbedUrl(restaurant.name, restaurant.address)}
                        className="w-full h-full border-0"
                        allowFullScreen=""
                        loading="lazy"
                      ></iframe>
                    </div>

                    <div className="flex border-t border-[#F2F2F7]">
                      <a 
                        href={getFreeMapAppUrl(restaurant.name, restaurant.address)}
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-1 py-3.5 text-center text-xs font-bold text-[#007AFF] hover:bg-[#F2F2F7]/50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                        在 Google 地圖中開啟
                      </a>
                    </div>
                  </div>
                ))
              )}
            </section>
          </main>

          <footer className="text-center mt-12 mb-8 text-[11px] text-[#8E8E93] space-y-1">
            <p className="font-bold tracking-tight text-black">@fabrica Tech Studio</p>
            <p className="text-[#C7C7CC] font-mono">Dynamic Multi-User Firestore Map Sandbox</p>
          </footer>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form 
            onSubmit={handleAddRestaurant}
            className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-xl border border-[#E5E5EA] animate-in fade-in zoom-in-95 duration-150 text-left"
          >
            <div className="flex justify-between items-center pb-2 border-b border-[#F2F2F7]">
              <h3 className="text-base font-bold text-black">
                新增口袋美食
              </h3>
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#8E8E93] hover:text-black font-semibold text-sm"
              >
                取消
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-[#1C1C1E]">餐廳名稱 *</label>
                <input 
                  type="text" 
                  required
                  value={newRestName}
                  onChange={(e) => setNewRestName(e.target.value)}
                  placeholder="例如：熟成宇治"
                  className="w-full bg-[#F2F2F7] rounded-xl p-3 border border-[#E5E5EA] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#1C1C1E]">地址（選填）</label>
                <input 
                  type="text" 
                  value={newRestAddress}
                  onChange={(e) => setNewRestAddress(e.target.value)}
                  placeholder="例如：台北市大安區永康街4巷8號"
                  className="w-full bg-[#F2F2F7] rounded-xl p-3 border border-[#E5E5EA] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#1C1C1E]">餐飲分類</label>
                <select 
                  value={newRestCategory}
                  onChange={(e) => setNewRestCategory(e.target.value)}
                  className="w-full bg-[#F2F2F7] rounded-xl p-3 border border-[#E5E5EA] focus:outline-none focus:ring-2 focus:ring-[#007AFF] font-medium"
                >
                  <option value="日式甜點 • 咖啡廳">日式甜點 • 咖啡廳</option>
                  <option value="義式料理 • 自然酒">義式料理 • 自然酒</option>
                  <option value="台灣傳統 • 小吃">台灣傳統 • 小吃</option>
                  <option value="美味肉食 • 鍋物">美味肉食 • 鍋物</option>
                  <option value="異國料理 • 餐酒">異國料理 • 餐酒</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#1C1C1E]">美食短評</label>
                <textarea 
                  value={newRestNote}
                  onChange={(e) => setNewRestNote(e.target.value)}
                  placeholder="輸入你對這家店的評價..."
                  className="w-full bg-[#F2F2F7] rounded-xl p-3 border border-[#E5E5EA] focus:outline-none focus:ring-2 focus:ring-[#007AFF] h-16 resize-none"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full py-3.5 bg-[#007AFF] text-white text-xs font-bold rounded-2xl hover:bg-[#0066CC] active:scale-[0.98] transition-all"
            >
              確認新增並同步至 Firebase
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
