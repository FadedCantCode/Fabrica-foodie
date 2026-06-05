// app/api/nearby/route.js
// Foursquare NEW Places API (post May 2026)
// Endpoint: places-api.foursquare.com/places/search
// Auth: Bearer token + X-Places-Api-Version header

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CLOSED_KEYWORDS = ['歇業', '停業', '關閉', '已關', '暫停', 'closed', '結束營業'];

function isClosed(place) {
  if (CLOSED_KEYWORDS.some(k => (place.name || '').toLowerCase().includes(k))) return true;
  return false;
}

function mapCategory(categories = []) {
  const cat = categories[0]?.name || '';
  if (cat.includes('火鍋') || cat.includes('Hot Pot'))                          return '火鍋專賣';
  if (cat.includes('咖啡') || cat.includes('Coffee') || cat.includes('Café'))   return '咖啡甜點';
  if (cat.includes('拉麵') || cat.includes('Ramen') || cat.includes('日式') || cat.includes('Sushi')) return '日式料理';
  if (cat.includes('燒肉') || cat.includes('Yakiniku') || cat.includes('BBQ'))  return '燒肉串燒';
  if (cat.includes('甜點') || cat.includes('Dessert') || cat.includes('Bakery'))return '咖啡甜點';
  if (cat.includes('飲料') || cat.includes('Tea') || cat.includes('Bubble'))    return '手搖茶攤';
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
    // New Foursquare Places API endpoint (post-deprecation May 2026)
    const url = new URL('https://places-api.foursquare.com/places/search');
    url.searchParams.set('ll', `${lat},${lng}`);
    url.searchParams.set('radius', radius.toString());
    url.searchParams.set('categories', '13000'); // Food & Drink
    url.searchParams.set('limit', Math.min(limit * 2, 50).toString());
    url.searchParams.set('sort', 'DISTANCE');
    url.searchParams.set('fields', 'fsq_place_id,name,location,categories,distance');

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Accept-Language': 'zh-TW,zh;q=0.9',
        'X-Places-Api-Version': '2025-06-17',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[nearby] Foursquare error:', res.status, err.slice(0, 200));

      // Fallback to Nominatim if Foursquare fails
      return await fetchNominatimFallback(lat, lng, radius, limit);
    }

    const data = await res.json();
    const results = data.results || [];

    const places = results
      .filter(p => !isClosed(p))
      .slice(0, limit)
      .map(p => ({
        id:       p.fsq_place_id,
        name:     p.name,
        address:  [
          p.location?.address,
          p.location?.locality,
        ].filter(Boolean).join(', ') || p.location?.formatted_address || '',
        category: mapCategory(p.categories),
        distance: p.distance,
        lat:      p.location?.lat,
        lng:      p.location?.lng,
      }));

    return NextResponse.json({ places, total: places.length, source: 'foursquare' });

  } catch (err) {
    console.error('[nearby] fatal:', err.message);
    // Fallback to Nominatim
    return await fetchNominatimFallback(lat, lng, radius, limit);
  }
}

// ── Nominatim fallback ────────────────────────────────────────────────────────
async function fetchNominatimFallback(lat, lng, radius, limit) {
  try {
    const d = (radius / 111000) * 1.5; // degrees approx
    const url = `https://nominatim.openstreetmap.org/search?amenity=restaurant&format=json&addressdetails=1&limit=${limit * 2}` +
      `&viewbox=${lng - d},${lat + d},${lng + d},${lat - d}&bounded=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'zh-TW,zh;q=0.9' } });
    const data = await res.json();

    const CLOSED_KW = ['歇業', '停業', '關閉'];
    const places = data
      .filter(p => p.name?.trim() && !CLOSED_KW.some(k => p.name.includes(k)))
      .slice(0, limit)
      .map(p => ({
        id:       p.place_id?.toString(),
        name:     p.name,
        address:  p.display_name?.split(',').slice(0, 3).join(',').trim() || '',
        category: '精選美食',
        lat:      parseFloat(p.lat),
        lng:      parseFloat(p.lon),
      }));

    return NextResponse.json({ places, total: places.length, source: 'nominatim_fallback' });
  } catch {
    return NextResponse.json({ places: [], total: 0, source: 'error' });
  }
}
