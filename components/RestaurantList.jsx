// components/RestaurantList.jsx
// Swapy-based drag-and-drop list for restaurant cards.
"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createSwapy, utils } from 'swapy';
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
  const [slotItemMap, setSlotItemMap] = useState(() => utils.initSlotItemMap(restaurants, 'id'));

  const slottedItems = useMemo(
    () => utils.toSlottedItems(restaurants, 'id', slotItemMap),
    [restaurants, slotItemMap]
  );

  useEffect(() => {
    if (restaurants.length === 0) {
      swapyRef.current?.destroy();
      swapyRef.current = null;
      return undefined;
    }

    if (!containerRef.current || swapyRef.current) return undefined;

    swapyRef.current = createSwapy(containerRef.current, {
      manualSwap: true,
      animation: 'spring',
      swapMode: 'hover',
      autoScrollOnDrag: true,
    });

    swapyRef.current.onSwap((event) => {
      const nextMap = event.newSlotItemMap?.asArray || event.data?.array || [];
      if (!nextMap.length) return;

      setSlotItemMap(nextMap);
    });

    swapyRef.current.onSwapEnd?.((event) => {
      const nextMap = event.slotItemMap?.asArray || event.newSlotItemMap?.asArray || event.data?.array || [];
      if (!nextMap.length || event.hasChanged === false) return;

      setSlotItemMap(nextMap);
    });

    return () => {
      swapyRef.current?.destroy();
      swapyRef.current = null;
    };
  }, [restaurants.length]);

  useEffect(() => {
    if (!swapyRef.current) {
      setSlotItemMap(utils.initSlotItemMap(restaurants, 'id'));
      return undefined;
    }

    return utils.dynamicSwapy(
      swapyRef.current,
      restaurants,
      'id',
      slotItemMap,
      setSlotItemMap
    );
  }, [restaurants]);

  if (restaurants.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white rounded-[24px] border border-[#E5E5EA] animate-fade-in">
        <div className="w-16 h-16 bg-neutral-100 rounded-full mx-auto flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
        </div>
        <h3 className="text-neutral-900 font-bold mb-1">還沒有收藏餐廳</h3>
        <p className="text-sm text-neutral-500 font-medium">新增或匯入 Threads 美食文章後會出現在這裡。</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {slottedItems.map(({ slotId, itemId, item: restaurant }, index) => (
        <div
          key={slotId}
          data-swapy-slot={slotId}
          className="relative"
        >
          <div key={itemId} data-swapy-item={itemId} className="relative">
            <div
              data-swapy-handle
              title="拖曳排序"
              aria-label="拖曳排序"
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
