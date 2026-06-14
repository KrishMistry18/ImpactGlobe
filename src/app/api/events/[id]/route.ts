import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase/admin'

/**
 * GET /api/events/[id]
 * Fetch a single event by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const docRef = await adminDb.collection('events').doc(id).get()

    if (!docRef.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const data = docRef.data()!

    // Transform to app format
    const event = {
      id: docRef.id,
      headline: data.headline,
      country: data.country,
      lat: Number(data.lat),
      lon: Number(data.lon),
      impactLevel: data.impact_level,
      category: data.category,
      summary: data.summary,
      sentiment: data.sentiment,
      forexImpacts: data.forex_impacts || [],
      confidenceScore: Number(data.confidence_score) * 100,
      isMarketMoving: data.is_market_moving,
      publishedAt: data.published_at,
      expiresAt: data.expires_at,
      sourceUrl: data.source_url,
      createdBy: data.created_by,
    }

    return NextResponse.json(event, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Event fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/events/[id]
 * Delete an event (authenticated users only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Check authentication
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

    await adminDb.collection('events').doc(id).delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Event delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/events/[id]
 * Update an event (authenticated users only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Check authentication
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

    // Build update object (only include provided fields)
    const updates: Record<string, unknown> = {}

    if (body.headline !== undefined) updates.headline = body.headline
    if (body.country !== undefined) updates.country = body.country
    if (body.lat !== undefined) updates.lat = body.lat
    if (body.lon !== undefined) updates.lon = body.lon
    if (body.impactLevel !== undefined) updates.impact_level = body.impactLevel
    if (body.category !== undefined) updates.category = body.category
    if (body.summary !== undefined) updates.summary = body.summary
    if (body.sentiment !== undefined) updates.sentiment = body.sentiment
    if (body.forexImpacts !== undefined) updates.forex_impacts = body.forexImpacts
    if (body.confidenceScore !== undefined)
      updates.confidence_score = body.confidenceScore / 100
    if (body.isMarketMoving !== undefined)
      updates.is_market_moving = body.isMarketMoving

    await adminDb.collection('events').doc(id).update(updates)

    const updatedDoc = await adminDb.collection('events').doc(id).get()
    const data = updatedDoc.data()!

    // Transform to app format
    const event = {
      id: updatedDoc.id,
      headline: data.headline,
      country: data.country,
      lat: Number(data.lat),
      lon: Number(data.lon),
      impactLevel: data.impact_level,
      category: data.category,
      summary: data.summary,
      sentiment: data.sentiment,
      forexImpacts: data.forex_impacts || [],
      confidenceScore: Number(data.confidence_score) * 100,
      isMarketMoving: data.is_market_moving,
      publishedAt: data.published_at,
      expiresAt: data.expires_at,
      sourceUrl: data.source_url,
      createdBy: data.created_by,
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Event update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
