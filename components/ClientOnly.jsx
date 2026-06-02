"use client";

// components/ClientOnly.jsx
// 防止 SSR hydration mismatch
// Three.js、Firebase、localStorage 都只能在 client 跑

import { useState, useEffect } from 'react';

export default function ClientOnly({ children, fallback = null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return fallback;
  return children;
}
