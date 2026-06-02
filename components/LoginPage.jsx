"use client";

import React from 'react';
import { FABRICA_THREADS_HANDLE } from '../lib/firebase';
import { AppleButton, VerticalMarquee, StepPips } from './ui';

export default function LoginPage({
  loginStep, inputUsername, setInputUsername,
  loginError, verificationCode,
  isGoogleAuthPending, isGlobalTransitioning,
  onGenerateCode, onVerifyCrawler, onResetLogin, onGoogleSignIn,
}) {
  return (
    <div className="relative w-full min-h-screen flex flex-row justify-between items-stretch">
      {/* Left marquee */}
      <div className="hidden md:flex flex-row justify-center gap-6 w-32 border-r border-black/5 bg-white/5 backdrop-blur-sm relative z-20">
        <VerticalMarquee direction="up" text="WELCOME TO FOODIE BETA TEST" />
        <VerticalMarquee direction="down" text="EXPLORE SHARE COLLECT" />
      </div>

      {/* Center form */}
      <div className={`flex-1 flex flex-col justify-between px-6 py-10 max-w-sm mx-auto relative z-30
        transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]
        ${isGlobalTransitioning ? 'opacity-0 scale-[0.98] blur-md translate-y-4' : 'opacity-100 scale-100 translate-y-0'}`}>

        <div className="flex-1 flex flex-col justify-center space-y-10 py-8">
          {/* Logo */}
          <div className="text-center space-y-5 animate-bounce-in">
            <div className="w-16 h-16 bg-black rounded-[20px] mx-auto flex items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.15)]
              transition-transform duration-300 hover:scale-105 hover:shadow-[0_15px_35px_rgba(0,0,0,0.2)]">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <circle cx="12" cy="11" r="3" strokeWidth="1.5"/>
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-black drop-shadow-sm">Foodie</h1>
              <p className="text-sm text-[#86868B] font-medium leading-relaxed max-w-xs mx-auto drop-shadow-sm">
                探索、珍藏、分享。<br/>輸入 Threads 帳號，開啟您的專屬美食地圖。
              </p>
            </div>
          </div>

          {/* Form card */}
          <div className="space-y-0 animate-slide-up">
            <StepPips currentStep={loginStep} />
            <div className="space-y-5 bg-white/45 backdrop-blur-xl border border-white/60 p-6 rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.04)]">

              {/* Step 0: enter username */}
              {loginStep === "idle" && (
                <form onSubmit={onGenerateCode} className="space-y-4 animate-fade-in">
                  <div className="relative flex items-center w-full group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-base font-semibold text-[#86868B] group-focus-within:text-black transition-colors select-none pointer-events-none">@</span>
                    <input
                      type="text"
                      placeholder="輸入您的 Threads 帳號"
                      value={inputUsername}
                      onChange={(e) => setInputUsername(e.target.value.replace("@", ""))}
                      className="w-full bg-white/80 text-base font-medium rounded-2xl py-4 pl-12 pr-5 border border-[#D2D2D7] focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all duration-300 placeholder-[#86868B]/70"
                    />
                  </div>
                  {loginError && <p className="text-xs font-bold text-[#FF3B30] animate-shake">{loginError}</p>}
                  <AppleButton type="submit" dark className="w-full h-14 bg-black text-white font-bold rounded-2xl text-sm shadow-lg">
                    產生驗證碼
                  </AppleButton>
                </form>
              )}

              {/* Step 1: show code */}
              {loginStep === "code_shown" && (
                <form onSubmit={onVerifyCrawler} className="space-y-4 animate-fade-in">
                  <div className="rounded-2xl border border-black/10 bg-white/80 p-4 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B]">到 Threads 發布以下公開貼文</p>
                    <div className="rounded-xl bg-black px-4 py-3 font-mono text-sm font-bold text-white text-center select-all tracking-wide
                      transition-all duration-200 active:scale-[0.98]">
                      {FABRICA_THREADS_HANDLE} verify {verificationCode}
                    </div>
                    <p className="text-xs text-[#666] leading-relaxed font-medium">
                      複製上方文字，到 Threads 發文（需設為<strong>公開貼文</strong>）。<br/>發文後回到這裡點「我已發文」。
                    </p>
                  </div>
                  <AppleButton type="button" onClick={() => navigator.clipboard?.writeText(`${FABRICA_THREADS_HANDLE} verify ${verificationCode}`)}
                    className="w-full h-10 rounded-xl border border-black/10 bg-white/60 text-xs font-bold text-[#555] hover:bg-white transition-colors">
                    複製驗證文字
                  </AppleButton>
                  {loginError && <p className="text-xs font-bold text-[#FF3B30] whitespace-pre-line animate-shake">{loginError}</p>}
                  <AppleButton type="submit" dark className="w-full h-14 bg-black text-white font-bold rounded-2xl text-sm shadow-lg">
                    我已發文，驗證身分
                  </AppleButton>
                  <AppleButton type="button" onClick={onResetLogin}
                    className="w-full text-xs font-semibold text-[#86868B] hover:text-black py-2 transition-colors">
                    ← 重新輸入帳號
                  </AppleButton>
                </form>
              )}

              {/* Step 2: verifying */}
              {loginStep === "verifying" && (
                <div className="flex flex-col items-center gap-4 py-8 animate-fade-in">
                  <div className="w-10 h-10 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-black">正在確認身分中...</p>
                    <p className="text-xs text-[#86868B] font-medium">系統正在讀取 @{inputUsername.replace("@", "")} 的公開頁面</p>
                  </div>
                </div>
              )}

              {/* Divider + Google */}
              {loginStep !== "verifying" && loginStep !== "done" && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-black/10"/>
                    <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider">或</span>
                    <div className="flex-1 h-px bg-black/10"/>
                  </div>
                  {isGoogleAuthPending && (
                    <p className="text-xs font-bold text-[#007AFF] text-center animate-pulse">正在完成 Google 登入...</p>
                  )}
                  <AppleButton type="button" onClick={onGoogleSignIn} dark
                    className="w-full h-[52px] bg-black text-white font-semibold rounded-2xl text-sm shadow-lg border border-black/10">
                    使用 Google 登入
                  </AppleButton>
                </>
              )}
            </div>
          </div>
        </div>

        <footer className="text-center text-xs text-[#86868B] pt-4 pointer-events-none">
          <p className="font-semibold text-[#1D1D1F]/40">© Fabrica</p>
        </footer>
      </div>

      {/* Right marquee */}
      <div className="hidden md:flex flex-row justify-center gap-6 w-32 border-l border-black/5 bg-white/5 backdrop-blur-sm relative z-20">
        <VerticalMarquee direction="down" text="EXPLORE SHARE COLLECT" />
        <VerticalMarquee direction="up" text="WELCOME TO FOODIE BETA TEST" />
      </div>
    </div>
  );
}
