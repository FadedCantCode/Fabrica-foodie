import React from 'react';
import './globals.css';

export const metadata = {
  title: 'Fabrica Foodie - 您的 Threads 美食收藏庫',
  description: '專屬於您的 Threads 美食檔案館。在 Threads 標記 @fabrica，AI 自動為您彙整地圖。',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
