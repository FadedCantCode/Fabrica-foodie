"use client";

import React, { useRef, useEffect } from 'react';
import { AppleButton, BlurVignette } from './ui';
import { getFoodImage, getFreeMapAppUrl, getSmartTag } from '../lib/helpers';

// ─── Gyro singleton ───────────────────────────────────────────────────────────
const gyroSubs = new Set();
let gyroOn = false, gBase = null, bBase = null, gS = 0.5, bS = 0.5;

function gyroTick(e) {
  const g = e.gamma ?? 0, b = e.beta ?? 0;
  if (gBase === null) { gBase = g; bBase = b; }
  gS = 0.12 * Math.max(0, Math.min(1, ((g - gBase) / 30) * 0.5 + 0.5)) + 0.88 * gS;
  bS = 0.12 * Math.max(0, Math.min(1, ((b - bBase) / 30) * 0.5 + 0.5)) + 0.88 * bS;
  gyroSubs.forEach(fn => fn(gS, bS));
}

export async function enableGyro() {
  if (gyroOn) return true;
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return false; }
    catch { return false; }
  }
  window.addEventListener('deviceorientation', gyroTick, { passive: true });
  gyroOn = true; gBase = null; bBase = null;
  return true;
}

export const GyroPermissionButton = ({ isLoggedIn }) => {
  const [show, setShow] = React.useState(false);
  useEffect(() => {
    if (!isLoggedIn) return;
    const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (iOS && typeof DeviceOrientationEvent?.requestPermission === 'function' && !gyroOn) setShow(true);
    else if (!iOS && typeof DeviceOrientationEvent !== 'undefined' && !gyroOn) enableGyro();
  }, [isLoggedIn]);
  if (!show) return null;
  return (
    <button onClick={async () => { if (await enableGyro()) setShow(false); }}
      style={{ position:'fixed', bottom:96, right:16, zIndex:50, background:'#1D1D1F', color:'white', border:'none', borderRadius:999, padding:'10px 16px', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:6, boxShadow:'0 8px 24px rgba(0,0,0,0.25)', touchAction:'manipulation', cursor:'pointer' }}>
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3"/>
      </svg>
      啟用光柵陀螺儀
    </button>
  );
};

// ─── HoloCard ─────────────────────────────────────────────────────────────────
const HoloCard = ({ children }) => {
  const cardRef  = useRef(null);  // the white card div
  const rafRef   = useRef(null);
  const foilRef  = useRef(null);
  const shineRef = useRef(null);

  useEffect(() => {
    const card  = cardRef.current;
    const foil  = foilRef.current;
    const shine = shineRef.current;
    if (!card || !foil || !shine) return;

    const apply = (x, y) => {
      const rx  =  (y - 0.5) * 18;
      const ry  = -(x - 0.5) * 18;
      const hue =   x * 360;

      // Apply perspective on the CARD itself, not a wrapper
      // This avoids stacking context issues with mix-blend-mode
      card.style.transform  = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
      card.style.transition = 'transform 0.08s linear, box-shadow 0.08s linear';
      card.style.boxShadow  = `${-ry}px ${rx + 8}px 30px rgba(0,0,0,0.16)`;

      foil.style.opacity    = '1';
      foil.style.transition = 'none';
      // No mix-blend-mode — foil paints directly over card with rgba transparency
      foil.style.background = `linear-gradient(
        ${120 + ry * 2}deg,
        hsla(${hue},100%,65%,0.18) 0%,
        hsla(${hue+60},100%,65%,0.14) 17%,
        hsla(${hue+120},100%,65%,0.16) 34%,
        hsla(${hue+180},100%,65%,0.14) 51%,
        hsla(${hue+240},100%,65%,0.16) 68%,
        hsla(${hue+300},100%,65%,0.14) 85%,
        hsla(${hue+360},100%,65%,0.18) 100%
      )`;

      shine.style.opacity    = '1';
      shine.style.transition = 'none';
      shine.style.background = `radial-gradient(
        circle at ${x*100}% ${y*100}%,
        rgba(255,255,255,0.45) 0%,
        rgba(255,255,255,0.05) 35%,
        transparent 65%
      )`;
    };

    const reset = () => {
      card.style.transform  = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
      card.style.transition = 'transform 0.6s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.6s ease';
      card.style.boxShadow  = '0 2px 10px rgba(0,0,0,0.07)';
      foil.style.transition  = 'opacity 0.5s ease';
      foil.style.opacity     = '0';
      shine.style.transition = 'opacity 0.5s ease';
      shine.style.opacity    = '0';
    };

    // document-level mousemove — most reliable
    let inside = false;
    const onDocMove = (e) => {
      if (gyroOn) return;
      const r = card.getBoundingClientRect();
      const isIn = e.clientX >= r.left && e.clientX <= r.right &&
                   e.clientY >= r.top  && e.clientY <= r.bottom;
      if (isIn) {
        inside = true;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          apply(
            (e.clientX - r.left) / r.width,
            (e.clientY - r.top)  / r.height
          );
        });
      } else if (inside) {
        inside = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        reset();
      }
    };

    const onReset = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      inside = false;
      reset();
    };

    // Gyro
    const gyroFn = (x, y) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => apply(x, y));
    };

    document.addEventListener('mousemove', onDocMove, { passive: true });
    document.addEventListener('visibilitychange', onReset);
    window.addEventListener('focus', onReset);
    gyroSubs.add(gyroFn);

    return () => {
      document.removeEventListener('mousemove', onDocMove);
      document.removeEventListener('visibilitychange', onReset);
      window.removeEventListener('focus', onReset);
      gyroSubs.delete(gyroFn);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      reset();
    };
  }, []);

  return (
    <div style={{ position: 'relative', borderRadius: 24 }}>

      {/* Card — gets perspective transform, rendered FIRST so foil/shine paint on top */}
      <div ref={cardRef} style={{
        borderRadius:22,
        transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)',
        transition: 'transform 0.6s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.6s ease',
        boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
      }}>
        {children}
      </div>

      {/* Foil: rendered AFTER card so it paints on top — no blend mode needed */}
      <div ref={foilRef} style={{
        position:'absolute', inset:0, borderRadius:22,
        pointerEvents:'none',
        opacity:0,
      }} />

      {/* Shine: rendered last, always on top */}
      <div ref={shineRef} style={{
        position:'absolute', inset:0, borderRadius:22,
        pointerEvents:'none',
        opacity:0,
      }} />
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getRecommenderInfo(r) {
  const isSystem  = r.recommendedBy === "系統探索" || r.recommendedBy === "系統推薦";
  const isThreads = r.source === "threads_mention" || r.source === "manual_threads_import" || !!r.threadsUrl;
  const isManual  = !isThreads && !isSystem;
  const handle    = r.sourceAuthor || r.recommendedBy?.replace("@","") || "";
  const link = isThreads && r.threadsUrl ? r.threadsUrl
             : isThreads && handle ? `https://www.threads.net/@${handle}`
             : "https://www.threads.com/@fabrica_tw";
  const label  = isSystem ? "@fabrica_tw" : (isThreads && handle) ? `@${handle}` : "手動加入";
  const avatar = isManual ? "✎" : handle ? handle[0].toUpperCase() : "F";
  return { link, label, avatar, isManual };
}

// ─── RestaurantCard ───────────────────────────────────────────────────────────
export const RestaurantCard = ({
  restaurant, index, draggingId, dragState,
  onPointerDown, onDelete, onShare,
}) => {
  const isDragging = draggingId === restaurant.id;
  const cat = getSmartTag(restaurant.name, restaurant.category);
  const rec = getRecommenderInfo(restaurant);

  let ty = 0;
  if (dragState.draggingId && dragState.hoveredIndex !== -1 && !isDragging) {
    const { startIndex: s, hoveredIndex: h } = dragState;
    if (s < h && index > s && index <= h) ty = -105;
    else if (s > h && index < s && index >= h) ty = 105;
  }

  return (
    <div
      data-sort-index={index}
      data-restaurant-id={restaurant.id}
      onPointerDown={e => onPointerDown(e, restaurant, index)}
      className="select-none w-full animate-card-appear"
      style={{
        animationDelay: `${Math.min(index*60,400)}ms`,
        transform: isDragging ? 'none' : `translate3d(0,${ty}%,0)`,
        transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.25,1,0.5,1)',
        opacity: isDragging ? 0.55 : 1,
        touchAction: 'pan-y',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <HoloCard>
        <div style={{ background:'white', borderRadius:22, border:'1px solid #E5E5EA', padding:8, overflow:'hidden' }}>
          <div style={{ width:'100%', height:216, position:'relative', borderRadius:16, overflow:'hidden', background:'#111' }}>
            <img draggable={false}
              src={getFoodImage(restaurant)}
              onError={e => { e.target.onerror=null; e.target.src="https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=800&auto=format&fit=crop"; }}
              alt={restaurant.name}
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
            />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 50%, rgba(0,0,0,0.18) 100%)' }} />
            <div style={{ position:'absolute', top:12, left:12, background:'rgba(0,0,0,0.32)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', color:'white', fontSize:10, fontWeight:700, padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.2)' }}>{cat}</div>
            <a href={rec.link} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
              style={{ position:'absolute', top:12, right:12, background:'rgba(255,255,255,0.95)', borderRadius:999, padding:'5px 10px', display:'flex', alignItems:'center', gap:5, fontSize:10, fontWeight:700, color:'#1D1D1F', textDecoration:'none' }}>
              <div style={{ width:14, height:14, borderRadius:'50%', background: rec.isManual ? 'linear-gradient(135deg,#9CA3AF,#6B7280)' : 'linear-gradient(135deg,#8B5CF6,#F97316)', color:'white', fontSize:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{rec.avatar}</div>
              {rec.label}
            </a>
            <div style={{ position:'absolute', bottom:12, left:16, right:16 }}>
              <div style={{ color:'white', fontSize:20, fontWeight:700, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textShadow:'0 2px 8px rgba(0,0,0,0.5)' }}>{restaurant.name}</div>
              <div style={{ display:'flex', alignItems:'center', gap:3, color:'rgba(255,255,255,0.88)', fontSize:11, fontWeight:500 }}>
                <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{flexShrink:0}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3" strokeWidth="2"/></svg>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{restaurant.address}</span>
              </div>
            </div>
          </div>
          <div style={{ padding:'12px 14px 10px' }}>
            {restaurant.note && <p style={{ fontSize:13, color:'#3C3C43', lineHeight:1.6, margin:'0 0 10px', fontWeight:500 }}>{restaurant.note}</p>}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid #F0F0F0', paddingTop:10 }}>
              <AppleButton onClick={e=>{e.stopPropagation();onDelete(restaurant.id);}} className="flex items-center gap-1.5 text-xs font-bold text-[#FF3B30] hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                刪除
              </AppleButton>
              <AppleButton onClick={e=>{e.stopPropagation();onShare(restaurant);}} className="flex items-center gap-1 text-xs font-bold text-neutral-800 hover:bg-neutral-50 px-3 py-1.5 rounded-lg ml-auto transition-colors">
                分享名單
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
              </AppleButton>
            </div>
          </div>
        </div>
      </HoloCard>
    </div>
  );
};

// ─── RecommendationCard ───────────────────────────────────────────────────────
export const RecommendationCard = ({ rec, animatingRecId, onDismiss, onSave }) => (
  <div className={`group flex-shrink-0 w-64 p-2 bg-white rounded-[24px] border border-[#E5E5EA] shadow-sm transition-all duration-700 ${animatingRecId===rec.id?'scale-[0.75] opacity-0 rotate-3':'scale-100 opacity-100 hover:shadow-xl hover:-translate-y-1'}`}>
    <figure className="w-full h-40 relative overflow-hidden rounded-[18px] bg-black/5">
      <img draggable={false} src={getFoodImage(rec)} onError={e=>{e.target.onerror=null;e.target.src="https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=800&auto=format&fit=crop";}} alt={rec.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 pointer-events-none"/>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none"/>
      <span className="absolute top-3 left-3 text-[10px] font-bold text-white bg-black/40 backdrop-blur-md px-2 py-1 rounded-md border border-white/20">{rec.category}</span>
      <h3 className="absolute bottom-3 left-3 right-3 font-bold text-white text-base line-clamp-1 drop-shadow-md">{rec.name}</h3>
    </figure>
    <article className="p-3 pt-2 space-y-1">
      <p className="text-[11px] text-[#555] line-clamp-1 font-medium">{rec.address}</p>
      <div className="flex gap-2 pt-2">
        <AppleButton onClick={()=>onDismiss(rec.id)} className="flex-1 py-2 text-[11px] font-bold text-[#555] bg-[#F5F5F7] rounded-xl hover:bg-[#EBEBED] transition-colors">略過</AppleButton>
        <AppleButton dark onClick={()=>onSave(rec)} className="flex-1 py-2 text-[11px] font-bold text-white bg-[#0071E3] rounded-xl flex items-center justify-center gap-1 shadow-sm hover:bg-[#0066CC] transition-colors">
          實體化<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
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
      <div className="bg-white/95 backdrop-blur-3xl w-full max-w-sm rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative animate-bounce-in max-h-[85vh] flex flex-col border border-white/50" onClick={e=>e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 z-[200] w-9 h-9 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/70 active:scale-90 transition-all duration-200 shadow-lg" style={{touchAction:'manipulation'}}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        <BlurVignette blur="8px" className="h-56 w-full flex-shrink-0 bg-black/5">
          <img src={getFoodImage(restaurant)} onError={e=>{e.target.onerror=null;e.target.src="https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=800&auto=format&fit=crop";}} className="w-full h-full object-cover" alt="food"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 z-10"/>
          <div className="absolute bottom-5 left-5 right-5 z-20">
            <span className="text-[10px] font-bold text-white bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-md inline-block mb-2 border border-white/20">{getSmartTag(restaurant.name,restaurant.category)}</span>
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
            <p className="text-[14px] text-neutral-900 font-medium leading-loose break-words whitespace-pre-wrap pl-1">{restaurant.note||"尚無筆記。"}</p>
          </div>
        </div>
        <div className="p-5 bg-white/80 backdrop-blur-xl border-t border-black/5 flex-shrink-0">
          <button onClick={()=>window.open(getFreeMapAppUrl(restaurant.name,restaurant.address),"_blank")} className="w-full flex items-center justify-center gap-2 py-4 bg-black/95 text-white font-bold rounded-2xl shadow-xl active:scale-[0.97] transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
            查看地點
          </button>
        </div>
      </div>
    </div>
  );
};
