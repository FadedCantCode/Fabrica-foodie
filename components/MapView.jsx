"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getFoodImage, getFreeMapAppUrl, getSmartTag } from '../lib/helpers';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || 'W1dDFaNHzCyu5PT8YwYk';

export default function MapView({ restaurants, isOpen, onClose, userLocation }) {
  const mapContainerRef  = useRef(null);
  const mapRef           = useRef(null);
  const markersRef       = useRef([]);
  const nearbyMarkersRef = useRef([]);
  const [selected, setSelected]           = useState(null);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [mapLoaded, setMapLoaded]         = useState(false);
  const [nearbyPlaces, setNearbyPlaces]   = useState([]);
  const [activeTab, setActiveTab]         = useState('saved');
  const [loadingNearby, setLoadingNearby] = useState(false);

  // ── Load MapTiler SDK ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (window.maptilersdk) { setMapLoaded(true); return; }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.maptiler.com/maptiler-sdk-js/v2.5.0/maptiler-sdk.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://cdn.maptiler.com/maptiler-sdk-js/v2.5.0/maptiler-sdk.umd.min.js';
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, [isOpen]);

  // ── Geocode via Nominatim ──────────────────────────────────────────────────
  const geocode = useCallback(async (name, address) => {
    const queries = [];
    if (address && address !== '僅提供店名定位' && address.trim()) {
      queries.push(address);
      queries.push(`${name} ${address}`);
    }
    queries.push(`${name} 台灣`);

    for (const q of queries) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=tw`,
          { headers: { 'Accept-Language': 'zh-TW,zh;q=0.9' } }
        );
        const data = await res.json();
        if (data[0]) {
          console.log(`[geocode] ✅ ${name}: ${data[0].lat}, ${data[0].lon}`);
          return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
      } catch (e) {
        console.log(`[geocode] ❌ ${name}:`, e.message);
      }
    }
    console.log(`[geocode] ❌ ${name}: no results`);
    return null;
  }, []);

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !mapLoaded || !mapContainerRef.current || mapRef.current) return;

    const mt = window.maptilersdk;
    mt.config.apiKey = MAPTILER_KEY;

    const center = userLocation
      ? [userLocation.lng, userLocation.lat]
      : [120.9738, 23.9739];

    const map = new mt.Map({
      container: mapContainerRef.current,
      style: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`,
      center,
      zoom: userLocation ? 13 : 7,
      attributionControl: false,
    });

    map.addControl(new mt.NavigationControl({ showCompass: false }), 'top-right');

    const restsSnapshot = restaurants;
    const locSnapshot   = userLocation;

    map.on('load', () => {
      mapRef.current = map;
      console.log('[MapView] loaded, restaurants:', restsSnapshot.length);
      addRestaurantMarkers(map, restsSnapshot);
      if (locSnapshot) {
        addUserMarker(map, locSnapshot);
        fetchNearby(locSnapshot);
      }
    });

    map.on('click', () => { setSelected(null); setDrawerOpen(false); });

    return () => {
      markersRef.current.forEach(m => m.remove());
      nearbyMarkersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      nearbyMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [isOpen, mapLoaded]);

  // ── Restaurant markers ─────────────────────────────────────────────────────
  const addRestaurantMarkers = useCallback(async (map, rests) => {
    const mt = window.maptilersdk;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    for (const r of rests) {
      let coords = null;
      if (r.latitude && r.longitude) {
        coords = { lat: parseFloat(r.latitude), lng: parseFloat(r.longitude) };
      } else {
        coords = await geocode(r.name, r.address);
      }
      if (!coords) continue;

      const el  = document.createElement('div');
      const img = getFoodImage(r);
      el.style.cssText = `
        width:40px;height:40px;border-radius:50%;
        background:${img ? `url(${img}) center/cover` : '#1D1D1F'};
        border:2.5px solid white;
        box-shadow:0 4px 16px rgba(0,0,0,0.5);
        cursor:pointer;
        transition:transform 0.2s cubic-bezier(0.2,0.8,0.2,1),box-shadow 0.2s;
        display:flex;align-items:center;justify-content:center;
        font-size:18px;overflow:hidden;
      `;
      if (!img) el.textContent = '🍽';

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.25)';
        el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)';
      });
      el.addEventListener('click', e => {
        e.stopPropagation();
        setSelected(r);
        setActiveTab('saved');
        setDrawerOpen(true);
        map.flyTo({ center: [coords.lng, coords.lat], zoom: 15, duration: 600 });
      });

      const marker = new mt.Marker({ element: el })
        .setLngLat([coords.lng, coords.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [geocode]);

  // ── User location marker ───────────────────────────────────────────────────
  const addUserMarker = (map, loc) => {
    const mt = window.maptilersdk;
    const el = document.createElement('div');
    el.style.cssText = `
      width:16px;height:16px;border-radius:50%;
      background:#0071E3;border:3px solid white;
      box-shadow:0 0 0 6px rgba(0,113,227,0.2),0 4px 12px rgba(0,0,0,0.4);
    `;
    new mt.Marker({ element: el }).setLngLat([loc.lng, loc.lat]).addTo(map);
  };

  // ── Nearby markers ─────────────────────────────────────────────────────────
  const addNearbyMarkers = (map, places) => {
    if (!map) return;
    const mt = window.maptilersdk;
    nearbyMarkersRef.current.forEach(m => m.remove());
    nearbyMarkersRef.current = [];
    places.forEach(p => {
      const el = document.createElement('div');
      el.style.cssText = `
        width:28px;height:28px;border-radius:50%;
        background:rgba(255,255,255,0.12);border:1.5px solid rgba(255,255,255,0.35);
        display:flex;align-items:center;justify-content:center;
        font-size:13px;cursor:pointer;
      `;
      el.textContent = '🔍';
      el.addEventListener('click', e => {
        e.stopPropagation();
        setSelected({ ...p, isNearby: true });
        setActiveTab('nearby');
        setDrawerOpen(true);
        map.flyTo({ center: [p.lng, p.lat], zoom: 16, duration: 600 });
      });
      const marker = new mt.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      nearbyMarkersRef.current.push(marker);
    });
  };

  // ── Nearby via Nominatim (no CORS issue, unlike Overpass) ──────────────────
  const fetchNearby = useCallback(async (loc) => {
    setLoadingNearby(true);
    try {
      const d = 0.015;
      const url = `https://nominatim.openstreetmap.org/search?amenity=restaurant&format=json&addressdetails=1&limit=15` +
        `&viewbox=${loc.lng - d},${loc.lat + d},${loc.lng + d},${loc.lat - d}&bounded=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'zh-TW,zh;q=0.9' } });
      const data = await res.json();
      const places = data
        .filter(p => p.name?.trim())
        .map(p => ({
          id:       p.place_id?.toString() || Math.random().toString(),
          name:     p.name,
          category: getSmartTag(p.name, 'restaurant'),
          address:  p.display_name?.split(',').slice(0, 3).join(',').trim() || '',
          lat:      parseFloat(p.lat),
          lng:      parseFloat(p.lon),
        }));
      setNearbyPlaces(places);
      addNearbyMarkers(mapRef.current, places);
    } catch (e) {
      console.log('[fetchNearby] error:', e.message);
    }
    setLoadingNearby(false);
  }, []);

  const flyToUser = () => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 14, duration: 800 });
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: '#0A0A0A',
      animation: 'mapSlideIn 0.4s cubic-bezier(0.2,0.8,0.2,1)',
    }}>
      <style>{`
        @keyframes mapSlideIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .maplibregl-ctrl-zoom-in,.maplibregl-ctrl-zoom-out {
          background: rgba(255,255,255,0.1) !important;
          backdrop-filter: blur(12px) !important;
          color: white !important;
        }
      `}</style>

      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '16px 16px 0',
        background: 'linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 100%)',
        display: 'flex', alignItems: 'center', gap: 12, zIndex: 10,
      }}>
        <button onClick={onClose} style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'white', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
        <span style={{ color: 'white', fontWeight: 700, fontSize: 16, letterSpacing: -0.3 }}>美食地圖</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div style={{
            background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', fontSize: 11, fontWeight: 700,
            padding: '6px 12px', borderRadius: 20,
          }}>
            {restaurants.length} 個收藏
          </div>
          {userLocation && (
            <button onClick={flyToUser} style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,113,227,0.8)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>◎</button>
          )}
        </div>
      </div>

      {/* Loading */}
      {!mapLoaded && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: '#0A0A0A', color: 'white', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ width: 32, height: 32, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>載入地圖中...</div>
        </div>
      )}

      {/* Bottom sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(18,18,18,0.96)', backdropFilter: 'blur(20px)',
        borderRadius: '24px 24px 0 0',
        border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none',
        maxHeight: drawerOpen && selected ? '60vh' : '180px',
        transition: 'max-height 0.4s cubic-bezier(0.2,0.8,0.2,1)',
        overflow: 'hidden', zIndex: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
        </div>

        {selected ? (
          <div style={{ padding: '0 16px 32px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 72, height: 72, borderRadius: 14, flexShrink: 0, overflow: 'hidden', background: '#333' }}>
                {!selected.isNearby ? (
                  <img src={getFoodImage(selected)} alt={selected.name}
                    onError={e => { e.target.src = "https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=200"; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🔍</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'white', fontSize: 17, fontWeight: 700, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.address}</div>
                {selected.note && !selected.isNearby && (
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{selected.note}</div>
                )}
                {selected.isNearby && (
                  <div style={{ display: 'inline-block', background: 'rgba(255,149,0,0.2)', color: '#FF9500', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginBottom: 8 }}>附近探索</div>
                )}
                <button onClick={() => window.open(getFreeMapAppUrl(selected.name, selected.address), '_blank')}
                  style={{ background: 'white', color: '#1D1D1F', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                  查看路線
                </button>
              </div>
              <button onClick={() => { setSelected(null); setDrawerOpen(false); }}
                style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 4, flexShrink: 0 }}>✕</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[['saved', '我的收藏'], ['nearby', '附近探索']].map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key)} style={{
                  padding: '6px 14px', borderRadius: 20,
                  background: activeTab === key ? 'white' : 'rgba(255,255,255,0.1)',
                  color: activeTab === key ? '#1D1D1F' : 'rgba(255,255,255,0.6)',
                  border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  {label}
                  <span style={{ marginLeft: 4, opacity: 0.6 }}>
                    {key === 'saved' ? restaurants.length : (loadingNearby ? '…' : nearbyPlaces.length || '')}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {(activeTab === 'saved' ? restaurants : nearbyPlaces).map(r => (
                <div key={r.id} onClick={() => {
                  setSelected(activeTab === 'nearby' ? { ...r, isNearby: true } : r);
                  setDrawerOpen(true);
                  const lat = r.lat || (r.latitude && parseFloat(r.latitude));
                  const lng = r.lng || (r.longitude && parseFloat(r.longitude));
                  if (lat && lng && mapRef.current)
                    mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 600 });
                }} style={{
                  flexShrink: 0, width: 110,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.2s',
                }}>
                  <div style={{ height: 70, background: '#333' }}>
                    {activeTab === 'saved' ? (
                      <img src={getFoodImage(r)} alt={r.name}
                        onError={e => { e.target.src = "https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=200"; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🔍</div>
                    )}
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ color: 'white', fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>{getSmartTag(r.name, r.category)}</div>
                  </div>
                </div>
              ))}
              {activeTab === 'nearby' && !loadingNearby && nearbyPlaces.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '20px 0' }}>
                  {userLocation ? '附近暫無資料' : '需要位置權限'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
