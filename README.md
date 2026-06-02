Fabrica Foodie 🥑A personal food library for saving restaurant and food recommendations from Threads.Fabrica Foodie 是一個個人美食收藏庫，專門用來儲存與管理來自 Threads 上的餐廳及美食推薦。Auto-saves when mentioning @fabrica_tw, with manual import support (pasting text or links) during development/review.長期目標為：當 Threads 用戶提及 @fabrica_tw 時自動儲存推薦；在開發與審查期間，亦支援貼上 Threads 文字或連結的手動匯入。FEATURESGoogle sign-in with Firebase Authentication / 使用 Google 帳戶進行安全登入Private food library per Firebase user / 每個用戶在 Firestore 中皆擁有獨立且安全的個人專屬美食收藏庫Manual Threads import for MVP testing / 手動匯入 Threads 貼文或連結以進行 MVP 測試AI-assisted food card extraction with Gemini / 利用 Google Gemini API 自動解析非結構化文字為美食卡片Saves source text, Threads link, author handle, confidence, and verification status / 記錄來源文字、Threads 連結、作者帳號、信心指數及驗證狀態Tracks signature items, reputation summary, promotions, and business hours / 自動擷取主打品項、評價摘要、近期優惠與營業時間Optional Threads webhook endpoint for future @fabrica_tw automation / 預留 Webhook 節點以供未來自動化提及儲存使用EnvironmentThe project runs on Next.js 14, deployed on Vercel, and backed by Firebase & Gemini API.本專案基於 Next.js 14 開發，部署於 Vercel，並使用 Firebase 與 Gemini API 提供支援。Required Environment Variables / 必要環境變數:NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
Optional for Webhook / Webhook 選用變數:THREADS_ACCESS_TOKEN=your_threads_access_token
THREADS_VERIFY_TOKEN=your_webhook_verify_token
Firestore RulesUse these rules in Firebase Console to secure user data per Firebase UID.請於 Firebase Console 中套用以下安全規則，確保資料依據 Firebase UID 進行安全隔離：rules_version = '2';
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
UsageLocal Development / 本地開發1. Install dependencies / 安裝依賴套件:
   npm install

2. Run the development server / 啟動開發伺服器:
   npm run dev

3. Build the project / 專案編譯:
   npm run build
Manual Threads Import / 手動匯入流程1. Sign in with Google / 使用 Google 帳戶登入。

2. Paste a Threads link or post text into the import modal / 將 Threads 連結或貼文文字貼入匯入彈窗中。

3. Fabrica analyzes content via Gemini API / Fabrica 將透過 Gemini API 自動分析內容。

4. The result is saved to your private food library / 分析結果將自動儲存至您的私有美食收藏庫。
Account Verification / 帳號驗證模式* Mode 1: Enter Threads ID -> Get `FAB-1234` code -> Post `@fabrica_tw verify FAB-1234` on Threads -> Webhook auto-verifies.
* 模式 1：輸入 Threads ID -> 取得 `FAB-1234` 驗證碼 -> 於 Threads 發文 `@fabrica_tw verify FAB-1234` -> Webhook 自動驗證。

* Mode 2 (Fallback): Paste the proof post URL -> Click proof-check -> Server fetches page and verifies verification code.
* 模式 2 (備用)：貼上包含驗證指令的貼文網址 -> 點擊「憑證檢查」 -> 伺服器抓取網頁並自動驗證。
ContributingFeel free to contribute. Don't hesitate to create a pull request or to submit an issue if you stumble upon any problems.如果您想要貢獻或改進此工具，歡迎創建一個 pull request 或者提交問題報告。DisclaimerReal Threads mention events are not delivered while the Meta app is in development mode. The app must be live and approved for the relevant Threads permissions before production webhook automation works.當 Meta 應用程式仍處於開發模式時，真實的 Threads 提及（Mention）事件將無法送達。本專案必須正式上線並通過 Meta App Review 取得相關 Threads 權限，Webhook 自動化功能才能正常運作。Use Google login and manual import while Meta permissions are pending. Keep Firestore locked by Firebase UID.在 Meta 權限審查完成前，請優先使用 Google 登入與手動匯入功能，並保持 Firestore 安全規則鎖定在 Firebase UID 以確保資料安全。LicenseThis project is licensed under the MIT License - see the LICENSE file for details.本工具遵循 MIT 授權協議，請查閱 LICENSE 文件獲取更多詳細信息。
