import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/events
 * Fetch all active events with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeRange = searchParams.get('timeRange') || '48h'
    const category = searchParams.get('category')
    const impactLevel = searchParams.get('impactLevel')
    const country = searchParams.get('country')
    const includeExpired = searchParams.get('include_expired') === 'true'

    const supabase = await createClient()

    // Calculate time threshold
    const hoursMap: Record<string, number> = {
      '1h': 1,
      '6h': 6,
      '24h': 24,
      '48h': 48,
    }
    const hours = hoursMap[timeRange] || 48
    const threshold = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    // Build query
    let query = supabase
      .from('events')
      .select('*')
      .gte('published_at', threshold)
      .order('published_at', { ascending: false })

    // Only filter by expiration if not including expired events
    if (!includeExpired) {
      query = query.lte('expires_at', new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString())
    }

    // Apply filters
    if (category) {
      query = query.eq('category', category)
    }
    if (impactLevel) {
      query = query.eq('impact_level', impactLevel)
    }
    if (country) {
      query = query.eq('country', country)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch events:', error)
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      )
    }

    // Transform database format to app format
    const events = data.map((row) => ({
      id: row.id,
      headline: row.headline,
      country: row.country,
      lat: Number(row.lat),
      lon: Number(row.lon),
      impactLevel: row.impact_level,
      category: row.category,
      summary: row.summary,
      sentiment: row.sentiment,
      forexImpacts: row.forex_impacts || [],
      confidenceScore: Number(row.confidence_score),
      isMarketMoving: row.is_market_moving,
      publishedAt: row.published_at,
      expiresAt: row.expires_at,
      sourceUrl: row.source_url,
      createdBy: row.created_by,
    }))

    return NextResponse.json(events, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('Events API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/events
 * Create a new event (authenticated users only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    const requiredFields = [
      'headline',
      'country',
      'lat',
      'lon',
      'impactLevel',
      'category',
      'summary',
      'sentiment',
    ]

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Calculate expiration (48 hours from now)
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    // Insert event
    const { data, error } = await supabase
      .from('events')
      .insert({
        headline: body.headline,
        country: body.country,
        lat: body.lat,
        lon: body.lon,
        impact_level: body.impactLevel,
        category: body.category,
        summary: body.summary,
        sentiment: body.sentiment,
        forex_impacts: body.forexImpacts || [],
        confidence_score: (body.confidenceScore || 0) / 100, // Convert 0-100 to 0-1
        is_market_moving: body.isMarketMoving || false,
        expires_at: expiresAt,
        source_url: body.sourceUrl,
        created_by: body.createdBy || 'manual',
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create event:', error)
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Events POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
