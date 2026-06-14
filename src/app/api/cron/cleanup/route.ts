import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000  // 3 days retention window
const CLEANUP_INTERVAL_MS  =  6 * 60 * 60 * 1000  // run at most every 6 hours

// In-memory fallback for last run time
let lastRunInMemory: Date | null = null

async function deleteInBatches(query: FirebaseFirestore.Query) {
  let deletedCount = 0;
  
  while (true) {
    const snapshot = await query.limit(500).get();
    if (snapshot.empty) break;

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    
    await batch.commit();
  }
  
  return deletedCount;
}

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  const adminSecret = request.headers.get('x-admin-secret')
  const isDev = process.env.NODE_ENV === 'development'
  const isForced = request.nextUrl.searchParams.get('force') === '1'

  if (!isDev && cronSecret !== process.env.CRON_SECRET && adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Check last run time
  if (!isForced) {
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

    const lastRunDoc = await adminDb.collection('env_data_cache').doc('cleanup_last_run').get()

    if (lastRunDoc.exists) {
      const lastRunData = lastRunDoc.data()
      if (lastRunData?.fetched_at) {
        const lastRun = new Date(lastRunData.fetched_at)
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
  }

  const eventCutoff = new Date(now.getTime() - SEVENTY_TWO_HOURS_MS).toISOString()
  const envCutoff = new Date(now.getTime() - SEVENTY_TWO_HOURS_MS).toISOString()
  const results: Record<string, { deleted?: number; error?: string }> = {}

  console.log(`[Cleanup] Starting purge. Events cutoff: ${eventCutoff} | Env cutoff: ${envCutoff}`)

  // 1. Events
  try {
    const query = adminDb.collection('events').where('created_at', '<', eventCutoff);
    const count = await deleteInBatches(query);

    results.events = { deleted: count }
    console.log(`[Cleanup] events: deleted ${count} (older than 72h)`)
  } catch (e: any) {
    results.events = { error: e.message }
    console.error('[Cleanup] events:', e.message)
  }

  // 2. Event dedup log
  try {
    const query = adminDb.collection('event_dedup_log').where('created_at', '<', envCutoff);
    const count = await deleteInBatches(query);
    
    results.event_dedup_log = { deleted: count }
    console.log(`[Cleanup] event_dedup_log: deleted ${count}`)
  } catch (e: any) {
    results.event_dedup_log = { error: e.message }
    console.warn('[Cleanup] event_dedup_log:', e.message)
  }

  // 3. Environmental data cache
  try {
    let deletedCount = 0;
    while (true) {
      const snapshot = await adminDb.collection('env_data_cache')
        .where('fetched_at', '<', envCutoff)
        .limit(500)
        .get();
        
      if (snapshot.empty) break;
      
      const batch = adminDb.batch();
      snapshot.docs.forEach((doc) => {
        if (doc.id !== 'cleanup_last_run') {
          batch.delete(doc.ref);
          deletedCount++;
        }
      });
      await batch.commit();
    }

    results.env_data_cache = { deleted: deletedCount }
    console.log(`[Cleanup] env_data_cache: deleted ${deletedCount}`)
  } catch (e: any) {
    results.env_data_cache = { error: e.message }
    console.error('[Cleanup] env_data_cache:', e.message)
  }

  // 4. AQI history
  try {
    const query = adminDb.collection('aqi_history').where('recorded_at', '<', envCutoff);
    const count = await deleteInBatches(query);
    
    results.aqi_history = { deleted: count }
    console.log(`[Cleanup] aqi_history: deleted ${count}`)
  } catch (e: any) {
    results.aqi_history = { error: e.message }
    console.warn('[Cleanup] aqi_history:', e.message)
  }

  // 5. Forex cache — reset stale sparklines
  try {
    let updatedCount = 0;
    while (true) {
      const snapshot = await adminDb.collection('forex_cache')
        .where('last_updated', '<', envCutoff)
        .limit(500)
        .get();
        
      if (snapshot.empty) break;
      
      const batch = adminDb.batch();
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { sparkline_data: [] });
        updatedCount++;
      });
      await batch.commit();
    }

    results.forex_cache = { deleted: updatedCount }
    if (updatedCount) console.log(`[Cleanup] forex_cache: reset ${updatedCount} stale sparklines`)
  } catch (e: any) {
    results.forex_cache = { error: e.message }
    console.warn('[Cleanup] forex_cache:', e.message)
  }

  // Record this run
  lastRunInMemory = now // always update in-memory

  try {
    await adminDb.collection('env_data_cache').doc('cleanup_last_run').set({
      data: { eventCutoff, envCutoff, results },
      fetched_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, { merge: true });
  } catch (markerError: any) {
    console.warn('[Cleanup] Could not persist last_run marker:', markerError.message)
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
