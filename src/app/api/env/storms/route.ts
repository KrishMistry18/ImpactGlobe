import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { getStorms } from '@/lib/env/eonet'
import type { EnvLayerData } from '@/store/types'
import { isRateLimited, RATE_LIMITS } from '@/lib/utils/ratelimit'

export const dynamic = 'force-dynamic';

/**
 * GET /api/env/storms
 * Fetch severe storm data from NASA EONET
 * Caches in env_data_cache collection for 15 minutes
 */
export async function GET(request: Request) {
  // Rate limiting
  const identifier = `env-storms-${request.headers.get('x-forwarded-for') || 'unknown'}`
  if (isRateLimited(identifier, RATE_LIMITS.ENV_API)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const docRef = adminDb.collection('env_data_cache').doc('storms')

    // Check cache first
    const cachedDoc = await docRef.get()
    const cached = cachedDoc.exists ? cachedDoc.data() : null

    if (cached?.data && cached.expires_at > new Date().toISOString()) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        },
      })
    }

    // Fetch fresh data
    console.log('Fetching storm data from NASA EONET...')
    const storms = await getStorms()

    const now = new Date()
    const layerData: EnvLayerData = {
      type: 'storms',
      updatedAt: now.toISOString(),
      storms,
    }

    // Cache for 15 minutes
    await docRef.set({
      data: layerData,
      fetched_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 900_000).toISOString(),
    }, { merge: true })

    return NextResponse.json(layerData, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
      },
    })
  } catch (error) {
    console.error('Storms API error:', error)
    
    // Try to return stale data if upstream API is down
    const docRef = adminDb.collection('env_data_cache').doc('storms')
    const staleDoc = await docRef.get()
    const staleData = staleDoc.exists ? staleDoc.data() : null

    if (staleData?.data) {
      console.log('Returning stale storm data due to upstream error')
      return NextResponse.json(
        {
          ...staleData.data,
          warning: 'Using cached data due to upstream service unavailability',
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          },
        }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch storm data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
