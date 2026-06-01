import { NextResponse } from 'next/server';

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
  const cleanJsonStr = rawText.replace(/```json|```/g, "").trim();
  const jsonMatch = cleanJsonStr.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : cleanJsonStr);
}

function fallbackFoodResult(text) {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .trim();

  return {
    name: cleaned.split(/\n|。|！|!|\?|？/).find(Boolean)?.slice(0, 40) || "待確認美食",
    category: "美食收藏",
    areaHint: "",
    address: "",
    aiNote: "已從貼文匯入，店名與地址仍待確認。",
    confidence: 0.35
  };
}

export async function POST(request) {
  try {
    const { text = "" } = await request.json();
    const textToAnalyze = text.trim();

    if (!textToAnalyze) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({ data: fallbackFoodResult(textToAnalyze), fallback: true });
    }

    const systemPrompt = `你是 Fabrica Foodie 的美食收藏助理。
使用者會貼上 Threads 文字、心得、店名或連結。請抽取可存進美食庫的資訊。
不要假裝知道地址；沒有明確地址就留空。只回傳 JSON，不要 Markdown。
格式：
{
  "name": "店名或美食名稱",
  "category": "例如：咖啡、甜點、火鍋、拉麵、小吃",
  "areaHint": "貼文提到的地區，例如：台北中山、台南、逢甲；沒有就空字串",
  "address": "明確地址；沒有就空字串",
  "aiNote": "50 字以內，說明為什麼值得收藏",
  "confidence": 0.0 到 1.0
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;
    const geminiData = await fetchJsonWithTimeout(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Threads 貼文或使用者輸入：${textToAnalyze}` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      })
    });

    const rawAiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = parseGeminiJson(rawAiText);

    return NextResponse.json({
      data: {
        ...fallbackFoodResult(textToAnalyze),
        ...parsed,
        confidence: Number(parsed.confidence ?? 0.5)
      }
    });
  } catch (error) {
    console.error("Food import analysis failed:", error);
    return NextResponse.json({ error: "Unable to analyze food text" }, { status: 500 });
  }
}
