"use client";
// FrontierGame.jsx — full-screen overlay hosting the Soul Knight HTML5 game.

import React, { useRef, useEffect } from 'react';

export default function FrontierGame({ isOpen, onClose }) {
  const iframeRef = useRef(null);

  // Focus iframe for keyboard input
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => iframeRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [isOpen]);

  // ESC closes
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Listen for in-game "Return to Fabrica" button
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.data?.type === 'fabrica-game-close') onClose();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180]" style={{ background: '#0a0a0f' }}>
      <button
        onClick={onClose}
        aria-label="Close game"
        style={{
          position: 'absolute', top: 14, right: 14, zIndex: 200,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          border: '0.5px solid rgba(255,255,255,0.2)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          color: 'white', fontSize: 17, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}
      >
        ✕
      </button>
      <iframe
        ref={iframeRef}
        src="/soul-knight.html"
        title="元氣騎士 Soul Knight"
        tabIndex={0}
        allow="fullscreen"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </div>
  );
}
