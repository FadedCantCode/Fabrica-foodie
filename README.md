# Fabrica Foodie

**English** | [中文](#中文說明)

Fabrica Foodie is a personal food library for saving restaurant and food recommendations from Threads.

The long-term goal is simple: when a Threads user mentions `@fabrica_tw`, Fabrica saves the recommendation into that user's food library. While the Meta app is still in development or waiting for review, the app also supports a manual import flow where users paste Threads text or a Threads link into the site.

## Features

- Google sign-in with Firebase Authentication
- Private food library per Firebase user
- Manual Threads import for MVP testing
- AI-assisted food card extraction with Gemini
- Saves source text, Threads link, author handle, confidence, and verification status
- Tracks consumer-facing details:
  - main offer / signature items
  - reputation summary
  - recent promotions
  - business hours
- Threads username binding to Google account (single library across login methods)
- Optional Threads webhook endpoint for future `@fabrica_tw` automation

## Tech Stack

- Next.js 14
- React 18
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Gemini API
- Vercel

## Required Environment Variables

Set these in Vercel:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

Do not expose Gemini from the browser in production. Server routes read
`GEMINI_API_KEY`; `NEXT_PUBLIC_GEMINI_API_KEY` is only kept as a temporary
fallback for older deployments.

`FIREBASE_SERVICE_ACCOUNT_KEY` is required for Threads verification and webhook
writes. It should be the Firebase service account JSON stored as a single Vercel
environment variable. As an alternative, set `FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.

Optional for Threads webhook support:

```env
THREADS_ACCESS_TOKEN=your_threads_access_token
THREADS_VERIFY_TOKEN=your_webhook_verify_token
```

## Firebase Setup

Enable Google sign-in:

1. Open Firebase Console.
2. Go to Authentication.
3. Open Sign-in method.
4. Enable Google.
5. Add your Vercel domain to Authorized domains.

Example:

```text
project-fabricafoodie.vercel.app
```

## Firestore Rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }
    function ownsUserDoc(uid) {
      return signedIn() && request.auth.uid == uid;
    }
    match /artifacts/fabrica-foodie-app/users/{uid}/{document=**} {
      allow read, write: if ownsUserDoc(uid);
    }
    match /artifacts/fabrica-foodie-app/verifiedUsers/{threadsUsername} {
      allow read, write: if false;
    }
  }
}
```

## Login Modes

Foodie supports two login flows that share the same food library after binding:

1. **Threads verification** — enter a Threads ID, receive a `FAB-1234` code, post `@fabrica_tw verify FAB-1234` publicly on Threads. The crawler confirms the post and signs you in via Firebase Custom Token.
2. **Google login** — sign in with Google. If no Threads ID is bound yet, tap "綁定 Threads" in the header and complete the same `FAB-1234` verification flow. After binding, both login methods point to the same food library.

## Local Development

```bash
npm install
npm run dev   # http://localhost:3000
npm run build
```

## Project Structure

```
app/
├── page.jsx                    # Main orchestrator
├── layout.jsx
├── globals.css
└── api/
    ├── analyze-food/
    ├── check-verification/
    ├── get-master-uid/         # Resolves Threads → Google UID mapping
    ├── threads-webhook/
    ├── verify-crawler/         # Crawler-based Threads verification + Custom Token
    └── verify-threads-proof/

components/
├── ui.jsx                      # AppleButton, LiquidGlassCard, Toast, ModalSheet, etc.
├── LoginPage.jsx
├── BindModal.jsx               # Google ↔ Threads binding flow
└── RestaurantCards.jsx

hooks/
└── index.js                    # useAuth, useRestaurants, useDrag, useNearby, useToast

lib/
├── firebase.js                 # Firebase client config
├── firebaseAdmin.js            # Firebase Admin SDK
└── helpers.js                  # Food utils, AI review, map helpers
```

## Project Status

MVP. Recommended production path:

1. Use Google login and manual import while Meta permissions are pending.
2. Keep Firestore locked by Firebase UID.
3. Enable `@fabrica_tw` automatic saving only after Meta App Review and webhook delivery are working.

---

# 中文說明

**[English](#fabrica-foodie)** | 中文

Fabrica Foodie 是一個從 Threads 儲存美食推薦的個人美食庫。

長期目標很簡單：當 Threads 用戶標記 `@fabrica_tw`，Fabrica 會自動把推薦內容存進該用戶的美食庫。在 Meta 應用程式審核期間，目前支援手動匯入流程，使用者可以將 Threads 文字或連結貼到網站進行分析匯入。

## 功能特色

- Firebase Authentication Google 登入
- 每位用戶獨立的私人美食庫
- 手動 Threads 匯入（MVP 測試用）
- Gemini AI 輔助美食卡片資訊提取
- 儲存來源文字、Threads 連結、作者帳號、可信度與驗證狀態
- 追蹤消費者面向資訊：
  - 招牌品項與主要賣點
  - 口碑摘要
  - 近期優惠
  - 營業時間
- Threads 帳號與 Google 帳號綁定（兩種登入方式共用同一個美食庫）
- 選用的 Threads Webhook 端點，供未來 `@fabrica_tw` 自動化使用

## 技術棧

- Next.js 14
- React 18
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Gemini API
- Vercel

## 必要的環境變數

在 Vercel 中設定：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=你的_firebase_web_api_key
GEMINI_API_KEY=你的_gemini_api_key
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

不要在瀏覽器端暴露 Gemini API Key。伺服器路由讀取 `GEMINI_API_KEY`；`NEXT_PUBLIC_GEMINI_API_KEY` 僅作為舊版部署的備用。

`FIREBASE_SERVICE_ACCOUNT_KEY` 是 Threads 驗證與 Webhook 寫入的必要設定，應將 Firebase 服務帳戶 JSON 儲存為單一 Vercel 環境變數。也可以改用 `FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL` 和 `FIREBASE_PRIVATE_KEY` 三個個別變數。

Threads Webhook 的選用變數：

```env
THREADS_ACCESS_TOKEN=你的_threads_access_token
THREADS_VERIFY_TOKEN=你的_webhook_verify_token
```

## Firebase 設定

啟用 Google 登入：

1. 開啟 Firebase Console。
2. 前往 Authentication。
3. 開啟「登入方式」。
4. 啟用 Google。
5. 將你的 Vercel domain 加入授權網域。

範例：

```text
project-fabricafoodie.vercel.app
```

## Firestore 安全規則

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }
    function ownsUserDoc(uid) {
      return signedIn() && request.auth.uid == uid;
    }
    match /artifacts/fabrica-foodie-app/users/{uid}/{document=**} {
      allow read, write: if ownsUserDoc(uid);
    }
    match /artifacts/fabrica-foodie-app/verifiedUsers/{threadsUsername} {
      allow read, write: if false;
    }
  }
}
```

## 登入模式

Foodie 支援兩種登入流程，綁定後共用同一個美食庫：

1. **Threads 驗證** — 輸入 Threads ID，取得 `FAB-1234` 驗證碼，在 Threads 公開發文 `@fabrica_tw verify FAB-1234`。系統爬蟲確認貼文後，透過 Firebase Custom Token 完成登入。
2. **Google 登入** — 使用 Google 帳號登入。若尚未綁定 Threads，點擊頁首的「綁定 Threads」按鈕，完成相同的 `FAB-1234` 驗證流程。綁定後兩種登入方式都指向同一個美食庫。

## 本地開發

```bash
npm install
npm run dev   # http://localhost:3000
npm run build
```

## 專案結構

```
app/
├── page.jsx                    # 主要協調器
├── layout.jsx
├── globals.css
└── api/
    ├── analyze-food/
    ├── check-verification/
    ├── get-master-uid/         # 解析 Threads → Google UID 對應
    ├── threads-webhook/
    ├── verify-crawler/         # 爬蟲驗證 + Custom Token 產生
    └── verify-threads-proof/

components/
├── ui.jsx                      # AppleButton、LiquidGlassCard、Toast、ModalSheet 等
├── LoginPage.jsx
├── BindModal.jsx               # Google ↔ Threads 綁定流程
└── RestaurantCards.jsx

hooks/
└── index.js                    # useAuth、useRestaurants、useDrag、useNearby、useToast

lib/
├── firebase.js                 # Firebase 客戶端設定
├── firebaseAdmin.js            # Firebase Admin SDK
└── helpers.js                  # 美食工具函數、AI 短評、地圖輔助
```

## 專案現狀

目前為 MVP 階段，建議的上線路徑：

1. 在 Meta 權限審核期間，使用 Google 登入與手動匯入。
2. Firestore 以 Firebase UID 鎖定。
3. 等 Meta App Review 通過且 Webhook 正常傳送後，再啟用 `@fabrica_tw` 自動儲存功能。
