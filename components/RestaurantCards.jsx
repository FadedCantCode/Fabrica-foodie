"use client";

import React from 'react';
import { AppleButton, BlurVignette } from './ui';
import { getFoodImage, getFreeMapAppUrl, getSmartTag } from '../lib/helpers';

// ─── Single restaurant card ───────────────────────────────────────────────────
export const RestaurantCard = ({
  restaurant, index,
  draggingId, dragState,
  onPointerDown, onDelete, onShare, onSelect,
}) => {
  const isDraggingThis = draggingId === restaurant.id;
  const recommenderHandle = restaurant.sourceAuthor || restaurant.recommendedBy?.replace('@', '') || "";
  const recommenderUrl = restaurant.threadsUrl || `https://www.threads.net/@${recommenderHandle || "fabrica_tw"}`;
  const smartCategory = getSmartTag(restaurant.name, restaurant.category);
  const isSystemRec = restaurant.recommendedBy === "系統探索" || restaurant.recommendedBy === "系統推薦";

  let translateY = 0;
  if (dragState.draggingId && dragState.hoveredIndex !== -1 && !isDraggingThis) {
    const { startIndex: start, hoveredIndex: hover } = dragState;
    if (start < hover && index > start && index <= hover) translateY = -105;
    else if (start > hover && index < start && index >= hover) translateY = 105;
  }

  return (
    <div
      data-sort-index={index}
      data-restaurant-id={restaurant.id}
      onPointerDown={(e) => onPointerDown(e, restaurant, index)}
      className="group select-none cursor-grab active:cursor-grabbing w-full animate-card-appear"
      style={{
        animationDelay: `${Math.min(index * 60, 400)}ms`,
        transform: isDraggingThis ? 'none' : `translate3d(0,${translateY}%,0)`,
        transition: isDraggingThis ? 'none' : 'transform 0.4s cubic-bezier(0.25,1,0.5,1), opacity 0.4s ease',
        touchAction: 'none',
        opacity: isDraggingThis ? 0.55 : 1,
      }}
    >
      <div className={`p-2 bg-white rounded-[24px] border border-[#E5E5EA] shadow-sm
        transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
        ${!isDraggingThis ? 'hover:shadow-xl hover:scale-[1.015]' : ''}`}>

        {/* Image */}
        <figure className="w-full h-56 relative overflow-hidden rounded-[18px] bg-black/5 pointer-events-none">
          <img
            draggable={false}
            src={getFoodImage(restaurant)}
            onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=800&auto=format&fit=crop"; }}
            alt={restaurant.name}
            className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:scale-108"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/25 opacity-85 pointer-events-none"/>

          {/* Category badge */}
          <span className="absolute top-3 left-3 text-[10px] font-bold text-white bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/20 shadow-sm z-10
            transition-all duration-300 group-hover:bg-black/50">
            {smartCategory}
          </span>

          {/* Recommender badge */}
          {restaurant.recommendedBy && (
            <a href={recommenderUrl} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-full flex items-center gap-1.5 text-[10px] font-bold text-neutral-900 shadow-md
                hover:scale-110 active:scale-90 transition-all duration-200 pointer-events-auto">
              <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-purple-500 to-orange-400 flex items-center justify-center text-white text-[8px] flex-shrink-0">
                {isSystemRec ? "F" : recommenderHandle.charAt(0).toUpperCase()}
              </div>
              @{isSystemRec ? "fabrica_tw" : recommenderHandle}
            </a>
          )}

          {/* Name + address */}
          <div className="absolute bottom-3 left-4 right-4 z-10 transition-transform duration-300 group-hover:-translate-y-1">
            <h3 className="text-xl font-bold text-white leading-tight line-clamp-1 drop-shadow-md">{restaurant.name}</h3>
            <div className="flex items-center gap-1 mt-1 text-white/90 text-xs">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <circle cx="12" cy="11" r="3" strokeWidth="2"/>
              </svg>
              <span className="line-clamp-1 drop-shadow-sm font-medium">{restaurant.address}</span>
            </div>
          </div>
        </figure>

        {/* Body */}
        <article className="px-3 pt-3 pb-2 pointer-events-auto">
          {restaurant.note && (
            <p className="text-[13px] text-neutral-800 font-medium leading-relaxed">{restaurant.note}</p>
          )}
          <div className="flex justify-between items-center pt-3 mt-2 border-t border-neutral-100">
            <AppleButton onClick={(e) => { e.stopPropagation(); onDelete(restaurant.id); }}
              className="flex items-center gap-1.5 text-xs font-bold text-[#FF3B30] hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>刪除
            </AppleButton>
            <AppleButton onClick={(e) => { e.stopPropagation(); onShare(restaurant); }}
              className="flex items-center gap-1 text-xs font-bold text-neutral-800 hover:bg-neutral-50 px-3 py-1.5 rounded-lg ml-auto transition-colors">
              分享名單
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
            </AppleButton>
          </div>
        </article>
      </div>
    </div>
  );
};

// ─── Nearby recommendation card ───────────────────────────────────────────────
export const RecommendationCard = ({ rec, animatingRecId, onDismiss, onSave }) => (
  <div className={`group flex-shrink-0 w-64 p-2 bg-white rounded-[24px] border border-[#E5E5EA] shadow-sm
    transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]
    ${animatingRecId === rec.id ? 'scale-[0.75] opacity-0 rotate-3' : 'scale-100 opacity-100 hover:shadow-xl hover:-translate-y-1'}`}>
    <figure className="w-full h-40 relative overflow-hidden rounded-[18px] bg-black/5">
      <img draggable={false} src={getFoodImage(rec)}
        onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=800&auto=format&fit=crop"; }}
        alt={rec.name}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 pointer-events-none"/>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none"/>
      <span className="absolute top-3 left-3 text-[10px] font-bold text-white bg-black/40 backdrop-blur-md px-2 py-1 rounded-md border border-white/20">{rec.category}</span>
      <h3 className="absolute bottom-3 left-3 right-3 font-bold text-white text-base line-clamp-1 drop-shadow-md">{rec.name}</h3>
    </figure>
    <article className="p-3 pt-2 space-y-1">
      <p className="text-[11px] text-[#555] line-clamp-1 font-medium">{rec.address}</p>
      <div className="flex gap-2 pt-2">
        <AppleButton onClick={() => onDismiss(rec.id)}
          className="flex-1 py-2 text-[11px] font-bold text-[#555] bg-[#F5F5F7] rounded-xl hover:bg-[#EBEBED] transition-colors">
          略過
        </AppleButton>
        <AppleButton dark onClick={() => onSave(rec)}
          className="flex-1 py-2 text-[11px] font-bold text-white bg-[#0071E3] rounded-xl flex items-center justify-center gap-1 shadow-sm hover:bg-[#0066CC] transition-colors">
          實體化
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
        </AppleButton>
      </div>
    </article>
  </div>
);

// ─── Restaurant detail modal ──────────────────────────────────────────────────
export const RestaurantDetailModal = ({ restaurant, onClose }) => {
  if (!restaurant) return null;
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center px-4 bg-black/50 backdrop-blur-md animate-fade-in"
      onClick={onClose}>
      <div className="bg-white/95 backdrop-blur-3xl w-full max-w-sm rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative animate-bounce-in max-h-[85vh] flex flex-col border border-white/50"
        onClick={e => e.stopPropagation()}>
        <AppleButton onClick={onClose}
          className="absolute top-4 right-4 z-30 w-8 h-8 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </AppleButton>

        <BlurVignette blur="8px" className="h-56 w-full flex-shrink-0 bg-black/5">
          <img src={getFoodImage(restaurant)}
            onError={(e) => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=800&auto=format&fit=crop"; }}
            className="w-full h-full object-cover" alt="food"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 z-10"/>
          <div className="absolute bottom-5 left-5 right-5 z-20">
            <span className="text-[10px] font-bold text-white bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-md inline-block mb-2 border border-white/20 shadow-sm">
              {getSmartTag(restaurant.name, restaurant.category)}
            </span>
            <h2 className="text-2xl font-bold text-white leading-tight drop-shadow-lg">{restaurant.name}</h2>
          </div>
        </BlurVignette>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex items-start gap-2 text-xs font-medium text-[#555] mb-6 bg-black/5 p-3 rounded-xl border border-black/5">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#0071E3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <circle cx="12" cy="11" r="3" strokeWidth="2"/>
            </svg>
            <span className="leading-relaxed text-neutral-800">{restaurant.address}</span>
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2.5">筆記與 AI 短評</h4>
            <p className="text-[14px] text-neutral-900 font-medium leading-loose break-words whitespace-pre-wrap pl-1">
              {restaurant.note || "尚無筆記。"}
            </p>
          </div>
        </div>

        <div className="p-5 bg-white/80 backdrop-blur-xl border-t border-black/5 flex-shrink-0">
          <AppleButton dark onClick={() => window.open(getFreeMapAppUrl(restaurant.name, restaurant.address), "_blank")}
            className="w-full flex items-center justify-center gap-2 py-4 bg-black/95 text-white font-bold rounded-2xl shadow-xl">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
            查看地點
          </AppleButton>
        </div>
      </div>
    </div>
  );
};
