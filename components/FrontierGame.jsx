"use client";
// FrontierGame.jsx
// Wraps the self-contained Frontier Fabrica HTML5 game in a full-screen overlay.
// No props beyond isOpen/onClose — the game itself manages all state.

import React, { useRef, useEffect } from 'react';

export default function FrontierGame({ isOpen, onClose }) {
  const iframeRef = useRef(null);

  // Give the iframe keyboard focus as soon as the modal opens
  // (WASD / Space need focus to register)
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      iframeRef.current?.focus();
    }, 120);
    return () => clearTimeout(t);
  }, [isOpen]);

  // ESC closes the overlay (mirroring the app's other modals)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[180]"
      style={{ background: '#05030a' }}   /* matches the game's own bg */
    >
      {/* Close button — positioned so it doesn't cover the HUD */}
      <button
        onClick={onClose}
        aria-label="Close game"
        style={{
          position:  'absolute',
          top:       14,
          right:     14,
          zIndex:    200,
          width:     36,
          height:    36,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
          border:    '1px solid rgba(255,255,255,0.2)',
          color:     'white',
          fontSize:  18,
          fontWeight: 700,
          cursor:    'pointer',
          display:   'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          transition: 'background 0.2s',
        }}
      >
        ✕
      </button>

      {/* The game — served as a static file from /public */}
      <iframe
        ref={iframeRef}
        src="/soul-knight.html"
        title="元氣騎士 Soul Knight"
        tabIndex={0}
        allow="fullscreen"
        style={{
          width:  '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  );
}
