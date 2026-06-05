// app/api/analyze-food/route.js
// Multi-restaurant Gemini analysis + URL handling
//
// Key rules:
// 1. If user pastes URL-only AND we can't scrape meaningful content → return clear error
// 2. If user pastes text (with or without URL) → always analyze
// 3. NEVER fall back to "URL as restaurant name" (the old bug)

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
  } catch { return ""; }
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
  const arrayMatch = clean.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]); }
    catch { /* fall through */ }
  }
  const objMatch = clean.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return [JSON.parse(objMatch[0])]; }
    catch { /* fall through */ }
  }
  return [];   // ← KEY FIX: return empty array, NOT throw
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
    const fetchUrl = url.replace("threads.com/", "threads.net/");
    const response = await fetchWithTimeout(fetchUrl);
    if (!response.ok) return { text: "", author: extractThreadsAuthor(url) };
    const html = await response.text();
    const description =
      extractMetaContent(html, "og:description") ||
      extractMetaContent(html, "twitter:description") ||
      extractMetaContent(html, "description");
    const title =
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    // Combine title + description but strip Threads boilerplate
    const combined = `${title}\n${description}`
      .replace(/在 Threads (上|看見|觀看|查看)[^"]*/g, "")
      .replace(/See on Threads/g, "")
      .trim();
    return { text: combined, author: extractThreadsAuthor(url) };
  } catch (error) {
    console.error("[scrape] failed:", error.message);
    return { text: "", author: extractThreadsAuthor(url) };
  }
}

// ── Geocode via MapTiler ─────────────────────────────────────────────────────
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
  } catch {}
  return {};
}

// ── Analyze with Gemini — returns ARRAY (or empty array if can't analyze) ────
async function analyzeMultiWithGemini(textToAnalyze, geminiApiKey) {
  if (!geminiApiKey || !textToAnalyze.trim()) return [];

  const systemPrompt = `你是 Fabrica Foodie 的台灣美食情報整理助理。
請從 Threads 貼文或使用者輸入中，抽取「所有」提到的可收藏美食店家。
一篇貼文可能提到「多家」餐廳（例如美食清單、台南美食推薦），請每一家都獨立列出。
重要規則：
- 如果輸入只是 URL 連結或沒有具體店家資訊，回傳空陣列 []
- 不要把網址、用戶名、日期當作店名
- 不要幻想精確地址，沒有就填空字串
只回傳 JSON 陣列，不要 Markdown。
格式：
[
  {
    "name": "店名（必須是真實店家名稱，不可以是 URL 或用戶名）",
    "category": "咖啡、甜點、火鍋、拉麵、小吃等",
    "areaHint": "貼文提到的地區",
    "address": "明確地址；沒有就空字串",
    "aiNote": "50 字以內，說明為什麼值得收藏",
    "confidence": 0.0 到 1.0
  }
]`;

  try {
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
      console.error("[gemini] failed:", data?.error?.message);
      return [];
    }
    const rawAiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = parseGeminiJson(rawAiText);
    const arr = Array.isArray(parsed) ? parsed : [parsed];

    return arr
      .filter(r => r && r.name && r.name.trim().length > 0)
      // ── KEY FIX: Reject URL-like, date-like, user-like garbage ──────────────
      .filter(r => !/^https?:\/\//.test(r.name))
      .filter(r => !/^\d{4}-\d{1,2}-\d{1,2}/.test(r.name))
      .filter(r => !/^@/.test(r.name))
      .filter(r => r.name !== "待確認美食")
      .map(r => ({
        name: r.name.trim(),
        category: r.category || "美食收藏",
        areaHint: r.areaHint || "",
        address: r.address || "",
        aiNote: r.aiNote || "從貼文匯入，等待補充店家資訊。",
        confidence: Math.max(0, Math.min(1, Number(r.confidence ?? 0.5))),
      }));
  } catch (e) {
    console.error("[gemini] error:", e.message);
    return [];
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const rawText = String(body?.text || "").trim();
    if (!rawText) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const sourceUrl = body?.url || extractFirstUrl(rawText);
    const isUrlOnly = /^https?:\/\/\S+$/.test(rawText.trim());

    // Try to scrape Threads OG metadata
    const scraped = await scrapePublicThreadsText(sourceUrl);

    // Build content for Gemini — prefer user text, supplement with scrape
    const textToAnalyze = isUrlOnly
      ? scraped.text
      : [rawText, scraped.text].filter(Boolean).join("\n").slice(0, 18000);

    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const aiResults = await analyzeMultiWithGemini(textToAnalyze, geminiApiKey);

    // ── If no real restaurants found ─────────────────────────────────────────
    if (aiResults.length === 0) {
      if (isUrlOnly) {
        return NextResponse.json({
          error: "無法從連結讀取貼文內容",
          hint: "Threads 連結預覽資訊有限。請複製貼文文字一併貼上（在 Threads 長按貼文 → 複製文字）。",
          urlOnly: true,
        }, { status: 422 });
      }
      return NextResponse.json({
        error: "找不到可匯入的餐廳",
        hint: "請確認貼文內容有提到具體店名。",
      }, { status: 422 });
    }

    // Geocode addressless restaurants in parallel
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
    console.error("[analyze-food] fatal:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
