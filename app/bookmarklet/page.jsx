// app/bookmarklet/page.jsx
// Installation guide page for the Fabrica bookmarklet
"use client";

import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';

const FABRICA_URL = 'https://project-fabricafoodie.vercel.app';

// The bookmarklet grabs the current page text and sends it to Fabrica
// It gets a fresh Firebase ID token from localStorage to authenticate
function buildBookmarklet(url) {
  const code = `(function(){
var u=location.href;
if(!u.includes('threads')){alert('請在 Threads 貼文頁面使用');return;}
var t=document.body.innerText.slice(0,3000);
var tk=null;
try{
  var ls=JSON.parse(localStorage.getItem('fabrica_fb_token')||'null');
  if(ls&&ls.exp>Date.now()/1000)tk=ls.token;
}catch(e){}
if(!tk){window.open('${url}','_blank');alert('請先登入 Fabrica，再使用書籤');return;}
var p=window.open('','_blank','width=360,height=180');
p.document.write('<div style="font:15px -apple-system,sans-serif;padding:24px">⏳ 正在存入 Fabrica...</div>');
fetch('${url}/api/bookmarklet-save',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({text:t,url:u,idToken:tk})
}).then(function(r){return r.json()}).then(function(d){
  if(d.success){
    p.document.body.innerHTML='<div style="font:15px -apple-system,sans-serif;padding:24px;color:#34C759">✅ 已存入！<br><br><strong>'+d.data.name+'</strong><br><span style="color:#86868B;font-size:13px">'+d.data.address+'</span></div>';
    setTimeout(function(){p.close()},2200);
  }else{
    p.document.body.innerHTML='<div style="font:15px -apple-system,sans-serif;padding:24px;color:#FF3B30">❌ '+(d.error||'存入失敗')+'</div>';
  }
}).catch(function(){
  p.document.body.innerHTML='<div style="font:15px -apple-system,sans-serif;padding:24px;color:#FF3B30">❌ 網路錯誤</div>';
});
})()`;
  return 'javascript:' + encodeURIComponent(code.replace(/\s+/g,' ').trim());
}

export default function BookmarkletPage() {
  const [bookmarkletHref, setBookmarkletHref] = useState('#');
  const [bookmarkletCode, setBookmarkletCode] = useState('');
  const [tab, setTab] = useState('desktop');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const href = buildBookmarklet(FABRICA_URL);
    setBookmarkletHref(href);
    setBookmarkletCode(decodeURIComponent(href.replace('javascript:', '')));

    // Save Firebase token to localStorage whenever auth state changes
    // so the bookmarklet can read it
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const token = await user.getIdToken();
        const exp = Math.floor(Date.now() / 1000) + 3600; // 1hr
        localStorage.setItem('fabrica_fb_token', JSON.stringify({ token, exp }));
      }
    });
    return () => unsub();
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText('javascript:' + bookmarkletCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', background: '#F2F2F7', minHeight: '100vh', padding: '0 16px 48px' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '48px 0 32px' }}>
        <div style={{ width: 56, height: 56, background: '#1D1D1F', borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <circle cx="12" cy="11" r="3"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Fabrica 快速存入</h1>
        <p style={{ fontSize: 15, color: '#86868B', marginTop: 6, fontWeight: 500 }}>在 Threads 看到美食，一鍵存進你的美食庫</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'white', borderRadius: 12, padding: 4, maxWidth: 400, margin: '0 auto 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {['desktop','mobile'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
            background: tab === t ? '#1D1D1F' : 'none',
            color: tab === t ? 'white' : '#86868B',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {t === 'desktop' ? '🖥 電腦版' : '📱 手機版'}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Desktop steps */}
        {tab === 'desktop' && (
          <>
            <Step num={1} title="把按鈕拖到書籤列">
              <p style={desc}>確認書籤列顯示（Cmd+Shift+B），把下方按鈕拖上去</p>
              <a href={bookmarkletHref} style={btnStyle} draggable="true"
                onClick={e => e.preventDefault()}>
                🥑 存入 Fabrica
              </a>
              <Hint>⬆️ <b>直接拖這個按鈕</b>到書籤列，不要點它</Hint>
            </Step>
            <Step num={2} title="在 Threads 開啟美食貼文">
              <p style={desc}>找到想存的美食推薦，點開貼文頁面（threads.net/t/...）</p>
            </Step>
            <Step num={3} title="點書籤列的「存入 Fabrica」" badge="完成！">
              <p style={desc}>AI 自動分析貼文，幾秒後存進你的美食庫</p>
            </Step>
          </>
        )}

        {/* Mobile steps */}
        {tab === 'mobile' && (
          <>
            <Step num={1} title="複製程式碼">
              <p style={desc}>點下方程式碼區塊，自動複製到剪貼簿</p>
              <div onClick={copyCode} style={{
                background: '#1D1D1F', color: '#34C759', fontFamily: 'monospace',
                fontSize: 11, padding: '12px 14px', borderRadius: 10,
                wordBreak: 'break-all', lineHeight: 1.5, margin: '10px 0',
                cursor: 'pointer', position: 'relative',
              }}>
                <span style={{ position: 'absolute', top: 8, right: 10, fontSize: 10, color: '#86868B', fontFamily: 'sans-serif' }}>
                  {copied ? '✅ 已複製！' : '點擊複製'}
                </span>
                {bookmarkletCode.slice(0, 100)}...
              </div>
              <Hint>這段程式碼只會在你點書籤時執行，送資料到 Fabrica</Hint>
            </Step>
            <Step num={2} title="新增一個空書籤">
              <p style={desc}>
                <b>Safari：</b>分享 → 加入書籤，名稱填「存入 Fabrica」<br/><br/>
                <b>Chrome：</b>⋯ → 書籤 → 加入書籤，名稱填「存入 Fabrica」
              </p>
            </Step>
            <Step num={3} title="編輯書籤，貼上程式碼">
              <p style={desc}>
                <b>Safari：</b>書籤 → 編輯 → 找到剛加的書籤 → 把網址清空換成程式碼<br/><br/>
                <b>Chrome：</b>書籤管理員 → 編輯 → 把網址換成程式碼
              </p>
            </Step>
            <Step num={4} title="在 Threads 貼文頁點書籤" badge="完成！">
              <p style={desc}>開任一美食貼文，點書籤「存入 Fabrica」，自動分析存入</p>
            </Step>
          </>
        )}

      </div>
    </div>
  );
}

const desc = { fontSize: 13, color: '#555', lineHeight: 1.6, margin: '4px 0 8px' };
const btnStyle = {
  display: 'block', width: '100%', padding: 14,
  background: '#1D1D1F', color: 'white', textAlign: 'center',
  borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: 'none',
  margin: '12px 0', cursor: 'grab', userSelect: 'none',
};

function Step({ num, title, badge, children }) {
  return (
    <div style={{ background: 'white', borderRadius: 20, padding: 20, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'inline-flex', width: 24, height: 24, background: '#1D1D1F', color: 'white', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>{num}</div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        {title}
        {badge && <span style={{ marginLeft: 8, padding: '2px 8px', background: '#D1FAE5', color: '#065F46', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{badge}</span>}
      </h3>
      {children}
    </div>
  );
}

function Hint({ children }) {
  return <div style={{ background: '#F2F2F7', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#86868B', lineHeight: 1.6 }}>{children}</div>;
}
