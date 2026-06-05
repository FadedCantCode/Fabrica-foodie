"use client";

import React, { useEffect, useRef, useState } from 'react';
import { FABRICA_THREADS_HANDLE } from '../lib/firebase';
import { SlideButton, AppleButton, VerticalMarquee, StepPips } from './ui';

export default function LoginPage({
  loginStep, inputUsername, setInputUsername,
  loginError, verificationCode,
  isGoogleAuthPending, isGlobalTransitioning,
  onGenerateCode, onVerifyCrawler, onResetLogin, onGoogleSignIn,
}) {
  const clipRef   = useRef(null);  // the clip container that syncs with Three.js canvas
  const [clipRect, setClipRect] = useState(null);

  // Track the Three.js canvas position/size and mirror it for clipping
  useEffect(() => {
    const sync = () => {
      // The Three.js canvas is fixed inset-0, so it's always full screen
      setClipRect({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  return (
    <div className="relative w-full min-h-screen flex overflow-hidden">

      {/* ── Left marquee ── */}
      <div className="hidden md:flex flex-col justify-center gap-6 w-12 border-r border-black/5 bg-white/5 backdrop-blur-sm relative z-30 py-8 flex-shrink-0">
        <VerticalMarquee direction="up"   text="WELCOME TO FOODIE BETA TEST" />
        <VerticalMarquee direction="down" text="EXPLORE SHARE COLLECT" />
      </div>

      {/* ── Main layout ── */}
      <div className="flex-1 flex flex-col lg:flex-row relative">

        {/* ── Left: Big title area ── */}
        <div className="flex-1 flex flex-col justify-between p-8 lg:p-16 relative z-10">

          {/* Logo top-left */}
          <div className="flex items-center gap-2.5 animate-bounce-in">
            <div className="w-8 h-8 bg-black rounded-[9px] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <circle cx="12" cy="11" r="3" strokeWidth="1.8"/>
              </svg>
            </div>
            <span className="text-black/70 font-bold text-xs tracking-widest uppercase">Fabrica Foodie</span>
          </div>

          {/* ── BIG TITLE — sandwich layers ──
              Layer A (z-10): muted text, sits behind Three.js canvas (z-15)
              Layer B (z-20): solid text with mix-blend-mode:multiply
                → appears where ball (light/white) overlaps → text "glows through"
                → invisible against white background → SOHub cutout effect
          */}
          <div className="relative select-none my-auto py-8" aria-hidden="true">

            {/* Layer A: behind ball */}
            <div className="relative z-10 pointer-events-none">
              <div className="text-[clamp(3.5rem,9vw,8rem)] font-black leading-[0.9] tracking-[-0.04em] text-black/20 animate-slide-up">
                Your
              </div>
              <div className="text-[clamp(3.5rem,9vw,8rem)] font-black leading-[0.9] tracking-[-0.04em] text-black/20 animate-slide-up" style={{ animationDelay: '50ms' }}>
                Food
              </div>
              <div className="text-[clamp(3.5rem,9vw,8rem)] font-black leading-[0.9] tracking-[-0.04em] text-black/20 animate-slide-up" style={{ animationDelay: '100ms' }}>
                Story.
              </div>
            </div>

            {/* Layer B: in front of ball — multiply reveals text only where ball is */}
            <div className="absolute inset-0 z-20 pointer-events-none" style={{ mixBlendMode: 'multiply' }}>
              <div className="text-[clamp(3.5rem,9vw,8rem)] font-black leading-[0.9] tracking-[-0.04em] text-black animate-slide-up">
                Your
              </div>
              <div className="text-[clamp(3.5rem,9vw,8rem)] font-black leading-[0.9] tracking-[-0.04em] text-black animate-slide-up" style={{ animationDelay: '50ms' }}>
                Food
              </div>
              <div className="text-[clamp(3.5rem,9vw,8rem)] font-black leading-[0.9] tracking-[-0.04em] text-black animate-slide-up" style={{ animationDelay: '100ms' }}>
                Story.
              </div>
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-[#86868B] text-sm font-medium max-w-xs leading-relaxed animate-fade-in" style={{ animationDelay: '300ms' }}>
            探索、珍藏、分享。<br/>輸入 Threads 帳號，開啟您的專屬美食地圖。
          </p>
        </div>

        {/* ── Right: Form panel ── */}
        <div className={`
          w-full lg:w-[400px] flex-shrink-0
          flex flex-col justify-center
          px-6 py-10 lg:px-12
          lg:border-l border-black/5
          bg-white/30 backdrop-blur-2xl
          relative z-30
          transition-all duration-700
          ${isGlobalTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}
        `}>

          <div className="flex-1 flex flex-col justify-center space-y-8 max-w-sm mx-auto w-full">

            {/* Form header */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-1">開始使用</p>
              <h2 className="text-2xl font-black tracking-tight text-black">
                {loginStep === 'idle'      && '登入您的帳號'}
                {loginStep === 'code_shown'&& '驗證身分'}
                {loginStep === 'verifying' && '確認中...'}
              </h2>
            </div>

            <StepPips currentStep={loginStep} />

            {/* ── Step 0 ── */}
            {loginStep === 'idle' && (
              <form onSubmit={onGenerateCode} className="space-y-4 animate-fade-in">
                <div className="relative flex items-center w-full group">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-base font-semibold text-[#86868B] group-focus-within:text-black select-none pointer-events-none transition-colors">@</span>
                  <input
                    type="text"
                    placeholder="輸入您的 Threads 帳號"
                    value={inputUsername}
                    onChange={(e) => setInputUsername(e.target.value.replace('@', ''))}
                    className="w-full bg-white/80 text-base font-medium rounded-2xl py-4 pl-12 pr-5 border border-[#D2D2D7] focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all duration-300 placeholder-[#86868B]/70"
                  />
                </div>
                {loginError && <p className="text-xs font-bold text-[#FF3B30] animate-shake">{loginError}</p>}
                <SlideButton type="submit" className="h-14 text-sm w-full">產生驗證碼</SlideButton>
              </form>
            )}

            {/* ── Step 1 ── */}
            {loginStep === 'code_shown' && (
              <form onSubmit={onVerifyCrawler} className="space-y-4 animate-fade-in">
                <div className="rounded-2xl border border-black/10 bg-white/80 p-4 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B]">到 Threads 發布以下公開貼文</p>
                  <div
                    onClick={() => navigator.clipboard?.writeText(`${FABRICA_THREADS_HANDLE} verify ${verificationCode}`)}
                    className="rounded-xl bg-black px-4 py-3 font-mono text-sm font-bold text-white text-center select-all tracking-wide cursor-copy transition-all active:scale-[0.98] active:bg-neutral-800">
                    {FABRICA_THREADS_HANDLE} verify {verificationCode}
                  </div>
                  <p className="text-xs text-[#666] leading-relaxed font-medium">
                    複製上方文字，到 Threads 發文（需設為<strong>公開貼文</strong>）。發文後回到這裡點「我已發文」。
                  </p>
                </div>
                <AppleButton type="button"
                  onClick={() => navigator.clipboard?.writeText(`${FABRICA_THREADS_HANDLE} verify ${verificationCode}`)}
                  className="w-full h-10 rounded-xl border border-black/10 bg-white/60 text-xs font-bold text-[#555] hover:bg-white transition-colors">
                  複製驗證文字
                </AppleButton>
                {loginError && <p className="text-xs font-bold text-[#FF3B30] whitespace-pre-line animate-shake">{loginError}</p>}
                <SlideButton type="submit" dark className="h-14 text-sm w-full">我已發文，驗證身分</SlideButton>
                <AppleButton type="button" onClick={onResetLogin}
                  className="w-full text-xs font-semibold text-[#86868B] hover:text-black py-2 transition-colors">
                  ← 重新輸入帳號
                </AppleButton>
              </form>
            )}

            {/* ── Step 2 ── */}
            {loginStep === 'verifying' && (
              <div className="flex flex-col items-center gap-4 py-8 animate-fade-in">
                <div className="w-10 h-10 rounded-full border-2 border-black border-t-transparent animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-black">正在確認身分中...</p>
                  <p className="text-xs text-[#86868B] font-medium">系統正在讀取 @{inputUsername.replace('@', '')} 的公開頁面</p>
                </div>
              </div>
            )}

            {/* ── Divider + Google ── */}
            {loginStep !== 'verifying' && loginStep !== 'done' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-black/10"/>
                  <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider">或</span>
                  <div className="flex-1 h-px bg-black/10"/>
                </div>
                {isGoogleAuthPending && (
                  <p className="text-xs font-bold text-[#007AFF] text-center animate-pulse">正在完成 Google 登入...</p>
                )}
                <SlideButton dark type="button" onClick={onGoogleSignIn} disabled={isGoogleAuthPending} className="h-[52px] text-sm w-full">
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

          <footer className="text-center text-xs text-[#86868B] pt-6 pointer-events-none">
            <p className="font-semibold text-[#1D1D1F]/40">© Fabrica</p>
          </footer>
        </div>
      </div>

      {/* ── Right marquee ── */}
      <div className="hidden md:flex flex-col justify-center gap-6 w-12 border-l border-black/5 bg-white/5 backdrop-blur-sm relative z-30 py-8 flex-shrink-0">
        <VerticalMarquee direction="down" text="EXPLORE SHARE COLLECT" />
        <VerticalMarquee direction="up"   text="WELCOME TO FOODIE BETA TEST" />
      </div>
    </div>
  );
}
