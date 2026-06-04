"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getFoodImage, getFreeMapAppUrl, getSmartTag } from '../lib/helpers';

// ─── MapView Component ────────────────────────────────────────────────────────
export default function MapView({ restaurants, isOpen, onClose, userLocation }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef([]);
  const nearbyMarkersRef = useRef([]);
  const [selected, setSelected]     = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mapLoaded, setMapLoaded]   = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [activeTab, setActiveTab]   = useState('saved'); // 'saved' | 'nearby'
  const [loadingNearby, setLoadingNearby] = useState(false);

  // ── Load MapTiler GL JS ────────────────────────────────────────────────────
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

    return () => {};
  }, [isOpen]);

  // ── Geocode address via Nominatim ──────────────────────────────────────────
  const geocode = useCallback(async (name, address) => {
    if (!address || address === '僅提供店名定位') return null;
    try {
      const q = encodeURIComponent(`${name} ${address} 台灣`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=tw`,
        { headers: { 'Accept-Language': 'zh-TW,zh;q=0.9' } }
      );
      const data = await res.json();
      if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch {}
    return null;
  }, []);

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !mapLoaded || !mapContainerRef.current) return;
    if (mapRef.current) return;

    const maptiler = window.maptilersdk;
    const apiKey   = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';
    maptiler.config.apiKey = apiKey;

    const center = userLocation
      ? [userLocation.lng, userLocation.lat]
      : [120.9738, 23.9739]; // Taiwan center

    const map = new maptiler.Map({
      container: mapContainerRef.current,
      style: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${apiKey}`,
      center,
      zoom: userLocation ? 13 : 7,
      attributionControl: false,
    });

    map.addControl(new maptiler.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      mapRef.current = map;
      addRestaurantMarkers(map, restaurants);
      if (userLocation) {
        addUserMarker(map, userLocation);
        fetchNearby(userLocation);
      }
    });

    map.on('click', () => {
      setSelected(null);
      setDrawerOpen(false);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      nearbyMarkersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      nearbyMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [isOpen, mapLoaded]);

  // ── Add restaurant markers ─────────────────────────────────────────────────
  const addRestaurantMarkers = useCallback(async (map, rests) => {
    const maptiler = window.maptilersdk;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    for (const r of rests) {
      let coords = null;
      if (r.latitude && r.longitude) {
        coords = { lat: parseFloat(r.latitude), lng: parseFloat(r.longitude) };
      } else if (r.address && r.address !== '僅提供店名定位') {
        coords = await geocode(r.name, r.address);
      }
      if (!coords) continue;

      // Custom marker element
      const el = document.createElement('div');
      el.style.cssText = `
        width: 36px; height: 36px; border-radius: 50%;
        background: white; border: 2.5px solid #1D1D1F;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: transform 0.2s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.2s;
        font-size: 15px;
        overflow: hidden;
      `;

      // Try to show food image as marker bg
      const img = getFoodImage(r);
      if (img) {
        el.style.backgroundImage = `url(${img})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.border = '2.5px solid white';
      } else {
        el.textContent = '🍽';
      }

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
        el.style.boxShadow = '0 8px 20px rgba(0,0,0,0.4)';
        el.style.zIndex = '10';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected(r);
        setActiveTab('saved');
        setDrawerOpen(true);
        map.flyTo({ center: [coords.lng, coords.lat], zoom: 15, duration: 600 });
      });

      const marker = new maptiler.Marker({ element: el })
        .setLngLat([coords.lng, coords.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [geocode]);

  // ── User location marker ───────────────────────────────────────────────────
  const addUserMarker = (map, loc) => {
    const maptiler = window.maptilersdk;
    const el = document.createElement('div');
    el.style.cssText = `
      width: 16px; height: 16px; border-radius: 50%;
      background: #0071E3; border: 3px solid white;
      box-shadow: 0 0 0 4px rgba(0,113,227,0.25), 0 4px 12px rgba(0,0,0,0.3);
    `;
    new maptiler.Marker({ element: el })
      .setLngLat([loc.lng, loc.lat])
      .addTo(map);
  };

  // ── Fetch nearby places via Overpass ───────────────────────────────────────
  const fetchNearby = useCallback(async (loc) => {
    setLoadingNearby(true);
    try {
      const q = `[out:json][timeout:10];
        (node["amenity"~"restaurant|cafe|fast_food"](around:1000,${loc.lat},${loc.lng});
         way["amenity"~"restaurant|cafe|fast_food"](around:1000,${loc.lat},${loc.lng}););
        out center 15;`;
      const res  = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q });
      const data = await res.json();

      const places = (data.elements || [])
        .filter(el => el.tags?.name)
        .map(el => ({
          id:       String(el.id),
          name:     el.tags.name,
          category: getSmartTag(el.tags.name, el.tags.amenity || '餐廳'),
          address:  el.tags['addr:street']
            ? `${el.tags['addr:city'] || ''}${el.tags['addr:street']}${el.tags['addr:housenumber'] || ''}`
            : '點擊查看地圖',
          lat:      el.lat || el.center?.lat,
          lng:      el.lon || el.center?.lon,
        }))
        .filter(p => p.lat && p.lng)
        .slice(0, 12);

      setNearbyPlaces(places);
      addNearbyMarkers(mapRef.current, places);
    } catch {}
    setLoadingNearby(false);
  }, []);

  // ── Nearby markers (subtle, different style) ───────────────────────────────
  const addNearbyMarkers = (map, places) => {
    if (!map) return;
    const maptiler = window.maptilersdk;
    nearbyMarkersRef.current.forEach(m => m.remove());
    nearbyMarkersRef.current = [];

    places.forEach(p => {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%;
        background: rgba(255,255,255,0.15); border: 1.5px solid rgba(255,255,255,0.4);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 12px;
        backdrop-filter: blur(4px);
        transition: all 0.2s;
      `;
      el.textContent = '🔍';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected({ ...p, isNearby: true });
        setActiveTab('nearby');
        setDrawerOpen(true);
        map.flyTo({ center: [p.lng, p.lat], zoom: 16, duration: 600 });
      });
      const marker = new maptiler.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      nearbyMarkersRef.current.push(marker);
    });
  };

  // ── Fly to user location ───────────────────────────────────────────────────
  const flyToUser = () => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 14, duration: 800,
    });
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#0A0A0A',
      animation: 'mapSlideIn 0.4s cubic-bezier(0.2,0.8,0.2,1)',
    }}>
      <style>{`
        @keyframes mapSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes drawerUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .map-drawer { animation: drawerUp 0.35s cubic-bezier(0.2,0.8,0.2,1); }
      `}</style>

      {/* Map container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '16px 16px 0',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
        display: 'flex', alignItems: 'center', gap: 12,
        zIndex: 10,
      }}>
        <button onClick={onClose} style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'white', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
        <div style={{ color: 'white', fontWeight: 700, fontSize: 16, letterSpacing: -0.3 }}>
          美食地圖
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div style={{
            background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', fontSize: 11, fontWeight: 700,
            padding: '6px 12px', borderRadius: 20,
          }}>
            {restaurants.filter(r => r.address && r.address !== '僅提供店名定位').length} 個收藏
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
          <div style={{ width: 32, height: 32, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>載入地圖中...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Bottom sheet — list */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(18,18,18,0.95)', backdropFilter: 'blur(20px)',
        borderRadius: '24px 24px 0 0',
        border: '1px solid rgba(255,255,255,0.1)',
        borderBottom: 'none',
        maxHeight: drawerOpen && selected ? '60vh' : '180px',
        transition: 'max-height 0.4s cubic-bezier(0.2,0.8,0.2,1)',
        overflow: 'hidden',
        zIndex: 10,
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}/>
        </div>

        {/* Selected card */}
        {selected ? (
          <div style={{ padding: '0 16px 24px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Thumbnail */}
              <div style={{
                width: 72, height: 72, borderRadius: 14, flexShrink: 0,
                overflow: 'hidden', background: '#333',
              }}>
                {!selected.isNearby ? (
                  <img src={getFoodImage(selected)} alt={selected.name}
                    onError={e => { e.target.src = "https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=200"; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🔍</div>
                )}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'white', fontSize: 17, fontWeight: 700, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selected.name}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selected.address}
                </div>
                {selected.note && !selected.isNearby && (
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.5, marginBottom: 8,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {selected.note}
                  </div>
                )}
                {selected.isNearby && (
                  <div style={{ display: 'inline-block', background: 'rgba(255,149,0,0.2)', color: '#FF9500',
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginBottom: 8 }}>
                    附近探索
                  </div>
                )}
                <button
                  onClick={() => window.open(getFreeMapAppUrl(selected.name, selected.address), '_blank')}
                  style={{
                    background: 'white', color: '#1D1D1F',
                    border: 'none', borderRadius: 10,
                    padding: '8px 16px', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                  查看路線
                </button>
              </div>
              {/* Close */}
              <button onClick={() => { setSelected(null); setDrawerOpen(false); }}
                style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 4, flexShrink: 0 }}>
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* Mini list */
          <div style={{ padding: '0 16px 16px' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[['saved','我的收藏'], ['nearby','附近探索']].map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key)} style={{
                  padding: '6px 14px', borderRadius: 20,
                  background: activeTab === key ? 'white' : 'rgba(255,255,255,0.1)',
                  color: activeTab === key ? '#1D1D1F' : 'rgba(255,255,255,0.6)',
                  border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                  {label}
                  {key === 'saved' && <span style={{ marginLeft: 4, opacity: 0.6 }}>{restaurants.length}</span>}
                  {key === 'nearby' && loadingNearby && <span style={{ marginLeft: 4 }}>...</span>}
                  {key === 'nearby' && !loadingNearby && nearbyPlaces.length > 0 && <span style={{ marginLeft: 4, opacity: 0.6 }}>{nearbyPlaces.length}</span>}
                </button>
              ))}
            </div>

            {/* Horizontal scroll list */}
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4,
              scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {(activeTab === 'saved' ? restaurants : nearbyPlaces).map(r => (
                <div key={r.id} onClick={() => {
                  setSelected(r.isNearby !== undefined ? r : r);
                  setDrawerOpen(true);
                  if (r.lat && r.lng && mapRef.current) {
                    mapRef.current.flyTo({ center: [r.lng, r.lat], zoom: 15, duration: 600 });
                  }
                }} style={{
                  flexShrink: 0, width: 110,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.1)',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ height: 70, background: '#333', position: 'relative', overflow: 'hidden' }}>
                    {activeTab === 'saved' ? (
                      <img src={getFoodImage(r)} alt={r.name}
                        onError={e => { e.target.src = "https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=200"; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🔍</div>
                    )}
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ color: 'white', fontSize: 11, fontWeight: 700,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>
                      {activeTab === 'saved' ? getSmartTag(r.name, r.category) : r.category}
                    </div>
                  </div>
                </div>
              ))}
              {activeTab === 'nearby' && !loadingNearby && nearbyPlaces.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '20px 0' }}>
                  {userLocation ? '附近暫無資料' : '需要位置權限才能顯示附近餐廳'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
