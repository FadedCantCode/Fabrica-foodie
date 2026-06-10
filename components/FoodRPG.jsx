"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { gsap } from 'gsap';
import { getFoodImage, getSmartTag } from '../lib/helpers';

// ─── Constants ────────────────────────────────────────────────────────────────
const SAVE_KEY     = 'fabrica_rpg_v3';
const MAX_DAILY    = 5;
const MAX_LEVEL    = 50;
const CRIT_RATE    = 0.15;

const TITLES = [
  { lv:  1, title: '見習冒険家' },
  { lv:  5, title: '美食探索者' },
  { lv: 12, title: '食界勇者'   },
  { lv: 20, title: '饕餮鬥士'   },
  { lv: 30, title: '美食傳説'   },
  { lv: 40, title: '食神降臨'   },
];

const SKILLS = [
  { id:'attack', name:'普通攻擊', emoji:'⚔️', sp:0,  mult:1.0, healPct:0,    cd:0, lv:1, desc:'基礎斬擊'       },
  { id:'slice',  name:'美食斬',  emoji:'🗡️', sp:12, mult:1.9, healPct:0,    cd:2, lv:3, desc:'強力一擊・CD 2'  },
  { id:'flame',  name:'Fabrica炎',emoji:'🔥', sp:28, mult:3.0, healPct:0,    cd:4, lv:8, desc:'終極必殺・CD 4'  },
  { id:'heal',   name:'補給糧草', emoji:'🍱', sp:18, mult:0,   healPct:0.32, cd:3, lv:1, desc:'回復 32% HP・CD 3'},
];

const ELEMENTS = {
  '火鍋專賣':   { name:'火焰', emoji:'🔥', bg:'#E8821A', text:'#fff'    },
  '咖啡甜點':   { name:'星光', emoji:'✨', bg:'#F59E0B', text:'#fff'    },
  '日式料理':   { name:'雷霆', emoji:'⚡', bg:'#818CF8', text:'#fff'    },
  '台式小吃':   { name:'大地', emoji:'🌿', bg:'#34D399', text:'#065F46' },
  '燒肉串燒':   { name:'熔岩', emoji:'🌋', bg:'#F87171', text:'#fff'    },
  '手搖茶攤':   { name:'流水', emoji:'💧', bg:'#60A5FA', text:'#1E40AF' },
  default:      { name:'混沌', emoji:'👾', bg:'#C084FC', text:'#fff'    },
};

// ─── Helper functions ─────────────────────────────────────────────────────────
function getTitle(lv) {
  for (let i = TITLES.length - 1; i >= 0; i--)
    if (lv >= TITLES[i].lv) return TITLES[i].title;
  return TITLES[0].title;
}

function getElement(restaurant) {
  const tag = getSmartTag(restaurant.name, restaurant.category || '');
  const key = Object.keys(ELEMENTS).find(k => tag.startsWith(k)) || 'default';
  return ELEMENTS[key];
}

function getDungeonLv(index, total, confidence = 0.5) {
  const base = total <= 1 ? 5 : Math.round(1 + (index / (total - 1)) * 27);
  return Math.max(1, Math.min(30, base + Math.round(confidence * 3)));
}

function getBossStats(dungeonLv, elite) {
  const m = elite ? 1.75 : 1;
  return {
    maxHp: Math.round((dungeonLv * 20 + 30) * m),
    atk:   Math.round((dungeonLv *  3 +  8) * m),
    def:   Math.round((dungeonLv *  1 +  3) * m),
    exp:   Math.round((dungeonLv * 18 + 25) * m),
    gold:  Math.round((dungeonLv * 10 + 12) * m),
  };
}

function getCharStats(lv) {
  return {
    maxHp: 80  + lv * 14,
    maxSp: 40  + lv *  6,
    atk:   8   + lv *  3,
    def:   3   + Math.floor(lv * 1.5),
    expNext: lv * 100,
  };
}

function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}

function newSave() {
  const stats = getCharStats(1);
  return {
    char:     { lv:1, exp:0, hp:stats.maxHp, sp:stats.maxSp, gold:0 },
    progress: { defeatedIds:[], eliteIds:[], totalBattles:0, totalWins:0 },
    daily:    { date:'', battles:0 },
    streak:   { count:0, lastDate:'' },
  };
}

function writeSave(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
}

function pctBar(cur, max) {
  return Math.max(0, Math.min(100, (cur / max) * 100));
}

// ─── Floating damage numbers ──────────────────────────────────────────────────
function spawnNumber(container, text, type) {
  if (!container) return;
  const el = document.createElement('div');
  const isHeal = type === 'heal';
  const isCrit = type === 'crit';
  const isEnemy= type === 'enemy';
  el.textContent = text;
  el.style.cssText = `
    position:absolute; left:50%; top:${isEnemy ? '65%' : '35%'};
    transform:translateX(-50%);
    font-size:${isCrit ? 30 : 20}px; font-weight:900;
    color:${isHeal ? '#34C759' : isCrit ? '#FFD700' : isEnemy ? '#FF6B6B' : '#fff'};
    pointer-events:none; z-index:60; text-shadow:0 2px 6px rgba(0,0,0,0.8);
    white-space:nowrap;
  `;
  container.appendChild(el);
  gsap.fromTo(el,
    { y:0, opacity:1, scale: isCrit ? 1.4 : 1 },
    { y:-60, opacity:0, duration:1.1, ease:'power2.out',
      onComplete: () => el.remove() }
  );
}

// ─── HP/SP Bar component ──────────────────────────────────────────────────────
function StatBar({ cur, max, color, label, flash, flashRef }) {
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
        <span style={{ color:'rgba(255,255,255,0.55)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</span>
        <span style={{ color:'rgba(255,255,255,0.8)', fontSize:11, fontWeight:700 }}>{cur}/{max}</span>
      </div>
      <div ref={flashRef} style={{ height:7, background:'rgba(255,255,255,0.1)', borderRadius:4, overflow:'hidden' }}>
        <div style={{
          height:'100%', background:color,
          width:`${pctBar(cur, max)}%`,
          borderRadius:4,
          transition:'width 0.35s ease',
          boxShadow:`0 0 6px ${color}80`,
        }}/>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FoodRPG({ restaurants, isOpen, onClose }) {
  // ── Refs ────────────────────────────────────────────────────────────────────
  const bossImgRef     = useRef(null);
  const floatRef       = useRef(null);  // container for floating numbers
  const hpFlashRef     = useRef(null);  // player HP bar (flash on hit)
  const levelupRef     = useRef(null);  // level up overlay
  const logEndRef      = useRef(null);  // auto-scroll battle log
  const enemyTimerRef  = useRef(null);

  // ── State ────────────────────────────────────────────────────────────────────
  const [save,        setSave]        = useState(null);
  const [view,        setView]        = useState('dungeons');   // dungeons|battle|result
  const [dungeon,     setDungeon]     = useState(null);         // { restaurant, lv, elite, boss }
  const [battle,      setBattle]      = useState(null);         // live battle state
  const [levelUpData, setLevelUpData] = useState(null);         // pending level-up info
  const [resultData,  setResultData]  = useState(null);         // post-battle result

  // ── Load save on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const raw = loadSave();
    if (!raw) { const s = newSave(); writeSave(s); setSave(s); }
    else setSave(raw);
    setView('dungeons');
    setDungeon(null);
    setBattle(null);
    setLevelUpData(null);
    setResultData(null);
  }, [isOpen]);

  // ── Update daily streak ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!save) return;
    const today = new Date().toDateString();
    let updated = false;
    const s = JSON.parse(JSON.stringify(save));

    // Reset daily counter if new day
    if (s.daily.date !== today) {
      s.daily = { date: today, battles: 0 };
      updated = true;
    }

    // Update streak
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (s.streak.lastDate === yesterday) {
      // continue streak (already counted)
    } else if (s.streak.lastDate !== today) {
      if (s.streak.lastDate === yesterday) {
        s.streak.count += 1;
      } else if (s.streak.lastDate !== today) {
        s.streak = { count: 1, lastDate: today };
      }
      s.streak.lastDate = today;
      updated = true;
    }

    if (updated) { writeSave(s); setSave(s); }
  }, [save?.daily?.date]);

  // ── Auto-scroll battle log ───────────────────────────────────────────────────
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [battle?.log?.length]);

  // ── Level-up overlay entrance ────────────────────────────────────────────────
  useEffect(() => {
    if (!levelUpData || !levelupRef.current) return;
    gsap.fromTo(levelupRef.current,
      { scale:0.6, opacity:0 },
      { scale:1, opacity:1, duration:0.55, ease:'back.out(1.5)' }
    );
  }, [levelUpData]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => () => { if (enemyTimerRef.current) clearTimeout(enemyTimerRef.current); }, []);

  // ── Dungeon list ──────────────────────────────────────────────────────────────
  const dungeons = useMemo(() => {
    if (!restaurants?.length || !save) return [];
    const total = restaurants.length;
    return restaurants.map((r, i) => {
      const lv      = getDungeonLv(i, total, r.confidence);
      const elem    = getElement(r);
      const beaten  = save.progress.defeatedIds.includes(r.id);
      const elite   = save.progress.eliteIds.includes(r.id);
      const locked  = lv > save.char.lv + 3;
      return { restaurant: r, lv, elem, beaten, elite, locked };
    }).sort((a, b) => {
      if (!a.locked && !b.locked) return a.lv - b.lv;
      if (!a.locked) return -1;
      if (!b.locked) return 1;
      return a.lv - b.lv;
    });
  }, [restaurants, save?.progress?.defeatedIds?.length, save?.progress?.eliteIds?.length, save?.char?.lv]);

  // ── Daily battles remaining ───────────────────────────────────────────────────
  const battlesLeft = useMemo(() => {
    if (!save) return 0;
    const today = new Date().toDateString();
    if (save.daily.date !== today) return MAX_DAILY;
    return Math.max(0, MAX_DAILY - save.daily.battles);
  }, [save]);

  // ── Enter dungeon ──────────────────────────────────────────────────────────────
  const enterDungeon = useCallback((dungeonData, isElite = false) => {
    if (!save || battlesLeft === 0) return;
    const boss   = getBossStats(dungeonData.lv, isElite);
    const cstats = getCharStats(save.char.lv);
    setDungeon({ ...dungeonData, isElite, boss });
    setBattle({
      bossHp:    boss.maxHp,
      turn:      1,
      phase:     'player',  // player | enemy | done
      cooldowns: { slice:0, flame:0, heal:0 },
      log:       [{ text:`⚠️ 遭遇 ${dungeonData.restaurant.name}！`, type:'info' }],
      outcome:   null,
    });
    setView('battle');
  }, [save, battlesLeft]);

  // ── Battle logic ────────────────────────────────────────────────────────────
  const handleSkill = useCallback((skill) => {
    if (!battle || battle.phase !== 'player' || !save || !dungeon) return;

    const s = JSON.parse(JSON.stringify(save));
    const cstats  = getCharStats(s.char.lv);
    const b       = { ...battle, log: [...battle.log] };
    const boss    = dungeon.boss;
    const cd      = { ...b.cooldowns };

    // SP check
    if (s.char.sp < skill.sp) {
      b.log.push({ text:`❌ SP 不足！（需要 ${skill.sp} SP）`, type:'info' });
      setSave(s); setBattle(b);
      return;
    }

    // CD check
    if (skill.id !== 'attack' && skill.id !== 'heal' && cd[skill.id] > 0) {
      b.log.push({ text:`⏳ ${skill.name} 冷卻中（還剩 ${cd[skill.id]} 回合）`, type:'info' });
      setSave(s); setBattle(b);
      return;
    }

    // Apply skill
    let newBossHp = b.bossHp;

    if (skill.healPct > 0) {
      // Heal
      const healAmt = Math.round(cstats.maxHp * skill.healPct);
      s.char.hp = Math.min(cstats.maxHp, s.char.hp + healAmt);
      s.char.sp -= skill.sp;
      b.log.push({ text:`🍱 補給糧草！回復 +${healAmt} HP`, type:'heal' });
      spawnNumber(floatRef.current, `+${healAmt}`, 'heal');
    } else if (skill.mult > 0) {
      // Damage
      const bossEffDef = Math.floor(boss.def * 0.5);
      const rawDmg     = Math.max(1, cstats.atk - bossEffDef);
      const scaled     = Math.round(rawDmg * skill.mult);
      const isCrit     = Math.random() < CRIT_RATE;
      const finalDmg   = isCrit ? Math.round(scaled * 1.5) : scaled;
      newBossHp        = Math.max(0, b.bossHp - finalDmg);
      s.char.sp        = Math.max(0, s.char.sp - skill.sp);

      if (isCrit) {
        b.log.push({ text:`💥 ${skill.name} 暴擊！對 Boss 造成 ${finalDmg} 傷害！`, type:'crit' });
        spawnNumber(floatRef.current, `${finalDmg}💥`, 'crit');
      } else {
        b.log.push({ text:`${skill.emoji} ${skill.name}！造成 ${finalDmg} 傷害`, type:'player' });
        spawnNumber(floatRef.current, `${finalDmg}`, 'player');
      }

      // Shake boss
      if (bossImgRef.current) {
        gsap.to(bossImgRef.current, {
          x: 8, yoyo:true, repeat:4, duration:0.06, ease:'none',
          onComplete: () => gsap.set(bossImgRef.current, { x:0 }),
        });
      }
    }

    // Apply cooldown
    if (skill.id !== 'attack') cd[skill.id] = skill.cd;
    // Tick down all cooldowns
    Object.keys(cd).forEach(k => { if (k !== skill.id && cd[k] > 0) cd[k]--; });

    b.bossHp   = newBossHp;
    b.cooldowns = cd;

    // Check boss dead
    if (newBossHp === 0) {
      b.phase   = 'done';
      b.outcome = 'win';
      b.log.push({ text:`🏆 ${dungeon.restaurant.name} 已被征服！`, type:'win' });

      // Give rewards
      s.progress.totalBattles++;
      s.progress.totalWins++;
      const today = new Date().toDateString();
      if (s.daily.date !== today) s.daily = { date:today, battles:0 };
      s.daily.battles++;

      if (dungeon.isElite) {
        if (!s.progress.eliteIds.includes(dungeon.restaurant.id))
          s.progress.eliteIds.push(dungeon.restaurant.id);
      } else {
        if (!s.progress.defeatedIds.includes(dungeon.restaurant.id))
          s.progress.defeatedIds.push(dungeon.restaurant.id);
      }

      // EXP & gold
      s.char.gold += boss.goldReward;
      const newExp = s.char.exp + boss.exp;
      const cstats = getCharStats(s.char.lv);
      
      // Level up check
      let leveled = false;
      let newLv = s.char.lv;
      let leftover = newExp;
      let unlockedSkill = null;

      while (newLv < MAX_LEVEL) {
        const needed = getCharStats(newLv).expNext;
        if (leftover >= needed) {
          leftover -= needed;
          newLv++;
          leveled = true;
          // Check skill unlocks
          const sk = SKILLS.find(sk => sk.lv === newLv);
          if (sk && sk.id !== 'attack' && sk.id !== 'heal') unlockedSkill = sk;
        } else break;
      }

      s.char.lv  = newLv;
      s.char.exp = leftover;

      if (leveled) {
        const newStats = getCharStats(newLv);
        s.char.hp = newStats.maxHp;  // full restore on level up
        s.char.sp = newStats.maxSp;
      }

      writeSave(s);
      setSave(s);
      setBattle(b);

      // Show level up overlay first if leveled, then result
      if (leveled) {
        setTimeout(() => {
          setLevelUpData({ lv: newLv, title: getTitle(newLv), skill: unlockedSkill, exp: boss.exp, gold: boss.goldReward });
        }, 600);
      } else {
        setTimeout(() => {
          setResultData({ outcome:'win', exp: boss.exp, gold: boss.goldReward, restaurant: dungeon.restaurant });
          setView('result');
        }, 800);
      }
      return;
    }

    // Boss turn (enemy attacks after delay)
    b.phase = 'enemy';
    setSave(s);
    setBattle({ ...b });

    enemyTimerRef.current = setTimeout(() => {
      const bossIsStrong = b.turn % 3 === 0;
      const baseBossAtk  = Math.max(1, boss.atk - Math.floor(getCharStats(s.char.lv).def * 0.4));
      const rawEnemyDmg  = Math.round(baseBossAtk * (bossIsStrong ? 1.7 : 1.0));
      const newCharHp    = Math.max(0, s.char.hp - rawEnemyDmg);

      s.char.hp = newCharHp;
      const logEntry = bossIsStrong
        ? { text:`💢 ${dungeon.restaurant.name} 強攻！你受到 ${rawEnemyDmg} 傷害！`, type:'enemy_strong' }
        : { text:`⚔️ ${dungeon.restaurant.name} 攻擊！你受到 ${rawEnemyDmg} 傷害！`, type:'enemy' };

      spawnNumber(floatRef.current, `-${rawEnemyDmg}`, 'enemy');

      // Flash HP bar red
      if (hpFlashRef.current) {
        gsap.to(hpFlashRef.current, {
          backgroundColor:'rgba(255,80,80,0.4)', yoyo:true, repeat:1, duration:0.18,
          onComplete: () => gsap.set(hpFlashRef.current, { backgroundColor:'' }),
        });
      }

      const died = newCharHp === 0;

      setBattle(prev => ({
        ...prev,
        phase: died ? 'done' : 'player',
        outcome: died ? 'lose' : null,
        turn: prev.turn + 1,
        cooldowns: { ...cd },
        log: [...prev.log, logEntry, ...(died ? [{ text:`💀 力竭倒下...`, type:'lose' }] : [])],
      }));

      writeSave(s);
      setSave(s);

      if (died) {
        setTimeout(() => {
          setResultData({ outcome:'lose', restaurant: dungeon.restaurant });
          setView('result');
        }, 900);
      }
    }, 700);
  }, [battle, save, dungeon]);

  // ── Close & clean up ─────────────────────────────────────────────────────────
  const handleClose = () => {
    if (enemyTimerRef.current) clearTimeout(enemyTimerRef.current);
    setView('dungeons');
    setDungeon(null);
    setBattle(null);
    setLevelUpData(null);
    setResultData(null);
    onClose();
  };

  const dismissLevelUp = () => {
    const rd = resultData || { outcome:'win', exp: levelUpData?.exp || 0, gold: levelUpData?.gold || 0, restaurant: dungeon?.restaurant };
    setLevelUpData(null);
    setResultData(rd);
    setView('result');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  if (!isOpen || !save) return null;

  const cstats = getCharStats(save.char.lv);
  const hpPct  = pctBar(save.char.hp, cstats.maxHp);
  const spPct  = pctBar(save.char.sp, cstats.maxSp);
  const expPct = pctBar(save.char.exp, cstats.expNext);

  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-[180] flex flex-col overflow-hidden"
         style={{ background:'rgba(6,6,8,0.96)', backdropFilter:'blur(28px)' }}>

      {/* ── Close ── */}
      <button onClick={handleClose}
        className="absolute top-5 right-5 z-50 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold transition-all active:scale-90 hover:bg-white/20"
        style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.18)', fontSize:18 }}>
        ✕
      </button>

      {/* ══════════════════ DUNGEON LIST ══════════════════════════════════════ */}
      {view === 'dungeons' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Player header */}
          <div style={{
            padding:'20px 20px 14px',
            background:'linear-gradient(to bottom, rgba(255,255,255,0.06) 0%, transparent 100%)',
            borderBottom:'1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <p style={{ color:'#E8821A', fontSize:10, fontWeight:800, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:3 }}>
                  美食冒険録
                </p>
                <h1 style={{ color:'white', fontSize:22, fontWeight:900, letterSpacing:-0.3, lineHeight:1 }}>
                  {getTitle(save.char.lv)}
                </h1>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{
                  background:'rgba(232,130,26,0.15)', border:'1px solid rgba(232,130,26,0.3)',
                  borderRadius:12, padding:'6px 12px', display:'inline-block',
                }}>
                  <div style={{ color:'#E8821A', fontSize:10, fontWeight:700, letterSpacing:'0.05em' }}>Lv.{save.char.lv}</div>
                  <div style={{ color:'rgba(255,255,255,0.5)', fontSize:9, fontWeight:600 }}>EXP {save.char.exp}/{cstats.expNext}</div>
                </div>
              </div>
            </div>

            {/* Stat bars */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
              <StatBar cur={save.char.hp} max={cstats.maxHp} color='#34C759' label='HP' flashRef={null}/>
              <StatBar cur={save.char.sp} max={cstats.maxSp} color='#60A5FA' label='SP' flashRef={null}/>
            </div>

            {/* EXP bar */}
            <div style={{ marginTop:8 }}>
              <div style={{ height:3, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden' }}>
                <div style={{
                  height:'100%', width:`${expPct}%`,
                  background:'linear-gradient(90deg,#E8821A,#F59E0B)',
                  transition:'width 0.4s ease', borderRadius:2,
                }}/>
              </div>
            </div>

            {/* Daily status */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10 }}>
              <div style={{ display:'flex', gap:5 }}>
                {Array.from({ length:MAX_DAILY }, (_, i) => (
                  <div key={i} style={{
                    width:7, height:7, borderRadius:'50%',
                    background: i < (MAX_DAILY - battlesLeft) ? 'rgba(255,255,255,0.15)' : '#E8821A',
                    boxShadow: i < (MAX_DAILY - battlesLeft) ? 'none' : '0 0 5px rgba(232,130,26,0.6)',
                  }}/>
                ))}
                <span style={{ color:'rgba(255,255,255,0.38)', fontSize:10, fontWeight:600, marginLeft:4 }}>
                  今日剩 {battlesLeft} 戰
                </span>
              </div>
              <span style={{ color:'rgba(255,255,255,0.38)', fontSize:10, fontWeight:600 }}>
                🪙 {save.char.gold}
              </span>
            </div>
          </div>

          {/* Dungeon cards */}
          <div className="flex-1 overflow-y-auto" style={{ padding:'12px 16px 32px' }}>
            {dungeons.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'rgba(255,255,255,0.3)', fontSize:13, fontWeight:600 }}>
                匯入美食後才有地城可以挑戰！
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {dungeons.map((d, i) => (
                  <DungeonCard
                    key={d.restaurant.id || i}
                    d={d}
                    save={save}
                    battlesLeft={battlesLeft}
                    onEnter={() => enterDungeon(d, false)}
                    onElite={() => enterDungeon(d, true)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════ BATTLE ════════════════════════════════════════════ */}
      {view === 'battle' && dungeon && battle && (
        <div className="flex flex-col flex-1 overflow-hidden" style={{ position:'relative' }}>
          {/* Float container for damage numbers */}
          <div ref={floatRef} style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:50, overflow:'hidden' }}/>

          {/* Boss section */}
          <div style={{ position:'relative', height:'38%', flexShrink:0, overflow:'hidden', background:'rgba(0,0,0,0.3)' }}>
            {/* Boss food photo */}
            <div ref={bossImgRef} style={{ position:'absolute', inset:0 }}>
              <img
                src={getFoodImage(dungeon.restaurant)}
                alt={dungeon.restaurant.name}
                style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.65 }}
                onError={e => { e.target.src='https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=600&auto=format&fit=crop'; }}
              />
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(6,6,8,1) 0%, rgba(6,6,8,0.3) 60%, transparent 100%)' }}/>
            </div>

            {/* Boss info overlay */}
            <div style={{ position:'absolute', bottom:14, left:16, right:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                {/* Element badge */}
                <div style={{
                  background:dungeon.elem.bg, color:dungeon.elem.text,
                  borderRadius:999, padding:'3px 10px', fontSize:11, fontWeight:700,
                  display:'flex', alignItems:'center', gap:4,
                }}>
                  {dungeon.elem.emoji} {dungeon.elem.name}
                </div>
                <span style={{ color:'rgba(255,255,255,0.5)', fontSize:10, fontWeight:700 }}>
                  Lv.{dungeon.lv} {dungeon.isElite ? '⭐ ELITE' : ''}
                </span>
              </div>
              <div style={{
                color:'white', fontSize:18, fontWeight:800, letterSpacing:-0.3,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                marginBottom:8,
              }}>
                {dungeon.restaurant.name}
              </div>
              {/* Boss HP bar */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ color:'rgba(255,255,255,0.5)', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>BOSS HP</span>
                  <span style={{ color:'rgba(255,255,255,0.7)', fontSize:10, fontWeight:700 }}>{battle.bossHp}/{dungeon.boss.maxHp}</span>
                </div>
                <div style={{ height:8, background:'rgba(255,255,255,0.12)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{
                    height:'100%',
                    width:`${pctBar(battle.bossHp, dungeon.boss.maxHp)}%`,
                    background:'linear-gradient(90deg, #F87171, #EF4444)',
                    borderRadius:4, transition:'width 0.35s ease',
                    boxShadow:'0 0 8px rgba(248,113,113,0.5)',
                  }}/>
                </div>
              </div>
            </div>
          </div>

          {/* Battle log */}
          <div style={{
            flex:1, overflowY:'auto', padding:'8px 14px',
            display:'flex', flexDirection:'column', gap:3,
          }}>
            {battle.log.slice(-8).map((entry, i) => (
              <div key={i} style={{
                fontSize:11, fontWeight:600, lineHeight:1.5, padding:'3px 0',
                color: entry.type === 'crit'    ? '#FFD700'
                     : entry.type === 'heal'    ? '#34C759'
                     : entry.type === 'win'     ? '#E8821A'
                     : entry.type === 'lose'    ? '#F87171'
                     : entry.type === 'enemy_strong' ? '#FF6B6B'
                     : entry.type === 'enemy'   ? 'rgba(255,255,255,0.55)'
                     : entry.type === 'info'    ? 'rgba(255,255,255,0.4)'
                     : 'rgba(255,255,255,0.85)',
                borderBottom: i < battle.log.slice(-8).length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                {entry.text}
              </div>
            ))}
            <div ref={logEndRef}/>
          </div>

          {/* Player section */}
          <div style={{
            padding:'10px 14px 28px',
            background:'rgba(0,0,0,0.4)',
            borderTop:'1px solid rgba(255,255,255,0.08)',
          }}>
            {/* Player HP/SP */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 14px', marginBottom:10 }}>
              <StatBar cur={save.char.hp} max={cstats.maxHp} color='#34C759' label='HP' flashRef={hpFlashRef}/>
              <StatBar cur={save.char.sp} max={cstats.maxSp} color='#60A5FA' label='SP' flashRef={null}/>
            </div>

            {/* Skill buttons */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {SKILLS.map(sk => {
                const locked   = sk.lv > save.char.lv;
                const cdLeft   = sk.id === 'attack' ? 0 : (battle.cooldowns[sk.id] || 0);
                const noSP     = save.char.sp < sk.sp;
                const disabled = locked || cdLeft > 0 || noSP || battle.phase !== 'player';
                return (
                  <button key={sk.id} onClick={() => handleSkill(sk)} disabled={disabled}
                    style={{
                      padding:'9px 6px', borderRadius:12,
                      fontSize:11, fontWeight:700, cursor:disabled ? 'not-allowed' : 'pointer',
                      border:'1px solid',
                      transition:'all 0.15s ease',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                      ...(locked ? {
                        background:'rgba(255,255,255,0.03)',
                        borderColor:'rgba(255,255,255,0.06)',
                        color:'rgba(255,255,255,0.2)',
                      } : disabled ? {
                        background:'rgba(255,255,255,0.04)',
                        borderColor:'rgba(255,255,255,0.08)',
                        color:'rgba(255,255,255,0.3)',
                      } : {
                        background:'rgba(232,130,26,0.12)',
                        borderColor:'rgba(232,130,26,0.3)',
                        color:'white',
                        boxShadow:'0 2px 12px rgba(232,130,26,0.15)',
                      }),
                    }}
                  >
                    <span style={{ fontSize:16 }}>{sk.emoji}</span>
                    <span>{sk.name}</span>
                    <span style={{ fontSize:9, opacity:0.6 }}>
                      {locked ? `🔒 Lv.${sk.lv}` : cdLeft > 0 ? `CD:${cdLeft}` : sk.sp > 0 ? `${sk.sp}SP` : 'FREE'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ RESULT ════════════════════════════════════════════ */}
      {view === 'result' && resultData && (
        <div className="flex flex-col flex-1 items-center justify-center p-6 animate-fade-in">
          {resultData.outcome === 'win' ? (
            <>
              <div style={{ fontSize:52, marginBottom:16 }}>🏆</div>
              <p style={{ color:'#E8821A', fontSize:11, fontWeight:800, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:6 }}>
                地城攻略成功
              </p>
              <h2 style={{ color:'white', fontSize:26, fontWeight:900, letterSpacing:-0.5, textAlign:'center', marginBottom:20 }}>
                {resultData.restaurant?.name}
              </h2>
              <div style={{
                display:'flex', gap:12, marginBottom:28,
              }}>
                <div style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'12px 20px', textAlign:'center' }}>
                  <div style={{ color:'#F59E0B', fontSize:18, fontWeight:900 }}>+{resultData.exp}</div>
                  <div style={{ color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:700, marginTop:2 }}>EXP</div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'12px 20px', textAlign:'center' }}>
                  <div style={{ color:'#FFD700', fontSize:18, fontWeight:900 }}>+{resultData.gold}</div>
                  <div style={{ color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:700, marginTop:2 }}>🪙 金幣</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize:52, marginBottom:16 }}>💀</div>
              <p style={{ color:'#F87171', fontSize:11, fontWeight:800, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:6 }}>
                戰鬥失敗
              </p>
              <h2 style={{ color:'white', fontSize:22, fontWeight:900, letterSpacing:-0.3, textAlign:'center', marginBottom:8 }}>
                {resultData.restaurant?.name} 太強大了
              </h2>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:12, textAlign:'center', maxWidth:240, lineHeight:1.6, marginBottom:28 }}>
                升個等再回來挑戰吧，勇者。
              </p>
            </>
          )}
          <div style={{ display:'flex', gap:10, width:'100%', maxWidth:320 }}>
            <button onClick={() => setView('dungeons')}
              style={{
                flex:1, padding:'15px 0', borderRadius:16, fontSize:13, fontWeight:700,
                background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)',
                color:'rgba(255,255,255,0.7)', cursor:'pointer',
              }}>
              返回地城
            </button>
            {battlesLeft > 0 && resultData.outcome === 'win' && (
              <button onClick={() => { setResultData(null); setView('dungeons'); }}
                style={{
                  flex:1, padding:'15px 0', borderRadius:16, fontSize:13, fontWeight:700,
                  background:'linear-gradient(135deg,#E8821A,#C4690F)', border:'none',
                  color:'#fff', cursor:'pointer', boxShadow:'0 4px 22px rgba(232,130,26,0.42)',
                }}>
                繼續冒険 →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════ LEVEL UP OVERLAY ═════════════════════════════════ */}
      {levelUpData && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
             style={{ background:'rgba(0,0,0,0.88)', backdropFilter:'blur(12px)' }}>
          <div ref={levelupRef} style={{ textAlign:'center', padding:'0 32px' }}>
            <div style={{ fontSize:14, color:'#E8821A', fontWeight:800, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:12 }}>
              LEVEL UP
            </div>
            <div style={{
              fontSize:80, fontWeight:900, color:'#FFD700',
              textShadow:'0 0 40px rgba(255,215,0,0.5), 0 0 80px rgba(255,215,0,0.25)',
              lineHeight:1, marginBottom:16,
            }}>
              {levelUpData.lv}
            </div>
            <div style={{ color:'white', fontSize:22, fontWeight:900, marginBottom:6 }}>
              {levelUpData.title}
            </div>
            {levelUpData.skill && (
              <div style={{
                background:'rgba(232,130,26,0.18)', border:'1px solid rgba(232,130,26,0.3)',
                borderRadius:12, padding:'10px 20px', display:'inline-block', marginBottom:28,
                color:'#E8821A', fontSize:13, fontWeight:700,
              }}>
                ✨ 解鎖技能：{levelUpData.skill.name}
              </div>
            )}
            {!levelUpData.skill && <div style={{ marginBottom:28 }}/>}
            <button onClick={dismissLevelUp}
              style={{
                padding:'16px 48px', borderRadius:999, fontSize:15, fontWeight:800,
                background:'linear-gradient(135deg,#E8821A,#CC6E0E)', color:'#fff', border:'none',
                cursor:'pointer', boxShadow:'0 8px 32px rgba(232,130,26,0.5)',
              }}>
              繼續冒険 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dungeon Card sub-component ───────────────────────────────────────────────
function DungeonCard({ d, save, battlesLeft, onEnter, onElite }) {
  const { restaurant, lv, elem, beaten, elite, locked } = d;
  const playerLv = save.char.lv;
  const canFight = !locked && battlesLeft > 0;
  const imgSrc = getFoodImage(restaurant);

  return (
    <div style={{
      borderRadius:18, overflow:'hidden', position:'relative',
      border: locked ? '1px solid rgba(255,255,255,0.06)'
            : elite  ? '1px solid rgba(255,215,0,0.4)'
            : beaten ? '1px solid rgba(52,199,89,0.3)'
            :          '1px solid rgba(232,130,26,0.3)',
      background:'rgba(255,255,255,0.04)',
      opacity: locked ? 0.45 : 1,
    }}>
      {/* Thumbnail */}
      <div style={{ height:90, position:'relative', overflow:'hidden' }}>
        <img src={imgSrc} alt="" draggable={false}
          style={{ width:'100%', height:'100%', objectFit:'cover', filter: locked ? 'grayscale(80%)' : 'none' }}
          onError={e => { e.target.src='https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=400'; }}
        />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 60%)' }}/>
        {/* Element badge */}
        <div style={{
          position:'absolute', top:6, left:6,
          background:elem.bg, color:elem.text,
          fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:5,
        }}>
          {elem.emoji} {elem.name}
        </div>
        {/* Status badge */}
        {elite && <div style={{ position:'absolute', top:6, right:6, fontSize:11 }}>⭐</div>}
        {beaten && !elite && <div style={{ position:'absolute', top:6, right:6, color:'#34C759', fontSize:14, fontWeight:900 }}>✓</div>}
        {locked && <div style={{ position:'absolute', top:6, right:6, fontSize:13 }}>🔒</div>}
        <div style={{
          position:'absolute', bottom:5, left:7,
          color:'rgba(255,255,255,0.8)', fontSize:9, fontWeight:700,
          background:'rgba(0,0,0,0.45)', borderRadius:5, padding:'1px 5px',
        }}>
          Lv.{lv}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding:'8px 9px 10px' }}>
        <div style={{
          color:'white', fontSize:12, fontWeight:700,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          marginBottom:7,
        }}>
          {restaurant.name}
        </div>

        {locked ? (
          <div style={{ color:'rgba(255,255,255,0.3)', fontSize:10, fontWeight:600 }}>
            需要 Lv.{Math.max(1, lv - 3)} 才能解鎖
          </div>
        ) : (
          <div style={{ display:'flex', gap:5, flexDirection:'column' }}>
            <button onClick={onEnter} disabled={!canFight}
              style={{
                padding:'7px 0', borderRadius:8, fontSize:11, fontWeight:700,
                background: canFight ? 'linear-gradient(135deg,#E8821A,#CC6E0E)' : 'rgba(255,255,255,0.07)',
                color: canFight ? '#fff' : 'rgba(255,255,255,0.3)',
                border:'none', cursor: canFight ? 'pointer' : 'not-allowed',
              }}>
              {beaten ? '重新挑戰' : '⚔️ 挑戰'}
            </button>
            {beaten && (
              <button onClick={onElite} disabled={!canFight}
                style={{
                  padding:'6px 0', borderRadius:8, fontSize:10, fontWeight:700,
                  background: canFight ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)',
                  color: canFight ? '#FFD700' : 'rgba(255,255,255,0.2)',
                  border: canFight ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent',
                  cursor: canFight ? 'pointer' : 'not-allowed',
                }}>
                ⭐ 菁英挑戰
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
