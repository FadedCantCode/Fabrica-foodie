import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC4YdF_pAKyMFuQVDCau_g3fP9zsMTcOcE",
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.THREADS_VERIFY_TOKEN || 'fabrica_studio_secret';

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
        const fetchPostUrl = `https://graph.threads.net/v1.0/${parentPostId}?fields=text,media_url,media_type&access_token=${threadsAccessToken}`;
        const threadsRes = await fetch(fetchPostUrl);
        const threadsData = await threadsRes.json();
        foodPostText = threadsData.text || "";
      } catch (err) {
        console.error("無法自 Threads 抓取原串文內容，將降級使用標記留言進行解析:", err);
      }
    }

    const textToAnalyze = foodPostText || triggerText;

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.error("❌ 系統錯誤：未配置 GEMINI_API_KEY 環境變數！");
      return NextResponse.json({ error: "內部 API 設定未完成" }, { status: 500 });
    }

    const systemPrompt = `你是一個專業的美食貼文與地理分析 AI。請閱讀使用者提供的 Threads 貼文內容，分析並提取出「餐廳名稱」、「分類」以及「地址」。

    【核心指令】
    - 若貼文中「只有提及店名、沒有寫地址」，請根據店名推測最有可能的台灣分店地址，如果真的不確定，地址請填寫「台灣地區」或空字串。不要編造不實的詳細門牌。
    - 嚴格只能輸出一個 JSON 物件，不要任何 Markdown 標記（如 \`\`\`json 等符號）。

    【輸出 JSON 格式】
    {
      "name": "餐廳名稱 (若有中英文請寫 '中文 / 英文'，無則單寫一個)",
      "category": "分類 (例如 '日式甜點 • 咖啡廳' 或 '美式餐酒館 • 漢堡')",
      "address": "餐廳完整地址 (若無精確地址，請寫大略地區如：'台北市信義區')",
      "aiNote": "一句話簡介這家店特色與推薦菜色 (50-80字)"
    }`;

    let aiResult = {
      name: "未知美食",
      category: "美食 • 精選",
      address: "僅提供店名定位",
      aiNote: "由 @fabrica 偵測並保存之精選口袋名單。"
    };

    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;
      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Threads貼文內容：${textToAnalyze}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });

      const geminiData = await geminiResponse.json();
      const rawAiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      const cleanJsonStr = rawAiText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJsonStr);
      
      if (parsed.name) {
        aiResult = parsed;
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