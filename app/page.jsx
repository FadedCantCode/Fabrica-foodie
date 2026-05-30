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
  serverTimestamp,
  doc,          
  deleteDoc     
} from 'firebase/firestore';
import * as THREE from 'three';

// --- 安全環境變數與降級防禦機制 ---
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

// ==========================================
// 🗺️ 輔助函數與即時地圖
// ==========================================
const getFreeMapEmbedUrl = (name, address) => {
  const hasValidAddress = address && address !== "僅提供店名定位" && address.trim() !== "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(hasValidAddress ? `${name} ${address}` : name)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
};

const getFreeMapAppUrl = (name, address) => {
  const hasValidAddress = address && address !== "僅提供店名定位" && address.trim() !== "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hasValidAddress ? `${name} ${address}` : name)}`;
};

const getSmartTag = (name, currentCategory = "") => {
  const n = name || "";
  if (n.includes("鍋") || n.includes("麻辣") || n.includes("涮涮") || n.includes("石二鍋") || n.includes("海底撈") || n.includes("火鍋")) return "火鍋專賣";
  if (n.includes("茶") || n.includes("嵐") || n.includes("五桐") || n.includes("渴") || n.includes("奶") || n.includes("飲料") || n.includes("紅茶") || n.includes("綠茶") || n.includes("手搖")) return "手搖茶攤";
  if (n.includes("咖啡") || n.toLowerCase().includes("cafe") || n.includes("甜點") || n.includes("烘焙") || n.includes("麵包") || n.includes("蛋糕")) return "咖啡甜點";
  if (n.includes("拉麵") || n.includes("日式") || n.includes("壽司") || n.includes("丼") || n.includes("居酒屋") || n.includes("食堂")) return "日式料理";
  if (n.includes("便當") || n.includes("飯") || n.includes("麵") || n.includes("小吃") || n.includes("排骨") || n.includes("傳統")) return "台式小吃 • 便當";
  if (n.includes("燒肉") || n.includes("烤") || n.includes("串燒") || n.includes("乾杯") || n.includes("屋馬")) return "燒肉串燒";
  
  if (currentCategory && currentCategory !== "美食餐廳" && currentCategory !== "在地美食") return currentCategory.replace(" • ", " • ").trim();
  return "精選美食";
};

// ==========================================
// 🎨 UI 視覺增強組件
// ==========================================

// 1. 垂直雙向滾動跑馬燈組件 (黑色極速絲滑版)
const VerticalMarquee = ({ direction = "up", text = "WELCOME TO FOODIE" }) => {
  const animationClass = direction === "up" ? "animate-marquee-up" : "animate-marquee-down";
  const marqueeItems = Array(15).fill(text);
  return (
    <div className="relative w-16 h-screen overflow-hidden flex justify-center items-center select-none bg-black/[0.02]">
      <div className="absolute w-[400vh] flex items-center justify-center rotate-90">
         <div className={`flex gap-16 whitespace-nowrap text-[#1D1D1F] font-black text-4xl md:text-5xl tracking-[0.3em] will-change-transform ${animationClass}`}>
           {marqueeItems.map((item, index) => (
             <span key={index}>{item}</span>
           ))}
         </div>
      </div>
    </div>
  );
};

// 2. Liquid Glass Card (液態玻璃卡片)
const LiquidGlassCard = ({ children, className, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden bg-white/20 backdrop-blur-2xl border border-white/40 shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] rounded-[24px] ${className}`}
      style={{ boxShadow: "inset 0 0 20px rgba(255,255,255,0.5), 0 8px 32px 0 rgba(0,0,0,0.05)" }}
    >
      <div className="absolute inset-0 pointer-events-none rounded-[24px] border border-white/60 mix-blend-overlay"></div>
      {children}
    </div>
  );
};

// 3. Blur Vignette (邊緣模糊暗角特效)
const BlurVignette = ({ children, className, blur = '20px' }) => {
  return (
    <div className={`relative ${className}`}>
      {children}
      <div 
        className="absolute inset-0 pointer-events-none z-10" 
        style={{
          boxShadow: `inset 0 0 60px 10px rgba(0,0,0,0.6)`,
          backdropFilter: `blur(${blur})`,
          maskImage: `radial-gradient(ellipse at center, transparent 40%, black 100%)`,
          WebkitMaskImage: `radial-gradient(ellipse at center, transparent 40%, black 100%)`
        }} 
      />
    </div>
  );
};

const GooeyLoader = () => (
  <div className="relative w-[300px] h-[300px] flex items-center justify-center">
    <style>{`
      .blobs { width: 300px; height: 300px; position: absolute; overflow: hidden; border-radius: 70px; transform-style: preserve-3d; filter: url(#goo); }
      .blobs .blob-center { transform-style: preserve-3d; position: absolute; background: #1D1D1F; top: 50%; left: 50%; width: 30px; height: 30px; transform-origin: left top; transform: scale(0.9) translate(-50%, -50%); animation: blob-grow_2 linear 3.4s infinite; border-radius: 50%; box-shadow: 0 -10px 40px -5px #1D1D1F; }
      .blob { position: absolute; background: #1D1D1F; top: 50%; left: 50%; width: 30px; height: 30px; border-radius: 50%; animation: blobs_2 ease-out 3.4s infinite; transform: scale(0.9) translate(-50%, -50%); transform-origin: center top; opacity: 0; }
      .blob:nth-child(1) { animation-delay: 0.2s; } .blob:nth-child(2) { animation-delay: 0.4s; } .blob:nth-child(3) { animation-delay: 0.6s; } .blob:nth-child(4) { animation-delay: 0.8s; } .blob:nth-child(5) { animation-delay: 1s; }
      @keyframes blobs_2 { 0% { opacity: 0; transform: scale(0) translate(calc(-330px - 50%), -50%); } 1% { opacity: 1; } 35%, 65% { opacity: 1; transform: scale(0.9) translate(-50%, -50%); } 99% { opacity: 1; } 100% { opacity: 0; transform: scale(0) translate(calc(330px - 50%), -50%); } }
      @keyframes blob-grow_2 { 0%, 39% { transform: scale(0) translate(-50%, -50%); } 40%, 42% { transform: scale(1, 0.9) translate(-50%, -50%); } 43%, 44% { transform: scale(1.2, 1.1) translate(-50%, -50%); } 45%, 46% { transform: scale(1.3, 1.2) translate(-50%, -50%); } 47%, 48% { transform: scale(1.4, 1.3) translate(-50%, -50%); } 52% { transform: scale(1.5, 1.4) translate(-50%, -50%); } 54% { transform: scale(1.7, 1.6) translate(-50%, -50%); } 58% { transform: scale(1.8, 1.7) translate(-50%, -50%); } 68%, 70% { transform: scale(1.7, 1.5) translate(-50%, -50%); } 78% { transform: scale(1.6, 1.4) translate(-50%, -50%); } 80%, 81% { transform: scale(1.5, 1.4) translate(-50%, -50%); } 82%, 83% { transform: scale(1.4, 1.3) translate(-50%, -50%); } 84%, 85% { transform: scale(1.3, 1.2) translate(-50%, -50%); } 86%, 87% { transform: scale(1.2, 1.1) translate(-50%, -50%); } 90%, 91% { transform: scale(1, 0.9) translate(-50%, -50%); } 92%, 100% { transform: scale(0) translate(-50%, -50%); } }
    `}</style>
    <div className="blobs">
      <div className="blob-center" />
      <div className="blob" /><div className="blob" /><div className="blob" /><div className="blob" /><div className="blob" />
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

// 🌈 WebGL 高品質無色系 Shader 背景 (登入後渲染)
const ColorfulBackground = ({ show }) => {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const uniforms = {
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) }
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float u_time; uniform vec2 u_resolution; varying vec2 vUv;
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; } vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; } vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy) ); vec2 x0 = v - i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i);
          vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m; m = m*m; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g);
        }
        void main() {
          vec2 uv = gl_FragCoord.xy / u_resolution.xy; float t = u_time * 0.2;
          float n1 = snoise(uv * 1.5 + vec2(t, t * 0.5)); float n2 = snoise(uv * 2.0 - vec2(t * 0.3, t * 0.8)); vec2 distortedUv = uv + vec2(n1, n2) * 0.2;
          vec3 color1 = vec3(0.96, 0.96, 0.97); vec3 color2 = vec3(0.12, 0.12, 0.12); vec3 color3 = vec3(0.75, 0.75, 0.75); 
          float mix1 = smoothstep(0.0, 1.0, sin(distortedUv.x * 4.0 + t) * 0.5 + 0.5); float mix2 = smoothstep(0.0, 1.0, cos(distortedUv.y * 3.0 - t) * 0.5 + 0.5);
          vec3 finalColor = mix(color1, color2, mix1); finalColor = mix(finalColor, color3, mix2); gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); scene.add(mesh);
    let animationFrameId;
    const animate = (time) => { uniforms.u_time.value = time * 0.001; renderer.render(scene, camera); animationFrameId = requestAnimationFrame(animate); };
    animate(0);
    const handleResize = () => { if (!container) return; renderer.setSize(container.clientWidth, container.clientHeight); uniforms.u_resolution.value.set(container.clientWidth, container.clientHeight); };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); cancelAnimationFrame(animationFrameId); if (container && renderer.domElement) container.removeChild(renderer.domElement); material.dispose(); renderer.dispose(); };
  }, []);
  return <div ref={containerRef} className={`fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${show ? 'opacity-100' : 'opacity-0'}`} />;
};

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [threadsUsername, setThreadsUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [restaurants, setRestaurants] = useState([]);
  // 🌟 用於拖曳排序的顯示陣列狀態
  const [displayRestaurants, setDisplayRestaurants] = useState([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [isLoading, setIsLoading] = useState(false);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false); 
  const [isGlobalTransitioning, setIsGlobalTransitioning] = useState(false); 
  const [deletingIds, setDeletingIds] = useState([]); 

  const [isLocating, setIsLocating] = useState(false);
  const [nearbyRecommendations, setNearbyRecommendations] = useState([]); 
  const [dismissedRecommendationIds, setDismissedRecommendationIds] = useState([]); 
  const [toastMessage, setToastMessage] = useState("");
  
  const [animatingRecId, setAnimatingRecId] = useState(null);
  const [sharedItem, setSharedItem] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [isTypingName, setIsTypingName] = useState(false);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  const [newRestName, setNewRestName] = useState("");
  const [newRestAddress, setNewRestAddress] = useState("");
  const [newRestCategory, setNewRestCategory] = useState("手搖茶攤");
  const [newRestNote, setNewRestNote] = useState("");
  const [newRestRecommender, setNewRestRecommender] = useState("");

  const [inputUsername, setInputUsername] = useState("");
  const [loginError, setLoginError] = useState("");
  
  const [mounted, setMounted] = useState(false); 
  const canvasContainerRef = useRef(null);
  const hasSearchedRef = useRef(false);

  // 🌟 拖曳排序專用的 Refs
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // 🌟 備用高質量名店庫
  const TAIWAN_TRENDY_RECS = [
    { id: "fallback-1", name: "詹記麻辣火鍋", address: "台北市大安區和平東路三段60號", category: "火鍋專賣", note: "📍 台北極致傳奇麻辣鍋，鴨血豆腐堪稱美味天花板，絕對必吃。" },
    { id: "fallback-2", name: "五之神製作所", address: "台北市信義區忠孝東路四段553巷6弄6號", category: "日式料理", note: "📍 超濃厚蝦沾麵名店，濃郁蝦湯搭配特色配菜，排隊不間斷。" },
    { id: "fallback-3", name: "約翰紅茶公司", address: "台北市內湖區江南街98號", category: "手搖茶攤", note: "📍 精緻紅茶專家，大推煮濃那堤與約翰紅茶，茶香極佳。" },
    { id: "fallback-4", name: "榕錦時光生活園區 - 興波咖啡", address: "台北市大安區金華街167號", category: "咖啡甜點", note: "📍 世界冠軍大師級精品咖啡館，日式老木屋改建極富質感。" }
  ];

  // 登入前「黑白液態 WebGL 3D 著色器背景」的特效
  const vertexShaderLogin = `
    uniform float u_intensity; uniform float u_time; uniform float u_noiseScale; uniform float u_noiseSpeed;
    varying vec2 vUv; varying float vDisplacement;
    vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }
    float cnoise(vec3 P) {
        vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0); Pi0 = mod(Pi0, 289.0); Pi1 = mod(Pi1, 289.0);
        vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0); vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x); vec4 iy = vec4(Pi0.yy, Pi1.yy);
        vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz; vec4 ixy = permute(permute(ix) + iy); vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);
        vec4 gx0 = ixy0 / 7.0; vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5; gx0 = fract(gx0); vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0); vec4 sz0 = step(gz0, vec4(0.0));
        gx0 -= sz0 * (step(0.0, gx0) - 0.5); gy0 -= sz0 * (step(0.0, gy0) - 0.5); vec4 gx1 = ixy1 / 7.0; vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5; gx1 = fract(gx1);
        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1); vec4 sz1 = step(gz1, vec4(0.0)); gx1 -= sz1 * (step(0.0, gx1) - 0.5); gy1 -= sz1 * (step(0.0, gy1) - 0.5);
        vec3 g000 = vec3(gx0.x,gy0.x,gz0.x); vec3 g100 = vec3(gx0.y,gy0.y,gz0.y); vec3 g010 = vec3(gx0.z,gy0.z,gz0.z); vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
        vec3 g001 = vec3(gx1.x,gy1.x,gz1.x); vec3 g101 = vec3(gx1.y,gy1.y,gz1.y); vec3 g011 = vec3(gx1.z,gy1.z,gz1.z); vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110))); g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111))); g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
        float n000 = dot(g000, Pf0); float n100 = dot(g100, vec3(Pf1.x, Pf0.yz)); float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z)); float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z)); float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z)); float n011 = dot(g011, vec3(Pf0.x, Pf1.yz)); float n111 = dot(g111, Pf1);
        vec3 fade_xyz = fade(Pf0); vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z); vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y); float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); return 2.2 * n_xyz;
    }
    float turbulence(vec3 p) {
        float t = 0.0; float frequency = 1.0; float amplitude = 1.0;
        for (int i = 0; i < 4; i++) { t += abs(cnoise(p * frequency)) * amplitude; frequency *= 2.0; amplitude *= 0.5; } return t;
    }
    void main() {
        vUv = uv;
        float noise1 = cnoise(position * u_noiseScale + vec3(u_time * u_noiseSpeed));
        float noise2 = cnoise(position * (u_noiseScale * 2.0) + vec3(u_time * u_noiseSpeed * 1.5)) * 0.5;
        float turbulenceNoise = turbulence(position + vec3(u_time)) * 0.3;
        vDisplacement = noise1 + noise2 + turbulenceNoise;
        vec3 newPosition = position + normal * (u_intensity * vDisplacement);
        vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
        gl_Position = projectionMatrix * viewMatrix * modelPosition;
    }
  `;

  const fragmentShaderLogin = `
    uniform float u_intensity; uniform float u_time; varying vec2 vUv; varying float vDisplacement;
    void main() {
        float distort = 2.0 * vDisplacement * u_intensity * sin(vUv.y * 10.0 + u_time);
        vec3 baseColor = vec3(0.96, 0.96, 0.97); vec3 waveColor = vec3(0.05, 0.05, 0.06); 
        vec3 color = mix(baseColor, waveColor, clamp(abs(distort) * 1.8, 0.0, 1.0)); gl_FragColor = vec4(color, 1.0);
    }
  `;

  // 比對是否重複收藏的公用檢查函數
  const isDuplicateRestaurant = (name) => {
    if (!name) return false;
    const target = name.replace(/\s+/g, "").toLowerCase();
    return restaurants.some(r => r.name && r.name.replace(/\s+/g, "").toLowerCase() === target);
  };

  useEffect(() => { setMounted(true); }, []);

  // 還原黑白 3D WebGL 互動球體背景 (登入前使用)
  useEffect(() => {
    if (!mounted || isLoggedIn) return;
    const container = canvasContainerRef.current;
    if (!container) return;

    const width = container.clientWidth; const height = container.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0, 8);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const uniforms = { u_time: { value: 0 }, u_intensity: { value: 0.25 }, u_noiseScale: { value: 1.5 }, u_noiseSpeed: { value: 0.8 } };
    const geometry = new THREE.SphereGeometry(2, 64, 64);
    const material = new THREE.ShaderMaterial({ vertexShader: vertexShaderLogin, fragmentShader: fragmentShaderLogin, uniforms, transparent: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, -1); mesh.scale.setScalar(2.4); scene.add(mesh);

    const mouse = { x: 0, y: 0 }; const targetPosition = new THREE.Vector3(0, 0, -1); const currentPosition = new THREE.Vector3(0, 0, -1);
    const handleMouseMove = (event) => { mouse.x = (event.clientX / window.innerWidth) * 2 - 1; mouse.y = -(event.clientY / window.innerHeight) * 2 + 1; };
    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => { if (!container) return; camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight); };
    window.addEventListener('resize', handleResize);

    let animationId; const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      uniforms.u_time.value = 0.25 * elapsed; uniforms.u_noiseScale.value = Math.sin(elapsed * 0.1) * 0.5 + 1.2;
      targetPosition.set(mouse.x * 1.2, mouse.y * 1.2, -1); currentPosition.lerp(targetPosition, 0.05); mesh.position.copy(currentPosition);
      renderer.render(scene, camera); animationId = requestAnimationFrame(animate);
    }; animate();

    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('resize', handleResize); cancelAnimationFrame(animationId); if (container && renderer.domElement) container.removeChild(renderer.domElement); geometry.dispose(); material.dispose(); renderer.dispose(); };
  }, [mounted, isLoggedIn]);

  useEffect(() => {
    const initAuth = async () => { try { await signInAnonymously(auth); } catch (err) { setFirebaseUser({ uid: "local-temp-guest", isAnonymous: true }); } };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => { if (user) setFirebaseUser(user); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser || !isLoggedIn || !threadsUsername || firebaseUser.uid === "local-temp-guest") return; 
    setIsLoading(true);
    const cleanUsername = threadsUsername.replace("@", "").trim().toLowerCase();
    const userRestaurantsRef = collection(db, 'artifacts', appId, 'users', cleanUsername, 'restaurants');
    const unsubscribe = onSnapshot(userRestaurantsRef, (snapshot) => {
      const list = []; snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      const sortedList = list.sort((a, b) => (b.savedAt?.seconds || 0) - (a.savedAt?.seconds || 0));
      setRestaurants(sortedList); setIsLoading(false);
    });
    return () => unsubscribe();
  }, [firebaseUser, isLoggedIn, threadsUsername]);

  // 🌟 改用 Overpass API (全球開源圖資，保證抓得到實時資料，無 CORS 問題)
  useEffect(() => {
    if (isLoggedIn && typeof window !== 'undefined' && navigator.geolocation && !hasSearchedRef.current) {
      hasSearchedRef.current = true;
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        triggerOverpassNearbySearch(latitude, longitude);
      }, (err) => {
        console.warn("Geolocation denied, loading fallback recommendations:", err);
        setNearbyRecommendations(TAIWAN_TRENDY_RECS);
      });
    }
  }, [isLoggedIn]);

  const triggerOverpassNearbySearch = async (lat, lng) => {
    setIsLocating(true);
    try {
      // 超狂優化的實時圖資抓取邏輯 (尋找周圍 3KM，且支援 node/way/relation 所有型態店家)
      const query = `
        [out:json][timeout:10];
        (
          nwr(around:3000, ${lat}, ${lng})["amenity"~"restaurant|cafe|fast_food|food_court|bar"];
          nwr(around:3000, ${lat}, ${lng})["shop"~"bakery|beverages|pastry"];
        );
        out center 12;
      `;
      const osmUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
      const response = await fetch(osmUrl);
      const data = await response.json();

      if (data && data.elements && data.elements.length > 0) {
        const formattedRecs = data.elements.map((el) => {
          const tags = el.tags || {};
          const name = tags.name || tags['name:zh'] || tags['name:en'];
          if (!name) return null; // 去除無名雜訊

          const rawCategory = tags.amenity || tags.shop || "在地美食";
          const autoCategory = getSmartTag(name, rawCategory);

          return {
            id: el.id.toString(),
            name: name,
            address: tags['addr:street'] ? `${tags['addr:city'] || ''}${tags['addr:street']}${tags['addr:housenumber'] || ''}` : "點擊查看地圖定位",
            category: autoCategory,
            note: "📍 透過實時地理圖資探測推薦。",
            tdxImage: null
          };
        }).filter(Boolean); // 過濾掉空值

        if (formattedRecs.length > 0) {
          setNearbyRecommendations(formattedRecs);
        } else {
          setNearbyRecommendations(TAIWAN_TRENDY_RECS);
        }
      } else {
        setNearbyRecommendations(TAIWAN_TRENDY_RECS);
      }
    } catch (err) { 
      console.error("Overpass API failed, switching to fallback database:", err); 
      setNearbyRecommendations(TAIWAN_TRENDY_RECS);
    }
    setIsLocating(false);
  };

  useEffect(() => {
    const fetchPlaces = async () => {
      if (!newRestName.trim() || !isTypingName) { setNameSuggestions([]); return; }
      setIsSearchingPlaces(true);
      try {
        let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(newRestName)}&format=json&addressdetails=1&limit=5&countrycodes=tw`;
        if (userLocation) {
          const lonDelta = 0.05; const latDelta = 0.05;
          url += `&viewbox=${userLocation.lng - lonDelta},${userLocation.lat + latDelta},${userLocation.lng + lonDelta},${userLocation.lat - latDelta}&bounded=0`;
        }
        const response = await fetch(url, { headers: { 'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8' } });
        const data = await response.json();
        setNameSuggestions(data || []);
      } catch (err) { console.error("Nominatim API error:", err); }
      setIsSearchingPlaces(false);
    };
    const timer = setTimeout(fetchPlaces, 800); return () => clearTimeout(timer);
  }, [newRestName, isTypingName, userLocation]);

  const handleSelectSuggestion = (place) => {
    const displayNameArray = place.display_name.split(',');
    const name = place.name || displayNameArray[0].trim();
    setNewRestName(name); setNewRestAddress(place.display_name || "");
    let rawCategory = place.type === "cafe" ? "咖啡廳" : place.type === "fast_food" ? "速食餐飲" : place.type === "bakery" ? "烘焙坊" : place.type === "beverages" ? "飲料店" : "餐廳";
    setNewRestCategory(getSmartTag(name, rawCategory)); setIsTypingName(false); setNameSuggestions([]);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!inputUsername.trim()) { setLoginError("請輸入您的 Threads ID"); return; }
    setIsGlobalTransitioning(true);
    setTimeout(() => {
      let formatted = inputUsername.trim(); if (!formatted.startsWith("@")) formatted = "@" + formatted;
      setThreadsUsername(formatted); setIsLoggedIn(true); setLoginError(""); setIsGlobalTransitioning(false);
    }, 2200);
  };

  const handleLogout = () => {
    setIsGlobalTransitioning(true);
    setTimeout(() => {
      setIsLoggedIn(false); setThreadsUsername(""); setInputUsername(""); setRestaurants([]); 
      setNearbyRecommendations([]); setDismissedRecommendationIds([]); hasSearchedRef.current = false; 
      setIsGlobalTransitioning(false);
    }, 1200);
  };

  const closeAddModal = () => { setIsClosingModal(true); setTimeout(() => { setShowAddModal(false); setIsClosingModal(false); }, 400); };

  const handleDeleteRestaurant = async (id) => {
    setDeletingIds(prev => [...prev, id]);
    setTimeout(async () => {
      if (firebaseUser?.uid === "local-temp-guest") { setRestaurants(prev => prev.filter(r => r.id !== id)); } 
      else {
        try {
          const cleanUsername = threadsUsername.replace("@", "").trim().toLowerCase();
          await deleteDoc(doc(db, 'artifacts', appId, 'users', cleanUsername, 'restaurants', id)); 
        } catch (err) { console.error("Delete error:", err); }
      }
      setDeletingIds(prev => prev.filter(delId => delId !== id));
    }, 400); 
  };

  const saveRecommendationWithAnimation = (rec) => {
    // 防重複驗證
    if (isDuplicateRestaurant(rec.name)) {
      setToastMessage(`⚠️ ${rec.name} 已在您的口袋名單中！`); setTimeout(() => setToastMessage(""), 3000); return;
    }

    setAnimatingRecId(rec.id);
    if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(40);
    setTimeout(async () => {
      setDismissedRecommendationIds(prev => [...prev, rec.id]);
      const smartCategory = getSmartTag(rec.name, rec.category);
      if (firebaseUser?.uid === "local-temp-guest") {
        const mockDoc = { id: Math.random().toString(), name: rec.name, address: rec.address, category: smartCategory, note: rec.note, recommendedBy: "系統探索", savedAt: { seconds: Math.floor(Date.now() / 1000) }, tdxImage: rec.tdxImage || "" };
        setRestaurants(prev => [mockDoc, ...prev]);
      } else {
        try {
          const cleanUsername = threadsUsername.replace("@", "").trim().toLowerCase();
          await addDoc(collection(db, 'artifacts', appId, 'users', cleanUsername, 'restaurants'), { name: rec.name, address: rec.address, category: smartCategory, note: rec.note, recommendedBy: "系統探索", savedAt: serverTimestamp(), tdxImage: rec.tdxImage || "" });
        } catch (err) { console.error("Error saving auto-recommendation:", err); }
      }
      setToastMessage(`🎉 已將 ${rec.name} 實體化至您的地圖！`); setTimeout(() => setToastMessage(""), 3000); setAnimatingRecId(null);
    }, 700);
  };

  const dismissRecommendation = (id) => setDismissedRecommendationIds(prev => [...prev, id]);

  const getFoodImage = (restaurant) => {
    if (restaurant?.tdxImage) return restaurant.tdxImage;
    const name = restaurant?.name || "";
    const images = [
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1525648199074-cee30ba79a4a?q=80&w=800&auto=format&fit=crop" 
    ];
    let sum = 0; for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return images[sum % images.length];
  };

  const handleShare = async (restaurant) => {
    const url = new URL(window.location.href);
    url.searchParams.set('share_name', restaurant.name || ''); url.searchParams.set('share_address', restaurant.address || ''); url.searchParams.set('share_category', restaurant.category || ''); url.searchParams.set('share_note', restaurant.note || ''); url.searchParams.set('share_by', restaurant.recommendedBy || threadsUsername.replace('@', ''));
    const shareUrl = url.toString(); const shareText = `這家感覺不錯！📍 ${restaurant.name}\n🏠 ${restaurant.address}\n✨ ${restaurant.note}\n\n— 來自 Fabrica Foodie`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Fabrica Foodie 推薦', text: shareText, url: shareUrl }); } 
      else { await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`); setToastMessage("專屬連結已複製到剪貼簿！"); setTimeout(() => setToastMessage(""), 3000); }
    } catch (err) { console.error('Share failed:', err); }
  };

  const clearSharedItem = () => {
    setSharedItem(null);
    if (typeof window !== 'undefined' && window.history.replaceState) {
      const url = new URL(window.location.href); url.search = ''; window.history.replaceState({}, document.title, url.toString());
    }
  };

  const handleAcceptShared = async () => {
    if (!sharedItem) return;

    if (isDuplicateRestaurant(sharedItem.name)) {
      setToastMessage(`⚠️ ${sharedItem.name} 已在您的口袋名單中！`); setTimeout(() => setToastMessage(""), 3000); clearSharedItem(); return;
    }

    const cleanRecommender = sharedItem.recommendedBy.replace("@", "").trim();
    const smartCategory = getSmartTag(sharedItem.name, sharedItem.category);
    if (firebaseUser?.uid === "local-temp-guest") {
      const mockDoc = { id: Math.random().toString(), name: sharedItem.name, address: sharedItem.address, category: smartCategory, note: sharedItem.note, recommendedBy: cleanRecommender, savedAt: { seconds: Math.floor(Date.now() / 1000) } };
      setRestaurants(prev => [mockDoc, ...prev]);
    } else {
      try {
        const cleanUsername = threadsUsername.replace("@", "").trim().toLowerCase();
        await addDoc(collection(db, 'artifacts', appId, 'users', cleanUsername, 'restaurants'), { name: sharedItem.name, address: sharedItem.address, category: smartCategory, note: sharedItem.note, recommendedBy: cleanRecommender, savedAt: serverTimestamp() });
      } catch (err) { console.error("Error adding shared document:", err); }
    }
    setToastMessage(`🎉 成功將 ${sharedItem.name} 收藏至您的地圖！`); setTimeout(() => setToastMessage(""), 3000); clearSharedItem();
  };

  const handleAddRestaurant = async (e) => {
    e.preventDefault(); if (!newRestName.trim()) return;

    if (isDuplicateRestaurant(newRestName)) {
      setToastMessage(`⚠️ ${newRestName} 已在您的口袋名單中！`); setTimeout(() => setToastMessage(""), 3000); return;
    }

    setIsGlobalTransitioning(true); 
    const smartCategory = getSmartTag(newRestName, newRestCategory);
    let finalNote = newRestNote;
    if (!finalNote.trim()) {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const payload = { contents: [{ parts: [{ text: `請分析台灣的這間餐廳：${newRestName} ${newRestAddress}。請綜合網路評價特色給出建議。` }] }], systemInstruction: { parts: [{ text: "你是一個高端美食顧問 Fabrica。請用 50-80 字精煉總結這家餐廳的真實網路評價、特色招牌菜色。請務必確保語意完整、順利結尾，絕不可話講一半。語氣要專業、具質感，不需加上 Markdown 標籤，直接給出純文字結果。" }] } };
        const geminiResponse = await fetch(geminiUrl, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(payload) });
        const geminiData = await geminiResponse.json();
        if (geminiData.error) { finalNote = `【AI 連線失敗】錯誤代碼：${geminiData.error.code}。詳細原因：${geminiData.error.message}`; } 
        else { finalNote = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "暫無 AI 分析結果，系統已將其加入您的口袋名單。"; }
      } catch (err) { finalNote = "連線 AI 引擎時發生網路錯誤，已為您預設儲存。"; }
    }
    const cleanRecommender = newRestRecommender.replace("@", "").trim();
    if (firebaseUser?.uid === "local-temp-guest") {
      const mockDoc = { id: Math.random().toString(), name: newRestName, address: newRestAddress || "僅提供店名定位", category: smartCategory, note: finalNote, recommendedBy: cleanRecommender, savedAt: { seconds: Math.floor(Date.now() / 1000) } };
      setRestaurants(prev => [mockDoc, ...prev]);
    } else {
      try {
        const cleanUsername = threadsUsername.replace("@", "").trim().toLowerCase();
        await addDoc(collection(db, 'artifacts', appId, 'users', cleanUsername, 'restaurants'), { name: newRestName, address: newRestAddress || "僅提供店名定位", category: smartCategory, note: finalNote, recommendedBy: cleanRecommender, savedAt: serverTimestamp() });
      } catch (err) { console.error("Error adding document:", err); }
    }
    setNewRestName(""); setNewRestAddress(""); setNewRestNote(""); setNewRestRecommender("");
    setTimeout(() => { setIsGlobalTransitioning(false); closeAddModal(); }, 1500);
  };

  const categories = ["全部", ...new Set(restaurants.map(r => getSmartTag(r.name, r.category).split(" • ")[0]))];
  const filteredRestaurants = restaurants.filter(restaurant => {
    const name = restaurant.name || ""; const address = restaurant.address || ""; 
    const note = restaurant.note || ""; const category = getSmartTag(name, restaurant.category);
    const recommender = restaurant.recommendedBy || ""; 
    const q = searchQuery.toLowerCase();
    const matchesSearch = name.toLowerCase().includes(q) || address.toLowerCase().includes(q) || note.toLowerCase().includes(q) || recommender.toLowerCase().includes(q.replace("@", "")); 
    const matchesCategory = selectedCategory === "全部" || category.startsWith(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  // 🌟 同步拖曳陣列與過濾後陣列 (以支援原生拖曳)
  useEffect(() => {
    setDisplayRestaurants(filteredRestaurants);
  }, [restaurants, searchQuery, selectedCategory]);

  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const _list = [...displayRestaurants];
    const draggedItemContent = _list.splice(dragItem.current, 1)[0];
    _list.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setDisplayRestaurants(_list);
  };

  const activeRecommendations = nearbyRecommendations.filter(rec => !dismissedRecommendationIds.includes(rec.id));

  return (
    <div className="relative min-h-screen text-[#1D1D1F] tracking-tight font-sans antialiased overflow-x-hidden overflow-y-scroll bg-[#F4F4F6]">
      
      {/* 🌟 登入後之 Blur Vignette + 原生 WebGL 彩色流體背景 */}
      {(isLoggedIn || isGlobalTransitioning) && (
        <BlurVignette blur="15px" className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)] opacity-100">
           <ColorfulBackground show={true} />
        </BlurVignette>
      )}

      {/* 🌟 頂級果凍 Loader 全局轉場覆蓋層 */}
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/40 backdrop-blur-3xl transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isGlobalTransitioning ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        <GooeyLoader />
      </div>

      {/* 登入前的黑白原生 3D 液態球體著色器背景 */}
      {!isLoggedIn && (
        <div 
          ref={canvasContainerRef} 
          className={`fixed inset-0 z-0 w-screen h-screen pointer-events-auto transition-opacity duration-1000 ease-in-out ${isGlobalTransitioning ? 'opacity-0 invisible' : 'opacity-100 visible'}`} 
        />
      )}

      {/* ==================== 頁面容器 ==================== */}
      <div className="relative z-10 w-full min-h-screen flex items-center justify-center">
        
        {!isLoggedIn ? (
          // --- 登入畫面 ---
          <div className="relative w-full min-h-screen flex flex-row justify-between items-stretch">
            
            {/* ⬅️ 左側跑馬燈 */}
            <div className="hidden md:flex flex-row justify-center gap-6 w-32 border-r border-black/5 bg-white/5 backdrop-blur-sm relative z-20">
              <VerticalMarquee direction="up" text="WELCOME TO FOODIE BETA TEST" />
              <VerticalMarquee direction="down" text="EXPLORE SHARE COLLECT" />
            </div>

            {/* 居中主登入卡片 */}
            <div className={`flex-1 flex flex-col justify-between px-6 py-10 max-w-sm mx-auto transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isGlobalTransitioning ? 'opacity-0 scale-[0.98] blur-md translate-y-4' : 'opacity-100 scale-100 blur-0 translate-y-0'} relative z-30`}>
              <div className="flex-1 flex flex-col justify-center space-y-10 py-8 pointer-events-auto">
                <div className="text-center space-y-5">
                  <div className="w-16 h-16 bg-black rounded-[20px] mx-auto flex items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.15)] transform hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3" strokeWidth="1.5"/></svg>
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-3xl font-extrabold tracking-tight text-black drop-shadow-sm">Foodie</h1>
                    <p className="text-sm text-[#86868B] font-medium leading-relaxed max-w-xs mx-auto drop-shadow-sm">
                      探索、珍藏、分享。<br />輸入 Threads 帳號，開啟您的專屬美食地圖。
                    </p>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-5 bg-white/45 backdrop-blur-xl border border-white/60 p-6 rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.03)] hover:shadow-lg transition-shadow">
                  <div className="space-y-3">
                    <div className="relative flex items-center w-full group">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-base font-semibold text-[#86868B] select-none pointer-events-none group-focus-within:text-black transition-colors">@</span>
                      <input type="text" placeholder="輸入您的 Threads 帳號" value={inputUsername} onChange={(e) => setInputUsername(e.target.value.replace("@", ""))} className="w-full bg-white/80 text-base font-medium rounded-2xl py-4.5 pl-12 pr-5 border border-[#D2D2D7] focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all duration-300 placeholder-[#86868B]/70 shadow-[0_2px_8px_rgba(0,0,0,0.01)]" />
                    </div>
                  </div>
                  <button type="submit" className="group relative cursor-pointer w-full h-[56px] border border-[#D2D2D7] bg-white rounded-2xl overflow-hidden text-[#1D1D1F] font-semibold transition-all duration-300 shadow-sm hover:shadow-md active:scale-[0.98] outline-none">
                    <div className="absolute inset-0 flex items-center justify-center translate-x-0 group-hover:translate-x-16 group-hover:opacity-0 transition-all duration-300 z-20 pointer-events-none select-none">進入美食檔案</div>
                    <div className="absolute inset-0 flex gap-2 items-center justify-center text-white z-20 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none select-none">
                      <span className="font-semibold text-sm">進入美食檔案</span><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-[#1D1D1F] scale-0 group-hover:scale-[35] transition-transform duration-500 ease-out z-10"></div>
                  </button>
                </form>
              </div>
              <footer className="text-center text-xs text-[#86868B] pt-4 pointer-events-none"><p className="font-semibold text-[#1D1D1F]/40">© Fabrica</p></footer>
            </div>

            {/* ➡️ 右側跑馬燈 */}
            <div className="hidden md:flex flex-row justify-center gap-6 w-32 border-l border-black/5 bg-white/5 backdrop-blur-sm relative z-20">
              <VerticalMarquee direction="down" text="EXPLORE SHARE COLLECT" />
              <VerticalMarquee direction="up" text="WELCOME TO FOODIE BETA TEST" />
            </div>

          </div>

        ) : (
          // --- 登入後主檔案庫面板 ---
          <div className={`w-full pb-10 min-h-screen transition-all duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isGlobalTransitioning ? 'opacity-0 translate-y-12 scale-[0.97] blur-md' : 'opacity-100 translate-y-0 scale-100 blur-0'}`}>
            <header className="sticky top-0 z-40 bg-white/40 backdrop-blur-2xl border-b border-white/30 px-6 py-4 shadow-[0_4px_30px_rgba(0,0,0,0.05)]">
              <div className="max-w-md mx-auto flex justify-between items-center">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider text-[#555555] uppercase">FABRICA MAPS</span>
                    {firebaseUser?.uid === "local-temp-guest" ? (
                      <span className="inline-flex items-center text-[9px] font-semibold text-[#FF9500] bg-[#FF9500]/10 px-2 py-0.5 rounded-md"><span className="w-1 h-1 bg-[#FF9500] rounded-full mr-1 animate-pulse" /> 本地暫存</span>
                    ) : (
                      <span className="inline-flex items-center text-[9px] font-semibold text-[#34C759] bg-[#34C759]/20 px-2 py-0.5 rounded-md backdrop-blur-sm"><span className="w-1 h-1 bg-[#34C759] rounded-full mr-1" /> 雲端連線</span>
                    )}
                  </div>
                  <h1 className="text-lg font-bold tracking-tight text-black mt-0.5">{threadsUsername}</h1>
                </div>
                <button onClick={handleLogout} className="text-xs font-semibold text-[#555555] hover:text-black hover:bg-white/60 bg-white/40 backdrop-blur-md border border-white/50 px-3.5 py-1.5 rounded-full transition-all duration-300 shadow-sm active:scale-95">登出</button>
              </div>
            </header>

            <main className="max-w-md mx-auto px-4 mt-6 space-y-6 relative z-10">
              
              <button onClick={() => setShowAddModal(true)} className="w-full bg-white/60 backdrop-blur-xl hover:bg-white/80 active:scale-95 transition-all duration-300 py-3.5 rounded-2xl border border-white/50 text-sm font-bold text-[#1D1D1F] flex items-center justify-center gap-2 shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>手動新增口袋名單
              </button>

              <section className="space-y-4">
                <div className="relative flex items-center w-full group">
                  <svg className="w-4 h-4 text-[#86868B] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none select-none group-focus-within:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
                  <input type="text" placeholder="搜尋餐廳、地址或推薦人..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white/60 backdrop-blur-xl text-sm font-medium rounded-2xl py-3 pl-10 pr-4 border border-white/50 focus:bg-white/90 focus:ring-2 focus:ring-black/10 outline-none transition-all duration-300 shadow-sm placeholder-[#86868B]" />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 active:scale-95 ${selectedCategory === cat ? 'bg-black/80 backdrop-blur-md text-white shadow-md' : 'bg-white/50 backdrop-blur-md text-[#555] border border-white/40 hover:bg-white/80 hover:text-black'}`}>{cat}</button>
                  ))}
                  <div className="w-2 flex-shrink-0" />
                </div>
              </section>

              {/* 附近推薦區域 (真實圖資整合) */}
              {activeRecommendations.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-[13px] font-bold text-[#555] uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-sm w-fit px-2 py-0.5 rounded-lg bg-white/20 shadow-[inset_0_1px_4px_rgba(255,255,255,0.4)]">
                    <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>附近探索與精選名店
                  </h2>
                  <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                    {activeRecommendations.map(rec => (
                      <LiquidGlassCard key={rec.id} className={`group flex-shrink-0 w-64 p-2 transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${animatingRecId === rec.id ? 'scale-[0.8] opacity-0' : 'scale-100 opacity-100 hover:shadow-lg'}`}>
                        <figure className='w-full h-40 relative overflow-hidden rounded-[18px] bg-black/5'>
                          <img src={getFoodImage(rec)} alt={rec.name} className='w-full h-full object-cover transition-transform duration-700 group-hover:scale-110' />
                          <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent'></div>
                          <span className="absolute top-3 left-3 text-[10px] font-bold text-white bg-black/40 backdrop-blur-md px-2 py-1 rounded-md shadow-sm border border-white/20">{rec.category}</span>
                          <h3 className='absolute bottom-3 left-3 right-3 font-bold text-white text-base line-clamp-1 drop-shadow-md'>{rec.name}</h3>
                        </figure>
                        
                        <article className='p-3 pt-2 space-y-1 relative'>
                          <p className="text-[11px] text-[#555] line-clamp-1 mt-0.5 font-medium">{rec.address}</p>
                          <div className='flex gap-2 pt-2 transition-all duration-300'>
                            <button onClick={() => dismissRecommendation(rec.id)} className="flex-1 py-2 text-[11px] font-bold text-[#555] hover:bg-white/80 bg-white/40 rounded-xl transition-all active:scale-95 shadow-sm border border-white/40">略過</button>
                            <button onClick={() => saveRecommendationWithAnimation(rec)} className="flex-1 py-2 text-[11px] font-bold text-[#0071E3] hover:bg-[#0071E3]/10 bg-white/60 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1 shadow-sm border border-white/40">
                              實體化 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                            </button>
                          </div>
                        </article>
                      </LiquidGlassCard>
                    ))}
                    <div className="w-6 flex-shrink-0" />
                  </div>
                </section>
              )}

              {/* 🌟 餐廳列表 (支援原生 Drag & Drop，取代 Swapy) */}
              <section className="space-y-4 pb-10">
                {isLoading ? (
                  <div className="text-center py-10">
                    <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto opacity-50"></div>
                  </div>
                ) : displayRestaurants.length > 0 ? (
                  displayRestaurants.map((restaurant, index) => {
                    const smartCategory = getSmartTag(restaurant.name, restaurant.category);
                    return (
                      <div
                        key={restaurant.id}
                        draggable
                        onDragStart={(e) => { dragItem.current = index; e.currentTarget.classList.add('opacity-40', 'scale-[0.98]', 'shadow-2xl'); }}
                        onDragEnter={(e) => { dragOverItem.current = index; }}
                        onDragEnd={(e) => { handleSort(); e.currentTarget.classList.remove('opacity-40', 'scale-[0.98]', 'shadow-2xl'); }}
                        onDragOver={(e) => e.preventDefault()}
                        className={`group cursor-move transition-transform duration-200 ${deletingIds.includes(restaurant.id) ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
                        onClick={() => setSelectedRestaurant(restaurant)}
                      >
                        <LiquidGlassCard className="p-2 transition-all hover:-translate-y-1 hover:shadow-lg">
                          {/* 拖曳提示小把手 (Drag Grip) */}
                          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex gap-1 px-3 py-1.5 bg-black/40 backdrop-blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-1 h-1 bg-white/80 rounded-full"></div><div className="w-1 h-1 bg-white/80 rounded-full"></div><div className="w-1 h-1 bg-white/80 rounded-full"></div>
                          </div>

                          <figure className='w-full h-56 relative overflow-hidden rounded-[18px] bg-black/5'>
                            <img src={getFoodImage(restaurant)} alt={restaurant.name} className='w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none' />
                            <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-80 group-hover:opacity-100 transition-opacity duration-300'></div>
                            <span className="absolute top-3 left-3 text-[10px] font-bold text-white bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/20 shadow-sm z-10">{smartCategory}</span>
                            
                            {restaurant.recommendedBy && (
                              <a href={`https://www.threads.net/@${restaurant.recommendedBy.replace('@', '')}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute top-3 right-3 z-20 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 text-[10px] font-bold text-[#1D1D1F] shadow-md hover:scale-110 transition-transform">
                                <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-purple-500 to-orange-400 flex items-center justify-center text-white text-[8px]">{restaurant.recommendedBy.replace('@', '').charAt(0).toUpperCase()}</div>@{restaurant.recommendedBy.replace('@', '')}
                              </a>
                            )}
                            <div className="absolute bottom-3 left-4 right-4 z-10 transition-transform duration-300 group-hover:-translate-y-1">
                               <h3 className='text-xl font-bold text-white leading-tight line-clamp-1 drop-shadow-md'>{restaurant.name}</h3>
                               <div className="flex items-center gap-1 mt-1 text-white/90 text-xs">
                                 <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3" strokeWidth="2"/></svg>
                                 <span className="line-clamp-1 drop-shadow-sm font-medium">{restaurant.address}</span>
                               </div>
                            </div>
                          </figure>

                          <article className='px-3 pt-3 pb-2 relative pointer-events-auto'>
                            {restaurant.note && <p className='text-[13px] text-[#444] font-medium leading-relaxed line-clamp-2'>{restaurant.note}</p>}
                            <div className='flex justify-between items-center pt-3 mt-2 border-t border-black/10'>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteRestaurant(restaurant.id); }} className="flex items-center gap-1.5 text-xs font-bold text-[#FF3B30] hover:bg-white/60 px-3 py-1.5 rounded-lg transition-all active:scale-95 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>刪除
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleShare(restaurant); }} className="flex items-center gap-1 text-xs font-bold text-[#1D1D1F] hover:bg-white/60 px-3 py-1.5 rounded-lg transition-all active:scale-95 ml-auto shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                                分享名單 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                              </button>
                            </div>
                          </article>
                        </LiquidGlassCard>
                      </div>
                    );
                  })
                ) : (
                  <LiquidGlassCard className="text-center py-16 px-4">
                    <div className="w-16 h-16 bg-white/60 backdrop-blur-md rounded-full mx-auto flex items-center justify-center shadow-sm border border-white/50 mb-4 hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                    </div>
                    <h3 className="text-[#1D1D1F] font-bold mb-1">找不到相關餐廳</h3>
                    <p className="text-sm text-[#555] font-medium">嘗試不同的搜尋關鍵字或分類</p>
                  </LiquidGlassCard>
                )}
              </section>

              <footer className="text-center text-xs text-[#86868B]/60 pt-8 pb-4 mix-blend-overlay">
                <p className="font-black tracking-widest text-[11px] uppercase mb-1">FABRICA FOODIE</p>
                <p className="font-semibold">© Fabrica All Rights Reserved.</p>
              </footer>
            </main>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 🌟 彈出式視窗 (Modals) */}
      {/* ========================================== */}

      {/* 新增餐廳 Modal */}
      {showAddModal && (
        <div className={`fixed inset-0 z-[120] flex items-end sm:items-center justify-center px-0 sm:px-4 pb-0 sm:pb-10 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isClosingModal ? 'opacity-0' : 'opacity-100'}`}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeAddModal} />
          <div className={`relative w-full max-w-md bg-white/90 backdrop-blur-2xl rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl border border-white/50 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isClosingModal ? 'translate-y-full sm:translate-y-10 sm:scale-95 blur-sm' : 'translate-y-0 sm:scale-100 blur-0'} max-h-[90vh] overflow-y-auto`}>
            <div className="w-12 h-1.5 bg-[#D2D2D7] rounded-full mx-auto mb-6 sm:hidden" />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-black tracking-tight">新增口袋名單</h2>
              <button onClick={closeAddModal} className="w-8 h-8 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-full text-[#555] transition-all active:scale-90"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <form onSubmit={handleAddRestaurant} className="space-y-4">
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-[#86868B] ml-1 uppercase tracking-wider">店名 *</label>
                <input required type="text" placeholder="例如：詹記麻辣火鍋" value={newRestName} onChange={(e) => { setNewRestName(e.target.value); setIsTypingName(true); }} className="w-full bg-black/5 text-sm font-bold rounded-xl py-3.5 px-4 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all shadow-inner" />
                {isTypingName && (nameSuggestions.length > 0 || isSearchingPlaces) && (
                  <div className="absolute top-[76px] left-0 right-0 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-black/10 overflow-hidden z-50 max-h-48 overflow-y-auto animate-fade-in-up">
                    {isSearchingPlaces ? (
                       <div className="p-3 text-xs text-center text-[#86868B] animate-pulse">搜尋地圖座標中...</div>
                    ) : (
                       nameSuggestions.map(place => (
                         <div key={place.place_id} onClick={() => handleSelectSuggestion(place)} className="p-3 hover:bg-black/5 cursor-pointer border-b border-black/5 last:border-0 transition-colors">
                           <div className="font-bold text-sm text-[#1D1D1F] text-left">{place.name || place.display_name.split(',')[0]}</div>
                           <div className="text-[11px] text-[#86868B] mt-0.5 line-clamp-1 text-left font-medium">{place.display_name}</div>
                         </div>
                       ))
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#86868B] ml-1 uppercase tracking-wider">分類 (系統將智慧修正)</label>
                <input type="text" placeholder="例如：日式甜點 • 咖啡廳" value={newRestCategory} onChange={(e) => setNewRestCategory(e.target.value)} className="w-full bg-black/5 text-sm font-bold rounded-xl py-3.5 px-4 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all shadow-inner" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#86868B] ml-1 uppercase tracking-wider">地址或區域</label>
                <input type="text" placeholder="例如：台北市中山區" value={newRestAddress} onChange={(e) => setNewRestAddress(e.target.value)} className="w-full bg-black/5 text-sm font-bold rounded-xl py-3.5 px-4 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all shadow-inner" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#86868B] ml-1 uppercase tracking-wider">推薦人 (Threads 帳號)</label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#86868B] group-focus-within:text-black transition-colors">@</span>
                  <input type="text" placeholder="推薦人帳號" value={newRestRecommender} onChange={(e) => setNewRestRecommender(e.target.value)} className="w-full bg-black/5 text-sm font-bold rounded-xl py-3.5 pl-9 pr-4 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all shadow-inner" />
                </div>
              </div>
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-bold text-[#86868B] uppercase tracking-wider">筆記與短評</label>
                  <span className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#0071E3] to-[#A334FA] flex items-center gap-1">
                    <svg className="w-3 h-3 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>空白時由 AI 自動產生
                  </span>
                </div>
                <textarea placeholder="寫下你想記住的餐點或特色，或是留白讓 Fabrica AI 幫你總結網路評價..." value={newRestNote} onChange={(e) => setNewRestNote(e.target.value)} className="w-full bg-black/5 text-sm font-bold rounded-xl py-3.5 px-4 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all min-h-[100px] resize-none shadow-inner" />
              </div>
              <button type="submit" className="w-full bg-black/90 text-white font-bold py-4 rounded-xl mt-4 hover:bg-black active:scale-95 transition-all shadow-xl">儲存至地圖</button>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 餐廳詳細資訊 Modal */}
      {selectedRestaurant && !isGlobalTransitioning && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center px-4 bg-black/50 backdrop-blur-md animate-fade-in" onClick={() => setSelectedRestaurant(null)}>
          <div className="bg-white/95 backdrop-blur-3xl w-full max-w-sm rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative animate-bounce-in max-h-[85vh] flex flex-col border border-white/50" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedRestaurant(null)} className="absolute top-4 right-4 z-30 w-8 h-8 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-all active:scale-90">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <BlurVignette blur="8px" className="h-56 w-full flex-shrink-0 bg-black/5">
              <img src={getFoodImage(selectedRestaurant)} className="w-full h-full object-cover" alt="food" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 z-10"></div>
              <div className="absolute bottom-5 left-5 right-5 z-20">
                <span className="text-[10px] font-bold text-white bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-md inline-block mb-2 border border-white/20 shadow-sm">{getSmartTag(selectedRestaurant.name, selectedRestaurant.category)}</span>
                <h2 className="text-2xl font-bold text-white leading-tight drop-shadow-lg">{selectedRestaurant.name}</h2>
              </div>
            </BlurVignette>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-start gap-2 text-xs font-medium text-[#555] mb-6 bg-black/5 p-3 rounded-xl border border-black/5">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3" strokeWidth="2"/></svg>
                <span className="leading-relaxed">{selectedRestaurant.address}</span>
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#888] uppercase tracking-wider mb-2.5 flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>筆記與 AI 短評</h4>
                <p className="text-[14px] text-[#222] font-medium leading-loose break-words whitespace-pre-wrap pl-1">{selectedRestaurant.note || "尚無筆記。"}</p>
              </div>
            </div>
            <div className="p-5 bg-white/80 backdrop-blur-xl border-t border-black/5 flex-shrink-0">
              <a href={getFreeMapAppUrl(selectedRestaurant.name, selectedRestaurant.address)} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 py-4 bg-[#1D1D1F] text-white font-bold rounded-2xl hover:bg-black transition-all shadow-xl active:scale-[0.98]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>查看地點
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 朋友推薦的 SHARED 彈出小卡 */}
      {isLoggedIn && sharedItem && !isGlobalTransitioning && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center px-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white/95 backdrop-blur-3xl w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative scale-100 animate-bounce-in border border-white/50">
            <BlurVignette blur="8px" className="h-56 w-full relative">
              <img src={getFoodImage(sharedItem)} className="w-full h-full object-cover" alt="food" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10"></div>
              <div className="absolute top-4 left-4 z-20 bg-black/50 backdrop-blur-xl text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 tracking-wider shadow-sm border border-white/20"><svg className="w-3.5 h-3.5 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>SHARED • 好友私藏推薦</div>
              <div className="absolute bottom-4 left-5 right-5 z-20"><span className="text-[10px] font-bold text-white bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-md inline-block mb-1 border border-white/20">{getSmartTag(sharedItem.name, sharedItem.category)}</span><h2 className="text-2xl font-bold text-white leading-tight drop-shadow-md">{sharedItem.name}</h2></div>
            </BlurVignette>
            <div className="p-6">
              <div className="flex items-start gap-1.5 text-xs font-medium text-[#555] mb-5 bg-black/5 p-2 rounded-lg"><svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3" strokeWidth="2"/></svg><span className="line-clamp-2 leading-relaxed">{sharedItem.address}</span></div>
              {sharedItem.note && <div className="bg-black/5 p-4 rounded-2xl mb-6 border border-black/5 shadow-inner"><p className="text-[13px] text-[#222] font-medium leading-relaxed break-words relative pl-3"><span className="absolute left-0 top-0 text-[#888] text-lg font-serif">"</span>{sharedItem.note}</p></div>}
              <div className="flex items-center gap-2 text-xs font-bold text-[#888] mb-6 w-full justify-center"><div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-orange-400 flex items-center justify-center text-white text-[11px] shadow-sm transform hover:scale-110 transition-transform">{sharedItem.recommendedBy.charAt(0).toUpperCase()}</div>這間店由 <span className="text-black">@{sharedItem.recommendedBy}</span> 推薦給您</div>
              <div className="flex gap-3"><button onClick={clearSharedItem} className="flex-[1] py-3.5 bg-black/5 text-[#555] hover:bg-black/10 hover:text-black font-bold rounded-xl transition-all active:scale-95 text-sm">沒興趣</button><button onClick={handleAcceptShared} className="flex-[2] py-3.5 bg-[#1D1D1F] text-white font-bold rounded-xl hover:bg-black transition-all shadow-xl active:scale-95 text-sm flex items-center justify-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>收下名單</button></div>
            </div>
          </div>
        </div>
      )}

      {/* 全域 Toast 通知 */}
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[150] animate-fade-in-up">
          <div className="bg-black/80 backdrop-blur-xl text-white px-5 py-3.5 rounded-full shadow-2xl flex items-center gap-2.5 border border-white/20">
            <div className="w-5 h-5 bg-[#34C759] rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(52,199,89,0.5)]"><svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg></div>
            <span className="text-sm font-bold tracking-wide">{toastMessage}</span>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
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
    </div>
  );
}
