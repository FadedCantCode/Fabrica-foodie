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
const FABRICA_HANDLE  = 'fabrica_tw';
const FABRICA_MENTION = '@fabrica_tw';
// Only process posts that contain these trigger phrases (case-insensitive)
// User must write "@fabrica_tw 存起來" or "@fabrica_tw 幫我存" etc.
const TRIGGER_PHRASES = ['存起來', '幫我存', '收藏', '存下來', 'save'];
const INSTAGRAM_API = 'https://i.instagram.com';
const MOBILE_UA     = 'Barcelona 337.0.0.29.118 Android';

// ─── Trigger check ───────────────────────────────────────────────────────────
function isTriggered(text) {
  const lower = text.toLowerCase();
  if (!lower.includes(FABRICA_MENTION.toLowerCase())) return false;
  return TRIGGER_PHRASES.some(phrase => lower.includes(phrase.toLowerCase()));
}

// ─── Threads client (inline, no npm install needed) ──────────────────────────
function makeHeaders(sessionId, csrfToken) {
  return {
    'cookie':          `sessionid=${sessionId}; csrftoken=${csrfToken}`,
    'x-csrftoken':     csrfToken,
    'x-ig-app-id':     '238260118697367',
    'user-agent':      MOBILE_UA,
    'sec-fetch-site':  'same-origin',
    'sec-fetch-mode':  'cors',
    'sec-fetch-dest':  'empty',
    'accept':          '*/*',
  };
}

async function igGet(path, sessionId, csrfToken) {
  const res = await fetch(`${INSTAGRAM_API}${path}`, {
    headers: makeHeaders(sessionId, csrfToken),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`IG API ${res.status}: ${path} | ${body.slice(0, 150)}`);
  }
  const text = await res.text();
  if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
    throw new Error(`Auth failed (got HTML): ${path}`);
  }
  return JSON.parse(text);
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
  // Use env var directly if available (avoids one API call)
  const envUserId = process.env.THREADS_USER_ID;
  if (envUserId && handle.toLowerCase() === FABRICA_HANDLE.toLowerCase()) {
    return envUserId;
  }
  const data = await igGet(
    `/api/v1/users/search/?q=${encodeURIComponent(handle)}`,
    sessionId, csrfToken
  );
  const users = data.users || [];
  const user = users.find(u => u.username?.toLowerCase() === handle.toLowerCase());
  return user ? String(user.pk || user.id) : null;
}

// Get recent posts for a user
async function getUserPosts(userId, sessionId, csrfToken, returnRaw = false) {
  const data = await igGet(
    `/api/v1/text_feed/${userId}/profile/`,
    sessionId, csrfToken
  );
  if (returnRaw) return data; // for debug

  // Handle all possible response structures (threads, items, medias)
  const threads = data.threads || data.items || data.medias || data.media_or_ads || [];
  const posts = [];

  for (const thread of threads) {
    // Structure 1: thread has thread_items array
    if (thread.thread_items?.length > 0) {
      const post = thread.thread_items[0].post || thread.thread_items[0];
      posts.push({
        id:       String(post.pk || post.id || ''),
        code:     post.code || '',
        text:     post.caption?.text || post.text || '',
        author:   post.user?.username || '',
        authorId: String(post.user?.pk || ''),
        timestamp: post.taken_at || 0,
      });
    }
    // Structure 2: thread.post
    else if (thread.post) {
      const post = thread.post;
      posts.push({
        id:       String(post.pk || post.id || ''),
        code:     post.code || '',
        text:     post.caption?.text || post.text || '',
        author:   post.user?.username || '',
        authorId: String(post.user?.pk || ''),
        timestamp: post.taken_at || 0,
      });
    }
    // Structure 3: thread itself is the post
    else if (thread.pk || thread.code) {
      posts.push({
        id:       String(thread.pk || thread.id || ''),
        code:     thread.code || '',
        text:     thread.caption?.text || thread.text || '',
        author:   thread.user?.username || '',
        authorId: String(thread.user?.pk || ''),
        timestamp: thread.taken_at || 0,
      });
    }
  }
  return posts;
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

// ─── Web scraping helpers ─────────────────────────────────────────────────────
async function fetchThreadsPage(url, sessionId, csrfToken) {
  const res = await fetch(url, {
    headers: {
      'cookie':       `sessionid=${sessionId}; csrftoken=${csrfToken}`,
      'user-agent':   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'accept':       'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8',
      'referer':      'https://www.threads.net/',
    },
  });
  if (!res.ok) throw new Error(`Web ${res.status}: ${url}`);
  return res.text();
}

function parseThreadsMentionsFromHtml(html) {
  // Extract __NEXT_DATA__ or similar JSON embedded in the page
  const nextDataMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!nextDataMatch) return [];
  try {
    const data = JSON.parse(nextDataMatch[1]);
    // Navigate the Next.js page props to find notification items
    const pageProps = data?.props?.pageProps || {};
    const notifications = pageProps?.notifications || 
                          pageProps?.initialData?.notifications || [];
    return notifications
      .filter(n => n?.type === 'mention' || n?.args?.text?.includes('@fabrica_tw'))
      .map(n => ({
        id:       String(n.args?.media?.id || ''),
        code:     n.args?.media?.code || '',
        text:     n.args?.text || '',
        author:   n.args?.profile_name || '',
        authorId: String(n.args?.sender_id || ''),
        timestamp: n.args?.timestamp || 0,
      }))
      .filter(p => p.id && p.text);
  } catch { return []; }
}

async function fetchThreadsGraphQL(userId, sessionId, csrfToken) {
  // Threads web uses a GraphQL endpoint for notifications
  const res = await fetch('https://www.threads.net/api/graphql', {
    method: 'POST',
    headers: {
      'cookie':          `sessionid=${sessionId}; csrftoken=${csrfToken}`,
      'x-csrftoken':     csrfToken,
      'x-ig-app-id':     '238260118697367',
      'content-type':    'application/x-www-form-urlencoded',
      'user-agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'x-fb-friendly-name': 'BarcelonaNotificationsListQuery',
    },
    body: new URLSearchParams({
      variables: JSON.stringify({ first: 20 }),
      doc_id: '7358236884218726', // Threads notifications query doc ID
    }).toString(),
  });
  if (!res.ok) throw new Error(`GraphQL ${res.status}`);
  const data = await res.json();
  
  const edges = data?.data?.viewer?.threadsNotifications?.edges || [];
  return edges
    .map(e => {
      const n = e?.node;
      const text = n?.text?.text || n?.narrative_text?.text || '';
      const mediaId = n?.media?.id || '';
      return {
        id:       String(mediaId),
        code:     n?.media?.code || '',
        text,
        author:   n?.user?.username || '',
        authorId: String(n?.user?.id || ''),
        timestamp: n?.taken_at || 0,
      };
    })
    .filter(p => p.id && p.text);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(request) {
  // Allow Vercel Cron, Authorization header, or ?secret= query param
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    const urlSecret  = new URL(request.url).searchParams.get('secret');
    if (authHeader !== `Bearer ${cronSecret}` && urlSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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

  const isDebug = new URL(request.url).searchParams.get('debug') === '1';

  try {
    // 1. Get @fabrica_tw user ID
    const fabrica_uid = await getUserId(FABRICA_HANDLE, sessionId, csrfToken);
    if (!fabrica_uid) throw new Error('Cannot find @fabrica_tw user ID');

    if (isDebug) {
      // Debug mode: return raw API data to diagnose what's available
      const debugInfo = { fabrica_uid, inbox: null, inboxError: null, ownPosts: [], userPosts: [] };
      
      try {
        const notifData = await igGet('/api/v1/news/inbox/', sessionId, csrfToken);
        const stories = [...(notifData.new_stories || []), ...(notifData.old_stories || [])];
        debugInfo.inbox = {
          storyCount: stories.length,
          sample: stories.slice(0, 3).map(s => ({
            type: s.type,
            text: s.args?.text?.slice(0, 100),
            profile_name: s.args?.profile_name,
            media_id: s.args?.media?.id,
          })),
        };
      } catch(e) {
        debugInfo.inboxError = e.message;
      }

      try {
        const rawPosts = await getUserPosts(fabrica_uid, sessionId, csrfToken, true);
        // Show raw keys to understand structure
        debugInfo.rawPostsKeys = Object.keys(rawPosts);
        debugInfo.rawPostsSample = JSON.stringify(rawPosts).slice(0, 500);
        // Also try parsed
        const posts = await getUserPosts(fabrica_uid, sessionId, csrfToken);
        debugInfo.ownPosts = posts.slice(0, 5).map(p => ({
          id: p.id, author: p.author,
          text: p.text?.slice(0, 80),
        }));
      } catch(e) {
        debugInfo.ownPostsError = e.message;
      }

      // Test web scraping
      try {
        const html = await fetchThreadsPage(
          'https://www.threads.net/notifications/',
          sessionId, csrfToken
        );
        debugInfo.notifHtmlLength = html.length;
        debugInfo.hasNextData = html.includes('__NEXT_DATA__');
        debugInfo.webMentions = parseThreadsMentionsFromHtml(html).slice(0, 3);
      } catch(e) {
        debugInfo.webScrapeError = e.message;
      }
      
      // Test GraphQL
      try {
        const gqlMentions = await fetchThreadsGraphQL(fabrica_uid, sessionId, csrfToken);
        debugInfo.gqlMentions = gqlMentions.slice(0, 3);
      } catch(e) {
        debugInfo.gqlError = e.message;
      }

      return NextResponse.json({ debug: true, ...debugInfo });
    }

    // 2. Find mentions via Threads web scraping
    // Instagram mobile API inbox is blocked (500), so we scrape the web notifications
    let mentionPosts = [];

    // Strategy: scrape https://www.threads.net/notifications/
    // This requires the session cookie and returns HTML with notification data
    try {
      const notifHtml = await fetchThreadsPage(
        'https://www.threads.net/notifications/',
        sessionId, csrfToken
      );
      const webMentions = parseThreadsMentionsFromHtml(notifHtml);
      mentionPosts = webMentions.filter(p => isTriggered(p.text));
      console.log(`Web scrape: ${webMentions.length} mentions found, ${mentionPosts.length} triggered`);
    } catch(e) {
      console.log('Web scrape failed:', e.message);
    }

    // Fallback: try graphql endpoint that Threads web uses
    if (mentionPosts.length === 0) {
      try {
        const gqlMentions = await fetchThreadsGraphQL(fabrica_uid, sessionId, csrfToken);
        mentionPosts = gqlMentions.filter(p => isTriggered(p.text));
        console.log(`GraphQL: ${gqlMentions.length} mentions, ${mentionPosts.length} triggered`);
      } catch(e) {
        console.log('GraphQL failed:', e.message);
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
