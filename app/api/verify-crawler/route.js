import { NextResponse } from 'next/server';
import { FieldValue, getAdminDb } from '../../../lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const appId = 'fabrica-foodie-app';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
];

function normalizeUsername(username = '') {
  return username.replace('@', '').trim().toLowerCase();
}

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Fetch the public Threads profile page for `username` and return the raw HTML.
 * Returns null when the page is blocked or unreachable.
 */
async function fetchThreadsProfileHtml(username) {
  const url = `https://www.threads.net/@${username}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8',
        'Cache-Control': 'no-cache',
      },
      // Next.js: always fetch fresh
      cache: 'no-store',
    });

    if (!res.ok) {
      return { html: null, status: res.status };
    }

    const html = await res.text();
    return { html, status: res.status };
  } catch (err) {
    console.error('[verify-crawler] fetch error:', err);
    return { html: null, status: 0 };
  }
}

/**
 * POST /api/verify-crawler
 *
 * Body: { username: string, expectedCode: string, uid?: string }
 *
 * - uid is the Firebase UID when the user is already signed in with Google.
 *   When provided, the verified Threads username gets bound to that Google account.
 * - When uid is omitted, the record is written under a `threads_<username>` library
 *   so the pure-Threads login path can still read it.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { uid, username, expectedCode } = body;

    if (!username || !expectedCode) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數 (username / expectedCode)' },
        { status: 400 }
      );
    }

    const cleanUsername = normalizeUsername(username);
    const upperCode = expectedCode.trim().toUpperCase();

    // ── Step 1: fetch the public profile page ────────────────────────────────
    const { html, status } = await fetchThreadsProfileHtml(cleanUsername);

    if (!html) {
      // Meta blocked us or the account doesn't exist
      if (status === 404) {
        return NextResponse.json({
          success: false,
          blocked: false,
          message: `找不到 Threads 帳號 @${cleanUsername}，請確認帳號名稱是否正確。`,
        });
      }
      return NextResponse.json({
        success: false,
        blocked: true,
        message: 'Threads 頁面目前無法讀取（Meta 可能暫時封鎖了伺服器請求）。請稍後再試，或改用 Threads API 驗證。',
      });
    }

    // ── Step 2: look for @fabrica_tw AND the verification code in the HTML ───
    const lowerHtml = html.toLowerCase();
    const hasMention = lowerHtml.includes('@fabrica_tw') || lowerHtml.includes('fabrica_tw');
    const hasCode = html.toUpperCase().includes(upperCode);

    console.log(
      `[verify-crawler] @${cleanUsername} — mention=${hasMention}, code=${hasCode}, httpStatus=${status}`
    );

    if (!hasMention || !hasCode) {
      // Give the user a targeted hint
      if (!hasMention && !hasCode) {
        return NextResponse.json({
          success: false,
          message: `在 @${cleanUsername} 的公開頁面中，未偵測到「@fabrica_tw」及「${upperCode}」。請確認貼文已公開，並等待約 5 秒後再試。`,
        });
      }
      if (!hasMention) {
        return NextResponse.json({
          success: false,
          message: `找到驗證碼「${upperCode}」，但沒找到「@fabrica_tw」的標記。請確認貼文內容正確。`,
        });
      }
      return NextResponse.json({
        success: false,
        message: `找到「@fabrica_tw」的標記，但未找到驗證碼「${upperCode}」。請確認複製的驗證碼正確。`,
      });
    }

    // ── Step 3: write verification record to Firestore ───────────────────────
    const db = getAdminDb();
    const now = FieldValue.serverTimestamp();

    // Always write the canonical verifiedUsers record (used by check-verification polling)
    await db
      .collection('artifacts')
      .doc(appId)
      .collection('verifiedUsers')
      .doc(cleanUsername)
      .set(
        {
          username: cleanUsername,
          verificationCode: upperCode,
          verified: true,
          verifiedAt: now,
          source: 'crawler_verification',
          ...(uid ? { boundUid: uid } : {}),
        },
        { merge: true }
      );

    // If a Google UID was supplied, bind the Threads username to that user doc
    if (uid) {
      await db
        .collection('artifacts')
        .doc(appId)
        .collection('users')
        .doc(uid)
        .set(
          {
            threadsUsername: cleanUsername,
            threadsVerified: true,
            threadsVerifiedAt: now,
          },
          { merge: true }
        );
    }

    // Write the username→uid mapping so webhook writes land in the right library
    await db
      .collection('artifacts')
      .doc(appId)
      .collection('threadMappings')
      .doc(cleanUsername)
      .set(
        { uid: uid || `threads_${cleanUsername}`, updatedAt: now },
        { merge: true }
      );

    return NextResponse.json({
      success: true,
      message: `🎉 驗證成功！@${cleanUsername} 已綁定至您的帳號。`,
      username: cleanUsername,
    });
  } catch (err) {
    console.error('[verify-crawler] error:', err);
    return NextResponse.json(
      { success: false, message: '伺服器發生錯誤，請稍後再試。' },
      { status: 500 }
    );
  }
}
