import { SpeedInsights } from "@vercel/speed-insights/next";
import React from 'react';

export const metadata = {
  title: 'Fabrica Foodie - 您的 Threads 美食收藏庫',
  description: '專屬於您的 Threads 美食檔案館。在 Threads 標記 @fabrica，AI 自動為您彙整地圖。',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
};

export default function RootLayout({ children }) {
  // 偵測是否處於客戶端預覽沙盒環境中（非真正的 Next.js 運行環境）
  // 這可以完美避免在預覽時將 <html> 與 <body> 巢狀掛載於 <div> 中產生的 DOM 警告
  const isPreviewSandbox = typeof window !== 'undefined' && !window.__NEXT_DATA__;

  if (isPreviewSandbox) {
    return (
      <div className="antialiased">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          body {
            background-color: #F2F2F7;
            color: #1C1C1E;
            margin: 0;
          }
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
        {children}
      </div>
    );
  }

  // 真正的 Next.js 伺服器與客戶端渲染（用於 Vercel 部署）
  return (
    <html lang="zh-TW">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          body {
            background-color: #F2F2F7;
            color: #1C1C1E;
            margin: 0;
          }
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
