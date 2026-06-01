import { NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-2.5-flash';

async function fetchTextWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 FabricaFoodie/1.0",
        ...(options.headers || {})
      }
    });
    if (!response.ok) throw new Error(`Request failed with ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 12000) {
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

function extractFirstUrl(text) {
  return text.match(/https?:\/\/\S+/)?.[0]?.replace(/[)\]}。！？,，]+$/, "") || "";
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMetaContent(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

async function enrichInputText(rawText) {
  const sourceUrl = extractFirstUrl(rawText);
  if (!sourceUrl) return { sourceUrl: "", analysisText: rawText, fetchedText: "" };

  try {
    const html = await fetchTextWithTimeout(sourceUrl);
    const title = extractMetaContent(html, "og:title") || extractMetaContent(html, "twitter:title");
    const description = extractMetaContent(html, "og:description") || extractMetaContent(html, "description");
    const pageText = stripHtml(html).slice(0, 2000);
    const fetchedText = [title, description, pageText].filter(Boolean).join("\n");
    return {
      sourceUrl,
      analysisText: [rawText, fetchedText].filter(Boolean).join("\n\n--- public page text ---\n"),
      fetchedText
    };
  } catch (error) {
    console.warn("Unable to fetch source URL. Continuing with user input only:", error);
    return { sourceUrl, analysisText: rawText, fetchedText: "" };
  }
}

function parseGeminiJson(rawText) {
  const cleanJsonStr = rawText.replace(/```json|```/g, "").trim();
  const jsonMatch = cleanJsonStr.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : cleanJsonStr);
}

function fallbackFoodResult(text, sourceUrl = "") {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .trim();
  const hasOnlyUrl = sourceUrl && cleaned.length < 8;

  return {
    name: hasOnlyUrl ? "Threads 貼文待整理" : (cleaned.split(/\n|。|！|!|\?|？/).find(Boolean)?.slice(0, 40) || "待確認美食"),
    category: "美食收藏",
    areaHint: "",
    address: "",
    mainOffer: "未確認。請貼上貼文文字，或手動補充店家主賣品項。",
    reputationSummary: "未確認。尚未取得足夠公開內容判斷口碑。",
    currentPromotions: "未確認。沒有可靠來源時不推測近期活動。",
    businessHours: "未確認。建議以店家官方頁面或現場公告為準。",
    aiNote: hasOnlyUrl
      ? "目前只取得連結，無法穩定讀取 Threads 內容；請貼上貼文文字可獲得更完整整理。"
      : "已從貼文匯入，店名與地址仍待確認。",
    confidence: hasOnlyUrl ? 0.15 : 0.35
  };
}

function buildConsumerNote(data) {
  return [
    `主賣：${data.mainOffer || "未確認"}`,
    `口碑：${data.reputationSummary || "未確認"}`,
    `近期活動：${data.currentPromotions || "未確認"}`,
    `營業時間：${data.businessHours || "未確認"}`,
    data.aiNote ? `備註：${data.aiNote}` : ""
  ].filter(Boolean).join("\n");
}

export async function POST(request) {
  const { text = "" } = await request.json().catch(() => ({}));
  const rawText = text.trim();

  if (!rawText) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const { sourceUrl, analysisText, fetchedText } = await enrichInputText(rawText);
  const baseFallback = fallbackFoodResult(rawText, sourceUrl);
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!geminiApiKey) {
    return NextResponse.json({
      data: { ...baseFallback, aiNote: buildConsumerNote(baseFallback) },
      fallback: true,
      sourceUrl,
      fetched: Boolean(fetchedText)
    });
  }

  const systemPrompt = `你是 Fabrica Foodie 的美食資訊整理助理。
使用者會貼上 Threads 文字、心得、店名或連結。請整理成消費者看得懂的店家卡片。
重要規則：
1. 不可假裝知道不存在於輸入內容中的資訊。
2. 如果沒有可靠資訊，請填「未確認」，不要推測。
3. 「近期活動」與「營業時間」必須保守；輸入沒有提到就填「未確認」。
4. 只回傳 JSON，不要 Markdown。
格式：
{
  "name": "店名或美食名稱",
  "category": "例如：咖啡、甜點、火鍋、拉麵、小吃",
  "areaHint": "貼文提到的地區，沒有就空字串",
  "address": "明確地址；沒有就空字串",
  "mainOffer": "主要賣什麼、招牌品項；不知道就未確認",
  "reputationSummary": "從貼文可看出的口碑或評價；不知道就未確認",
  "currentPromotions": "近期活動/優惠；不知道就未確認",
  "businessHours": "營業時間；不知道就未確認",
  "aiNote": "50 字內收藏理由",
  "confidence": 0.0 到 1.0
}`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;
    const geminiData = await fetchJsonWithTimeout(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `使用者輸入與可取得公開內容：\n${analysisText}` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      })
    });

    const rawAiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = parseGeminiJson(rawAiText);
    const merged = {
      ...baseFallback,
      ...parsed,
      confidence: Number(parsed.confidence ?? baseFallback.confidence)
    };

    return NextResponse.json({
      data: {
        ...merged,
        aiNote: buildConsumerNote(merged)
      },
      sourceUrl,
      fetched: Boolean(fetchedText)
    });
  } catch (error) {
    console.error("Food import analysis failed, returning fallback:", error);
    return NextResponse.json({
      data: { ...baseFallback, aiNote: buildConsumerNote(baseFallback) },
      fallback: true,
      sourceUrl,
      fetched: Boolean(fetchedText)
    });
  }
}
