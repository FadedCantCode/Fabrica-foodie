// components/RestaurantList.jsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
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
  const containerRef  = useRef(null);
  const swapyRef      = useRef(null);
  // Internal ordered list — Swapy drives this, not React key reconciliation
  const [orderedList, setOrderedList] = useState(restaurants);

  // Sync when external list changes (add/delete/filter)
  useEffect(() => {
    setOrderedList(restaurants);
  }, [restaurants.map(r => r.id).join(',')]);

  // Init Swapy once — never re-init (re-init causes the ghost/stuck bug)
  useEffect(() => {
    if (!containerRef.current) return;

    swapyRef.current?.destroy();

    swapyRef.current = createSwapy(containerRef.current, {
      animation: 'none',
      swapMode:  'drop',
      autoScrollOnDrag: true,
    });

    swapyRef.current.onSwap(({ data }) => {
      // data.array = [{ slotId: 'slot-0', itemId: 'restaurant_id' }, ...]
      // slotId is positional (slot-0, slot-1), itemId is restaurant ID
      setOrderedList(prev => {
        const newOrder = data.array
          .map(entry => prev.find(r => r.id === entry.itemId))
          .filter(Boolean);
        onOrderChange?.(newOrder);
        return newOrder;
      });
    });

    return () => {
      swapyRef.current?.destroy();
      swapyRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← empty deps: init once only

  if (orderedList.length === 0) {
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
      {orderedList.map((restaurant, index) => (
        /*
         * slot key = POSITION (slot-0, slot-1, ...) — never changes
         * item key = CONTENT (restaurant.id)         — moves between slots
         * This is the correct Swapy pattern.
         */
        <div
          key={`slot-${index}`}          // ← positional, stable
          data-swapy-slot={`slot-${index}`}
        >
          <div
            data-swapy-item={restaurant.id}   // ← restaurant ID, moves with content
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
