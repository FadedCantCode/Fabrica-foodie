// app/api/nearby/route.js
// Proxy for Foursquare Places API — keeps API key server-side
// Filters out closed venues and returns clean data for Fabrica

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CLOSED_KEYWORDS = ['歇業', '停業', '關閉', '已關', '暫停', 'closed', '結束營業'];

function isClosed(place) {
  // Foursquare closed_bucket field
  if (place.closed_bucket === 'VeryLikelyClosed' || place.closed_bucket === 'LikelyClosed') return true;
  // Name contains closed keywords
  const name = (place.name || '').toLowerCase();
  if (CLOSED_KEYWORDS.some(k => name.includes(k))) return true;
  return false;
}

function mapCategory(categories = []) {
  const cat = categories[0]?.name || '';
  if (cat.includes('火鍋') || cat.includes('Hot Pot')) return '火鍋專賣';
  if (cat.includes('咖啡') || cat.includes('Coffee') || cat.includes('Café')) return '咖啡甜點';
  if (cat.includes('拉麵') || cat.includes('Ramen') || cat.includes('日式') || cat.includes('Sushi')) return '日式料理';
  if (cat.includes('燒肉') || cat.includes('Yakiniku') || cat.includes('BBQ')) return '燒肉串燒';
  if (cat.includes('甜點') || cat.includes('Dessert') || cat.includes('Bakery')) return '咖啡甜點';
  if (cat.includes('飲料') || cat.includes('Tea') || cat.includes('Bubble')) return '手搖茶攤';
  if (cat) return cat;
  return '精選美食';
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat    = parseFloat(searchParams.get('lat') || '0');
  const lng    = parseFloat(searchParams.get('lng') || '0');
  const radius = parseInt(searchParams.get('radius') || '1000');
  const limit  = parseInt(searchParams.get('limit') || '15');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing lat/lng' }, { status: 400 });
  }

  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'FOURSQUARE_API_KEY not configured' }, { status: 500 });
  }

  try {
    // Foursquare Places API v3 — nearby search
    // Categories: 13000 = Food, 13065 = Restaurant
    const url = new URL('https://api.foursquare.com/v3/places/nearby');
    url.searchParams.set('ll', `${lat},${lng}`);
    url.searchParams.set('radius', radius.toString());
    url.searchParams.set('categories', '13000'); // Food & Drink
    url.searchParams.set('limit', Math.min(limit * 2, 50).toString()); // fetch extra to account for filtered ones
    url.searchParams.set('fields', 'fsq_id,name,location,categories,distance,closed_bucket,rating,popularity');
    url.searchParams.set('sort', 'DISTANCE');

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[nearby] Foursquare error:', res.status, err);
      return NextResponse.json({ error: `Foursquare API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const results = data.results || [];

    // Filter closed + format
    const places = results
      .filter(p => !isClosed(p))
      .slice(0, limit)
      .map(p => ({
        id:       p.fsq_id,
        name:     p.name,
        address:  [
          p.location?.address,
          p.location?.locality,
          p.location?.region,
        ].filter(Boolean).join(', ') || p.location?.formatted_address || '',
        category: mapCategory(p.categories),
        distance: p.distance,
        lat:      p.location?.lat,
        lng:      p.location?.lng,
        rating:   p.rating,
      }));

    return NextResponse.json({ places, total: places.length });

  } catch (err) {
    console.error('[nearby] fatal:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
