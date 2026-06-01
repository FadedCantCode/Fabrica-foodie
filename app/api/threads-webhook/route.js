import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// --- 安全升級：完全依賴環境變數，不留任何明碼以防 GitHub 報錯 ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "fabrica-foodie.firebaseapp.com",
  projectId: "fabrica-foodie",
  storageBucket: "fabrica-foodie.firebasestorage.app",
  messagingSenderId: "635499185101",
  appId: "1:635499185101:web:e5b4dcba1c57e782467a84",
  measurementId: "G-MPYBH4KBER"
};

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(firebaseApp);
const appId = 'fabrica-foodie-app';
const GEMINI_MODEL = 'gemini-2.5-flash';

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || `Request failed with ${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function parseGeminiJson(rawText) {
  const cleanJsonStr = rawText
    .replace(/```json|```/g, "")
    .trim();
  const jsonMatch = cleanJsonStr.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : cleanJsonStr);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.THREADS_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error('THREADS_VERIFY_TOKEN is not configured.');
    return new Response('Webhook verification is not configured', { status: 500 });
  }

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Meta Webhook 驗證成功！');
    return new Response(challenge, { status: 200 });
  }

  return new Response('Verification failed', { status: 403 });
}

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('📡 收到 Threads Webhook 事件:', JSON.stringify(body, null, 2));

    const changeValue = body?.entry?.[0]?.changes?.[0]?.value;
    if (!changeValue) {
      return NextResponse.json({ error: "無效的 Webhook 資料格式" }, { status: 400 });
    }

    const triggerText = changeValue.text || "";
    const threadsSender = changeValue.username;
    const parentPostId = changeValue.parent_id;

    if (!triggerText.toLowerCase().includes('@fabrica') || !threadsSender) {
      return NextResponse.json({ success: true, message: "非 @fabrica 提及事件，略過處理。" });
    }

    const threadsAccessToken = process.env.THREADS_ACCESS_TOKEN;
    let foodPostText = "";

    if (threadsAccessToken && parentPostId) {
      try {
        const fetchPostUrl = `https://graph.threads.net/v1.0/${parentPostId}?fields=text,media_url,media_type`;
        const threadsData = await fetchJsonWithTimeout(fetchPostUrl, {
          headers: { Authorization: `Bearer ${threadsAccessToken}` }
        });
        foodPostText = threadsData.text || "";
      } catch (err) {
        console.error("無法自 Threads 抓取原串文內容，將降級使用標記留言進行解析:", err);
      }
    }

    const textToAnalyze = foodPostText || triggerText;

    // 🌟 對齊 Vercel 變數名稱
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.error("❌ 系統錯誤：未配置 GEMINI_API_KEY 環境變數！");
      return NextResponse.json({ error: "內部 API 設定未完成" }, { status: 500 });
    }

    // 🚀 讓 AI 扮演您的專屬高端美食顧問
    const systemPrompt = `你是一個高端的專業美食顧問 AI 助理 Fabrica。請閱讀使用者提供的 Threads 貼文內容，分析並提取出「餐廳名稱」、「分類」以及「地址」。

    【核心指令】
    1. 提取店名與推測台灣地址。
    2. 最重要：請根據你對該餐廳的認知或是綜合近期的網路真實評價、特色招牌菜色，或者是近期的優惠與活動，寫出極具質感的「aiNote」。
    3. 嚴格只能輸出一個 JSON 物件，不要任何 Markdown 標記（如 \`\`\`json 等符號）。

    【輸出 JSON 格式】
    {
      "name": "餐廳名稱 (若有中英文請寫 '中文 / 英文'，無則單寫一個)",
      "category": "分類 (例如 '日式甜點 • 咖啡廳' 或 '美式餐酒館 • 漢堡')",
      "address": "餐廳完整地址 (若無精確地址，請寫大略地區如：'台北市信義區')",
      "aiNote": "50-80字精煉總結這家餐廳的真實網路評價、特色招牌菜色，若近期有知名優惠或活動也請提及。語氣要專業且吸引人。"
    }`;

    let aiResult = {
      name: "未知美食",
      category: "美食 • 精選",
      address: "僅提供店名定位",
      aiNote: "由 @fabrica 偵測並保存之精選口袋名單。"
    };

    try {
      // 🌟 升級為 2026 最新主力萬用模型 gemini-2.5-flash
      // 網址保留 ?key= 參數，這是 Google API 路由分配的必要條件
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;
      
      const payload = {
        contents: [{ parts: [{ text: `Threads貼文內容：${textToAnalyze}` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      };

      const geminiData = await fetchJsonWithTimeout(geminiUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey // 🌟 補上 Header 雙重驗證，解決新版 AQ. 金鑰格式 Bug
        },
        body: JSON.stringify(payload)
      });
      
      if (geminiData.error) {
         console.error("🤖 Gemini API 錯誤:", geminiData.error);
      } else {
         const rawAiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
         const parsed = parseGeminiJson(rawAiText);
         
         if (parsed.name) {
           aiResult = parsed;
         }
      }
    } catch (aiErr) {
      console.error("🤖 Gemini AI 分析錯誤 (採用預設降級處理):", aiErr);
    }

    const cleanUsername = threadsSender.replace("@", "").trim().toLowerCase();
    const userRestaurantsRef = collection(db, 'artifacts', appId, 'users', cleanUsername, 'restaurants');

    const newDoc = {
      name: aiResult.name,
      address: aiResult.address || "僅提供店名定位",
      category: aiResult.category || "美食 • 精選",
      note: aiResult.aiNote || "系統已自動儲存至口袋名單。",
      recommendedBy: threadsSender, // 🌟 寫入社群推薦人 (脆友帳號)
      savedAt: serverTimestamp(),
      threadsUrl: parentPostId ? `https://threads.net/post/${parentPostId}` : ""
    };

    await addDoc(userRestaurantsRef, newDoc);
    console.log(`💾 成功將美食儲存至用戶 [${cleanUsername}] 的 Firestore 中:`, newDoc.name);

    return NextResponse.json({ success: true, message: "美食已自動儲存至個人地圖！", data: newDoc });

  } catch (error) {
    console.error("💥 Webhook 處理解析失敗:", error);
    return NextResponse.json({ error: "伺服器內部錯誤" }, { status: 500 });
  }
}
