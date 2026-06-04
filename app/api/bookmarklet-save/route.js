// app/api/bookmarklet-save/route.js
// Receives POST from the bookmarklet with {text, url, uid, idToken}
// Validates Firebase ID token, then calls analyze-food logic and saves to Firestore

import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const APP_ID = 'fabrica-foodie-app';
const GEMINI_MODEL = 'gemini-2.5-flash';

async function analyzeFood(text, url, geminiKey) {
  if (!geminiKey) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `請分析以下內容：\n${text.slice(0, 3000)}` }] }],
          systemInstruction: { parts: [{ text: `你是 Fabrica Foodie 的台灣美食整理助理。從 Threads 貼文抽取美食資訊，只回傳 JSON：
{
  "name": "店名",
  "category": "分類",
  "areaHint": "地區",
  "address": "地址或空字串",
  "aiNote": "50字以內推薦理由",
  "confidence": 0.0到1.0
}` }] },
        }),
      }
    );
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch { return null; }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { text, url, idToken } = body;

    if (!text || !idToken) {
      return NextResponse.json({ error: 'Missing text or idToken' }, { status: 400 });
    }

    // Verify Firebase ID token
    let uid;
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: '請先登入 Fabrica' }, { status: 401 });
    }

    // Resolve master UID (Threads users may have a Google UID mapping)
    const db = getAdminDb();
    let masterUid = uid;
    if (uid.startsWith('threads_')) {
      const username = uid.replace('threads_', '');
      const snap = await db
        .collection('artifacts').doc(APP_ID)
        .collection('threadMappings').doc(username).get();
      masterUid = snap.data()?.uid || uid;
    }

    // Analyze with Gemini
    const geminiKey = process.env.GEMINI_API_KEY;
    const ai = await analyzeFood(text, url, geminiKey);

    if (!ai?.name) {
      return NextResponse.json({ error: '找不到美食資訊，請在美食貼文頁面使用' }, { status: 400 });
    }

    // Save to user's food library
    const docRef = await db
      .collection('artifacts').doc(APP_ID)
      .collection('users').doc(masterUid)
      .collection('restaurants').add({
        name:        ai.name || '待確認美食',
        address:     ai.address || '',
        areaHint:    ai.areaHint || '',
        category:    ai.category || '美食收藏',
        note:        ai.aiNote || '從 Threads 書籤存入',
        confidence:  Math.max(0, Math.min(1, Number(ai.confidence || 0.5))),
        placeStatus: ai.address ? 'needs_review' : 'unverified',
        source:      'bookmarklet',
        threadsUrl:  url || '',
        sourceText:  text.slice(0, 500),
        recommendedBy: uid.startsWith('threads_') ? uid.replace('threads_', '') : 'google-user',
        savedAt:     FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      success: true,
      data: {
        id:      docRef.id,
        name:    ai.name,
        address: ai.address || '',
        note:    ai.aiNote || '',
      },
    });

  } catch (err) {
    console.error('[bookmarklet-save]', err);
    return NextResponse.json({ error: '儲存失敗，請稍後再試' }, { status: 500 });
  }
}
