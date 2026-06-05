import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GEMINI_MODEL = "gemini-2.5-flash";

function extractFirstUrl(text = "") {
  return text.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[),.]+$/, "") || "";
}

function extractThreadsAuthor(url = "") {
  try {
    const parsed = new URL(url);
    return parsed.pathname.match(/\/@([^/]+)/)?.[1] || "";
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
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : clean);
}

function fallbackFoodResult(text = "", sourceUrl = "") {
  const compact = text.replace(sourceUrl, "").trim();
  return {
    name: compact.slice(0, 36) || "待確認美食",
    category: "美食收藏",
    areaHint: "",
    address: "",
    aiNote: "已先保留來源內容，店名、地址與營業資訊仍待確認。",
    mainOffer: "未確認",
    reputationSummary: "未確認",
    currentPromotions: "未確認",
    businessHours: "未確認",
    operatingStatus: "未確認",
    confidence: 0.25
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8",
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ── Threads shortcode → numeric media ID ─────────────────────────────────────
function shortcodeToId(shortcode) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let n = BigInt(0);
  for (const char of shortcode) {
    n = n * BigInt(64) + BigInt(alphabet.indexOf(char));
  }
  return n.toString();
}

function extractShortcode(url = "") {
  // handles threads.com/@user/post/SHORTCODE and threads.net/@user/post/SHORTCODE
  return url.match(/\/post\/([A-Za-z0-9_-]+)/)?.[1] || "";
}

// ── Fetch post text via Threads internal API (uses session token) ─────────────
async function fetchThreadsPostViaApi(url) {
  const sessionId = process.env.THREADS_SESSION_ID;
  const csrfToken = process.env.THREADS_CSRF_TOKEN;
  if (!sessionId) return null;

  const shortcode = extractShortcode(url);
  if (!shortcode) return null;

  const mediaId = shortcodeToId(shortcode);

  try {
    const res = await fetchWithTimeout(
      `https://www.threads.net/api/v1/media/${mediaId}/info/`,
      {
        headers: {
          "Cookie": `sessionid=${sessionId}; csrftoken=${csrfToken || ""}`,
          "X-CSRFToken": csrfToken || "",
          "X-IG-App-ID": "238260118697367",
          "User-Agent": "Barcelona 289.0.0.77.109",
          "Accept": "*/*",
        }
      },
      8000
    );

    if (!res.ok) {
      console.error("[threads-api] status:", res.status);
      return null;
    }

    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) return null;

    const text = item.caption?.text || "";
    const author = item.user?.username || "";
    console.log(`[threads-api] ✅ got post text (${text.length} chars) by @${author}`);
    return { text, author };
  } catch (e) {
    console.error("[threads-api] fetch failed:", e.message);
    return null;
  }
}

async function scrapePublicThreadsText(url) {
  if (!url) return { text: "", author: "" };

  // Try internal API first (most reliable, gets actual post text)
  const apiResult = await fetchThreadsPostViaApi(url);
  if (apiResult?.text) return apiResult;

  // Fallback: OG metadata scrape (usually empty for Threads, but try anyway)
  try {
    const fetchUrl = url.replace("https://www.threads.com/", "https://www.threads.net/")
                        .replace("https://threads.com/", "https://www.threads.net/");
    const response = await fetchWithTimeout(fetchUrl);
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
    const jsonLd = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)?.[1] || "";
    const readable = stripHtml(`${title}\n${description}\n${jsonLd}\n${nextData}`).slice(0, 12000);

    return { text: readable, author: extractThreadsAuthor(url) };
  } catch (error) {
    console.error("[scrape] failed:", error.message);
    return { text: "", author: extractThreadsAuthor(url) };
  }
}

async function searchAddressHint(name = "", areaHint = "") {
  const query = [name, areaHint, "台灣"].filter(Boolean).join(" ");
  if (!name || name === "待確認美食") return {};

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1&countrycodes=tw`;
    const response = await fetchWithTimeout(url, {
      headers: { "Accept": "application/json" }
    });
    const data = await response.json().catch(() => []);
    const place = Array.isArray(data) ? data[0] : null;
    if (!place) return {};
    return {
      address: place.display_name || "",
      latitude: place.lat || "",
      longitude: place.lon || ""
    };
  } catch (error) {
    console.error("Address lookup failed:", error);
    return {};
  }
}

async function analyzeWithGemini(textToAnalyze, geminiApiKey) {
  if (!geminiApiKey) return fallbackFoodResult(textToAnalyze);

  const systemPrompt = `你是 Fabrica Foodie 的台灣美食情報整理助理。
請從 Threads 貼文、連結預覽文字或使用者輸入中，抽取可收藏的美食資訊。
不要幻想精確地址、優惠或營業時間；沒有明確資訊就填「未確認」或空字串。
只回傳 JSON，不要 Markdown。
格式：
{
  "name": "店名或美食名稱",
  "category": "咖啡、甜點、火鍋、拉麵、小吃等",
  "areaHint": "貼文提到的地區，例如台北中山、台南、逢甲；沒有就空字串",
  "address": "明確地址；沒有就空字串",
  "aiNote": "50 字以內，說明為什麼值得收藏",
  "mainOffer": "招牌品項或主要賣點；沒有就未確認",
  "reputationSummary": "貼文或網路語境中的口碑摘要；沒有就未確認",
  "currentPromotions": "近期優惠或活動；沒有就未確認",
  "businessHours": "營業時間；沒有就未確認",
  "operatingStatus": "營業中、休息中、可能歇業、未確認其中之一",
  "confidence": 0.0 到 1.0
}`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;
  const response = await fetchWithTimeout(
    geminiUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `請分析以下內容：\n${textToAnalyze}` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      })
    },
    20000
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini request failed with ${response.status}`);
  }

  const rawAiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = parseGeminiJson(rawAiText);
  return {
    ...fallbackFoodResult(textToAnalyze),
    ...parsed,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5)))
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const rawText = String(body?.text || "").trim();

    if (!rawText) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    // If input is a URL, try to fetch the post content via Threads internal API
    const isUrlOnly = /^https?:\/\/\S+$/.test(rawText.trim());
    const sourceUrl = isUrlOnly ? rawText : (body?.url || extractFirstUrl(rawText));
    const scraped = await scrapePublicThreadsText(sourceUrl);

    // If URL-only and scraping got nothing, we can't analyze
    const hasContent = !isUrlOnly || (scraped.text && scraped.text.trim().length > 20);
    if (!hasContent) {
      return NextResponse.json({
        error: "無法取得貼文內容",
        hint: "請同時貼上貼文文字（在 Threads 長按貼文 → 複製文字），或直接貼文字內容到這裡。",
        urlOnly: true,
      }, { status: 422 });
    }

    const textToAnalyze = isUrlOnly
      ? scraped.text   // URL-only: use scraped content
      : [rawText, scraped.text].filter(Boolean).join("\n\n--- scraped context ---\n").slice(0, 18000);

    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    let aiResult;
    try {
      aiResult = await analyzeWithGemini(textToAnalyze, geminiApiKey);
    } catch (error) {
      console.error("Gemini analysis failed:", error);
      aiResult = fallbackFoodResult(rawText, sourceUrl);
    }

    const addressHint = aiResult.address ? {} : await searchAddressHint(aiResult.name, aiResult.areaHint);
    const result = {
      ...aiResult,
      address: aiResult.address || addressHint.address || "",
      latitude: addressHint.latitude || "",
      longitude: addressHint.longitude || "",
      sourceUrl,
      sourceAuthor: scraped.author || extractThreadsAuthor(sourceUrl),
      sourceText: rawText,
      scrapedText: scraped.text,
      placeStatus: aiResult.address || addressHint.address ? "needs_review" : "unverified"
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Analyze food failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
