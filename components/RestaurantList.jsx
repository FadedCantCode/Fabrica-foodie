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
  const containerRef = useRef(null);
  const swapyRef     = useRef(null);
  const idsKey = restaurants.map(r => r.id).join(',');

  useEffect(() => {
    if (!containerRef.current || restaurants.length === 0) return;

    swapyRef.current?.destroy();

    swapyRef.current = createSwapy(containerRef.current, {
      animation:        'spring',
      swapMode:         'drop',
      autoScrollOnDrag: true,
    });

    swapyRef.current.onSwap(({ data }) => {
      const newOrder = data.array
        .map(entry => restaurants.find(r => r.id === entry.itemId))
        .filter(Boolean);
      onOrderChange?.(newOrder);
    });

    return () => {
      swapyRef.current?.destroy();
      swapyRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <h3 className="text-neutral-900 font-bold mb-1">找不到相關餐廳</h3>
        <p className="text-sm text-neutral-500 font-medium">嘗試不同的搜尋關鍵字或分類</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {restaurants.map((restaurant, index) => (
        /* slot — Swapy 管這個 div，不要加任何視覺 style */
        <div
          key={`slot-${restaurant.id}`}
          data-swapy-slot={`slot-${restaurant.id}`}
        >
          {/*
           * item — Swapy 把這個 div 當作拖動單元移動。
           * 刻意不加 border-radius 或 overflow:hidden，
           * 讓圓角完全在 RestaurantCard 內部控制，不被 Swapy 蓋掉。
           *
           * data-swapy-handle 放在這裡但不顯示任何 UI，
           * 讓整個 item 可拖（Swapy 會用 item 本身作 handle 如果沒指定 handle）。
           * 排除互動元素透過 RestaurantCard 內部的 stopPropagation 處理。
           */}
          <div
            data-swapy-item={restaurant.id}
            data-swapy-handle        /* 整個卡片都是 handle，沒有額外 UI */
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
