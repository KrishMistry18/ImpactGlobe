import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecentEarthquakes } from '@/lib/env/usgs'
import type { EnvLayerData } from '@/store/types'
import { isRateLimited, RATE_LIMITS } from '@/lib/utils/ratelimit'

/**
 * GET /api/env/earthquakes
 * Fetch earthquake data from USGS
 * Caches in env_data_cache table for 5 minutes
 */
export async function GET(request: Request) {
  // Rate limiting
  const identifier = `env-earthquakes-${request.headers.get('x-forwarded-for') || 'unknown'}`
  if (isRateLimited(identifier, RATE_LIMITS.ENV_API)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const supabase = await createClient()

    // Check cache first
    const { data: cached } = await supabase
      .from('env_data_cache')
      .select('*')
      .eq('layer_type', 'earthquakes')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (cached?.data) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      })
    }

    // Fetch fresh data
    console.log('Fetching earthquake data from USGS...')
    const earthquakes = await getRecentEarthquakes()

    const now = new Date()
    const layerData: EnvLayerData = {
      type: 'earthquakes',
      updatedAt: now.toISOString(),
      earthquakes,
    }

    // Cache for 5 minutes
    await supabase.from('env_data_cache').upsert({
      layer_type: 'earthquakes',
      data: layerData,
      fetched_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 300_000).toISOString(),
    })

    return NextResponse.json(layerData, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Earthquakes API error:', error)
    
    // Try to return stale data if upstream API is down
    const supabase = await createClient()
    const { data: staleData } = await supabase
      .from('env_data_cache')
      .select('*')
      .eq('layer_type', 'earthquakes')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single()

    if (staleData?.data) {
      console.log('Returning stale earthquake data due to upstream error')
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
        error: 'Failed to fetch earthquake data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
