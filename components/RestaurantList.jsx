// components/RestaurantList.jsx
"use client";

import React, { useEffect, useRef } from 'react';
import { createSwapy } from 'swapy';
import { RestaurantCard } from './RestaurantCards';

export default function RestaurantList({
  restaurants,
  onOrderChange,
  onDelete,
  onShare,
  onUpdate,
  onSelect,
}) {
  const containerRef    = useRef(null);
  const swapyRef        = useRef(null);
  const restaurantsRef  = useRef(restaurants);

  // Keep ref current so the onSwap closure always has fresh data
  useEffect(() => {
    restaurantsRef.current = restaurants;
  }, [restaurants]);

  // Order-dependent key: re-init Swapy whenever list content OR order changes.
  // This handles: initial load (empty→loaded), add, delete, filter, AND swap.
  const idsKey = restaurants.map(r => r.id).join(',');

  useEffect(() => {
    // Guard: wait until container exists AND we actually have restaurants
    if (!containerRef.current || restaurants.length === 0) return;

    // Destroy previous instance cleanly
    swapyRef.current?.destroy();
    swapyRef.current = null;

    // Small delay to let React finish painting the new DOM before Swapy reads it
    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      swapyRef.current = createSwapy(containerRef.current, {
        animation:        'none',   // 'spring'/'dynamic' leave stuck inline styles
        swapMode:         'drop',   // 'hover' desyncs with React reconciliation
        autoScrollOnDrag: true,
      });

      swapyRef.current.onSwap(({ data }) => {
        const newOrder = data.array
          .map(e => restaurantsRef.current.find(r => r.id === e.itemId))
          .filter(Boolean);
        onOrderChange?.(newOrder);
      });
    }, 50);

    return () => {
      clearTimeout(timer);
      swapyRef.current?.destroy();
      swapyRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]); // re-run when restaurant list changes (including order)

  if (restaurants.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white rounded-[24px] border border-[#E5E5EA] animate-fade-in">
        <div className="w-16 h-16 bg-neutral-100 rounded-full mx-auto flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
        </div>
        <h3 className="text-neutral-900 font-bold mb-1">找不到相關餐廳</h3>
        <p className="text-sm text-neutral-500 font-medium">嘗試不同的搜尋關鍵字或分類</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {restaurants.map((restaurant, index) => (
        /*
         * Slot key = POSITIONAL (slot-0, slot-1 …) — never moves in React's tree.
         * Item id  = RESTAURANT ID                 — Swapy moves these between slots.
         *
         * data-swapy-handle on the item itself = whole card is the drag handle.
         * Interactive elements (buttons, inputs) stop propagation via RestaurantCard.
         */
        <div
          key={`slot-${index}`}
          data-swapy-slot={`slot-${index}`}
        >
          <div
            data-swapy-item={restaurant.id}
            data-swapy-handle
            style={{ cursor: 'grab', userSelect: 'none' }}
          >
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
