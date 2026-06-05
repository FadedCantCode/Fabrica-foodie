// components/RestaurantList.jsx
// Swapy-based drag-and-drop list for restaurant cards.
"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import { createSwapy } from 'swapy';
import { RestaurantCard } from './RestaurantCards';

export default function RestaurantList({
  restaurants,
  onDelete,
  onShare,
  onUpdate,
  onSelect,
}) {
  const containerRef = useRef(null);
  const swapyRef = useRef(null);
  const idsKey = useMemo(() => restaurants.map(r => r.id).join('|'), [restaurants]);

  useEffect(() => {
    if (!containerRef.current || swapyRef.current || restaurants.length === 0) return undefined;

    const swapy = createSwapy(containerRef.current, {
      animation: 'spring',
      swapMode: 'hover',
      autoScrollOnDrag: true,
    });

    const clearDragState = () => {
      delete document.body.dataset.swapyDragging;
      requestAnimationFrame(() => swapy.update?.());
      document.removeEventListener('pointerup', clearDragState);
      document.removeEventListener('pointercancel', clearDragState);
    };

    swapy.onSwapStart?.(() => {
      document.body.dataset.swapyDragging = 'true';
      window.dispatchEvent(new Event('fabrica-swapy-drag-start'));
      document.addEventListener('pointerup', clearDragState, { once: true });
      document.addEventListener('pointercancel', clearDragState, { once: true });
    });

    swapy.onSwapEnd?.(clearDragState);

    swapyRef.current = swapy;

    return () => {
      clearDragState();
      swapyRef.current?.destroy();
      swapyRef.current = null;
    };
  }, [restaurants.length]);

  useEffect(() => {
    if (!swapyRef.current) return;
    requestAnimationFrame(() => swapyRef.current?.update?.());
  }, [idsKey]);

  if (restaurants.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white rounded-[24px] border border-[#E5E5EA] animate-fade-in">
        <div className="w-16 h-16 bg-neutral-100 rounded-full mx-auto flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
        </div>
        <h3 className="text-neutral-900 font-bold mb-1">No saved restaurants yet</h3>
        <p className="text-sm text-neutral-500 font-medium">Add or import Threads food posts to start your list.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {restaurants.map((restaurant, index) => (
        <div
          key={restaurant.id}
          data-swapy-slot={restaurant.id}
          className="relative"
          style={{ borderRadius: 24 }}
        >
          <div
            data-swapy-item={restaurant.id}
            className="relative"
            style={{
              borderRadius: 24,
              overflow: 'hidden',
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)',
            }}
          >
            <div
              data-swapy-handle
              title="Drag to reorder"
              aria-label="Drag to reorder"
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 32,
                height: 32,
                zIndex: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.32)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: 10,
                cursor: 'grab',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.18)',
                touchAction: 'none',
              }}
              onClick={e => e.stopPropagation()}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                <circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/>
                <circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/>
                <circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/>
              </svg>
            </div>

            <RestaurantCard
              restaurant={restaurant}
              index={index}
              onDelete={onDelete}
              onShare={onShare}
              onUpdate={onUpdate}
              onSelect={onSelect}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
