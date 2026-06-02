import React from 'react';

export const metadata = {
  title: 'Fabrica Foodie - 您的 Threads 美食收藏庫',
  description: '專屬於您的 Threads 美食檔案館。在 Threads 標記 @fabrica，AI 自動為您彙整地圖。',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
