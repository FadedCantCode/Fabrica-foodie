// app/api/share-save/route.js
// Receives shared Threads content, analyzes for MULTIPLE restaurants, saves all
import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const APP_ID = 'fabrica-foodie-app';

export async function POST(request) {
  try {
    const { text, idToken } = await request.json();
    if (!text || !idToken) {
      return NextResponse.json({ error: '缺少分享內容或登入資訊' }, { status: 400 });
    }

    // Verify Firebase token
    let uid;
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: '請先登入 Fabrica' }, { status: 401 });
    }

    // Resolve master UID (Threads users → Google UID mapping)
    const db = getAdminDb();
    let masterUid = uid;
    if (uid.startsWith('threads_')) {
      const username = uid.replace('threads_', '');
      const snap = await db.collection('artifacts').doc(APP_ID)
        .collection('threadMappings').doc(username).get();
      masterUid = snap.data()?.uid || uid;
    }

    // Call analyze-food (multi) by reusing the same origin
    const origin = new URL(request.url).origin;
    const analyzeRes = await fetch(`${origin}/api/analyze-food`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const analyzeData = await analyzeRes.json();

    if (!analyzeData.success || !analyzeData.data?.length) {
      return NextResponse.json({ error: '找不到美食資訊' }, { status: 400 });
    }

    const restaurants = analyzeData.data;
    const recommender = uid.startsWith('threads_') ? uid.replace('threads_', '') : 'google-user';

    // Save all restaurants
    const saved = [];
    const collectionRef = db.collection('artifacts').doc(APP_ID)
      .collection('users').doc(masterUid).collection('restaurants');

    for (const r of restaurants) {
      const docRef = await collectionRef.add({
        name:          r.name || '待確認美食',
        address:       r.address || '',
        areaHint:      r.areaHint || '',
        category:      r.category || '美食收藏',
        note:          r.aiNote || '從 Threads 分享存入',
        confidence:    Math.max(0, Math.min(1, Number(r.confidence || 0.5))),
        latitude:      r.latitude || '',
        longitude:     r.longitude || '',
        placeStatus:   r.placeStatus || (r.address ? 'needs_review' : 'unverified'),
        source:        'threads_share',
        threadsUrl:    r.sourceUrl || '',
        sourceAuthor:  r.sourceAuthor || '',
        sourceText:    r.sourceText || text.slice(0, 500),
        recommendedBy: r.sourceAuthor || recommender,
        savedAt:       FieldValue.serverTimestamp(),
      });
      saved.push({ id: docRef.id, name: r.name, address: r.address || '' });
    }

    return NextResponse.json({ success: true, saved, count: saved.length });
  } catch (err) {
    console.error('[share-save]', err);
    return NextResponse.json({ error: '儲存失敗，請稍後再試' }, { status: 500 });
  }
}
