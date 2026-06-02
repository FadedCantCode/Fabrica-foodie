{/* ── Threads 登入表單 — 替換原本的 <form onSubmit={handleVerificationStart}> ── */}

{/* Step pip indicator */}
{(() => {
  const steps = ["輸入帳號", "發文驗證", "確認身分"];
  const stepIndex = loginStep === "idle" ? 0 : loginStep === "code_shown" ? 1 : 2;
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
              i < stepIndex ? "bg-[#34C759] text-white"
              : i === stepIndex ? "bg-black text-white scale-110"
              : "bg-black/10 text-[#86868B]"
            }`}>
              {i < stepIndex
                ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                : i + 1
              }
            </div>
            <span className={`text-[9px] font-semibold transition-colors ${i === stepIndex ? "text-black" : "text-[#86868B]"}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-8 mb-4 transition-all duration-300 ${i < stepIndex ? "bg-[#34C759]" : "bg-black/10"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
})()}

<div className="space-y-5 bg-white/45 backdrop-blur-xl border border-white/60 p-6 rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.03)]">

  {/* ── STEP 0: 輸入帳號 ─────────────────────────────────────────────────── */}
  {loginStep === "idle" && (
    <form onSubmit={handleGenerateCode} className="space-y-4">
      <div className="relative flex items-center w-full group">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-base font-semibold text-[#86868B] select-none pointer-events-none group-focus-within:text-black transition-colors">@</span>
        <input
          type="text"
          placeholder="輸入您的 Threads 帳號"
          value={inputUsername}
          onChange={(e) => setInputUsername(e.target.value.replace("@", ""))}
          className="w-full bg-white/80 text-base font-medium rounded-2xl py-4 pl-12 pr-5 border border-[#D2D2D7] focus:border-black focus:ring-2 focus:ring-black/20 outline-none transition-all placeholder-[#86868B]/70"
        />
      </div>
      {loginError && <p className="text-xs font-bold text-[#FF3B30]">{loginError}</p>}
      <button type="submit" className="w-full h-[52px] bg-black text-white font-semibold rounded-2xl hover:bg-[#1D1D1F] active:scale-95 transition-all">
        產生驗證碼
      </button>
    </form>
  )}

  {/* ── STEP 1: 發文驗證 ─────────────────────────────────────────────────── */}
  {loginStep === "code_shown" && (
    <form onSubmit={handleVerifyCrawler} className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white/80 p-4 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B]">到 Threads 發布以下公開貼文</p>
        <div className="rounded-xl bg-black px-4 py-3 font-mono text-sm font-bold text-white text-center select-all tracking-wide">
          {FABRICA_THREADS_HANDLE} verify {verificationCode}
        </div>
        <p className="text-xs text-[#666] leading-relaxed font-medium">
          複製上方文字，到 Threads 發文（需設為<strong>公開貼文</strong>）。<br/>
          發文後回到這裡點「我已發文」。
        </p>
      </div>

      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(`${FABRICA_THREADS_HANDLE} verify ${verificationCode}`)}
        className="w-full h-10 rounded-xl border border-black/10 bg-white/60 text-xs font-bold text-[#555] hover:bg-white transition-all active:scale-95"
      >
        複製驗證文字
      </button>

      {loginError && <p className="text-xs font-bold text-[#FF3B30] whitespace-pre-line">{loginError}</p>}

      <button type="submit" className="w-full h-[52px] bg-black text-white font-semibold rounded-2xl hover:bg-[#1D1D1F] active:scale-95 transition-all">
        我已發文，驗證身分 →
      </button>
      <button type="button" onClick={handleResetLogin} className="w-full text-xs font-semibold text-[#86868B] hover:text-black py-2 transition-colors">
        ← 重新輸入帳號
      </button>
    </form>
  )}

  {/* ── STEP 2: 驗證中 spinner ───────────────────────────────────────────── */}
  {loginStep === "verifying" && (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="w-10 h-10 rounded-full border-2 border-black border-t-transparent animate-spin" />
      <div className="text-center space-y-1">
        <p className="text-sm font-bold text-black">正在確認身分中...</p>
        <p className="text-xs text-[#86868B] font-medium">
          系統正在讀取 @{inputUsername.replace("@", "")} 的公開頁面
        </p>
      </div>
    </div>
  )}

  {/* ── Divider + Google (隱藏於驗證中) ─────────────────────────────────── */}
  {loginStep !== "verifying" && loginStep !== "done" && (
    <>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-black/10" />
        <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider">或</span>
        <div className="flex-1 h-px bg-black/10" />
      </div>
      {isGoogleAuthPending && (
        <p className="text-xs font-bold text-[#007AFF] text-center">正在完成 Google 登入...</p>
      )}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full h-[52px] rounded-2xl border border-black/10 bg-black text-white text-sm font-semibold transition-all hover:bg-[#1D1D1F] active:scale-95"
      >
        使用 Google 登入
      </button>
    </>
  )}

</div>
