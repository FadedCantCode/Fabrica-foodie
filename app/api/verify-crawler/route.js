import { NextResponse } from 'next/server';
import { FieldValue, getAdminDb } from '../../../lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
const appId = 'fabrica-foodie-app';

// 隨機更換 User-Agent 避免被 Meta 快速封鎖
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1'
];

function normalizeUsername(username = "") {
  return username.replace("@", "").trim().toLowerCase();
}

export async function POST(request) {
  try {
    const { uid, username, expectedCode } = await request.json();

    if (!uid || !username || !expectedCode) {
      return NextResponse.json({ success: false, message: "缺少必要參數" }, { status: 400 });
    }

    const cleanUsername = normalizeUsername(username);
    const targetUrl = `https://www.threads.net/@${cleanUsername}`;
    
    const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    // 🌟 步驟一：偽裝成一般瀏覽器去抓取該用戶的 Threads 公開主頁
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': randomUserAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      next: { revalidate: 0 } // 禁用 Next.js 缓存，確保抓到最新貼文
    });

    if (!response.ok) {
      // 如果 Meta 回傳 404，代表可能帳號輸入錯誤或是公開頁面被阻擋
      return NextResponse.json({ 
        success: false, 
        message: `無法讀取該 Threads 帳號頁面 (錯誤碼: ${response.status})，請確認帳號是否公開。` 
      });
    }

    const htmlText = await response.text();

    // 🌟 步驟二：核心關鍵！Threads 頁面會把資料脱水（Hydrate）在 HTML 的 Script 內
    // 我們不需要執行 JS，直接在大字串裡搜尋有沒有包含「@fabrica_tw」和「驗證碼」
    const hasMention = htmlText.includes('@fabrica_tw');
    const hasCode = htmlText.toUpperCase().includes(expectedCode.toUpperCase());

    // 調試用：日誌記錄
    console.log(`[Crawler Log] 檢查用戶 @${cleanUsername} : 偵測到標記=${hasMention}, 偵測到驗證碼=${hasCode}`);

    if (hasMention && hasCode) {
      const db = getAdminDb();

      // 🌟 步驟三：爬蟲核對成功！更新 Firebase，將 Threads 帳號與 Google UID 綁定
      const userDocRef = db.collection('artifacts').doc(appId).collection('users').doc(uid);
      await userDocRef.set({
        threadsUsername: cleanUsername,
        verified: true,
        verifiedAt: FieldValue.serverTimestamp(),
        source: "crawler_verification"
      }, { merge: true });

      // 建立對應橋樑，方便未來擴充
      await db.collection('artifacts').doc(appId).collection('threadMappings').doc(cleanUsername).set({
        uid: uid,
        updatedAt: FieldValue.serverTimestamp()
      });

      return NextResponse.json({ 
        success: true, 
        message: `🎉 驗證成功！已成功將 @${cleanUsername} 綁定至您的帳號。` 
      });
    }

    // 樂觀過渡方案：如果真的被 Meta 嚴格反爬蟲擋下來，回傳更人性化的提示
    return NextResponse.json({ 
      success: false, 
      message: `在您的 Threads 最新貼文中，尚未偵測到同時包含「@fabrica_tw」與「${expectedCode}」的公開內容。請確認發文完成後，過 5 秒再試一次！` 
    });

  } catch (error) {
    console.error("Crawler Verification Error:", error);
    return NextResponse.json({ success: false, message: "伺服器爬蟲模組發生異常，請稍後再試。" }, { status: 500 });
  }
}