import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000  // events retention window
const SIX_HOURS_MS         =  6 * 60 * 60 * 1000  // env cache / dedup retention
const CLEANUP_INTERVAL_MS  =  1 * 60 * 60 * 1000  // run at most every 1 hour

// In-memory fallback for last run time (used if DB constraint blocks the marker row)
let lastRunInMemory: Date | null = null

/**
 * GET /api/cron/cleanup
 *
 * Purges all data older than 6 hours across every table to ensure fresh, real-time data.
 *
 * RESILIENT DESIGN — no fixed time dependency:
 *   - Tracks last successful run in env_data_cache (key: 'cleanup_last_run')
 *   - On every call, checks if 1+ hours have passed since last run
 *   - If yes → purge. If no → skip (idempotent, safe to call frequently)
 *   - This means even if the server was offline, the cleanup
 *     will fire on the next heartbeat after it comes back online.
 *
 * Called by:
 *   - Vercel cron: every hour
 *   - Dev heartbeat: every hour (minute === 0)
 *   - Manually: any time with admin/cron secret
 *
 * Tables cleaned (data older than 6 hours):
 *   events            → created_at
 *   event_dedup_log   → created_at
 *   env_data_cache    → fetched_at  (zone data: wind, temp, AQI, sea temp)
 *   aqi_history       → recorded_at
 *   forex_cache       → last_updated (reset stale sparklines only)
 */
export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  const adminSecret = request.headers.get('x-admin-secret')
  const isDev = process.env.NODE_ENV === 'development'
  const isForced = request.nextUrl.searchParams.get('force') === '1'

  if (!isDev && cronSecret !== process.env.CRON_SECRET && adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  // ── Check last run time ────────────────────────────────────────────────────
  if (!isForced) {
    // Check in-memory first (fast, works even without DB migration)
    if (lastRunInMemory) {
      const msSince = now.getTime() - lastRunInMemory.getTime()
      if (msSince < CLEANUP_INTERVAL_MS) {
        const nextIn = Math.round((CLEANUP_INTERVAL_MS - msSince) / 60_000)
        return NextResponse.json({
          success: true, skipped: true,
          reason: `Last cleanup ${Math.round(msSince / 60_000)}min ago (in-memory). Next in ~${nextIn}min.`,
          nextRunInMinutes: nextIn,
        })
      }
    }

    // Also check DB (persists across server restarts)
    const { data: lastRunRow } = await supabase
      .from('env_data_cache')
      .select('fetched_at')
      .eq('layer_type', 'cleanup_last_run')
      .single()

    if (lastRunRow?.fetched_at) {
      const lastRun = new Date(lastRunRow.fetched_at)
      const msSince = now.getTime() - lastRun.getTime()
      if (msSince < CLEANUP_INTERVAL_MS) {
        const nextIn = Math.round((CLEANUP_INTERVAL_MS - msSince) / 60_000)
        lastRunInMemory = lastRun // sync to memory
        return NextResponse.json({
          success: true, skipped: true,
          reason: `Last cleanup ${Math.round(msSince / 60_000)}min ago (DB). Next in ~${nextIn}min.`,
          nextRunInMinutes: nextIn,
        })
      }
    }
  }

  // Events use a 48-hour retention window so playback always has 2 days of history.
  const eventCutoff = new Date(now.getTime() - FORTY_EIGHT_HOURS_MS).toISOString()
  // Env cache + dedup still use 6h — that data is refreshed frequently.
  const envCutoff = new Date(now.getTime() - SIX_HOURS_MS).toISOString()
  const results: Record<string, { deleted?: number; error?: string }> = {}

  console.log(`[Cleanup] Starting purge. Events cutoff: ${eventCutoff} | Env cutoff: ${envCutoff}`)

  // ── 1. Events ──────────────────────────────────────────────────────────────
  try {
    const { error, count } = await supabase
      .from('events')
      .delete({ count: 'exact' })
      .lt('created_at', eventCutoff)

    if (error) throw error
    results.events = { deleted: count ?? 0 }
    console.log(`[Cleanup] events: deleted ${count ?? 0} (older than 48h)`)
  } catch (e: any) {
    results.events = { error: e.message }
    console.error('[Cleanup] events:', e.message)
  }

  // ── 2. Event dedup log ─────────────────────────────────────────────────────
  try {
    const { error, count } = await supabase
      .from('event_dedup_log')
      .delete({ count: 'exact' })
      .lt('created_at', envCutoff)

    if (error && error.message.includes('schema cache')) {
      results.event_dedup_log = { deleted: 0 } // table not created yet — skip silently
    } else if (error) {
      throw error
    } else {
      results.event_dedup_log = { deleted: count ?? 0 }
      console.log(`[Cleanup] event_dedup_log: deleted ${count ?? 0}`)
    }
  } catch (e: any) {
    results.event_dedup_log = { error: e.message }
    console.warn('[Cleanup] event_dedup_log:', e.message)
  }

  // ── 3. Environmental data cache ────────────────────────────────────────────
  // Delete zone rows older than 3 days (but keep the cleanup_last_run marker)
  try {
    const { error, count } = await supabase
      .from('env_data_cache')
      .delete({ count: 'exact' })
      .lt('fetched_at', envCutoff)
      .neq('layer_type', 'cleanup_last_run')

    if (error) throw error
    results.env_data_cache = { deleted: count ?? 0 }
    console.log(`[Cleanup] env_data_cache: deleted ${count ?? 0}`)
  } catch (e: any) {
    results.env_data_cache = { error: e.message }
    console.error('[Cleanup] env_data_cache:', e.message)
  }

  // ── 4. AQI history ─────────────────────────────────────────────────────────
  try {
    const { error, count } = await supabase
      .from('aqi_history')
      .delete({ count: 'exact' })
      .lt('recorded_at', envCutoff)

    if (error) throw error
    results.aqi_history = { deleted: count ?? 0 }
    console.log(`[Cleanup] aqi_history: deleted ${count ?? 0}`)
  } catch (e: any) {
    results.aqi_history = { error: e.message }
    console.warn('[Cleanup] aqi_history:', e.message)
  }

  // ── 5. Forex cache — reset stale sparklines ────────────────────────────────
  // Rows are upserted (never deleted), but sparkline arrays become stale.
  // Reset any pair not updated in 6 hours so it refetches fresh data.
  try {
    const { error, count } = await supabase
      .from('forex_cache')
      .update({ sparkline_data: [] })
      .lt('last_updated', envCutoff)

    if (error) throw error
    results.forex_cache = { deleted: count ?? 0 }
    if (count) console.log(`[Cleanup] forex_cache: reset ${count} stale sparklines`)
  } catch (e: any) {
    results.forex_cache = { error: e.message }
    console.warn('[Cleanup] forex_cache:', e.message)
  }

  // ── Record this run ────────────────────────────────────────────────────────
  lastRunInMemory = now // always update in-memory

  // Try to persist to DB (requires SQL migration to be run)
  const { error: markerError } = await supabase.from('env_data_cache').upsert({
    layer_type: 'cleanup_last_run',
    data: { eventCutoff, envCutoff, results },
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
  if (markerError) {
    console.warn('[Cleanup] Could not persist last_run marker (run SQL migration):', markerError.message)
  }

  const totalDeleted = Object.values(results).reduce((sum, r) => sum + (r.deleted ?? 0), 0)
  const errors = Object.entries(results)
    .filter(([, r]) => r.error)
    .map(([t, r]) => `${t}: ${r.error}`)

  console.log(`[Cleanup] ✅ Done. Total purged: ${totalDeleted} rows. Event cutoff: ${eventCutoff}`)

  return NextResponse.json({
    success: true,
    eventCutoff,
    envCutoff,
    totalDeleted,
    results,
    errors: errors.length > 0 ? errors : undefined,
    nextRunIn: `${CLEANUP_INTERVAL_MS / 3600_000} hours`,
  })
}
