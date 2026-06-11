import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic';

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
    let eventsRef: FirebaseFirestore.Query = adminDb.collection('events')

    eventsRef = eventsRef
      .where('published_at', '>=', threshold)
      .orderBy('published_at', 'desc')

    // Apply filters
    if (category) {
      eventsRef = eventsRef.where('category', '==', category)
    }
    if (impactLevel) {
      eventsRef = eventsRef.where('impact_level', '==', impactLevel)
    }
    if (country) {
      eventsRef = eventsRef.where('country', '==', country)
    }

    const snapshot = await eventsRef.get()
    let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))

    // Firebase queries only support one inequality filter per query, 
    // so we handle expiration filter in memory if necessary.
    if (!includeExpired) {
      const expirationThreshold = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      data = data.filter(row => row.expires_at <= expirationThreshold)
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
      confidenceScore: Number(row.confidence_score) * (row.confidence_score <= 1 ? 100 : 1), // Handle 0-1 scale conversion
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
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split('Bearer ')[1]
    
    try {
      await adminAuth.verifyIdToken(token)
    } catch (e) {
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
    const publishedAt = new Date().toISOString()

    const newEvent = {
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
      published_at: publishedAt,
      expires_at: expiresAt,
      source_url: body.sourceUrl || null,
      created_by: body.createdBy || 'manual',
    }

    // Insert event
    const docRef = await adminDb.collection('events').add(newEvent)
    const data = { id: docRef.id, ...newEvent }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Events POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
