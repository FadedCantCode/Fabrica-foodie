// app/share/page.jsx
// Receives shared content from Threads (via Android Web Share Target)
// URL format: /share?title=...&text=...&url=...
"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { auth } from '../../lib/firebase';

function ShareHandler() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus]   = useState('analyzing'); // analyzing | success | error | need_login
  const [results, setResults] = useState([]);
  const [error, setError]     = useState('');

  useEffect(() => {
    const shared = [
      params.get('text') || '',
      params.get('url') || '',
      params.get('title') || '',
    ].filter(Boolean).join('\n');

    if (!shared.trim()) {
      setStatus('error');
      setError('沒有收到分享內容');
      return;
    }

    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setStatus('need_login');
        // Stash the shared content so we can resume after login
        sessionStorage.setItem('fabrica_pending_share', shared);
        return;
      }

      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/share-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: shared, idToken: token }),
        });
        const data = await res.json();
        if (data.success) {
          setResults(data.saved || []);
          setStatus('success');
          // Auto-redirect to home after 2.5s
          setTimeout(() => router.push('/'), 2500);
        } else {
          setStatus('error');
          setError(data.error || '儲存失敗');
        }
      } catch (e) {
        setStatus('error');
        setError('網路錯誤，請稍後再試');
      }
    });

    return () => unsub();
  }, [params, router]);

  return (
    <div style={{
      minHeight: '100vh', background: '#F2F2F7',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif',
    }}>
      {/* Logo */}
      <div style={{
        width: 56, height: 56, background: '#1D1D1F', borderRadius: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <circle cx="12" cy="11" r="3"/>
        </svg>
      </div>

      {status === 'analyzing' && (
        <>
          <div style={{ width: 36, height: 36, border: '3px solid #1D1D1F', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F' }}>AI 正在分析貼文...</p>
          <p style={{ fontSize: 13, color: '#86868B', marginTop: 4 }}>正在找出貼文中的所有餐廳</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <svg width="28" height="28" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          </div>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#1D1D1F', marginBottom: 12 }}>
            已存入 {results.length} 家餐廳！
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320 }}>
            {results.map((r, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F' }}>{r.name}</div>
                {r.address && <div style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>{r.address}</div>}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#86868B', marginTop: 16 }}>即將返回美食庫...</p>
        </>
      )}

      {status === 'need_login' && (
        <>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', marginBottom: 8 }}>請先登入 Fabrica</p>
          <p style={{ fontSize: 13, color: '#86868B', marginBottom: 20, textAlign: 'center' }}>登入後會自動存入剛剛分享的內容</p>
          <button onClick={() => router.push('/')} style={{
            background: '#1D1D1F', color: 'white', border: 'none', borderRadius: 12,
            padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>前往登入</button>
        </>
      )}

      {status === 'error' && (
        <>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <svg width="28" height="28" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', marginBottom: 4 }}>分析失敗</p>
          <p style={{ fontSize: 13, color: '#86868B', marginBottom: 20 }}>{error}</p>
          <button onClick={() => router.push('/')} style={{
            background: '#1D1D1F', color: 'white', border: 'none', borderRadius: 12,
            padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>返回首頁</button>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#F2F2F7' }} />}>
      <ShareHandler />
    </Suspense>
  );
}
