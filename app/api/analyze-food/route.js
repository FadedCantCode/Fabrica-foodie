import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GEMINI_MODEL = "gemini-2.5-flash";
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || "W1dDFaNHzCyu5PT8YwYk";

function extractFirstUrl(text = "") {
  return text.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[),.]+$/, "") || "";
}

function extractThreadsAuthor(url = "") {
  try {
    return new URL(url).pathname.match(/\/@([^/]+)/)?.[1] || "";
  } catch {
    return "";
  }
}

function stripHtml(html = "") {
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

function extractMetaContent(html = "", property = "") {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escaped}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return stripHtml(match[1]);
  }
  return "";
}

function parseGeminiJson(rawText = "") {
  const clean = rawText.replace(/```json|```/g, "").trim();
  // Try array first, then object
  const arrayMatch = clean.match(/\[[\s\S]*\]/);
  if (arrayMatch) return JSON.parse(arrayMatch[0]);
  const objMatch = clean.match(/\{[\s\S]*\}/);
  if (objMatch) return [JSON.parse(objMatch[0])];
  return JSON.parse(clean);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8",
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function scrapePublicThreadsText(url) {
  if (!url) return { text: "", author: "" };
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return { text: "", author: extractThreadsAuthor(url) };
    const html = await response.text();
    const description =
      extractMetaContent(html, "og:description") ||
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "twitter:description");
    const title =
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] || "";
    const readable = stripHtml(`${title}\n${description}\n${nextData}`).slice(0, 12000);
    return { text: readable, author: extractThreadsAuthor(url) };
  } catch (error) {
    console.error("Threads scrape failed:", error);
    return { text: "", author: extractThreadsAuthor(url) };
  }
}

// ── Geocode via MapTiler (best Taiwan coverage) ──────────────────────────────
async function geocodeAddress(name, areaHint) {
  const query = [name, areaHint].filter(Boolean).join(" ");
  if (!name) return {};
  try {
    const res = await fetchWithTimeout(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&language=zh&country=tw&limit=1`,
      {}, 8000
    );
    const data = await res.json();
    const feature = data.features?.[0];
    if (feature?.center) {
      const [lng, lat] = feature.center;
      return {
        address: feature.place_name || feature.text || "",
        latitude: String(lat),
        longitude: String(lng),
      };
    }
  } catch (e) {
    console.error("MapTiler geocode failed:", e.message);
  }
  // Fallback to Nominatim
  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + " 台灣")}&format=json&limit=1&countrycodes=tw`,
      { headers: { Accept: "application/json" } }, 8000
    );
    const data = await res.json().catch(() => []);
    const place = Array.isArray(data) ? data[0] : null;
    if (place) {
      return {
        address: place.display_name || "",
        latitude: place.lat || "",
        longitude: place.lon || "",
      };
    }
  } catch {}
  return {};
}

function fallbackResult(text = "") {
  return [{
    name: text.slice(0, 36) || "待確認美食",
    category: "美食收藏",
    areaHint: "",
    address: "",
    aiNote: "已先保留來源內容，店名、地址與營業資訊仍待確認。",
    confidence: 0.25
  }];
}

// ── Analyze with Gemini — returns ARRAY of restaurants ───────────────────────
async function analyzeMultiWithGemini(textToAnalyze, geminiApiKey) {
  if (!geminiApiKey) return fallbackResult(textToAnalyze);

  const systemPrompt = `你是 Fabrica Foodie 的台灣美食情報整理助理。
請從 Threads 貼文或使用者輸入中，抽取「所有」提到的可收藏美食店家。
一篇貼文可能提到「多家」餐廳（例如美食清單、台南美食推薦），請每一家都獨立列出。
不要幻想精確地址、優惠或營業時間；沒有明確資訊就填空字串。
只回傳 JSON 陣列，不要 Markdown。即使只有一家，也回傳長度為 1 的陣列。
格式：
[
  {
    "name": "店名或美食名稱",
    "category": "咖啡、甜點、火鍋、拉麵、小吃等",
    "areaHint": "貼文提到的地區，例如台北中山、台南、逢甲；沒有就空字串",
    "address": "明確地址；沒有就空字串",
    "aiNote": "50 字以內，說明為什麼值得收藏",
    "confidence": 0.0 到 1.0
  }
]`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;
  const response = await fetchWithTimeout(
    geminiUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `請分析以下內容，找出所有餐廳：\n${textToAnalyze}` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      })
    },
    20000
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini failed ${response.status}`);
  }

  const rawAiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = parseGeminiJson(rawAiText);
  const arr = Array.isArray(parsed) ? parsed : [parsed];

  return arr
    .filter(r => r && r.name)
    .map(r => ({
      name: r.name || "待確認美食",
      category: r.category || "美食收藏",
      areaHint: r.areaHint || "",
      address: r.address || "",
      aiNote: r.aiNote || "已從貼文匯入，等待補充店家資訊。",
      confidence: Math.max(0, Math.min(1, Number(r.confidence ?? 0.5))),
    }));
}

export async function POST(request) {
  try {
    const body = await request.json();
    const rawText = String(body?.text || "").trim();
    if (!rawText) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const sourceUrl = body?.url || extractFirstUrl(rawText);
    const scraped = await scrapePublicThreadsText(sourceUrl);
    const textToAnalyze = [rawText, scraped.text].filter(Boolean).join("\n\n--- scraped context ---\n").slice(0, 18000);
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    let aiResults;
    try {
      aiResults = await analyzeMultiWithGemini(textToAnalyze, geminiApiKey);
    } catch (error) {
      console.error("Gemini analysis failed:", error);
      aiResults = fallbackResult(rawText);
    }

    // Geocode each restaurant that has no address (parallel, capped)
    const enriched = await Promise.all(
      aiResults.map(async (r) => {
        let geo = {};
        if (!r.address || r.address.trim() === "") {
          geo = await geocodeAddress(r.name, r.areaHint);
        }
        return {
          ...r,
          address: r.address || geo.address || "",
          latitude: geo.latitude || "",
          longitude: geo.longitude || "",
          sourceUrl,
          sourceAuthor: scraped.author || extractThreadsAuthor(sourceUrl),
          sourceText: rawText.slice(0, 500),
          placeStatus: (r.address || geo.address) ? "needs_review" : "unverified",
        };
      })
    );

    return NextResponse.json({ success: true, data: enriched, count: enriched.length });
  } catch (error) {
    console.error("Analyze food failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
