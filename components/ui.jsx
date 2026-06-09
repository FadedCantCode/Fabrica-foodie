"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

// ─── SlideButton — 主要 CTA 按鈕，文字滑出 + 圓形填充滑入 ───────────────────
export const SlideButton = ({
  children, onClick, className,
  type = "button", disabled = false, dark = false,
}) => (
  <button
    type={type}
    disabled={disabled}
    onClick={disabled ? undefined : onClick}
    className={`
      group relative cursor-pointer overflow-hidden
      w-full rounded-2xl font-semibold select-none
      transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
      active:scale-[0.96]
      disabled:opacity-40 disabled:cursor-not-allowed
      ${dark
        ? 'bg-black text-white border border-white/10 shadow-lg'
        : 'bg-white text-[#1D1D1F] border border-[#D2D2D7] shadow-sm hover:shadow-md'
      }
      ${className}
    `}
  >
    {/* Original text — slides up and fades out */}
    <span className="
      absolute inset-0 flex items-center justify-center gap-2
      transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
      translate-y-0 opacity-100
      group-hover:-translate-y-full group-hover:opacity-0
    ">
      {children}
    </span>

    {/* Slide-in text with arrow — slides up from bottom */}
    <span className={`
      absolute inset-0 flex items-center justify-center gap-2
      transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
      translate-y-full opacity-0
      group-hover:translate-y-0 group-hover:opacity-100
      z-20
      ${dark ? 'text-black' : 'text-white'}
    `}>
      {children}
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
      </svg>
    </span>

    {/* Circle fill expanding on hover */}
    <span className={`
      absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
      h-8 w-8 rounded-full z-10
      scale-0 group-hover:scale-[35]
      transition-transform duration-500 ease-out pointer-events-none
      ${dark ? 'bg-white' : 'bg-[#1D1D1F]'}
    `} />
  </button>
);

// ─── AppleButton — 小按鈕用，ripple + scale ───────────────────────────────────
export const AppleButton = ({
  children, onClick, className,
  type = "button", disabled = false, dark = false,
}) => {
  const [ripples, setRipples] = useState([]);
  const handleClick = (e) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const id   = Date.now();
    setRipples(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top, id }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);
    onClick?.(e);
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={`
        relative overflow-hidden select-none
        transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
        active:scale-[0.95]
        disabled:opacity-40 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {ripples.map(r => (
        <span key={r.id}
          className={`absolute rounded-full animate-ripple pointer-events-none ${dark ? 'bg-white/25' : 'bg-black/10'}`}
          style={{ left: r.x - 40, top: r.y - 40, width: 80, height: 80 }}
        />
      ))}
      {children}
    </button>
  );
};

// ─── LiquidGlassCard ──────────────────────────────────────────────────────────
export const LiquidGlassCard = ({ children, className, onClick, disabled }) => (
  <div
    onClick={disabled ? undefined : onClick}
    className={`
      relative overflow-hidden bg-white/40 backdrop-blur-2xl
      border border-white/50 rounded-[24px]
      transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-[0.96] hover:scale-[1.02] cursor-pointer'}
      ${className}
    `}
    style={{ boxShadow: "inset 0 0 15px rgba(255,255,255,0.6), 0 8px 32px 0 rgba(0,0,0,0.06)" }}
  >
    <div className="absolute inset-0 pointer-events-none rounded-[24px] border border-white/40 mix-blend-overlay" />
    {children}
  </div>
);

// ─── SuccessCheck ─────────────────────────────────────────────────────────────
export const SuccessCheck = () => (
  <div className="w-16 h-16 rounded-full bg-[#34C759] flex items-center justify-center animate-success-pop shadow-[0_0_30px_rgba(52,199,89,0.45)]">
    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" className="animate-check-path" />
    </svg>
  </div>
);

// ─── GooeyLoader ─────────────────────────────────────────────────────────────
export const GooeyLoader = () => (
  <div className="relative w-[260px] h-[260px] flex items-center justify-center">
    <style>{`
      .gl-wrap{width:260px;height:260px;position:absolute;overflow:hidden;border-radius:60px;filter:url(#gl-goo)}
      .gl-center{position:absolute;background:#1D1D1F;top:50%;left:50%;width:28px;height:28px;transform-origin:left top;transform:scale(.9) translate(-50%,-50%);animation:gl-grow 3.4s linear infinite;border-radius:50%;box-shadow:0 -10px 40px -5px #1D1D1F}
      .gl-blob{position:absolute;background:#1D1D1F;top:50%;left:50%;width:28px;height:28px;border-radius:50%;animation:gl-move ease-out 3.4s infinite;transform:scale(.9) translate(-50%,-50%);transform-origin:center top;opacity:0}
      .gl-blob:nth-child(2){animation-delay:.2s}.gl-blob:nth-child(3){animation-delay:.4s}.gl-blob:nth-child(4){animation-delay:.6s}.gl-blob:nth-child(5){animation-delay:.8s}.gl-blob:nth-child(6){animation-delay:1s}
      @keyframes gl-move{0%{opacity:0;transform:scale(0) translate(calc(-300px - 50%),-50%)}1%{opacity:1}35%,65%{opacity:1;transform:scale(.9) translate(-50%,-50%)}99%{opacity:1}100%{opacity:0;transform:scale(0) translate(calc(300px - 50%),-50%)}}
      @keyframes gl-grow{0%,39%{transform:scale(0) translate(-50%,-50%)}52%{transform:scale(1.5,1.4) translate(-50%,-50%)}68%,70%{transform:scale(1.7,1.5) translate(-50%,-50%)}92%,100%{transform:scale(0) translate(-50%,-50%)}}
    `}</style>
    <div className="gl-wrap">
      <div className="gl-center"/>
      <div className="gl-blob"/><div className="gl-blob"/>
      <div className="gl-blob"/><div className="gl-blob"/>
      <div className="gl-blob"/>
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" className="hidden absolute">
      <defs>
        <filter id="gl-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur"/>
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo"/>
          <feBlend in="SourceGraphic" in2="goo"/>
        </filter>
      </defs>
    </svg>
  </div>
);

// ─── BlurVignette ─────────────────────────────────────────────────────────────
export const BlurVignette = ({ children, className, blur = '35px', vignetteOpacity = 0.96 }) => (
  <div className={`relative ${className}`}>
    {children}
    <div className="absolute inset-0 pointer-events-none z-10"
      style={{
        boxShadow:       `inset 0 0 150px 65px rgba(0,0,0,${vignetteOpacity})`,
        backdropFilter:  `blur(${blur})`,
        maskImage:       `radial-gradient(circle at center, transparent 25%, black 90%)`,
        WebkitMaskImage: `radial-gradient(circle at center, transparent 25%, black 90%)`,
      }}
    />
  </div>
);

// ─── VerticalMarquee ─────────────────────────────────────────────────────────
export const VerticalMarquee = ({ direction = "up", text = "WELCOME TO FOODIE" }) => (
  <div className="relative w-16 h-screen overflow-hidden flex justify-center items-center select-none bg-black/[0.02]">
    <div className="absolute w-[400vh] flex items-center justify-center rotate-90">
      <div className={`flex gap-16 whitespace-nowrap text-black font-black text-4xl md:text-5xl tracking-[0.3em] will-change-transform ${direction === "up" ? "animate-marquee-up" : "animate-marquee-down"}`}>
        {Array(15).fill(text).map((t, i) => <span key={i}>{t}</span>)}
      </div>
    </div>
  </div>
);

// ─── StepPips ─────────────────────────────────────────────────────────────────
export const StepPips = ({ currentStep, dark = false }) => {
  const steps     = ["輸入帳號", "發文驗證", "確認身分"];
  const stepIndex = currentStep === "idle" ? 0 : currentStep === "code_shown" ? 1 : 2;
  return (
    <div className="flex items-center justify-center gap-2 mb-5">
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1">
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
              transition-all duration-500
              ${i < stepIndex  ? "bg-[#34C759] text-white"
              : i === stepIndex ? (dark ? "bg-white text-black scale-110" : "bg-black text-white scale-110 shadow-[0_0_12px_rgba(0,0,0,0.18)]")
              :                   (dark ? "bg-white/10 text-white/30" : "bg-black/10 text-[#86868B]")}
            `}>
              {i < stepIndex
                ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                : i + 1}
            </div>
            <span className={`text-[9px] font-semibold transition-colors duration-300 ${i === stepIndex ? (dark ? "text-white/60" : "text-black") : (dark ? "text-white/20" : "text-[#86868B]")}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-8 mb-4 transition-all duration-500 ${i < stepIndex ? "bg-[#34C759]" : (dark ? "bg-white/10" : "bg-black/10")}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ─── Toast ────────────────────────────────────────────────────────────────────
export const Toast = ({ message, type = "success" }) => {
  if (!message) return null;
  const bg     = { success: "bg-black/80", error: "bg-[#FF3B30]/85", info: "bg-black/70" };
  const iconBg = { success: "bg-[#34C759] shadow-[0_0_10px_rgba(52,199,89,0.5)]", error: "bg-white/30", info: "bg-white/20" };
  const Icon   = {
    success: <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>,
    error:   <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>,
    info:    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01"/></svg>,
  };
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[150] animate-fade-in-up pointer-events-none">
      <div className={`${bg[type]} backdrop-blur-xl text-white px-5 py-3.5 rounded-full shadow-2xl flex items-center gap-2.5 border border-white/20`}>
        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg[type]}`}>
          {Icon[type]}
        </div>
        <span className="text-sm font-bold tracking-wide">{message}</span>
      </div>
    </div>
  );
};

// ─── ModalSheet ───────────────────────────────────────────────────────────────
export const ModalSheet = ({ show, onClose, children, zIndex = 120, disableClose = false }) => {
  const [closing, setClosing] = useState(false);
  const handleClose = () => {
    if (disableClose) return;
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose(); }, 360);
  };
  if (!show) return null;
  return (
    <div className={`fixed inset-0 flex items-end sm:items-center justify-center px-0 sm:px-4 pb-0 sm:pb-10 animate-fade-in`}
      style={{ zIndex }}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={handleClose} />
      <div className={`
        relative w-full max-w-md bg-white/95 backdrop-blur-2xl
        rounded-t-[32px] sm:rounded-[32px]
        shadow-[0_20px_60px_rgba(0,0,0,0.22)] border border-white/50
        max-h-[92vh] overflow-y-auto
        ${closing ? 'animate-slide-down-out' : 'animate-slide-up'}
      `}>
        <div className="w-12 h-1.5 bg-[#D2D2D7] rounded-full mx-auto mt-4 mb-2 sm:hidden" />
        {children}
      </div>
    </div>
  );
};

// ─── ColorfulBackground (Three.js) ───────────────────────────────────────────
export const ColorfulBackground = ({ show }) => {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scene    = new THREE.Scene();
    const camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    const uniforms = {
      u_time:       { value: 0 },
      u_resolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,
      fragmentShader: `
        uniform float u_time;uniform vec2 u_resolution;varying vec2 vUv;
        vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
        vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
        vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
        float snoise(vec2 v){
          const vec4 C=vec4(.211324865,.366025404,-.577350269,.024390244);
          vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
          vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
          vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);
          vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
          vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);
          m=m*m;m=m*m;vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;
          vec3 ox=floor(x+.5);vec3 a0=x-ox;
          m*=1.79284291-.85373472*(a0*a0+h*h);
          vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
          return 130.*dot(m,g);
        }
        void main(){
          vec2 uv=gl_FragCoord.xy/u_resolution.xy;float t=u_time*.2;
          float n1=snoise(uv*1.5+vec2(t,t*.5));float n2=snoise(uv*2.-vec2(t*.3,t*.8));
          vec2 d=uv+vec2(n1,n2)*.2;
          vec3 c1=vec3(.97,.96,.94);vec3 c2=vec3(.08,.07,.06);vec3 c3=vec3(.78,.76,.73);
          float m1=smoothstep(0.,1.,sin(d.x*4.+t)*.5+.5);
          float m2=smoothstep(0.,1.,cos(d.y*3.-t)*.5+.5);
          vec3 fc=mix(c1,c2,m1);fc=mix(fc,c3,m2);
          gl_FragColor=vec4(fc,1.);
        }
      `,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    let rafId;
    const animate = (t) => { uniforms.u_time.value = t * 0.001; renderer.render(scene, camera); rafId = requestAnimationFrame(animate); };
    animate(0);
    const onResize = () => { if (!container) return; renderer.setSize(container.clientWidth, container.clientHeight); uniforms.u_resolution.value.set(container.clientWidth, container.clientHeight); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(rafId); if (container && renderer.domElement) container.removeChild(renderer.domElement); material.dispose(); renderer.dispose(); };
  }, []);
  return (
    <div ref={containerRef}
      className={`fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000 ${show ? 'opacity-100' : 'opacity-0'}`}
    />
  );
};

// ─── GlobalStyles — 注入所有動畫（CDN Tailwind 無法編譯的部分）────────────────
export const GlobalStyles = () => null; // 動畫已移到 layout.jsx 的 <style> 裡
