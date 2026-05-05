import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      console.error('Failed to fetch event:', error)
      return NextResponse.json(
        { error: 'Failed to fetch event' },
        { status: 500 }
      )
    }

    // Transform to app format
    const event = {
      id: data.id,
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
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase.from('events').delete().eq('id', id)

    if (error) {
      console.error('Failed to delete event:', error)
      return NextResponse.json(
        { error: 'Failed to delete event' },
        { status: 500 }
      )
    }

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
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
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

    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update event:', error)
      return NextResponse.json(
        { error: 'Failed to update event' },
        { status: 500 }
      )
    }

    // Transform to app format
    const event = {
      id: data.id,
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
