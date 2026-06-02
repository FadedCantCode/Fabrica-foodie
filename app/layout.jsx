import React from 'react';

export const metadata = {
  title: 'Fabrica Foodie - 您的 Threads 美食收藏庫',
  description: '專屬於您的 Threads 美食檔案館。在 Threads 標記 @fabrica，AI 自動為您彙整地圖。',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          body {
            background-color: #F2F2F7;
            color: #1C1C1E;
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
          }
          .no-scrollbar::-webkit-scrollbar,
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .no-scrollbar, .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

          @keyframes fade-in { from{opacity:0} to{opacity:1} }
          @keyframes fade-in-up { from{opacity:0;transform:translate(-50%,18px) scale(0.96)} to{opacity:1;transform:translate(-50%,0) scale(1)} }
          @keyframes bounce-in { 0%{opacity:0;transform:scale(0.88) translateY(14px)} 60%{opacity:1;transform:scale(1.03) translateY(-3px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
          @keyframes slide-up { from{opacity:0;transform:translateY(36px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
          @keyframes slide-down-out { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(40px) scale(0.96)} }
          @keyframes marquee-up { 0%{transform:translateX(0%)} 100%{transform:translateX(-50%)} }
          @keyframes marquee-down { 0%{transform:translateX(-50%)} 100%{transform:translateX(0%)} }
          @keyframes dropdown-in { from{opacity:0;transform:translateY(8px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
          @keyframes ripple { 0%{transform:scale(0);opacity:0.55} 100%{transform:scale(4.5);opacity:0} }
          @keyframes success-pop { 0%{transform:scale(0);opacity:0} 55%{transform:scale(1.22);opacity:1} 100%{transform:scale(1);opacity:1} }
          @keyframes check-draw { from{stroke-dashoffset:30} to{stroke-dashoffset:0} }
          @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
          @keyframes pulse-badge { 0%,100%{opacity:1} 50%{opacity:0.6} }
          @keyframes card-appear { from{opacity:0;transform:translateY(18px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }

          .animate-fade-in        { animation: fade-in        0.45s cubic-bezier(0.2,0.8,0.2,1) both }
          .animate-fade-in-up     { animation: fade-in-up     0.45s cubic-bezier(0.2,0.8,0.2,1) both }
          .animate-bounce-in      { animation: bounce-in      0.6s  cubic-bezier(0.2,0.8,0.2,1) both }
          .animate-slide-up       { animation: slide-up       0.42s cubic-bezier(0.2,0.8,0.2,1) both }
          .animate-slide-down-out { animation: slide-down-out 0.35s cubic-bezier(0.4,0,1,1)     both }
          .animate-marquee-up     { animation: marquee-up     12s   linear infinite }
          .animate-marquee-down   { animation: marquee-down   12s   linear infinite }
          .animate-dropdown-in    { animation: dropdown-in    0.22s cubic-bezier(0.2,0.8,0.2,1) both }
          .animate-ripple         { animation: ripple         0.55s cubic-bezier(0.2,0.8,0.2,1) forwards }
          .animate-success-pop    { animation: success-pop    0.5s  cubic-bezier(0.2,0.8,0.2,1) both }
          .animate-shake          { animation: shake          0.4s  cubic-bezier(0.2,0.8,0.2,1) }
          .animate-pulse-badge    { animation: pulse-badge    2.2s  ease-in-out infinite }
          .animate-card-appear    { animation: card-appear    0.48s cubic-bezier(0.2,0.8,0.2,1) both }
          .animate-check-path {
            stroke-dasharray: 30;
            stroke-dashoffset: 30;
            animation: check-draw 0.38s 0.18s cubic-bezier(0.2,0.8,0.2,1) forwards;
          }
        `}</style>
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
