"use client";

import React, { useState } from 'react';
import { FABRICA_THREADS_HANDLE } from '../lib/firebase';
import { AppleButton, SuccessCheck, StepPips, ModalSheet } from './ui';

export default function BindModal({ show, onClose, firebaseUser }) {
  const [bindUsername, setBindUsername] = useState("");
  const [bindCode,     setBindCode]     = useState("");
  const [bindStep,     setBindStep]     = useState("idle");
  const [bindError,    setBindError]    = useState("");

  const reset = () => {
    setBindStep("idle");
    setBindError("");
    setBindUsername("");
    setBindCode("");
  };

  const handleGenerateCode = (e) => {
    e.preventDefault();
    const clean = bindUsername.replace("@", "").trim().toLowerCase();
    if (!clean) { setBindError("請輸入您的 Threads 帳號"); return; }
    const code = `FAB-${Math.floor(1000 + Math.random() * 9000)}`;
    setBindCode(code);
    setBindError("");
    setBindStep("code_shown");
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const clean = bindUsername.replace("@", "").trim().toLowerCase();
    if (!clean || !bindCode) return;
    setBindStep("verifying");
    setBindError("");

    // ── 確認 Google UID 存在 ──────────────────────────────────────────────────
    const googleUid = firebaseUser?.uid;
    if (!googleUid) {
      setBindStep("code_shown");
      setBindError("找不到 Google 帳號資訊，請重新登入後再試。");
      return;
    }

    // Threads 用戶不應該來綁定（uid 已經是 threads_ 開頭）
    if (googleUid.startsWith("threads_")) {
      setBindStep("code_shown");
      setBindError("請先用 Google 登入後再綁定 Threads 帳號。");
      return;
    }

    try {
      const res = await fetch("/api/verify-crawler", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username:     clean,
          expectedCode: bindCode,
          uid:          googleUid,  // ← 必須傳 Google UID，讓 server 寫 threadMappings
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.success) {
        // 綁定成功：把 Threads username 存進 localStorage
        if (typeof window !== "undefined") {
          window.localStorage.setItem("fabrica_threads_username", clean);
        }
        setBindStep("done");
        // 等成功動畫播完再關
        setTimeout(() => { onClose(clean); reset(); }, 2200);
      } else {
        setBindStep("code_shown");
        setBindError(data.message || "驗證失敗，請稍後再試。");
      }
    } catch {
      setBindStep("code_shown");
      setBindError("網路錯誤，請確認連線後再試。");
    }
  };

  return (
    <ModalSheet
      show={show}
      onClose={() => { onClose(null); reset(); }}
      zIndex={130}
      disableClose={bindStep === "verifying"}
    >
      <div className="p-6 sm:p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B]">綁定 Threads</p>
            <h2 className="text-xl font-bold text-black tracking-tight mt-0.5">連結你的 Threads 帳號</h2>
          </div>
          <AppleButton
            onClick={() => { onClose(null); reset(); }}
            className="w-8 h-8 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-full text-[#555]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </AppleButton>
        </div>

        <StepPips currentStep={bindStep} />

        <div className="space-y-4">

          {/* ── Step 0: 輸入帳號 ── */}
          {bindStep === "idle" && (
            <form onSubmit={handleGenerateCode} className="space-y-4 animate-fade-in">
              <div className="bg-black/5 rounded-xl p-3 text-xs text-[#666] font-medium leading-relaxed">
                綁定後，無論你用 <strong>Google</strong> 或 <strong>Threads</strong> 登入，都會進到同一個美食庫。
              </div>
              <div className="relative flex items-center w-full group">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-base font-semibold text-[#86868B] group-focus-within:text-black transition-colors">@</span>
                <input
                  type="text"
                  placeholder="輸入 Threads 帳號"
                  value={bindUsername}
                  onChange={(e) => setBindUsername(e.target.value.replace("@", ""))}
                  className="w-full bg-black/5 text-sm font-bold rounded-2xl py-4 pl-12 pr-5 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all duration-300"
                />
              </div>
              {bindError && <p className="text-xs font-bold text-[#FF3B30] animate-shake">{bindError}</p>}
              <AppleButton type="submit" dark className="w-full h-14 bg-black text-white font-bold rounded-2xl text-sm shadow-lg">
                產生驗證碼
              </AppleButton>
            </form>
          )}

          {/* ── Step 1: 顯示驗證碼 ── */}
          {bindStep === "code_shown" && (
            <form onSubmit={handleVerify} className="space-y-4 animate-fade-in">
              <div className="rounded-2xl border border-black/10 bg-white/80 p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B]">到 Threads 發布以下公開貼文</p>
                <div
                  onClick={() => navigator.clipboard?.writeText(`${FABRICA_THREADS_HANDLE} verify ${bindCode}`)}
                  className="rounded-xl bg-black px-4 py-3 font-mono text-sm font-bold text-white text-center select-all tracking-wide cursor-copy transition-all duration-200 active:scale-[0.98]">
                  {FABRICA_THREADS_HANDLE} verify {bindCode}
                </div>
                <p className="text-xs text-[#666] leading-relaxed font-medium">
                  複製上方文字，到 Threads 發文（需設為<strong>公開貼文</strong>）。
                </p>
              </div>
              <AppleButton
                type="button"
                onClick={() => navigator.clipboard?.writeText(`${FABRICA_THREADS_HANDLE} verify ${bindCode}`)}
                className="w-full h-10 rounded-xl border border-black/10 bg-white/60 text-xs font-bold text-[#555] hover:bg-white transition-colors">
                複製驗證文字
              </AppleButton>
              {bindError && <p className="text-xs font-bold text-[#FF3B30] whitespace-pre-line animate-shake">{bindError}</p>}
              <AppleButton type="submit" dark className="w-full h-14 bg-black text-white font-bold rounded-2xl text-sm shadow-lg">
                我已發文，完成綁定
              </AppleButton>
              <AppleButton
                type="button"
                onClick={() => { setBindStep("idle"); setBindError(""); }}
                className="w-full text-xs font-semibold text-[#86868B] hover:text-black py-2 transition-colors">
                ← 重新輸入帳號
              </AppleButton>
            </form>
          )}

          {/* ── Verifying ── */}
          {bindStep === "verifying" && (
            <div className="flex flex-col items-center gap-4 py-10 animate-fade-in">
              <div className="w-10 h-10 rounded-full border-2 border-black border-t-transparent animate-spin"/>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-black">正在驗證中...</p>
                <p className="text-xs text-[#86868B] font-medium">讀取 @{bindUsername} 的公開頁面</p>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {bindStep === "done" && (
            <div className="flex flex-col items-center gap-4 py-10 animate-bounce-in">
              <SuccessCheck/>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-black">@{bindUsername} 已成功綁定！</p>
                <p className="text-xs text-[#86868B] font-medium">現在兩種登入方式都指向同一個美食庫</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </ModalSheet>
  );
}
