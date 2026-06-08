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
  const containerRef = useRef(null);
  const swapyRef     = useRef(null);
  const [orderedList, setOrderedList] = useState(restaurants);

  // Sync when external list changes (filter/add/delete)
  useEffect(() => {
    setOrderedList(restaurants);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants.map(r => r.id).join(',')]);

  // Init Swapy once only
  useEffect(() => {
    if (!containerRef.current) return;
    swapyRef.current?.destroy();

    swapyRef.current = createSwapy(containerRef.current, {
      animation: 'none',
      swapMode:  'drop',
      autoScrollOnDrag: true,
    });

    swapyRef.current.onSwap(({ data }) => {
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
  }, []);

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
        <div
          key={`slot-${index}`}
          data-swapy-slot={`slot-${index}`}
        >
          {/*
           * item wrapper: position:relative so the drag-overlay sits on top
           * NO pointer-events manipulation here — let events flow naturally
           */}
          <div
            data-swapy-item={restaurant.id}
            style={{ position: 'relative', userSelect: 'none' }}
          >
            {/*
             * Drag overlay: covers the card image area (top ~216px) only.
             * data-swapy-handle lives here — isolated from all interactive elements.
             * pointer-events: none on everything inside card EXCEPT buttons/links/inputs.
             * The overlay intercepts pointerdown for drag, but lets click pass through
             * to onSelect via the card's onClick.
             */}
            <div
              data-swapy-handle
              style={{
                position:      'absolute',
                top:            0,
                left:           0,
                right:          0,
                height:         216,    // matches the card image height
                zIndex:         10,
                cursor:         'grab',
                borderRadius:   '22px 22px 0 0',
                // Invisible — just an event capture layer
              }}
            />

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
