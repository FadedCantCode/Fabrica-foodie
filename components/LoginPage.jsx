"use client";

import React, { useEffect, useRef } from 'react';
import { FABRICA_THREADS_HANDLE } from '../lib/firebase';
import { SlideButton, AppleButton, VerticalMarquee, StepPips } from './ui';

export default function LoginPage({
  loginStep, inputUsername, setInputUsername,
  loginError, verificationCode,
  isGoogleAuthPending, isGlobalTransitioning,
  onGenerateCode, onVerifyCrawler, onResetLogin, onGoogleSignIn,
}) {
  const heroRef   = useRef(null);
  const formRef   = useRef(null);
  const titleRef  = useRef(null);

  // Subtle parallax on mousemove
  useEffect(() => {
    const onMove = (e) => {
      if (!heroRef.current) return;
      const x = (e.clientX / window.innerWidth  - 0.5) * 12;
      const y = (e.clientY / window.innerHeight - 0.5) * 8;
      heroRef.current.style.transform = `translate(${x}px, ${y}px) scale(1.04)`;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#0A0A0A] flex">

      {/* ── Background hero image with parallax ── */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div
          ref={heroRef}
          className="absolute inset-[-6%] transition-transform duration-[120ms] ease-out will-change-transform"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 70% 40%, rgba(255,255,255,0.04) 0%, transparent 60%),
              radial-gradient(ellipse 50% 80% at 20% 80%, rgba(255,255,255,0.03) 0%, transparent 50%),
              #0A0A0A
            `,
          }}
        >
          {/* Grain texture overlay */}
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
          }} />
          {/* Subtle grid */}
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
          }}/>
        </div>
      </div>

      {/* ── Left marquee ── */}
      <div className="hidden lg:flex flex-col justify-center gap-6 w-12 border-r border-white/5 relative z-20 py-8">
        <VerticalMarquee direction="up"   text="WELCOME TO FOODIE BETA TEST" />
        <VerticalMarquee direction="down" text="EXPLORE SHARE COLLECT" />
      </div>

      {/* ── Main split layout ── */}
      <div className="flex-1 flex flex-col lg:flex-row relative z-10">

        {/* ── Left: Hero copy ── */}
        <div className="flex-1 flex flex-col justify-between p-8 lg:p-16 lg:pr-0">

          {/* Top: Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-[10px] flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <circle cx="12" cy="11" r="3" strokeWidth="1.8"/>
              </svg>
            </div>
            <span className="text-white/90 font-bold text-sm tracking-tight">FABRICA FOODIE</span>
          </div>

          {/* Middle: Big headline */}
          <div ref={titleRef} className="space-y-6 py-12 lg:py-0">
            <div className="overflow-hidden">
              <h1 className="text-[clamp(3rem,8vw,7rem)] font-black leading-[0.9] tracking-[-0.03em] text-white animate-slide-up">
                Your
              </h1>
            </div>
            <div className="overflow-hidden">
              <h1 className="text-[clamp(3rem,8vw,7rem)] font-black leading-[0.9] tracking-[-0.03em] text-white/30 animate-slide-up" style={{ animationDelay: '60ms' }}>
                Food
              </h1>
            </div>
            <div className="overflow-hidden">
              <h1 className="text-[clamp(3rem,8vw,7rem)] font-black leading-[0.9] tracking-[-0.03em] text-white animate-slide-up" style={{ animationDelay: '120ms' }}>
                Story.
              </h1>
            </div>
            <p className="text-white/40 text-sm font-medium max-w-xs leading-relaxed animate-fade-in" style={{ animationDelay: '300ms' }}>
              從 Threads 探索到您的專屬美食地圖——<br/>AI 自動彙整，一切從這裡開始。
            </p>
          </div>

          {/* Bottom: Stats */}
          <div className="hidden lg:flex items-center gap-8 animate-fade-in" style={{ animationDelay: '400ms' }}>
            <div>
              <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest mb-1">收藏</p>
              <p className="text-white/80 text-xl font-black tracking-tight">無限制</p>
            </div>
            <div className="w-px h-8 bg-white/10"/>
            <div>
              <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest mb-1">AI 分析</p>
              <p className="text-white/80 text-xl font-black tracking-tight">即時</p>
            </div>
            <div className="w-px h-8 bg-white/10"/>
            <div>
              <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest mb-1">平台</p>
              <p className="text-white/80 text-xl font-black tracking-tight">Threads</p>
            </div>
          </div>
        </div>

        {/* ── Right: Form panel ── */}
        <div
          ref={formRef}
          className={`
            w-full lg:w-[420px] flex-shrink-0
            flex flex-col justify-center
            p-8 lg:p-12
            lg:border-l border-white/5
            transition-all duration-700
            ${isGlobalTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
          `}
        >
          {/* Form header */}
          <div className="mb-8">
            <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest mb-2">開始使用</p>
            <h2 className="text-white text-2xl font-black tracking-tight leading-tight">
              {loginStep === 'idle'       && '登入您的帳號'}
              {loginStep === 'code_shown' && '驗證身分'}
              {loginStep === 'verifying'  && '確認中...'}
            </h2>
          </div>

          <StepPips currentStep={loginStep} dark />

          {/* Form body */}
          <div className="space-y-4 mt-6">

            {/* ── Step 0: enter username ── */}
            {loginStep === 'idle' && (
              <form onSubmit={onGenerateCode} className="space-y-4 animate-fade-in">
                <div className="relative flex items-center w-full group">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-base font-semibold text-white/30 group-focus-within:text-white select-none pointer-events-none transition-colors duration-200">@</span>
                  <input
                    type="text"
                    placeholder="您的 Threads 帳號"
                    value={inputUsername}
                    onChange={(e) => setInputUsername(e.target.value.replace('@', ''))}
                    className="w-full bg-white/5 text-white text-base font-medium rounded-2xl py-4 pl-12 pr-5 border border-white/10 focus:border-white/30 focus:bg-white/8 focus:ring-0 outline-none transition-all duration-300 placeholder-white/20"
                  />
                </div>
                {loginError && <p className="text-xs font-bold text-[#FF453A] animate-shake">{loginError}</p>}
                <SlideButton type="submit" dark className="h-14 text-sm w-full">
                  產生驗證碼
                </SlideButton>
              </form>
            )}

            {/* ── Step 1: show code ── */}
            {loginStep === 'code_shown' && (
              <form onSubmit={onVerifyCrawler} className="space-y-4 animate-fade-in">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                    到 Threads 發布以下公開貼文
                  </p>
                  <div
                    onClick={() => navigator.clipboard?.writeText(`${FABRICA_THREADS_HANDLE} verify ${verificationCode}`)}
                    className="rounded-xl bg-white/10 hover:bg-white/15 px-4 py-3 font-mono text-sm font-bold text-white text-center select-all tracking-wide cursor-copy transition-all duration-200 active:scale-[0.98]">
                    {FABRICA_THREADS_HANDLE} verify {verificationCode}
                  </div>
                  <p className="text-xs text-white/30 leading-relaxed font-medium">
                    複製上方文字，到 Threads 發文（需設為<strong className="text-white/50">公開貼文</strong>）。發文後回到這裡點「我已發文」。
                  </p>
                </div>
                <AppleButton
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(`${FABRICA_THREADS_HANDLE} verify ${verificationCode}`)}
                  className="w-full h-10 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                  複製驗證文字
                </AppleButton>
                {loginError && <p className="text-xs font-bold text-[#FF453A] whitespace-pre-line animate-shake">{loginError}</p>}
                <SlideButton type="submit" dark className="h-14 text-sm w-full">
                  我已發文，驗證身分
                </SlideButton>
                <AppleButton
                  type="button"
                  onClick={onResetLogin}
                  className="w-full text-xs font-semibold text-white/30 hover:text-white/60 py-2 transition-colors">
                  ← 重新輸入帳號
                </AppleButton>
              </form>
            )}

            {/* ── Step 2: verifying ── */}
            {loginStep === 'verifying' && (
              <div className="flex flex-col items-center gap-4 py-8 animate-fade-in">
                <div className="w-10 h-10 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-white">正在確認身分中...</p>
                  <p className="text-xs text-white/40 font-medium">
                    系統正在讀取 @{inputUsername.replace('@', '')} 的公開頁面
                  </p>
                </div>
              </div>
            )}

            {/* ── Divider + Google ── */}
            {loginStep !== 'verifying' && loginStep !== 'done' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10"/>
                  <span className="text-[10px] font-bold text-white/20 uppercase tracking-wider">或</span>
                  <div className="flex-1 h-px bg-white/10"/>
                </div>
                {isGoogleAuthPending && (
                  <p className="text-xs font-bold text-white/50 text-center animate-pulse">
                    正在完成 Google 登入...
                  </p>
                )}
                <SlideButton
                  dark
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={isGoogleAuthPending}
                  className="h-[52px] text-sm w-full">
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    使用 Google 登入
                  </span>
                </SlideButton>
              </>
            )}
          </div>

          {/* Footer */}
          <p className="text-white/15 text-[10px] font-bold tracking-widest uppercase text-center mt-10">
            © Fabrica All Rights Reserved
          </p>
        </div>
      </div>

      {/* ── Right marquee ── */}
      <div className="hidden lg:flex flex-col justify-center gap-6 w-12 border-l border-white/5 relative z-20 py-8">
        <VerticalMarquee direction="down" text="EXPLORE SHARE COLLECT" />
        <VerticalMarquee direction="up"   text="WELCOME TO FOODIE BETA TEST" />
      </div>
    </div>
  );
}
