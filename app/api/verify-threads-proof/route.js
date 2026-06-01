import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

const appId = "fabrica-foodie-app";

function normalizeUsername(username = "") {
  return username.replace("@", "").trim().toLowerCase();
}

async function findVerificationPostViaApi(username, code) {
  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  if (!accessToken) throw new Error("THREADS_ACCESS_TOKEN not configured");

  // Step 1: 用 username 查 user ID
  const userRes = await fetch(
    `https://graph.threads.net/v1.0/${username}?fields=id,username`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!userRes.ok) {
    const err = await userRes.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `Cannot find Threads user: ${username}`
    );
  }
  const userData = await userRes.json();
  const userId = userData.id;

  // Step 2: 查最新 25 篇貼文
  const postsRes = await fetch(
    `https://graph.threads.net/v1.0/${userId}/threads?fields=id,text&limit=25`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!postsRes.ok) {
    const err = await postsRes.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || "Cannot fetch user's Threads posts"
    );
  }
  const postsData = await postsRes.json();
  const posts = postsData.data || [];

  const upperCode = code.toUpperCase();
  const found = posts.find(
    (p) =>
      p.text &&
      p.text.toLowerCase().includes("@fabrica_tw") &&
      p.text.toUpperCase().includes(upperCode)
  );

  return found || null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const username = normalizeUsername(body?.username || "");
    const code = String(body?.code || "").trim().toUpperCase();

    if (!username || !code) {
      return NextResponse.json(
        { verified: false, error: "Missing username or code" },
        { status: 400 }
      );
    }

    const post = await findVerificationPostViaApi(username, code);

    if (!post) {
      return NextResponse.json({
        verified: false,
        error:
          "找不到包含驗證碼的公開貼文。請確認貼文是公開的，且包含 @fabrica_tw verify " +
          code,
      });
    }

    const db = getAdminDb();
    await db
      .collection("artifacts")
      .doc(appId)
      .collection("verifiedUsers")
      .doc(username)
      .set(
        {
          username,
          verificationCode: code,
          verified: true,
          verifiedAt: FieldValue.serverTimestamp(),
          source: "threads_api_scan",
          proofPostId: post.id,
        },
        { merge: true }
      );

    return NextResponse.json({ verified: true, username });
  } catch (error) {
    console.error("Threads proof verification failed:", error);
    return NextResponse.json(
      { verified: false, error: error.message || "Unable to verify" },
      { status: 500 }
    );
  }
}
