"use client";

import React, { useState, useEffect, useRef } from 'react';
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

// --- 原生 WebGL 渲染，徹底避開 React Three Fiber 的 useContext 衝突 ---
import * as THREE from 'three';

// --- 安全環境變數與降級防禦機制 ---
let safeApiKey = "AIzaSyC4YdF_pAKyMFuQVDCau_g3fP9zsMTcOcE"; 
try {
  if (typeof window !== 'undefined' && typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    safeApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  }
} catch (e) { }

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

// ==========================================
// 🎨 原生 3D Vertex & Fragment Shaders (黑白液態)
// ==========================================
const vertexShader = `
uniform float u_intensity;
uniform float u_time;
uniform float u_noiseScale;
uniform float u_noiseSpeed;

varying vec2 vUv;
varying float vDisplacement;

vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec3 P) {
    vec3 Pi0 = floor(P);
    vec3 Pi1 = Pi0 + vec3(1.0);
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P);
    vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;
    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);
    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);
    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);
    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);
    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
    return 2.2 * n_xyz;
}
float turbulence(vec3 p) {
    float t = 0.0;
    float frequency = 1.0;
    float amplitude = 1.0;
    for (int i = 0; i < 4; i++) {
        t += abs(cnoise(p * frequency)) * amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return t;
}
void main() {
    vUv = uv;
    float noise1 = cnoise(position * u_noiseScale + vec3(u_time * u_noiseSpeed));
    float noise2 = cnoise(position * (u_noiseScale * 2.0) + vec3(u_time * u_noiseSpeed * 1.5)) * 0.5;
    float turbulenceNoise = turbulence(position + vec3(u_time)) * 0.3;
    vDisplacement = noise1 + noise2 + turbulenceNoise;
    vec3 newPosition = position + normal * (u_intensity * vDisplacement);
    vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;
}
`;

const fragmentShader = `
uniform float u_intensity;
uniform float u_time;
varying vec2 vUv;
varying float vDisplacement;
void main() {
    float distort = 2.0 * vDisplacement * u_intensity * sin(vUv.y * 10.0 + u_time);
    vec3 baseColor = vec3(0.96, 0.96, 0.97); 
    vec3 waveColor = vec3(0.05, 0.05, 0.06); 
    vec3 color = mix(baseColor, waveColor, clamp(abs(distort) * 1.8, 0.0, 1.0));
    gl_FragColor = vec4(color, 1.0);
}
`;

// ==========================================
// 🚀 專屬 Gooey Loader 元件 (Apple 質感果凍擴散)
// ==========================================
const GooeyLoader = () => {
  return (
    <div className="relative w-[300px] h-[300px] flex items-center justify-center">
      <style>{`
        .blobs {
          width: 300px;
          height: 300px;
          position: absolute;
          overflow: hidden;
          border-radius: 70px;
          transform-style: preserve-3d;
          filter: url(#goo);
        }
        .blobs .blob-center {
          transform-style: preserve-3d;
          position: absolute;
          background: #1D1D1F;
          top: 50%;
          left: 50%;
          width: 30px;
          height: 30px;
          transform-origin: left top;
          transform: scale(0.9) translate(-50%, -50%);
          animation: blob-grow_2 linear 3.4s infinite;
          border-radius: 50%;
          box-shadow: 0 -10px 40px -5px #1D1D1F;
        }
        .blob {
          position: absolute;
          background: #1D1D1F;
          top: 50%;
          left: 50%;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          animation: blobs_2 ease-out 3.4s infinite;
          transform: scale(0.9) translate(-50%, -50%);
          transform-origin: center top;
          opacity: 0;
        }
        .blob:nth-child(1) { animation-delay: 0.2s; }
        .blob:nth-child(2) { animation-delay: 0.4s; }
        .blob:nth-child(3) { animation-delay: 0.6s; }
        .blob:nth-child(4) { animation-delay: 0.8s; }
        .blob:nth-child(5) { animation-delay: 1s; }
        @keyframes blobs_2 {
          0% { opacity: 0; transform: scale(0) translate(calc(-330px - 50%), -50%); }
          1% { opacity: 1; }
          35%, 65% { opacity: 1; transform: scale(0.9) translate(-50%, -50%); }
          99% { opacity: 1; }
          100% { opacity: 0; transform: scale(0) translate(calc(330px - 50%), -50%); }
        }
        @keyframes blob-grow_2 {
          0%, 39% { transform: scale(0) translate(-50%, -50%); }
          40%, 42% { transform: scale(1, 0.9) translate(-50%, -50%); }
          43%, 44% { transform: scale(1.2, 1.1) translate(-50%, -50%); }
          45%, 46% { transform: scale(1.3, 1.2) translate(-50%, -50%); }
          47%, 48% { transform: scale(1.4, 1.3) translate(-50%, -50%); }
          52% { transform: scale(1.5, 1.4) translate(-50%, -50%); }
          54% { transform: scale(1.7, 1.6) translate(-50%, -50%); }
          58% { transform: scale(1.8, 1.7) translate(-50%, -50%); }
          68%, 70% { transform: scale(1.7, 1.5) translate(-50%, -50%); }
          78% { transform: scale(1.6, 1.4) translate(-50%, -50%); }
          80%, 81% { transform: scale(1.5, 1.4) translate(-50%, -50%); }
          82%, 83% { transform: scale(1.4, 1.3) translate(-50%, -50%); }
          84%, 85% { transform: scale(1.3, 1.2) translate(-50%, -50%); }
          86%, 87% { transform: scale(1.2, 1.1) translate(-50%, -50%); }
          90%, 91% { transform: scale(1, 0.9) translate(-50%, -50%); }
          92%, 100% { transform: scale(0) translate(-50%, -50%); }
        }
      `}</style>
      <div className="blobs">
        <div className="blob-center" />
        <div className="blob" />
        <div className="blob" />
        <div className="blob" />
        <div className="blob" />
        <div className="blob" />
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" className="hidden absolute">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation={10} result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
    </div>
  );
};

// ==========================================
// 🚀 Page 主組件
// ==========================================
export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [threadsUsername, setThreadsUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [restaurants, setRestaurants] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [isLoading, setIsLoading] = useState(false);
  
  // 彈出視窗與全域轉場狀態
  const [showAddModal, setShowAddModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false); 
  const [isGlobalTransitioning, setIsGlobalTransitioning] = useState(false); 

  const [newRestName, setNewRestName] = useState("");
  const [newRestAddress, setNewRestAddress] = useState("");
  const [newRestCategory, setNewRestCategory] = useState("日式甜點 • 咖啡廳");
  const [newRestNote, setNewRestNote] = useState("");

  const [inputUsername, setInputUsername] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authError, setAuthError] = useState(null); 
  
  const [mounted, setMounted] = useState(false); 
  const [isSandbox, setIsSandbox] = useState(false); 
  const canvasContainerRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      setIsSandbox(hostname.includes('usercontent.goog') || hostname.includes('localhost'));
    }
  }, []);

  // 🌟 原生 WebGL 初始化 
  useEffect(() => {
    if (!mounted || isLoggedIn) return;
    const container = canvasContainerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const uniforms = {
      u_time: { value: 0 },
      u_intensity: { value: 0.25 },
      u_noiseScale: { value: 1.5 },
      u_noiseSpeed: { value: 0.8 },
    };

    const geometry = new THREE.SphereGeometry(2, 64, 64);
    const material = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: uniforms,
      transparent: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, -1);
    mesh.scale.setScalar(2.4);
    scene.add(mesh);

    const mouse = { x: 0, y: 0 };
    const targetPosition = new THREE.Vector3(0, 0, -1);
    const currentPosition = new THREE.Vector3(0, 0, -1);

    const handleMouseMove = (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      uniforms.u_time.value = 0.25 * elapsedTime;
      uniforms.u_noiseScale.value = Math.sin(elapsedTime * 0.1) * 0.5 + 1.2;

      targetPosition.set(mouse.x * 1.2, mouse.y * 1.2, -1);
      currentPosition.lerp(targetPosition, 0.05);
      mesh.position.copy(currentPosition);

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) container.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [mounted, isLoggedIn]);

  // Firebase 初始化認證
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        setAuthError(err.code || err.message);
        setFirebaseUser({ uid: "local-temp-guest", isAnonymous: true });
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  // 實時監聽 Firestore
  useEffect(() => {
    if (!firebaseUser || !isLoggedIn || !threadsUsername) return;
    if (firebaseUser.uid === "local-temp-guest") return; 

    setIsLoading(true);
    const cleanUsername = threadsUsername.replace("@", "").trim().toLowerCase();
    const userRestaurantsRef = collection(db, 'artifacts', appId, 'users', cleanUsername, 'restaurants');

    const unsubscribe = onSnapshot(userRestaurantsRef, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      const sortedList = list.sort((a, b) => (b.savedAt?.seconds || 0) - (a.savedAt?.seconds || 0));
      setRestaurants(sortedList);
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
    
    setIsGlobalTransitioning(true); // 🌟 啟動登入 Loader
    setTimeout(() => {
      let formatted = inputUsername.trim();
      if (!formatted.startsWith("@")) formatted = "@" + formatted;
      setThreadsUsername(formatted);
      setIsLoggedIn(true);
      setLoginError("");
      setIsGlobalTransitioning(false); // 🌟 結束登入 Loader
    }, 2200);
  };

  const handleLogout = () => {
    setIsGlobalTransitioning(true); // 🌟 啟動登出 Loader
    setTimeout(() => {
      setIsLoggedIn(false);
      setThreadsUsername("");
      setInputUsername("");
      setRestaurants([]);
      setIsGlobalTransitioning(false); // 🌟 結束登出 Loader
    }, 1200);
  };

  const closeAddModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setShowAddModal(false);
      setIsClosingModal(false);
    }, 400); 
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

  // 🚀 AI 評價分析生成引擎
  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    if (!newRestName.trim()) return;

    setIsGlobalTransitioning(true); // 🌟 啟動 AI 生成果凍 Loader，顯示「AI 思考中」質感

    let finalNote = newRestNote;

    // 💡 關鍵：如果使用者沒有寫筆記（留白），自動呼叫 Google Gemini AI 聯網抓取真實評價
    if (!finalNote.trim()) {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""; 
        // 🚨 修正：將模型改為所有人都能穩定使用的 gemini-1.5-flash
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const payload = {
          contents: [{ parts: [{ text: `請分析台灣的這間餐廳：${newRestName} ${newRestAddress}。請綜合網路評價、近期優惠、活動與特色給出建議。` }] }],
          systemInstruction: { parts: [{ text: "你是一個高端美食顧問 Fabrica。請用 50-80 字精煉總結這家餐廳的真實網路評價、特色招牌菜色，若近期有知名優惠或活動也請提及。語氣要專業、具質感，不需加上 Markdown 標籤，直接給出純文字結果。" }] },
          tools: [{ google_search: {} }]
        };

        const geminiResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const geminiData = await geminiResponse.json();
        
        // 🚨 強化除錯：捕捉真實的 API 錯誤訊息，直接顯示在畫面上！
        if (geminiData.error) {
          console.error("Gemini API Error:", geminiData.error);
          finalNote = `【AI 連線失敗】錯誤代碼：${geminiData.error.code}。原因：${geminiData.error.message}`;
        } else {
          const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiText) {
            finalNote = aiText.trim();
          } else {
            finalNote = "暫無 AI 分析結果，系統已將其加入您的口袋名單。";
          }
        }
      } catch (err) {
        console.error("AI Generation error:", err);
        finalNote = "連線 AI 引擎時發生錯誤，已為您預設儲存。";
      }
    }

    // 寫入資料庫
    if (firebaseUser?.uid === "local-temp-guest") {
      const mockDoc = {
        id: Math.random().toString(),
        name: newRestName,
        address: newRestAddress || "僅提供店名定位",
        category: newRestCategory,
        note: finalNote,
        savedAt: { seconds: Math.floor(Date.now() / 1000) },
        threadsUrl: "" 
      };
      setRestaurants(prev => [mockDoc, ...prev]);
    } else {
      try {
        const cleanUsername = threadsUsername.replace("@", "").trim().toLowerCase();
        const userRestaurantsRef = collection(db, 'artifacts', appId, 'users', cleanUsername, 'restaurants');
        await addDoc(userRestaurantsRef, {
          name: newRestName,
          address: newRestAddress || "僅提供店名定位",
          category: newRestCategory,
          note: finalNote,
          savedAt: serverTimestamp(),
          threadsUrl: "" 
        });
      } catch (err) {
        console.error("Error adding document to Firestore:", err);
      }
    }

    setNewRestName("");
    setNewRestAddress("");
    setNewRestNote("");
    
    // 生成與寫入完畢後，關閉 Loader 與彈出視窗
    setTimeout(() => {
      setIsGlobalTransitioning(false);
      closeAddModal();
    }, 1500);
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
    <div className="relative min-h-screen bg-[#F4F4F6] text-[#1D1D1F] tracking-tight font-sans antialiased overflow-x-hidden">
      
      {/* 🌟 頂級果凍 Loader 全局轉場覆蓋層 */}
      <div 
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/70 backdrop-blur-xl transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          isGlobalTransitioning ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        <GooeyLoader />
      </div>

      {/* 🌟 3D 原生 WebGL 黑白極簡液態 Shader 流體背景 (未登入時全螢幕鋪底) */}
      {!isLoggedIn && (
        <div 
          ref={canvasContainerRef} 
          className="fixed inset-0 z-0 bg-[#F4F4F6] w-screen h-screen pointer-events-auto transition-opacity duration-1000"
        />
      )}

      {/* ==================== 頁面容器 (配合登入/登出/AI生成狀態做流暢縮放模糊轉場) ==================== */}
      <div className={`relative z-10 transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isGlobalTransitioning ? 'scale-[0.98] opacity-50 blur-sm pointer-events-none' : 'scale-100 opacity-100 blur-0'}`}>
        
        {!isLoggedIn ? (
          /* ---------------- Apple ID 原生極簡登入介面 ---------------- */
          <div className="min-h-screen flex flex-col justify-between px-6 py-10 max-w-sm mx-auto pointer-events-none">
            
            <div className="flex-1 flex flex-col justify-center space-y-10 py-8 pointer-events-auto">
              <div className="text-center space-y-5">
                <div className="w-16 h-16 bg-black rounded-[20px] mx-auto flex items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.15)] transform hover:scale-[1.03] transition-all duration-300">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <circle cx="12" cy="11" r="3" strokeWidth="1.5"/>
                  </svg>
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-3xl font-extrabold tracking-tight text-black drop-shadow-sm">Foodie</h1>
                  <p className="text-sm text-[#86868B] font-medium leading-relaxed max-w-xs mx-auto drop-shadow-sm">
                    您的專屬美食足跡庫。<br />
                    在 Threads 提及 <span className="text-[#1D1D1F] font-semibold">@fabrica</span> 即可自動寫入。
                  </p>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-5 bg-white/45 backdrop-blur-xl border border-white/60 p-6 rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.03)]">
                
                {(authError === 'auth/configuration-not-found' || authError === 'auth/operation-not-allowed') && (
                  <div className="bg-[#FF9500]/10 border border-[#FF9500]/30 rounded-2xl p-4 text-xs text-[#D97300] font-medium leading-relaxed flex items-start gap-2.5">
                    <span className="text-sm mt-0.5">⚠️</span>
                    <div>
                      <p className="font-bold text-[#C96300]">Firebase 匿名登入尚未啟用</p>
                      <p className="mt-1 opacity-90">目前降級為記憶體暫存模式。請前往 Firebase 控制台 ➔ Authentication 啟用「匿名 (Anonymous)」以開啟雲端同步。</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="relative flex items-center w-full">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-base font-semibold text-[#86868B] select-none pointer-events-none">@</span>
                    <input 
                      type="text" 
                      placeholder="輸入您的 Threads 帳號" 
                      value={inputUsername}
                      onChange={(e) => setInputUsername(e.target.value.replace("@", ""))}
                      className="w-full bg-white/80 text-base font-medium rounded-2xl py-4.5 pl-12 pr-5 border border-[#D2D2D7] focus:border-black focus:ring-1 focus:ring-black outline-none transition-all duration-200 placeholder-[#86868B]/70 shadow-[0_2px_8px_rgba(0,0,0,0.01)]"
                    />
                  </div>
                  {loginError && (
                    <p className="text-xs text-[#FF3B30] font-medium pl-3.5 flex items-center gap-1.5 animate-in fade-in duration-200">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                      {loginError}
                    </p>
                  )}
                </div>

                <button 
                  type="submit"
                  className="group relative cursor-pointer w-full h-[56px] border border-[#D2D2D7] bg-white rounded-2xl overflow-hidden text-[#1D1D1F] font-semibold transition-all duration-300 shadow-sm active:scale-[0.98] outline-none"
                >
                  <div className="absolute inset-0 flex items-center justify-center translate-x-0 group-hover:translate-x-16 group-hover:opacity-0 transition-all duration-300 z-20 pointer-events-none select-none">
                    進入美食檔案
                  </div>
                  <div className="absolute inset-0 flex gap-2 items-center justify-center text-white z-20 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none select-none">
                    <span className="font-semibold text-sm">進入美食檔案</span>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                  </div>
                  {/* 絕對圓心擴散深色背景：使用 scale-0 徹底隱藏黑點 */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[#1D1D1F] scale-0 group-hover:scale-[35] transition-transform duration-500 ease-out z-10"></div>
                </button>
              </form>
            </div>

            <footer className="text-center text-xs text-[#86868B] pt-4 pointer-events-none">
              <p className="font-semibold text-[#1D1D1F]/40">© Fabrica</p>
            </footer>
          </div>

        ) : (
          /* ---------------- iOS 主檔案庫面板 ---------------- */
          <div className="pb-32 bg-[#F4F4F6] min-h-screen animate-fade-in">
            <header className="sticky top-0 z-40 bg-white/60 backdrop-blur-xl border-b border-[#E5E5EA] px-6 py-4">
              <div className="max-w-md mx-auto flex justify-between items-center">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider text-[#86868B] uppercase">FABRICA MAPS</span>
                    {firebaseUser?.uid === "local-temp-guest" ? (
                      <span className="inline-flex items-center text-[9px] font-semibold text-[#FF9500] bg-[#FF9500]/10 px-2 py-0.5 rounded-md">
                        <span className="w-1 h-1 bg-[#FF9500] rounded-full mr-1 animate-pulse" /> 本地暫存
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[9px] font-semibold text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded-md">
                        <span className="w-1 h-1 bg-[#34C759] rounded-full mr-1" /> 雲端已連線
                      </span>
                    )}
                  </div>
                  <h1 className="text-lg font-bold tracking-tight text-black mt-0.5">{threadsUsername}</h1>
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
              <section className="space-y-4">
                <div className="relative flex items-center w-full">
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
                    <svg className="animate-spin h-5 w-5 text-black mx-auto" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <p className="text-xs text-[#86868B] font-semibold">正在讀取雲端美食資料庫...</p>
                  </div>
                ) : filteredRestaurants.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-[28px] border border-[#E5E5EA] p-8 space-y-4 shadow-sm animate-in fade-in duration-300">
                    <div className="w-12 h-12 bg-[#F5F5F7] rounded-full flex items-center justify-center mx-auto text-[#86868B]">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-black">您的專屬美食地圖尚未收集足跡</p>
                      <p className="text-xs text-[#86868B] max-w-[240px] mx-auto leading-relaxed">請在下方手動新增，或者讓 @fabrica 機器人自動為您收集 Threads 串文！</p>
                    </div>
                    <button 
                      onClick={() => setShowAddModal(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-black hover:bg-black/90 text-white px-4 py-2 rounded-full transition-all animate-pulse"
                    >
                      手動新增第一筆
                    </button>
                  </div>
                ) : (
                  filteredRestaurants.map((restaurant, i) => (
                    <div 
                      key={restaurant.id}
                      className="bg-white rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-[#E5E5EA]/80 overflow-hidden hover:shadow-[0_12px_40px_rgb(0,0,0,0.05)] hover:border-[#D2D2D7]/80 transition-all duration-300 transform hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-8 fill-mode-both"
                      style={{ animationDelay: `${i * 100}ms` }}
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
                            <a href={restaurant.threadsUrl} target="_blank" rel="noreferrer" className="text-[#86868B] hover:text-black transition-colors">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                            </a>
                          )}
                        </h2>
                        
                        <p className="text-xs text-[#86868B] mt-2 flex items-center gap-1.5 font-medium">
                          <svg className="w-4 h-4 text-[#86868B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3" strokeWidth="2.5"/></svg>
                          {restaurant.address || "僅提供店名定位"}
                        </p>
                      </div>

                      <div className="mx-6 mb-5 p-4.5 bg-[#F5F5F7] rounded-2xl border border-[#E5E5EA]/40">
                        {/* 🌟 Fabrica AI Insight 標籤統一保留給所有筆記 */}
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#86868B] uppercase tracking-wider mb-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 .364l-.707 .707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                          Fabrica AI Insight
                        </div>
                        <p className="text-xs text-[#3A3A3C] leading-relaxed font-medium">{restaurant.note}</p>
                      </div>

                      <div className="w-full h-44 bg-[#E5E5EA] relative overflow-hidden border-t border-[#F2F2F7]">
                        <iframe title={`Map for ${restaurant.name}`} src={getFreeMapEmbedUrl(restaurant.name, restaurant.address)} className="w-full h-full border-0 grayscale hover:grayscale-0 transition-all duration-500" allowFullScreen="" loading="lazy"></iframe>
                      </div>

                      <div className="p-4 bg-white border-t border-[#F2F2F7] flex gap-3">
                        <a href={getFreeMapAppUrl(restaurant.name, restaurant.address)} target="_blank" rel="noreferrer" className="w-full py-3 text-center text-xs font-semibold text-black bg-[#F5F5F7] hover:bg-[#E8E8ED] active:scale-95 transition-all rounded-xl flex items-center justify-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                手動新增足跡
              </button>
            </div>

            <footer className="text-center mt-20 mb-8 text-[11px] text-[#86868B] space-y-1">
              <p className="font-semibold text-[#1D1D1F]">© Fabrica</p>
            </footer>
          </div>
        )}
      </div>

      {/* ==================== 🚀 AI 賦能的新增美食彈出視窗 ==================== */}
      {showAddModal && (
        <div 
          className={`fixed inset-0 z-50 bg-black/20 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-400 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
            isClosingModal ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <form 
            onSubmit={handleAddRestaurant}
            className={`bg-white/85 backdrop-blur-2xl w-full max-w-sm rounded-[36px] p-7 space-y-6 shadow-[0_24px_48px_rgba(0,0,0,0.08)] border border-white text-left transition-all duration-400 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
              isClosingModal ? 'scale-95 translate-y-8 opacity-0' : 'scale-100 translate-y-0 opacity-100'
            }`}
          >
            <div className="flex justify-between items-center pb-3 border-b border-[#1D1D1F]/5">
              <h3 className="text-lg font-bold text-black tracking-tight">新增口袋美食</h3>
              <button 
                type="button"
                onClick={closeAddModal}
                className="w-8 h-8 bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#86868B] hover:text-black font-semibold rounded-full flex items-center justify-center text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="font-bold text-[#1D1D1F] text-xs px-1">餐廳名稱 *</label>
                <input type="text" required value={newRestName} onChange={(e) => setNewRestName(e.target.value)} placeholder="例如：熟成宇治" className="w-full bg-white/70 rounded-2xl p-3.5 border border-[#E5E5EA] focus:ring-1 focus:ring-black outline-none font-medium placeholder-[#86868B]/60 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)]" />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-[#1D1D1F] text-xs px-1">地址（選填）</label>
                <input type="text" value={newRestAddress} onChange={(e) => setNewRestAddress(e.target.value)} placeholder="例如：台北市大安區永康街4巷8號" className="w-full bg-white/70 rounded-2xl p-3.5 border border-[#E5E5EA] focus:ring-1 focus:ring-black outline-none font-medium placeholder-[#86868B]/60 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)]" />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-[#1D1D1F] text-xs px-1">餐飲分類</label>
                <select value={newRestCategory} onChange={(e) => setNewRestCategory(e.target.value)} className="w-full bg-white/70 rounded-2xl p-3.5 border border-[#E5E5EA] focus:ring-1 focus:ring-black outline-none font-semibold text-[#1D1D1F] appearance-none transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                  <option value="日式甜點 • 咖啡廳">日式甜點 • 咖啡廳</option>
                  <option value="義式料理 • 自然酒">義式料理 • 自然酒</option>
                  <option value="台灣傳統 • 小吃">台灣傳統 • 小吃</option>
                  <option value="美味肉食 • 鍋物">美味肉食 • 鍋物</option>
                  <option value="異國料理 • 餐酒">異國料理 • 餐酒</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-[#1D1D1F] text-xs px-1 flex justify-between items-end">
                  美食短評
                  <span className="text-[#86868B] font-normal tracking-wide text-[10px]">💡 留白將自動呼叫 AI 分析</span>
                </label>
                <textarea value={newRestNote} onChange={(e) => setNewRestNote(e.target.value)} placeholder="若留白，AI 將為您爬取網路評價、優惠與推薦..." className="w-full bg-white/70 rounded-2xl p-3.5 border border-[#E5E5EA] focus:ring-1 focus:ring-black outline-none h-20 resize-none font-medium placeholder-[#86868B]/60 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)]" />
              </div>
            </div>

            <button 
              type="submit" 
              className="group relative cursor-pointer w-full h-[56px] border border-[#D2D2D7] bg-white rounded-2xl overflow-hidden text-[#1D1D1F] font-semibold transition-all duration-300 shadow-sm active:scale-[0.98] outline-none mt-2"
            >
              <div className="absolute inset-0 flex items-center justify-center translate-x-0 group-hover:translate-x-16 group-hover:opacity-0 transition-all duration-300 z-20 pointer-events-none select-none">
                儲存至個人地圖
              </div>
              <div className="absolute inset-0 flex gap-2 items-center justify-center text-white z-20 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none select-none">
                <span className="font-semibold text-sm">確認新增</span>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[#1D1D1F] scale-0 group-hover:scale-[35] transition-transform duration-500 ease-out z-10"></div>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
