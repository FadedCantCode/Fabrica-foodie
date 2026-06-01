import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "../../../lib/firebaseAdmin";

const appId = "fabrica-foodie-app";
const FABRICA_HANDLE = "@fabrica_tw";

function normalizeUsername(username = "") {
  return username.replace("@", "").trim().toLowerCase();
}

function extractThreadsAuthor(url = "") {
  try {
    const parsed = new URL(url);
    return normalizeUsername(parsed.pathname.match(/\/@([^/]+)/)?.[1] || "");
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
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchThreadsPageText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome Safari",
      "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`Threads page returned ${response.status}`);
  }

  return stripHtml(await response.text()).slice(0, 20000);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const username = normalizeUsername(body?.username || "");
    const code = String(body?.code || "").trim().toUpperCase();
    const proofUrl = String(body?.proofUrl || "").trim();

    if (!username || !code || !proofUrl) {
      return NextResponse.json({ verified: false, error: "Missing username, code, or proofUrl" }, { status: 400 });
    }

    const proofAuthor = extractThreadsAuthor(proofUrl);
    if (proofAuthor && proofAuthor !== username) {
      return NextResponse.json(
        { verified: false, error: "Proof URL username does not match" },
        { status: 400 }
      );
    }

    const pageText = await fetchThreadsPageText(proofUrl);
    const lowerText = pageText.toLowerCase();
    const hasHandle = lowerText.includes(FABRICA_HANDLE);
    const hasCode = pageText.toUpperCase().includes(code);

    if (!hasHandle || !hasCode) {
      return NextResponse.json({
        verified: false,
        error: "Proof page does not contain the Fabrica verification text"
      });
    }

    const db = getAdminDb();
    await db.collection("artifacts").doc(appId).collection("verifiedUsers").doc(username).set(
      {
        username,
        verificationCode: code,
        verified: true,
        verifiedAt: FieldValue.serverTimestamp(),
        source: "threads_proof_url",
        proofUrl
      },
      { merge: true }
    );

    return NextResponse.json({ verified: true, username });
  } catch (error) {
    console.error("Threads proof verification failed:", error);
    return NextResponse.json(
      {
        verified: false,
        error: "Unable to verify proof URL"
      },
      { status: 500 }
    );
  }
}
