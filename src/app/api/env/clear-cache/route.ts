import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldPath } from "firebase-admin/firestore";

async function clearCache(type: string) {
  let query: FirebaseFirestore.Query = adminDb.collection("env_data_cache");
  if (type !== "all") {
    query = query
      .where(FieldPath.documentId(), ">=", type)
      .where(FieldPath.documentId(), "<", type + "\uf8ff");
  }

  const snapshot = await query.get();
  const batch = adminDb.batch();
  let count = 0;

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
    count++;
  });

  if (count > 0) {
    await batch.commit();
  }
  return count;
}

/**
 * GET /api/env/clear-cache?type=temp  (dev only — no auth required)
 * Clears stale cached env data so the next layer load fetches fresh values.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 });
  }
  const type = request.nextUrl.searchParams.get("type") || "all";
  
  try {
    const count = await clearCache(type);
    return NextResponse.json({ success: true, deleted: count, type });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/env/clear-cache?type=aqi
 * Clears cached env data so it refetches fresh.
 * Protected by admin secret.
 */
export async function DELETE(request: NextRequest) {
  const adminSecret = request.headers.get("x-admin-secret");
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") || "all";
  
  try {
    const count = await clearCache(type);
    return NextResponse.json({ success: true, deleted: count, type });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
