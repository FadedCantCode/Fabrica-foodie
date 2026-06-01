import { NextResponse } from "next/server";
import { getAdminDb } from "../../../lib/firebaseAdmin";

const appId = "fabrica-foodie-app";

function normalizeUsername(username = "") {
  return username.replace("@", "").trim().toLowerCase();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = normalizeUsername(searchParams.get("username") || "");
    const code = (searchParams.get("code") || "").trim().toUpperCase();

    if (!username || !code) {
      return NextResponse.json({ verified: false, error: "Missing username or code" }, { status: 400 });
    }

    const db = getAdminDb();
    const snapshot = await db
      .collection("artifacts")
      .doc(appId)
      .collection("verifiedUsers")
      .doc(username)
      .get();

    const data = snapshot.data();
    const verified = Boolean(data?.verified && data?.verificationCode === code);

    return NextResponse.json({
      verified,
      username,
      verifiedAt: data?.verifiedAt || null
    });
  } catch (error) {
    console.error("Verification check failed:", error);
    return NextResponse.json(
      {
        verified: false,
        error: "Verification check failed"
      },
      { status: 500 }
    );
  }
}
