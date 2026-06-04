// app/api/threads-poller/route.js
// Polls @fabrica_tw's profile for new mention posts,
// analyzes them with Gemini, saves to Firestore, and replies.
//
// Trigger via Vercel Cron — add to vercel.json:
// {
//   "crons": [{ "path": "/api/threads-poller", "schedule": "*/5 * * * *" }]
// }

import { NextResponse } from 'next/server';
import { FieldValue, getAdminDb } from '../../../lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel max for hobby plan

const APP_ID      = 'fabrica-foodie-app';
const FABRICA_HANDLE = 'fabrica_tw';
const FABRICA_MENTION = '@fabrica_tw';
const INSTAGRAM_API = 'https://i.instagram.com';
const MOBILE_UA     = 'Barcelona 289.0.0.77.109 Android';

// ─── Threads client (inline, no npm install needed) ──────────────────────────
function makeHeaders(sessionId, csrfToken) {
  return {
    'cookie':         `sessionid=${sessionId}; csrftoken=${csrfToken}`,
    'x-csrftoken':    csrfToken,
    'x-ig-app-id':   '238260118697367',
    'user-agent':     MOBILE_UA,
    'accept':         '*/*',
  };
}

async function igGet(path, sessionId, csrfToken) {
  const res = await fetch(`${INSTAGRAM_API}${path}`, {
    headers: makeHeaders(sessionId, csrfToken),
  });
  if (!res.ok) throw new Error(`IG API ${res.status}: ${path}`);
  return res.json();
}

async function igPost(path, body, sessionId, csrfToken) {
  const res = await fetch(`${INSTAGRAM_API}${path}`, {
    method: 'POST',
    headers: {
      ...makeHeaders(sessionId, csrfToken),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`IG API POST ${res.status}: ${path}`);
  return res.json();
}

// Get user ID from handle
async function getUserId(handle, sessionId, csrfToken) {
  const data = await igGet(
    `/api/v1/users/search/?q=${encodeURIComponent(handle)}`,
    sessionId, csrfToken
  );
  const user = (data.users || []).find(
    u => u.username?.toLowerCase() === handle.toLowerCase()
  );
  return user?.pk || user?.id || null;
}

// Get recent posts for a user
async function getUserPosts(userId, sessionId, csrfToken) {
  const data = await igGet(
    `/api/v1/text_feed/${userId}/profile/`,
    sessionId, csrfToken
  );
  const items = data.media_or_ads || data.items || [];
  return items.map(item => ({
    id:     String(item.pk || item.id || ''),
    code:   item.code || '',
    text:   item.caption?.text || '',
    author: item.user?.username || '',
    authorId: String(item.user?.pk || ''),
    timestamp: item.taken_at || 0,
  }));
}

// Reply to a post
async function replyToPost(postId, replyText, userId, sessionId, csrfToken) {
  const payload = {
    publish_mode: 'text_post',
    text_post_app_info: JSON.stringify({
      reply_control: 0,
      reply_id: postId,
    }),
    timezone_offset: '28800', // UTC+8 Taiwan
    source_type: '4',
    caption: replyText,
    _uid: userId,
    device_id: `android-${Math.random().toString(36).slice(2, 18)}`,
    upload_id: Date.now().toString(),
    device: JSON.stringify({
      manufacturer: 'OnePlus',
      model: 'ONEPLUS+A3010',
      android_version: 25,
      android_release: '7.1.1',
    }),
  };

  const body = new URLSearchParams();
  body.append('signed_body', `SIGNATURE.${JSON.stringify(payload)}`);

  return igPost(
    '/api/v1/media/configure_text_only_post/',
    body, sessionId, csrfToken
  );
}

// ─── Gemini food analysis ─────────────────────────────────────────────────────
async function analyzeFood(text, geminiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `請分析以下內容：\n${text}` }] }],
        systemInstruction: { parts: [{ text: `你是 Fabrica Foodie 的台灣美食整理助理。從貼文抽取美食資訊，只回傳 JSON：
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
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return { name: '待確認美食', category: '美食收藏', confidence: 0.3 };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(request) {
  // Allow both Vercel Cron and manual trigger
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionId = process.env.THREADS_SESSION_ID;
  const csrfToken = process.env.THREADS_CSRF_TOKEN;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!sessionId || !csrfToken) {
    return NextResponse.json({
      error: 'Missing THREADS_SESSION_ID or THREADS_CSRF_TOKEN env vars'
    }, { status: 500 });
  }

  const db = getAdminDb();
  const results = { processed: 0, skipped: 0, errors: [] };

  try {
    // 1. Get @fabrica_tw user ID
    const fabrica_uid = await getUserId(FABRICA_HANDLE, sessionId, csrfToken);
    if (!fabrica_uid) throw new Error('Cannot find @fabrica_tw user ID');

    // 2. Get recent posts that mention @fabrica_tw
    //    Strategy: scrape @fabrica_tw profile to find tagged posts
    //    (mentions show up as replies to @fabrica_tw's own posts,
    //     or we poll the notification mentions endpoint)
    
    // Try notifications / mentions endpoint
    let mentionPosts = [];
    try {
      const notifData = await igGet(
        '/api/v1/news/inbox/',
        sessionId, csrfToken
      );
      const stories = notifData.new_stories || notifData.old_stories || [];
      mentionPosts = stories
        .filter(s => s.args?.text?.toLowerCase().includes(FABRICA_MENTION.toLowerCase()))
        .map(s => ({
          id:       String(s.args?.media?.id || s.args?.inline_follow?.media_id || ''),
          code:     s.args?.media?.code || '',
          text:     s.args?.text || '',
          author:   s.args?.profile_name || s.args?.sender_id || '',
          authorId: String(s.args?.sender_id || ''),
          timestamp: s.args?.timestamp || 0,
        }))
        .filter(p => p.id && p.author);
    } catch (e) {
      // Fallback: inbox not available, use profile scan
      console.log('Inbox unavailable, falling back to profile scan:', e.message);
    }

    // Fallback: scan @fabrica_tw's own posts for replies
    if (mentionPosts.length === 0) {
      const ownPosts = await getUserPosts(fabrica_uid, sessionId, csrfToken);
      // For each recent post, check if it's a reply from another user mentioning fabrica
      for (const post of ownPosts.slice(0, 10)) {
        if (post.text.toLowerCase().includes(FABRICA_MENTION.toLowerCase()) &&
            post.author.toLowerCase() !== FABRICA_HANDLE.toLowerCase()) {
          mentionPosts.push(post);
        }
      }
    }

    // 3. Process each mention
    for (const post of mentionPosts) {
      const postId   = post.id;
      const postCode = post.code;
      const author   = post.author.replace('@', '').toLowerCase();
      const text     = post.text;

      if (!postId || !author || !text) continue;

      // Check if already processed (idempotent)
      const processedRef = db
        .collection('artifacts').doc(APP_ID)
        .collection('processedMentions').doc(postId);
      const already = await processedRef.get();
      if (already.exists) { results.skipped++; continue; }

      try {
        // Analyze food content
        const ai = geminiKey
          ? await analyzeFood(text, geminiKey)
          : { name: '待確認美食', category: '美食收藏', confidence: 0.3 };

        // Resolve master UID for this author
        const mappingSnap = await db
          .collection('artifacts').doc(APP_ID)
          .collection('threadMappings').doc(author).get();
        const masterUid = mappingSnap.data()?.uid || `threads_${author}`;

        // Save to user's food library
        const docData = {
          name:           ai.name || '待確認美食',
          address:        ai.address || '',
          areaHint:       ai.areaHint || '',
          category:       ai.category || '美食收藏',
          note:           ai.aiNote || '已從 Threads 標記記下。',
          confidence:     Math.max(0, Math.min(1, Number(ai.confidence || 0.5))),
          placeStatus:    ai.address ? 'needs_review' : 'unverified',
          source:         'threads_mention',
          sourceText:     text,
          threadsUrl:     postCode ? `https://www.threads.net/t/${postCode}` : '',
          sourceAuthor:   author,
          recommendedBy:  author,
          savedAt:        FieldValue.serverTimestamp(),
        };

        await db
          .collection('artifacts').doc(APP_ID)
          .collection('users').doc(masterUid)
          .collection('restaurants').add(docData);

        // Mark as processed
        await processedRef.set({
          processedAt: FieldValue.serverTimestamp(),
          author,
          masterUid,
          restaurantName: ai.name,
        });

        // Reply to the post
        const restaurantName = ai.name || '美食';
        const replyText = `收到！已將「${restaurantName}」存入您的 Fabrica 美食庫 🥑\n立即查看：https://project-fabricafoodie.vercel.app`;

        try {
          await replyToPost(postId, replyText, fabrica_uid, sessionId, csrfToken);
        } catch (replyErr) {
          console.error(`Reply failed for ${postId}:`, replyErr.message);
          // Don't fail the whole job if reply fails
        }

        results.processed++;
      } catch (itemErr) {
        console.error(`Error processing mention ${postId}:`, itemErr);
        results.errors.push({ postId, error: itemErr.message });
      }
    }

    return NextResponse.json({
      ok: true,
      ...results,
      mentionsFound: mentionPosts.length,
    });

  } catch (err) {
    console.error('[threads-poller] fatal:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
