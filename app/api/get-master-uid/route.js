import { NextResponse } from "next/server";
import { getAdminDb } from "../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

const appId = "fabrica-foodie-app";

function normalizeUsername(username = "") {
  return username.replace("@", "").trim().toLowerCase();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = normalizeUsername(searchParams.get("username") || "");

    if (!username) {
      return NextResponse.json({ masterUid: null, error: "Missing username" }, { status: 400 });
    }

    const db = getAdminDb();
    const snapshot = await db
      .collection("artifacts")
      .doc(appId)
      .collection("threadMappings")
      .doc(username)
      .get();

    if (!snapshot.exists) {
      // 沒有綁定紀錄，用 threads_ 前綴作為 fallback
      return NextResponse.json({ masterUid: `threads_${username}`, bound: false });
    }

    const data = snapshot.data();
    const masterUid = data?.uid || `threads_${username}`;
    const bound = masterUid && !masterUid.startsWith("threads_");

    return NextResponse.json({ masterUid, bound });
  } catch (error) {
    console.error("[get-master-uid] error:", error);
    return NextResponse.json({ masterUid: null, error: "Server error" }, { status: 500 });
  }
}
