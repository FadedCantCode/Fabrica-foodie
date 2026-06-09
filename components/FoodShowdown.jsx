"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { gsap } from 'gsap';
import { getFoodImage, getSmartTag } from '../lib/helpers';

// ─── Shuffle utility ──────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Round label ──────────────────────────────────────────────────────────────
function getRoundLabel(current, total) {
  const remaining = total - current + 1;
  if (remaining === 1) return '決賽';
  if (remaining === 2) return '準決賽';
  return `第 ${current} 場`;
}

// ─── Particle burst ───────────────────────────────────────────────────────────
function ChampionBurst() {
  const particles = Array.from({ length: 36 }, (_, i) => {
    const angle = (i / 36) * 360 + Math.random() * 10;
    const dist  = 80 + Math.random() * 140;
    const rad   = angle * Math.PI / 180;
    return {
      id:    i,
      tx:    Math.cos(rad) * dist,
      ty:    Math.sin(rad) * dist,
      size:  3 + Math.random() * 7,
      color: ['#E8821A','#FFD700','#fff','#F09630','#FFB347'][i % 5],
      delay: Math.random() * 0.3,
      dur:   0.7 + Math.random() * 0.5,
    };
  });
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:10, overflow:'hidden' }}>
      <style>{`@keyframes champ-burst{0%{transform:translate(-50%,-50%)scale(0);opacity:1}70%{opacity:1}100%{transform:translate(calc(-50% + var(--ctx)),calc(-50% + var(--cty)))scale(0.2);opacity:0}}`}</style>
      {particles.map(p => (
        <div key={p.id} style={{
          position:'absolute', top:'30%', left:'50%',
          width:p.size, height:p.size, borderRadius:'50%',
          background:p.color,
          '--ctx':`${p.tx}px`, '--cty':`${p.ty}px`,
          animation:`champ-burst ${p.dur}s ${p.delay}s ease-out forwards`,
        }}/>
      ))}
    </div>
  );
}

// ─── Battle Card ──────────────────────────────────────────────────────────────
function BattleCard({ restaurant, side, onClick, disabled, isChampion }) {
  if (!restaurant) return <div style={{ flex:1 }}/>;
  const imgSrc = getFoodImage(restaurant);
  const tag    = getSmartTag(restaurant.name, restaurant.category);

  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        flex:1,
        position:'relative',
        borderRadius:24,
        overflow:'hidden',
        cursor: disabled ? 'default' : 'pointer',
        transform: side === 'left' ? 'rotate(-2deg)' : 'rotate(2deg)',
        boxShadow: isChampion
          ? '0 0 0 2.5px #E8821A, 0 12px 48px rgba(232,130,26,0.35)'
          : '0 12px 40px rgba(0,0,0,0.55)',
        transition: 'box-shadow 0.3s ease',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        aspectRatio: '3/4',
        maxHeight: '55vh',
        minHeight: 200,
      }}
    >
      {/* Food photo */}
      <img
        src={imgSrc}
        alt={restaurant.name}
        draggable={false}
        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', pointerEvents:'none' }}
        onError={e => { e.target.src='https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=600&auto=format&fit=crop'; }}
      />

      {/* Gradient overlay */}
      <div style={{
        position:'absolute', inset:0,
        background:'linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.35) 50%, transparent 80%)',
        pointerEvents:'none',
      }}/>

      {/* Champion badge */}
      {isChampion && (
        <div style={{
          position:'absolute', top:12, left:12,
          background:'#E8821A',
          borderRadius:999,
          padding:'3px 10px',
          fontSize:9, fontWeight:800, color:'#fff',
          letterSpacing:'0.12em', textTransform:'uppercase',
          boxShadow:'0 2px 12px rgba(232,130,26,0.55)',
        }}>
          衛冕
        </div>
      )}

      {/* Category tag */}
      <div style={{
        position:'absolute', top:12, right:12,
        background:'rgba(0,0,0,0.45)',
        backdropFilter:'blur(8px)',
        borderRadius:6, padding:'3px 9px',
        fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.85)',
        border:'1px solid rgba(255,255,255,0.18)',
      }}>
        {tag}
      </div>

      {/* Name + note */}
      <div style={{ position:'absolute', bottom:14, left:14, right:14 }}>
        <div style={{
          color:'white', fontSize:17, fontWeight:800,
          letterSpacing:-0.3, lineHeight:1.1,
          overflow:'hidden', textOverflow:'ellipsis',
          whiteSpace:'nowrap',
          textShadow:'0 2px 8px rgba(0,0,0,0.6)',
          marginBottom:5,
        }}>
          {restaurant.name}
        </div>
        {restaurant.note && (
          <div style={{
            color:'rgba(255,255,255,0.6)', fontSize:10, lineHeight:1.45,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
            overflow:'hidden',
          }}>
            {restaurant.note}
          </div>
        )}
      </div>

      {/* Hover glow overlay */}
      {!disabled && (
        <div style={{
          position:'absolute', inset:0,
          background:'rgba(232,130,26,0)',
          transition:'background 0.2s',
          borderRadius:24,
          pointerEvents:'none',
        }}
        className="battle-card-hover"
        />
      )}
    </div>
  );
}

// ─── Main game component ──────────────────────────────────────────────────────
export default function FoodShowdown({ restaurants, isOpen, onClose }) {
  const leftRef      = useRef(null);
  const rightRef     = useRef(null);
  const vsRef        = useRef(null);
  const containerRef = useRef(null);

  const [phase,      setPhase]      = useState('intro');  // intro|battle|result
  const [champion,   setChampion]   = useState(null);
  const [challenger, setChallenger] = useState(null);
  const [queue,      setQueue]      = useState([]);
  const [roundNum,   setRoundNum]   = useState(0);
  const [totalRounds,setTotalRounds]= useState(0);
  const [wins,       setWins]       = useState(0);
  const [choosing,   setChoosing]   = useState(false);
  const [showBurst,  setShowBurst]  = useState(false);
  const [currentChampion, setCurrentChampion] = useState(null); // for result screen

  // Internal refs to avoid stale closures in GSAP callbacks
  const queueRef      = useRef([]);
  const roundNumRef   = useRef(0);
  const totalRoundsRef= useRef(0);
  const winsRef       = useRef(0);

  const pool = useMemo(() => shuffle((restaurants || []).slice(0, 8)), [restaurants, isOpen]);

  // ── Start game ──────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const p = shuffle((restaurants || []).slice(0, 8));
    if (p.length < 2) return;

    const total = p.length - 1;
    queueRef.current      = p.slice(2);
    roundNumRef.current   = 1;
    totalRoundsRef.current = total;
    winsRef.current       = 0;

    setTotalRounds(total);
    setRoundNum(1);
    setWins(0);
    setChampion(p[0]);
    setChallenger(p[1]);
    setQueue(p.slice(2));
    setCurrentChampion(null);
    setPhase('battle');
    setShowBurst(false);

    // Intro animation for first cards
    requestAnimationFrame(() => {
      if (leftRef.current && rightRef.current) {
        gsap.fromTo(leftRef.current,
          { x:-80, opacity:0, rotation:0 },
          { x:0, opacity:1, rotation:-2, duration:0.5, ease:'power3.out' }
        );
        gsap.fromTo(rightRef.current,
          { x:80, opacity:0, rotation:0 },
          { x:0, opacity:1, rotation:2, duration:0.5, ease:'power3.out', delay:0.08 }
        );
        if (vsRef.current) {
          gsap.fromTo(vsRef.current,
            { scale:0, opacity:0 },
            { scale:1, opacity:1, duration:0.4, ease:'back.out(1.7)', delay:0.2 }
          );
        }
      }
    });
  }, [restaurants]);

  // ── Handle pick ─────────────────────────────────────────────────────────────
  const handlePick = useCallback((side) => {
    if (choosing || phase !== 'battle') return;
    setChoosing(true);

    const pickedChampion = side === 'left';
    const winner  = pickedChampion ? champion : challenger;
    const winRef  = pickedChampion ? leftRef  : rightRef;
    const loseRef = pickedChampion ? rightRef : leftRef;
    const loseDir = pickedChampion ? 1 : -1;  // loser exits: right if right loses, left if left loses

    if (navigator.vibrate) navigator.vibrate(30);

    const nextQueue  = [...queueRef.current];
    const nextRound  = roundNumRef.current + 1;
    const isGameOver = nextQueue.length === 0;
    const newWins    = winsRef.current + (pickedChampion ? 1 : 0);

    roundNumRef.current = nextRound;
    winsRef.current     = newWins;
    if (!pickedChampion) queueRef.current = nextQueue;
    else queueRef.current = nextQueue;

    const tl = gsap.timeline({
      onComplete: () => {
        if (isGameOver) {
          setCurrentChampion(winner);
          setPhase('result');
          setChoosing(false);
          setTimeout(() => setShowBurst(true), 300);
        } else {
          const nextChallenger = nextQueue[0];
          const remainingQueue = nextQueue.slice(1);
          queueRef.current = remainingQueue;

          // Reset both cards to neutral, then slide in new challenger
          gsap.set(loseRef.current, { clearProps:'all' });

          if (pickedChampion) {
            // Champion (left) stays, new challenger slides in from right
            gsap.set(leftRef.current, { rotation:-2, x:0, opacity:1, scale:1 });
            gsap.fromTo(rightRef.current,
              { x:300, opacity:0, rotation:4 },
              { x:0, opacity:1, rotation:2, duration:0.45, ease:'power3.out' }
            );
          } else {
            // Challenger (right) becomes champion (left), new challenger from right
            gsap.set(rightRef.current, { rotation:2, x:0, opacity:1, scale:1 });
            gsap.fromTo(leftRef.current,
              { x:-300, opacity:0, rotation:-4 },
              { x:0, opacity:1, rotation:-2, duration:0.45, ease:'power3.out' }
            );
            // Slide existing right card to left position
            gsap.to(rightRef.current, { rotation:-2, duration:0.2 });
          }

          setChampion(winner);
          setChallenger(nextChallenger);
          setQueue(remainingQueue);
          setRoundNum(nextRound);
          setWins(newWins);
          setChoosing(false);

          // VS badge pop
          gsap.fromTo(vsRef.current,
            { scale:0.7, opacity:0 },
            { scale:1, opacity:1, duration:0.35, ease:'back.out(1.7)', delay:0.2 }
          );
        }
      }
    });

    // Winner pulse
    tl.to(winRef.current, { scale:1.08, duration:0.18, ease:'power2.out' });
    tl.to(winRef.current, { scale:1.0, duration:0.14 });

    // Loser exits
    tl.to(loseRef.current, {
      x: loseDir * 360,
      rotation: loseDir * 18,
      opacity:0,
      scale:0.78,
      duration:0.42,
      ease:'power2.in',
    }, '-=0.22');

    // VS badge exits
    tl.to(vsRef.current, { scale:0, opacity:0, duration:0.2, ease:'power2.in' }, '-=0.3');
  }, [choosing, phase, champion, challenger]);

  // ── Close ───────────────────────────────────────────────────────────────────
  const handleClose = () => {
    gsap.killTweensOf([leftRef.current, rightRef.current, vsRef.current]);
    setPhase('intro');
    setChampion(null);
    setChallenger(null);
    setQueue([]);
    setShowBurst(false);
    setChoosing(false);
    onClose();
  };

  if (!isOpen) return null;

  // Not enough restaurants
  if ((restaurants || []).length < 2) {
    return (
      <div className="fixed inset-0 z-[180] flex items-center justify-center p-6"
           style={{ background:'rgba(0,0,0,0.82)', backdropFilter:'blur(28px)' }}>
        <div className="bg-white/95 rounded-[32px] p-8 max-w-xs w-full text-center border border-white/50 shadow-2xl">
          <div style={{ fontSize:48, marginBottom:16 }}>🏆</div>
          <h2 className="text-xl font-bold text-black mb-2 tracking-tight">需要更多餐廳</h2>
          <p className="text-sm text-[#86868B] font-medium leading-relaxed mb-6">至少需要 2 家餐廳才能開始對決！先去匯入一些美食吧。</p>
          <button onClick={handleClose}
            className="w-full bg-black/90 text-white font-bold rounded-2xl py-4 text-sm active:scale-[0.97] transition-all">
            關閉
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[180] flex flex-col items-stretch overflow-hidden"
         style={{ background:'rgba(4,4,4,0.94)', backdropFilter:'blur(32px)' }}>

      {/* ── Close button ── */}
      <button onClick={handleClose}
        className="absolute top-5 right-5 z-50 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold transition-all active:scale-90 hover:bg-white/20"
        style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.18)', fontSize:18 }}>
        ✕
      </button>

      {/* ═══ INTRO PHASE ═══════════════════════════════════════════════════════ */}
      {phase === 'intro' && (
        <div className="flex flex-col items-center justify-center flex-1 p-6 animate-fade-in">
          {/* Preview cards stacked behind */}
          <div style={{ position:'relative', width:240, height:180, marginBottom:32 }}>
            {(pool.slice(0,3)).map((r, i) => (
              <div key={r.id || i} style={{
                position:'absolute',
                width:'100%', height:'100%',
                borderRadius:20,
                overflow:'hidden',
                transform:`rotate(${(i-1)*8}deg) translateY(${i*4}px)`,
                boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
                zIndex:3-i,
              }}>
                <img src={getFoodImage(r)} alt="" draggable={false}
                  style={{ width:'100%', height:'100%', objectFit:'cover' }}
                  onError={e => { e.target.src='https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=400'; }}
                />
                <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.35)' }}/>
              </div>
            ))}
          </div>

          <p style={{ color:'#E8821A', fontSize:11, fontWeight:800, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:8 }}>
            Fabrica Battle
          </p>
          <h1 style={{ color:'white', fontSize:36, fontWeight:900, letterSpacing:-0.8, textAlign:'center', marginBottom:10, lineHeight:1 }}>
            美食對決
          </h1>
          <p style={{ color:'rgba(255,255,255,0.45)', fontSize:13, textAlign:'center', maxWidth:260, lineHeight:1.6, marginBottom:8, fontWeight:500 }}>
            你的美食庫互相廝殺——
            <br/>每次只能活一家，最後冠軍就是今晚的命定美食。
          </p>

          {/* Round count badge */}
          <div style={{
            background:'rgba(255,255,255,0.07)',
            border:'1px solid rgba(255,255,255,0.12)',
            borderRadius:999, padding:'7px 16px',
            color:'rgba(255,255,255,0.55)', fontSize:12, fontWeight:700,
            marginBottom:36,
          }}>
            共 {Math.min((restaurants||[]).length, 8) - 1} 場對決 · {Math.min((restaurants||[]).length, 8)} 家參賽
          </div>

          <button
            onClick={startGame}
            style={{
              padding:'18px 60px',
              borderRadius:999,
              fontSize:17, fontWeight:800,
              background:'linear-gradient(135deg,#E8821A,#CC6E0E)',
              color:'#fff', border:'none',
              boxShadow:'0 8px 36px rgba(232,130,26,0.5)',
              cursor:'pointer',
              letterSpacing:'0.01em',
            }}
          >
            開始對決 →
          </button>
        </div>
      )}

      {/* ═══ BATTLE PHASE ══════════════════════════════════════════════════════ */}
      {phase === 'battle' && champion && challenger && (
        <div ref={containerRef} className="flex flex-col flex-1" style={{ padding:'16px 16px 24px' }}>
          {/* Round header */}
          <div style={{ textAlign:'center', marginBottom:16, paddingTop:12 }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:8,
              background:'rgba(255,255,255,0.07)',
              border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:999, padding:'6px 16px',
            }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#E8821A', boxShadow:'0 0 6px rgba(232,130,26,0.8)' }}/>
              <span style={{ color:'white', fontSize:12, fontWeight:800, letterSpacing:'0.05em' }}>
                {getRoundLabel(roundNum, totalRounds)}
              </span>
              <span style={{ color:'rgba(255,255,255,0.3)', fontSize:11, fontWeight:600 }}>
                {roundNum}/{totalRounds}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height:2, background:'rgba(255,255,255,0.08)', borderRadius:1, marginBottom:16, overflow:'hidden' }}>
            <div style={{
              height:'100%',
              width:`${(roundNum - 1) / totalRounds * 100}%`,
              background:'linear-gradient(90deg,#E8821A,#F09630)',
              borderRadius:1,
              transition:'width 0.4s ease',
            }}/>
          </div>

          {/* Battle arena */}
          <div style={{
            display:'flex', gap:12, alignItems:'stretch', flex:1,
            position:'relative', marginBottom:16,
          }}>
            {/* Left card */}
            <div ref={leftRef} style={{ flex:1, display:'flex', flexDirection:'column' }}>
              <BattleCard
                restaurant={champion}
                side="left"
                onClick={() => handlePick('left')}
                disabled={choosing}
                isChampion={roundNum > 1}
              />
            </div>

            {/* VS badge */}
            <div ref={vsRef} style={{
              position:'absolute', left:'50%', top:'50%',
              transform:'translate(-50%, -50%)',
              zIndex:20,
              width:44, height:44,
              borderRadius:'50%',
              background:'rgba(14,14,16,0.95)',
              border:'2px solid rgba(255,255,255,0.2)',
              backdropFilter:'blur(8px)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 4px 20px rgba(0,0,0,0.6)',
            }}>
              <span style={{ color:'#E8821A', fontSize:13, fontWeight:900, letterSpacing:'-0.02em' }}>VS</span>
            </div>

            {/* Right card */}
            <div ref={rightRef} style={{ flex:1, display:'flex', flexDirection:'column' }}>
              <BattleCard
                restaurant={challenger}
                side="right"
                onClick={() => handlePick('right')}
                disabled={choosing}
                isChampion={false}
              />
            </div>
          </div>

          {/* Tap hint */}
          <div style={{ textAlign:'center' }}>
            <span style={{ color:'rgba(255,255,255,0.28)', fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>
              點擊你更想吃的那家
            </span>
          </div>
        </div>
      )}

      {/* ═══ RESULT PHASE ══════════════════════════════════════════════════════ */}
      {phase === 'result' && currentChampion && (
        <div className="flex flex-col flex-1 relative overflow-hidden animate-fade-in">
          {showBurst && <ChampionBurst />}

          {/* Hero background photo */}
          <div style={{ position:'absolute', inset:0, zIndex:0 }}>
            <img
              src={getFoodImage(currentChampion)}
              alt=""
              style={{ width:'100%', height:'100%', objectFit:'cover' }}
              onError={e => { e.target.src='https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=800&auto=format&fit=crop'; }}
            />
            <div style={{
              position:'absolute', inset:0,
              background:'linear-gradient(to top, rgba(0,0,0,0.97) 40%, rgba(0,0,0,0.6) 75%, rgba(0,0,0,0.3) 100%)',
            }}/>
          </div>

          {/* Content */}
          <div style={{ position:'relative', zIndex:5, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'24px 24px 48px' }}>
            {/* Trophy + label */}
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🏆</div>
              <p style={{ color:'#E8821A', fontSize:11, fontWeight:800, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:8 }}>
                最終冠軍 · {totalRounds} 場全勝
              </p>
              <h1 style={{ color:'white', fontSize:32, fontWeight:900, letterSpacing:-0.5, lineHeight:1.1, margin:0 }}>
                {currentChampion.name}
              </h1>
            </div>

            {/* Info card */}
            <div style={{
              background:'rgba(255,255,255,0.07)',
              backdropFilter:'blur(20px)',
              border:'1px solid rgba(255,255,255,0.12)',
              borderRadius:20, padding:'14px 16px',
              marginBottom:20,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: currentChampion.note ? 8 : 0 }}>
                <div style={{
                  background:'rgba(232,130,26,0.2)', color:'#E8821A',
                  fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:6,
                }}>
                  {getSmartTag(currentChampion.name, currentChampion.category)}
                </div>
                {currentChampion.address && (
                  <span style={{ color:'rgba(255,255,255,0.45)', fontSize:11, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    📍 {currentChampion.address}
                  </span>
                )}
              </div>
              {currentChampion.note && (
                <p style={{ color:'rgba(255,255,255,0.68)', fontSize:12, lineHeight:1.55, margin:0, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {currentChampion.note}
                </p>
              )}
            </div>

            {/* CTA buttons */}
            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={startGame}
                style={{
                  flex:1, padding:'15px 0',
                  borderRadius:16, fontSize:13, fontWeight:700,
                  background:'rgba(255,255,255,0.09)',
                  border:'1px solid rgba(255,255,255,0.12)',
                  color:'rgba(255,255,255,0.7)',
                  cursor:'pointer',
                }}
              >
                再來一場
              </button>
              <button
                onClick={handleClose}
                style={{
                  flex:'1.6', padding:'15px 0',
                  borderRadius:16, fontSize:13, fontWeight:700,
                  background:'linear-gradient(135deg,#E8821A,#C4690F)',
                  border:'none', color:'#fff',
                  boxShadow:'0 4px 24px rgba(232,130,26,0.45)',
                  cursor:'pointer',
                }}
              >
                今晚就吃這家 →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
