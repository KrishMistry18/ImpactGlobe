import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/env/clear-cache?type=temp  (dev only — no auth required)
 * Clears stale cached env data so the next layer load fetches fresh values.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 });
  }
  const type = request.nextUrl.searchParams.get("type") || "all";
  const supabase = createAdminClient();
  let query = supabase.from("env_data_cache").delete();
  if (type === "all") {
    query = query.neq("layer_type", "KEEP_NOTHING");
  } else {
    query = query.like("layer_type", `${type}%`);
  }
  const { error, count } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, deleted: count, type });
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
  const supabase = createAdminClient();

  let query = supabase.from("env_data_cache").delete();

  if (type === "all") {
    query = query.neq("layer_type", "KEEP_NOTHING"); // delete all
  } else {
    query = query.like("layer_type", `${type}%`);
  }

  const { error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: count, type });
}
