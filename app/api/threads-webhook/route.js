import { NextResponse } from 'next/server';
import { FieldValue, getAdminDb } from '../../../lib/firebaseAdmin';

const FABRICA_HANDLE = '@fabrica_tw';
const GEMINI_MODEL = 'gemini-2.5-flash';
const appId = 'fabrica-foodie-app';

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

function normalizeUsername(username = "") {
  return username.replace("@", "").trim().toLowerCase();
}

function extractVerificationCode(text = "") {
  return text.match(/\bFAB-\d{4,6}\b/i)?.[0]?.toUpperCase() || "";
}

function parseGeminiJson(rawText) {
  const cleanJsonStr = rawText.replace(/```json|```/g, "").trim();
  const jsonMatch = cleanJsonStr.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : cleanJsonStr);
}

function fallbackFoodResult(text) {
  const withoutMention = text.replace(new RegExp(FABRICA_HANDLE, "ig"), "").trim();
  return {
    name: withoutMention.slice(0, 40) || "待確認美食",
    category: "美食收藏",
    areaHint: "",
    address: "",
    aiNote: "已從 Threads 標記記下，店名與地址仍待確認。",
    confidence: 0.35
  };
}

async function analyzeFoodPost(textToAnalyze, geminiApiKey) {
  if (!geminiApiKey) return fallbackFoodResult(textToAnalyze);

  const systemPrompt = `你是 Fabrica Foodie 的美食收藏助理。
請從 Threads 貼文中抽取使用者想收藏的美食資訊。不要假裝知道地址；如果沒有明確地址就留空。
只回傳 JSON，不要使用 Markdown。
格式：
{
  "name": "店名或美食名稱",
  "category": "例如：咖啡、甜點、火鍋、拉麵、小吃",
  "areaHint": "貼文提到的地區，例如：台北中山、台南、逢甲；沒有就空字串",
  "address": "明確地址；沒有就空字串",
  "aiNote": "50 字以內，說明為什麼值得收藏",
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
        contents: [{ parts: [{ text: `Threads 貼文內容：${textToAnalyze}` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      })
    });

    const rawAiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = parseGeminiJson(rawAiText);
    return {
      ...fallbackFoodResult(textToAnalyze),
      ...parsed,
      confidence: Number(parsed.confidence ?? 0.5)
    };
  } catch (error) {
    console.error("Gemini analysis failed, using fallback:", error);
    return fallbackFoodResult(textToAnalyze);
  }
}

async function fetchParentPostText(parentPostId) {
  const threadsAccessToken = process.env.THREADS_ACCESS_TOKEN;
  if (!threadsAccessToken || !parentPostId) return { text: "", mediaUrl: "", mediaType: "" };

  const fetchPostUrl = `https://graph.threads.net/v1.0/${parentPostId}?fields=text,media_url,media_type`;
  const threadsData = await fetchJsonWithTimeout(fetchPostUrl, {
    headers: { Authorization: `Bearer ${threadsAccessToken}` }
  });

  return {
    text: threadsData.text || "",
    mediaUrl: threadsData.media_url || "",
    mediaType: threadsData.media_type || ""
  };
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
    return new Response(challenge, { status: 200 });
  }

  return new Response('Verification failed', { status: 403 });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const changeValue = body?.entry?.[0]?.changes?.[0]?.value;

    if (!changeValue) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    const triggerText = changeValue.text || "";
    const threadsSender = changeValue.username;
    const parentPostId = changeValue.parent_id;
    const cleanUsername = normalizeUsername(threadsSender);
    const lowerTriggerText = triggerText.toLowerCase();

    if (!threadsSender || !lowerTriggerText.includes(FABRICA_HANDLE)) {
      return NextResponse.json({ success: true, message: "Ignored non-Fabrica mention." });
    }

    const verificationCode = extractVerificationCode(triggerText);
    if (verificationCode && lowerTriggerText.includes("verify")) {
      const db = getAdminDb();
      await db.collection('artifacts').doc(appId).collection('verifiedUsers').doc(cleanUsername).set({
        username: cleanUsername,
        verificationCode,
        verified: true,
        verifiedAt: FieldValue.serverTimestamp(),
        source: "threads_mention"
      }, { merge: true });

      return NextResponse.json({
        success: true,
        type: "verification",
        username: cleanUsername,
        verificationCode
      });
    }

    let parentPost = { text: "", mediaUrl: "", mediaType: "" };
    try {
      parentPost = await fetchParentPostText(parentPostId);
    } catch (error) {
      console.error("Unable to fetch parent Threads post, falling back to trigger text:", error);
    }

    const textToAnalyze = parentPost.text || triggerText;
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const aiResult = await analyzeFoodPost(textToAnalyze, geminiApiKey);
    const confidence = Math.max(0, Math.min(1, Number(aiResult.confidence || 0)));
    const placeStatus = aiResult.address ? "needs_review" : "unverified";

    const newDoc = {
      name: aiResult.name || "待確認美食",
      address: aiResult.address || "",
      areaHint: aiResult.areaHint || "",
      category: aiResult.category || "美食收藏",
      note: aiResult.aiNote || "已從 Threads 標記記下，等待補充店家資訊。",
      confidence,
      placeStatus,
      source: "threads_mention",
      sourceText: textToAnalyze,
      sourceImageUrl: parentPost.mediaUrl || "",
      sourceMediaType: parentPost.mediaType || "",
      recommendedBy: cleanUsername,
      savedAt: FieldValue.serverTimestamp(),
      threadsUrl: parentPostId ? `https://threads.net/post/${parentPostId}` : ""
    };

    const db = getAdminDb();
    await db.collection('artifacts').doc(appId).collection('users').doc(cleanUsername).collection('restaurants').add(newDoc);

    return NextResponse.json({
      success: true,
      type: "food_saved",
      username: cleanUsername,
      data: newDoc
    });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
