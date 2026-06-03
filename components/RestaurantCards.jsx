"use client";

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { AppleButton, BlurVignette } from './ui';
import { getFoodImage, getFreeMapAppUrl, getSmartTag } from '../lib/helpers';

// ─── Global gyroscope singleton ───────────────────────────────────────────────
const gyroListeners = new Set();
let gyroStarted = false;
let baseGamma = null, baseBeta = null;
let smoothX = 0.5, smoothY = 0.5;
const ALPHA = 0.1;

function startGlobalGyro() {
  if (gyroStarted) return;
  gyroStarted = true;
  baseGamma = null; baseBeta = null;
  window.addEventListener('deviceorientation', (e) => {
    const beta  = e.beta  ?? 0;
    const gamma = e.gamma ?? 0;
    if (baseGamma === null) { baseGamma = gamma; baseBeta = beta; }
    const dG = gamma - baseGamma;
    const dB = beta  - baseBeta;
    const rawX = Math.max(0, Math.min(1, (dG / 28) * 0.5 + 0.5));
    const rawY = Math.max(0, Math.min(1, (dB / 28) * 0.5 + 0.5));
    smoothX = ALPHA * rawX + (1 - ALPHA) * smoothX;
    smoothY = ALPHA * rawY + (1 - ALPHA) * smoothY;
    gyroListeners.forEach(cb => cb(smoothX, smoothY));
  });
}

async function requestGyroPermission() {
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result === 'granted') { startGlobalGyro(); return true; }
      return false;
    } catch { return false; }
  } else {
    startGlobalGyro();
    return true;
  }
}

// ─── iOS Gyro button ─────────────────────────────────────────────────────────
export const GyroPermissionButton = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile || gyroStarted) return;
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      setVisible(true); // iOS needs manual trigger
    } else if (typeof DeviceOrientationEvent !== 'undefined') {
      startGlobalGyro(); // Android auto
    }
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={async () => {
        const ok = await requestGyroPermission();
        if (ok) setVisible(false);
      }}
      className="fixed bottom-24 right-4 z-50 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-bounce-in"
      style={{ touchAction: 'manipulation' }}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3"/>
      </svg>
      啟用光柵陀螺儀
    </button>
  );
};

// ─── computeHoloStyles — pure function, no hooks ─────────────────────────────
function computeHoloStyles(x, y, active) {
  const rx  =  (y - 0.5) * 26;
  const ry  = -(x - 0.5) * 26;
  const hue =  x * 360;

  return {
    wrapper: {
      willChange: 'transform',
      transformStyle: 'preserve-3d',
      borderRadius: '24px',
      transform: active
        ? `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.025,1.025,1.025)`
        : 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)',
      transition: active
        ? 'transform 0.06s linear'
        : 'transform 0.65s cubic-bezier(0.2,0.8,0.2,1)',
      boxShadow: active
        ? `${ry * -1.2}px ${rx * 1.2 + 10}px 50px rgba(0,0,0,0.22)`
        : '0 2px 12px rgba(0,0,0,0.07)',
    },
    foil: {
      position: 'absolute', inset: 0, borderRadius: '22px',
      pointerEvents: 'none', zIndex: 15,
      mixBlendMode: 'screen',
      opacity: active ? 1 : 0,
      transition: active ? 'none' : 'opacity 0.6s ease',
      background: active ? `linear-gradient(
        ${110 + ry * 2.5}deg,
        hsla(${hue},     100%,65%,0.30) 0%,
        hsla(${hue+ 55}, 100%,65%,0.24) 17%,
        hsla(${hue+110}, 100%,65%,0.28) 34%,
        hsla(${hue+170}, 100%,65%,0.24) 51%,
        hsla(${hue+220}, 100%,65%,0.28) 68%,
        hsla(${hue+275}, 100%,65%,0.24) 85%,
        hsla(${hue+330}, 100%,65%,0.30) 100%
      )` : 'none',
    },
    shine: {
      position: 'absolute', inset: 0, borderRadius: '22px',
      pointerEvents: 'none', zIndex: 16,
      opacity: active ? 1 : 0,
      transition: active ? 'none' : 'opacity 0.6s ease',
      background: active ? `radial-gradient(
        circle at ${x*100}% ${y*100}%,
        rgba(255,255,255,0.55) 0%,
        rgba(255,255,255,0.15) 28%,
        transparent 58%
      )` : 'none',
    },
    edge: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: '2px', borderRadius: '0 0 22px 22px',
      pointerEvents: 'none', zIndex: 17,
      opacity: active ? 1 : 0,
      transition: active ? 'none' : 'opacity 0.6s ease',
      background: active ? `linear-gradient(90deg,
        hsla(${hue},     100%,68%,0.9),
        hsla(${hue+120}, 100%,68%,0.9),
        hsla(${hue+240}, 100%,68%,0.9)
      )` : 'none',
    },
    img: {
      transform: active ? 'scale(1.04) translateZ(8px)' : 'scale(1)',
      transition: active ? 'none' : 'transform 0.65s ease',
    },
    title: {
      transform: active ? 'translateZ(14px)' : 'translateZ(0)',
      transition: active ? 'none' : 'transform 0.65s ease',
    },
  };
}

// ─── HoloCard wrapper ─────────────────────────────────────────────────────────
// Separate component so the holographic state is isolated per card
const HoloCard = ({ cardId, children }) => {
  const [pos, setPos] = useState({ x: 0.5, y: 0.5, active: false });
  const rafRef = useRef(null);
  const wrapRef = useRef(null);

  // Gyro subscription
  useEffect(() => {
    const cb = (x, y) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setPos({ x, y, active: true }));
    };
    gyroListeners.add(cb);
    return () => {
      gyroListeners.delete(cb);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleMouseMove = (e) => {
    if (gyroStarted) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top)  / rect.height));
      setPos({ x, y, active: true });
    });
  };

  const handleMouseLeave = () => {
    if (gyroStarted) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPos({ x: 0.5, y: 0.5, active: false });
  };

  const s = computeHoloStyles(pos.x, pos.y, pos.active);

  return (
    <div
      ref={wrapRef}
      style={s.wrapper}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Holographic overlays */}
      <div style={s.foil} />
      <div style={s.shine} />
      <div style={s.edge} />
      {/* Pass computed styles to children */}
      {children(s)}
    </div>
  );
};

// ─── Helper: recommender info ─────────────────────────────────────────────────
function getRecommenderInfo(restaurant) {
  const source        = restaurant.source || "";
  const recommendedBy = restaurant.recommendedBy || "";
  const sourceAuthor  = restaurant.sourceAuthor || "";
  const threadsUrl    = restaurant.threadsUrl || "";
  const isSystemRec   = recommendedBy === "系統探索" || recommendedBy === "系統推薦";
  const isFromThreads = source === "threads_mention" || source === "manual_threads_import" || !!threadsUrl;
  const isManual      = !isFromThreads && !isSystemRec;
  const handle        = sourceAuthor || recommendedBy.replace("@", "") || "";
  let linkUrl = "https://www.threads.com/@fabrica_tw";
  if (isFromThreads && threadsUrl)  linkUrl = threadsUrl;
  else if (isFromThreads && handle) linkUrl = `https://www.threads.net/@${handle}`;
  const badgeLabel = isSystemRec ? "@fabrica_tw" : (isFromThreads && handle) ? `@${handle}` : "手動加入";
  const avatarChar = (isManual && !isSystemRec) ? "✎" : (!isSystemRec && handle) ? handle.charAt(0).toUpperCase() : "F";
  return { badgeLabel, linkUrl, avatarChar, isManual: isManual && !isSystemRec };
}

// ─── RestaurantCard ───────────────────────────────────────────────────────────
export const RestaurantCard = ({
  restaurant, index, draggingId, dragState,
  onPointerDown, onDelete, onShare,
}) => {
  const isDraggingThis = draggingId === restaurant.id;
  const smartCategory  = getSmartTag(restaurant.name, restaurant.category);
  const { badgeLabel, linkUrl, avatarChar, isManual } = getRecommenderInfo(restaurant);

  let translateY = 0;
  if (dragState.draggingId && dragState.hoveredIndex !== -1 && !isDraggingThis) {
    const { startIndex: start, hoveredIndex: hover } = dragState;
    if (start < hover && index > start && index <= hover) translateY = -105;
    else if (start > hover && index < start && index >= hover) translateY = 105;
  }

  return (
    <div
      data-sort-index={index}
      data-restaurant-id={restaurant.id}
      onPointerDown={(e) => onPointerDown(e, restaurant, index)}
      className="select-none cursor-grab active:cursor-grabbing w-full animate-card-appear"
      style={{
        animationDelay: `${Math.min(index * 60, 400)}ms`,
        transform: isDraggingThis ? 'none' : `translate3d(0,${translateY}%,0)`,
        transition: isDraggingThis ? 'none' : 'transform 0.4s cubic-bezier(0.25,1,0.5,1)',
        touchAction: 'none',
        opacity: isDraggingThis ? 0.55 : 1,
      }}
    >
      <HoloCard cardId={restaurant.id}>
        {(s) => (
          <div className="relative p-2 bg-white rounded-[24px] border border-[#E5E5EA]"
            style={{ borderRadius: '24px' }}>

            {/* Image */}
            <figure className="w-full h-56 relative rounded-[18px] bg-black/5 pointer-events-none"
              style={{ overflow: 'hidden', borderRadius: '18px' }}>
              <img
                draggable={false}
                src={getFoodImage(restaurant)}
                onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=800&auto=format&fit=crop"; }}
                alt={restaurant.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...s.img }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 50%, rgba(0,0,0,0.22) 100%)' }} />

              {/* Category */}
              <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(8px)', color: 'white', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', zIndex: 5 }}>
                {smartCategory}
              </span>

              {/* Recommender */}
              <a href={linkUrl} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.96)', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 10, fontWeight: 700, color: '#1D1D1F', zIndex: 5, textDecoration: 'none', pointerEvents: 'auto' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: isManual ? 'linear-gradient(135deg,#9CA3AF,#6B7280)' : 'linear-gradient(135deg,#8B5CF6,#F97316)', color: 'white', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {avatarChar}
                </div>
                {badgeLabel}
              </a>

              {/* Name + address */}
              <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16, zIndex: 5, ...s.title }}>
                <h3 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '0 0 4px', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{restaurant.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'rgba(255,255,255,0.88)', fontSize: 11, fontWeight: 500 }}>
                  <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <circle cx="12" cy="11" r="3" strokeWidth="2"/>
                  </svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{restaurant.address}</span>
                </div>
              </div>
            </figure>

            {/* Body */}
            <div style={{ padding: '12px 14px 10px', position: 'relative', zIndex: 20 }}>
              {restaurant.note && (
                <p style={{ fontSize: 13, color: '#3C3C43', lineHeight: 1.6, margin: '0 0 10px', fontWeight: 500 }}>{restaurant.note}</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F0F0F0', paddingTop: 10 }}>
                <AppleButton onClick={(e) => { e.stopPropagation(); onDelete(restaurant.id); }}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#FF3B30] hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                  刪除
                </AppleButton>
                <AppleButton onClick={(e) => { e.stopPropagation(); onShare(restaurant); }}
                  className="flex items-center gap-1 text-xs font-bold text-neutral-800 hover:bg-neutral-50 px-3 py-1.5 rounded-lg ml-auto transition-colors">
                  分享名單
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/>
                  </svg>
                </AppleButton>
              </div>
            </div>
          </div>
        )}
      </HoloCard>
    </div>
  );
};

// ─── RecommendationCard ───────────────────────────────────────────────────────
export const RecommendationCard = ({ rec, animatingRecId, onDismiss, onSave }) => (
  <div className={`group flex-shrink-0 w-64 p-2 bg-white rounded-[24px] border border-[#E5E5EA] shadow-sm
    transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]
    ${animatingRecId === rec.id ? 'scale-[0.75] opacity-0 rotate-3' : 'scale-100 opacity-100 hover:shadow-xl hover:-translate-y-1'}`}>
    <figure className="w-full h-40 relative overflow-hidden rounded-[18px] bg-black/5">
      <img draggable={false} src={getFoodImage(rec)}
        onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=800&auto=format&fit=crop"; }}
        alt={rec.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 pointer-events-none"/>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none"/>
      <span className="absolute top-3 left-3 text-[10px] font-bold text-white bg-black/40 backdrop-blur-md px-2 py-1 rounded-md border border-white/20">{rec.category}</span>
      <h3 className="absolute bottom-3 left-3 right-3 font-bold text-white text-base line-clamp-1 drop-shadow-md">{rec.name}</h3>
    </figure>
    <article className="p-3 pt-2 space-y-1">
      <p className="text-[11px] text-[#555] line-clamp-1 font-medium">{rec.address}</p>
      <div className="flex gap-2 pt-2">
        <AppleButton onClick={() => onDismiss(rec.id)} className="flex-1 py-2 text-[11px] font-bold text-[#555] bg-[#F5F5F7] rounded-xl hover:bg-[#EBEBED] transition-colors">略過</AppleButton>
        <AppleButton dark onClick={() => onSave(rec)} className="flex-1 py-2 text-[11px] font-bold text-white bg-[#0071E3] rounded-xl flex items-center justify-center gap-1 shadow-sm hover:bg-[#0066CC] transition-colors">
          實體化
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
        </AppleButton>
      </div>
    </article>
  </div>
);

// ─── RestaurantDetailModal ────────────────────────────────────────────────────
export const RestaurantDetailModal = ({ restaurant, onClose }) => {
  if (!restaurant) return null;
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center px-4 bg-black/50 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div className="bg-white/95 backdrop-blur-3xl w-full max-w-sm rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative animate-bounce-in max-h-[85vh] flex flex-col border border-white/50" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 z-[200] w-9 h-9 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/70 active:scale-90 transition-all duration-200 shadow-lg" style={{ touchAction: 'manipulation' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        <BlurVignette blur="8px" className="h-56 w-full flex-shrink-0 bg-black/5">
          <img src={getFoodImage(restaurant)} onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=800&auto=format&fit=crop"; }} className="w-full h-full object-cover" alt="food"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 z-10"/>
          <div className="absolute bottom-5 left-5 right-5 z-20">
            <span className="text-[10px] font-bold text-white bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-md inline-block mb-2 border border-white/20">{getSmartTag(restaurant.name, restaurant.category)}</span>
            <h2 className="text-2xl font-bold text-white leading-tight drop-shadow-lg">{restaurant.name}</h2>
          </div>
        </BlurVignette>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex items-start gap-2 text-xs font-medium text-[#555] mb-6 bg-black/5 p-3 rounded-xl border border-black/5">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3" strokeWidth="2"/></svg>
            <span className="leading-relaxed text-neutral-800">{restaurant.address}</span>
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2.5">筆記與 AI 短評</h4>
            <p className="text-[14px] text-neutral-900 font-medium leading-loose break-words whitespace-pre-wrap pl-1">{restaurant.note || "尚無筆記。"}</p>
          </div>
        </div>
        <div className="p-5 bg-white/80 backdrop-blur-xl border-t border-black/5 flex-shrink-0">
          <button onClick={() => window.open(getFreeMapAppUrl(restaurant.name, restaurant.address), "_blank")} className="w-full flex items-center justify-center gap-2 py-4 bg-black/95 text-white font-bold rounded-2xl shadow-xl active:scale-[0.97] transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
            查看地點
          </button>
        </div>
      </div>
    </div>
  );
};
