export const metadata = {
  title: 'Fabrica Foodie - 您的 Threads 美食收藏庫',
  description: '專屬於您的 Threads 美食檔案館。在 Threads 標記 @fabrica，AI 自動為您彙整地圖。',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <head>
        {/* 載入 Tailwind CDN，確保在各種環境下 CSS 都能正常渲染 */}
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          body {
            background-color: #F2F2F7;
            color: #1C1C1E;
          }
          /* 隱藏滾動條，保持 iOS 乾淨質感 */
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