"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { gsap } from 'gsap';
import { getFoodImage, getSmartTag } from '../lib/helpers';

// ─── Wheel colour palette ─────────────────────────────────────────────────────
// Alternating amber + dark pairs so every neighbour contrasts
const PALETTE = [
  { bg: '#E8821A', fg: '#fff' },
  { bg: '#1D1D1F', fg: '#E8821A' },
  { bg: '#CC6E0E', fg: '#fff' },
  { bg: '#2C2C2E', fg: '#F0A030' },
  { bg: '#F09630', fg: '#1D1D1F' },
  { bg: '#141416', fg: '#E8821A' },
  { bg: '#B86010', fg: '#fff' },
  { bg: '#3A3A3C', fg: '#F0A030' },
  { bg: '#E8901F', fg: '#1D1D1F' },
  { bg: '#1A1A1C', fg: '#E8821A' },
  { bg: '#D97010', fg: '#fff' },
  { bg: '#252527', fg: '#F0A030' },
];

const CANVAS_SIZE    = 340;   // internal canvas px (before DPR)
const MAX_SEGMENTS   = 12;
const MAX_DAILY_SPINS = 3;

// ─── Canvas renderer (called once on mount) ───────────────────────────────────
function drawWheel(canvas, segments) {
  if (!canvas || !segments.length) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = CANVAS_SIZE * dpr;
  canvas.height = CANVAS_SIZE * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const cx     = CANVAS_SIZE / 2;
  const cy     = CANVAS_SIZE / 2;
  const outerR = CANVAS_SIZE / 2 - 14;
  const innerR = outerR * 0.21;
  const textR  = innerR + (outerR - innerR) * 0.62;
  const n      = segments.length;
  const seg    = (2 * Math.PI) / n;

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Ambient glow halo
  const glow = ctx.createRadialGradient(cx, cy, outerR - 8, cx, cy, outerR + 30);
  glow.addColorStop(0,   'rgba(232,130,26,0.50)');
  glow.addColorStop(0.55,'rgba(232,130,26,0.18)');
  glow.addColorStop(1,   'rgba(232,130,26,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 30, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // Segments
  for (let i = 0; i < n; i++) {
    const sa  = i * seg - Math.PI / 2;
    const ea  = sa + seg;
    const mid = sa + seg / 2;
    const col = PALETTE[i % PALETTE.length];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, sa, ea);
    ctx.closePath();
    ctx.fillStyle = col.bg;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth   = 0.8;
    ctx.stroke();

    // Radial text
    const tx = cx + textR * Math.cos(mid);
    const ty = cy + textR * Math.sin(mid);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(mid + Math.PI / 2);
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    const maxLen  = n > 8 ? 4 : n > 5 ? 6 : 8;
    const label   = segments[i].name.length > maxLen
      ? segments[i].name.slice(0, maxLen) + '\u2026'
      : segments[i].name;

    const fSize   = Math.max(9, Math.min(13, Math.floor(outerR * seg * 0.27)));
    ctx.font      = `700 ${fSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur  = 3;
    ctx.fillStyle   = col.fg;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  // Outer rim highlight
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  // Hub shadow
  ctx.beginPath();
  ctx.arc(cx, cy, innerR + 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fill();

  // Hub glass fill
  const hub = ctx.createRadialGradient(
    cx - innerR * 0.28, cy - innerR * 0.28, 1,
    cx, cy, innerR
  );
  hub.addColorStop(0,   'rgba(255,255,255,0.97)');
  hub.addColorStop(0.65,'rgba(252,252,252,0.92)');
  hub.addColorStop(1,   'rgba(238,238,238,0.86)');
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle   = hub;
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth   = 1.8;
  ctx.stroke();

  // Hub emoji
  ctx.font         = `${Math.max(16, Math.floor(innerR * 0.62))}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = '#1D1D1F';
  ctx.fillText('\uD83C\uDF7D', cx, cy); // 🍽
}

// ─── Particle burst ────────────────────────────────────────────────────────────
const PARTICLE_COLORS = ['#E8821A','#FFD700','#fff','#F09630','#FFB347','#FFEAA7'];

function Particles() {
  const ps = Array.from({ length: 30 }, (_, i) => {
    const angle = (i / 30) * 360 + Math.random() * 12;
    const dist  = 72 + Math.random() * 105;
    const rad   = angle * Math.PI / 180;
    return {
      id:    i,
      tx:    Math.cos(rad) * dist,
      ty:    Math.sin(rad) * dist,
      size:  4 + Math.random() * 6,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      delay: Math.random() * 0.22,
      dur:   0.55 + Math.random() * 0.45,
    };
  });

  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:30 }}>
      <style>{`
        @keyframes ob-burst {
          0%   { transform:translate(-50%,-50%) scale(0); opacity:1; }
          60%  { opacity:1; }
          100% { transform:translate(calc(-50% + var(--obx)), calc(-50% + var(--oby))) scale(0.3); opacity:0; }
        }
      `}</style>
      {ps.map(p => (
        <div key={p.id} style={{
          position:'absolute', top:'50%', left:'50%',
          width:p.size, height:p.size,
          borderRadius:'50%',
          background:p.color,
          '--obx':`${p.tx}px`,
          '--oby':`${p.ty}px`,
          animation:`ob-burst ${p.dur}s ${p.delay}s cubic-bezier(0.2,0.8,0.2,1) both`,
        }}/>
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function FoodOracleGame({ restaurants, isOpen, onClose }) {
  const canvasRef  = useRef(null);
  const wrapRef    = useRef(null);   // div that GSAP rotates
  const rotRef     = useRef(0);      // accumulated degrees

  const [state,        setState]        = useState('idle');   // idle | spinning | result
  const [winner,       setWinner]       = useState(null);
  const [showCard,     setShowCard]     = useState(false);
  const [showBurst,    setShowBurst]    = useState(false);
  const [dailySpins,   setDailySpins]   = useState(0);

  const segments   = useMemo(() => (restaurants || []).slice(0, MAX_SEGMENTS), [restaurants]);
  const spinsLeft  = Math.max(0, MAX_DAILY_SPINS - dailySpins);
  const canSpin    = spinsLeft > 0 && state === 'idle';

  // ── Load daily spin count ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    try {
      const today = new Date().toDateString();
      const d = JSON.parse(localStorage.getItem('fabrica_oracle') || '{}');
      if (d.date === today) {
        setDailySpins(d.count || 0);
      } else {
        setDailySpins(0);
        localStorage.setItem('fabrica_oracle', JSON.stringify({ date: today, count: 0 }));
      }
    } catch { setDailySpins(0); }
  }, [isOpen]);

  // ── Draw wheel once on open ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !canvasRef.current || segments.length < 2) return;
    const t = setTimeout(() => drawWheel(canvasRef.current, segments), 50);
    return () => clearTimeout(t);
  }, [isOpen, segments]);

  // ── Spin ─────────────────────────────────────────────────────────────────
  const handleSpin = useCallback(() => {
    if (!canSpin || segments.length < 2) return;

    const n         = segments.length;
    const segDeg    = 360 / n;
    const winIdx    = Math.floor(Math.random() * n);
    const winCenter = winIdx * segDeg + segDeg / 2;   // angle of winner from top

    // How many degrees to add so winner lands at top (0 mod 360)
    const curMod = ((rotRef.current % 360) + 360) % 360;
    let delta    = (winCenter - curMod + 360) % 360;
    if (delta < segDeg * 0.5) delta += 360;           // ensure visible move

    const extra    = (4 + Math.floor(Math.random() * 3)) * 360;
    const totalRot = rotRef.current + extra + delta;
    const duration = 3.6 + Math.random() * 1.4;

    setState('spinning');
    setShowCard(false);
    setWinner(null);
    setShowBurst(false);

    gsap.to(wrapRef.current, {
      rotation: totalRot,
      duration,
      ease: 'power3.out',
      transformOrigin: 'center center',
      onComplete: () => {
        rotRef.current = totalRot;

        const today    = new Date().toDateString();
        const newCount = dailySpins + 1;
        setDailySpins(newCount);
        try {
          localStorage.setItem('fabrica_oracle', JSON.stringify({ date: today, count: newCount }));
        } catch {}

        setWinner(segments[winIdx]);
        setState('result');
        setShowBurst(true);
        setTimeout(() => { setShowBurst(false); setShowCard(true); }, 650);
      },
    });
  }, [canSpin, segments, dailySpins]);

  const handleAgain = () => {
    setShowCard(false);
    setWinner(null);
    setShowBurst(false);
    setTimeout(() => setState('idle'), 320);
  };

  const handleClose = () => {
    gsap.killTweensOf(wrapRef.current);
    setState('idle');
    setWinner(null);
    setShowCard(false);
    setShowBurst(false);
    onClose();
  };

  if (!isOpen) return null;

  // ── Empty state ──────────────────────────────────────────────────────────
  if (segments.length < 2) {
    return (
      <div className="fixed inset-0 z-[180] flex items-center justify-center p-6"
           style={{ background:'rgba(0,0,0,0.8)', backdropFilter:'blur(28px)' }}>
        <div className="bg-white/95 rounded-[32px] p-8 max-w-xs w-full text-center border border-white/50 shadow-2xl">
          <div style={{ fontSize:48, marginBottom:16 }}>🍽</div>
          <h2 className="text-xl font-bold text-black mb-2 tracking-tight">美食庫太空了</h2>
          <p className="text-sm text-[#86868B] font-medium leading-relaxed mb-6">
            至少需要 2 家餐廳才能轉動命盤。先去匯入一些美食吧！
          </p>
          <button onClick={handleClose}
            className="w-full bg-black/90 text-white font-bold rounded-2xl py-4 text-sm active:scale-[0.97] transition-all">
            關閉
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[180] flex flex-col items-center justify-center overflow-hidden select-none"
         style={{ background:'rgba(4,4,4,0.92)', backdropFilter:'blur(32px)' }}>

      {/* Close */}
      <button onClick={handleClose}
        className="absolute top-5 right-5 z-40 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold transition-all active:scale-90 hover:bg-white/20"
        style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.18)', fontSize:18 }}>
        ✕
      </button>

      {/* Header */}
      <div className="text-center mb-6 z-10 animate-fade-in">
        <p style={{ color:'#E8821A', fontSize:10, fontWeight:800, letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:6 }}>
          Fabrica Oracle
        </p>
        <h1 style={{ color:'white', fontSize:34, fontWeight:900, letterSpacing:-0.8, lineHeight:1, marginBottom:10 }}>
          美食命盤
        </h1>

        {/* Spin pip indicators */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
          {Array.from({ length:MAX_DAILY_SPINS }, (_, i) => (
            <div key={i} style={{
              width:8, height:8, borderRadius:'50%',
              background: i < dailySpins ? 'rgba(255,255,255,0.15)' : '#E8821A',
              boxShadow: i < dailySpins ? 'none' : '0 0 8px rgba(232,130,26,0.6)',
              transition:'all 0.4s ease',
            }}/>
          ))}
          <span style={{ color:'rgba(255,255,255,0.38)', fontSize:11, fontWeight:600, marginLeft:4 }}>
            {spinsLeft > 0 ? `剩 ${spinsLeft} 次` : '今日已用完'}
          </span>
        </div>
      </div>

      {/* Wheel area */}
      <div className="relative z-10" style={{ width:'min(340px,82vw)', height:'min(340px,82vw)' }}>

        {/* Particle burst */}
        {showBurst && <Particles />}

        {/* Winner top-glow (visible once result is in) */}
        {state === 'result' && (
          <div style={{
            position:'absolute', inset:0, pointerEvents:'none',
            background:'radial-gradient(circle at 50% 6%, rgba(232,130,26,0.38) 0%, transparent 52%)',
            borderRadius:'50%',
          }}/>
        )}

        {/* Fixed needle / pointer */}
        <div style={{
          position:'absolute', top:-3, left:'50%',
          transform:'translateX(-50%)',
          zIndex:20, width:0, height:0,
          borderLeft:'10px solid transparent',
          borderRight:'10px solid transparent',
          borderTop:'26px solid #E8821A',
          filter:'drop-shadow(0 0 10px rgba(232,130,26,0.75))',
        }}/>

        {/* Rotating wrapper — only this div spins */}
        <div ref={wrapRef} style={{ width:'100%', height:'100%', transformOrigin:'center center' }}>
          <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }}/>
        </div>
      </div>

      {/* Spin button */}
      {state !== 'result' && (
        <div className="mt-8 z-10">
          <button
            onClick={handleSpin}
            disabled={!canSpin}
            style={{
              padding:'16px 56px',
              borderRadius:999,
              fontSize:16,
              fontWeight:800,
              letterSpacing:'0.01em',
              cursor: canSpin ? 'pointer' : 'not-allowed',
              border:'none',
              transition:'all 0.25s cubic-bezier(0.2,0.8,0.2,1)',
              ...(canSpin ? {
                background:'linear-gradient(135deg,#E8821A 0%,#CC6E0E 100%)',
                color:'#fff',
                boxShadow:'0 8px 32px rgba(232,130,26,0.48), 0 2px 8px rgba(0,0,0,0.22)',
              } : {
                background:'rgba(255,255,255,0.06)',
                color:'rgba(255,255,255,0.22)',
                boxShadow:'none',
              }),
            }}
          >
            {state === 'spinning'
              ? '命運降臨中...'
              : spinsLeft === 0
              ? '明日再試'
              : '轉動命盤'}
          </button>
          {spinsLeft === 0 && (
            <p style={{ color:'rgba(255,255,255,0.28)', fontSize:11, textAlign:'center', marginTop:10, fontWeight:600 }}>
              每日 3 次，明日重置
            </p>
          )}
        </div>
      )}

      {/* Result card — slides up from bottom */}
      {state === 'result' && winner && (
        <div style={{
          position:'absolute', bottom:0, left:0, right:0,
          zIndex:40,
          transform: showCard ? 'translateY(0)' : 'translateY(108%)',
          transition:'transform 0.55s cubic-bezier(0.2,0.8,0.2,1)',
        }}>
          <div style={{
            background:'rgba(12,12,14,0.97)',
            backdropFilter:'blur(48px)',
            borderRadius:'28px 28px 0 0',
            border:'1px solid rgba(255,255,255,0.09)',
            borderBottom:'none',
            padding:'20px 20px 48px',
          }}>
            {/* Handle */}
            <div style={{ width:40, height:4, background:'rgba(255,255,255,0.16)', borderRadius:2, margin:'0 auto 20px' }}/>

            {/* Winner headline */}
            <div style={{ textAlign:'center', marginBottom:18 }}>
              <p style={{ color:'#E8821A', fontSize:10, fontWeight:800, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:6 }}>
                今日命定美食
              </p>
              <h2 style={{ color:'white', fontSize:28, fontWeight:900, letterSpacing:-0.5, lineHeight:1.1, margin:0 }}>
                {winner.name}
              </h2>
            </div>

            {/* Restaurant info card */}
            <div style={{
              display:'flex', gap:14, alignItems:'flex-start',
              background:'rgba(255,255,255,0.05)',
              borderRadius:20, padding:14,
              border:'1px solid rgba(255,255,255,0.07)',
              marginBottom:16,
            }}>
              {/* Photo */}
              <div style={{ width:78, height:78, borderRadius:14, overflow:'hidden', flexShrink:0, background:'rgba(255,255,255,0.07)' }}>
                <img
                  src={getFoodImage(winner)}
                  alt={winner.name}
                  style={{ width:'100%', height:'100%', objectFit:'cover' }}
                  onError={e => { e.target.src='https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=200&auto=format&fit=crop'; }}
                />
              </div>

              {/* Details */}
              <div style={{ flex:1, minWidth:0 }}>
                {/* Category pill */}
                <div style={{
                  display:'inline-block',
                  background:'rgba(232,130,26,0.18)',
                  color:'#E8821A',
                  fontSize:10, fontWeight:700,
                  padding:'3px 9px', borderRadius:6, marginBottom:8,
                }}>
                  {getSmartTag(winner.name, winner.category)}
                </div>

                {/* Address */}
                {winner.address && (
                  <div style={{
                    color:'rgba(255,255,255,0.42)', fontSize:11, fontWeight:500,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    marginBottom:6,
                  }}>
                    {'\uD83D\uDCCD'} {winner.address}
                  </div>
                )}

                {/* AI note */}
                {winner.note && (
                  <div style={{
                    color:'rgba(255,255,255,0.62)', fontSize:11, lineHeight:1.55,
                    display:'-webkit-box',
                    WebkitLineClamp:2,
                    WebkitBoxOrient:'vertical',
                    overflow:'hidden',
                  }}>
                    {winner.note}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={handleAgain}
                disabled={spinsLeft <= 0}
                style={{
                  flex:1, padding:'15px 0',
                  borderRadius:16, fontSize:13, fontWeight:700,
                  cursor: spinsLeft > 0 ? 'pointer' : 'not-allowed',
                  background:'rgba(255,255,255,0.07)',
                  border:'1px solid rgba(255,255,255,0.09)',
                  color: spinsLeft > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                  transition:'all 0.2s ease',
                }}
              >
                {spinsLeft > 0 ? `再轉（${spinsLeft}）` : '今日已用完'}
              </button>
              <button
                onClick={handleClose}
                style={{
                  flex:1, padding:'15px 0',
                  borderRadius:16, fontSize:13, fontWeight:700,
                  cursor:'pointer',
                  background:'linear-gradient(135deg,#E8821A,#C4690F)',
                  border:'none', color:'#fff',
                  boxShadow:'0 4px 22px rgba(232,130,26,0.42)',
                  transition:'all 0.2s ease',
                }}
              >
                前往查看 →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
