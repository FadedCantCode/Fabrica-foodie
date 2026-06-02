// ─── Food helpers ─────────────────────────────────────────────────────────────

export const FOOD_IMAGES = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1525648199074-cee30ba79a4a?q=80&w=800&auto=format&fit=crop",
];

export const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1414235077428-338988692309?q=80&w=800&auto=format&fit=crop";

export const TAIWAN_TRENDY_RECS = [
  { id: "fallback-1", name: "詹記麻辣火鍋", address: "台北市大安區和平東路三段60號", category: "火鍋專賣", note: "📍 台北極致傳奇麻辣鍋，鴨血豆腐堪稱美味天花板，絕對必吃。" },
  { id: "fallback-2", name: "五之神製作所", address: "台北市信義區忠孝東路四段553巷6弄6號", category: "日式料理", note: "📍 超濃厚蝦沾麵名店，濃郁蝦湯搭配特色配菜，排隊不間斷。" },
  { id: "fallback-3", name: "約翰紅茶公司", address: "台北市內湖區江南街98號", category: "手搖茶攤", note: "📍 精緻紅茶專家，大推煮濃那堤與約翰紅茶，茶香極佳。" },
  { id: "fallback-4", name: "榕錦時光生活園區 - 興波咖啡", address: "台北市大安區金華街167號", category: "咖啡甜點", note: "📍 世界冠軍大師級精品咖啡館，日式老木屋改建極富質感。" },
];

export const getFoodImage = (restaurant) => {
  if (restaurant?.sourceImageUrl) return restaurant.sourceImageUrl;
  const name = restaurant?.name || "";
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return FOOD_IMAGES[sum % FOOD_IMAGES.length];
};

export const getFreeMapAppUrl = (name, address) => {
  const hasAddr = address && address !== "僅提供店名定位" && address.trim() !== "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hasAddr ? `${name} ${address}` : name)}`;
};

export const getSmartTag = (name = "", currentCategory = "") => {
  const n = name;
  if (n.includes("鍋") || n.includes("麻辣") || n.includes("涮涮") || n.includes("石二鍋") || n.includes("海底撈")) return "火鍋專賣";
  if (n.includes("茶") || n.includes("嵐") || n.includes("五桐") || n.includes("渴") || n.includes("奶") || n.includes("飲料") || n.includes("紅茶") || n.includes("綠茶") || n.includes("手搖")) return "手搖茶攤";
  if (n.includes("咖啡") || n.toLowerCase().includes("cafe") || n.includes("甜點") || n.includes("烘焙") || n.includes("蛋糕")) return "咖啡甜點";
  if (n.includes("拉麵") || n.includes("日式") || n.includes("壽司") || n.includes("丼") || n.includes("居酒屋") || n.includes("食堂")) return "日式料理";
  if (n.includes("便當") || n.includes("飯") || n.includes("麵") || n.includes("小吃") || n.includes("排骨")) return "台式小吃 • 便當";
  if (n.includes("燒肉") || n.includes("烤") || n.includes("串燒") || n.includes("乾杯") || n.includes("屋馬")) return "燒肉串燒";
  if (currentCategory && currentCategory !== "美食餐廳" && currentCategory !== "在地美食") return currentCategory.trim();
  return "精選美食";
};

export const extractThreadsAuthor = (url = "") => {
  try { return new URL(url).pathname.match(/\/@([^/]+)/)?.[1] || ""; }
  catch { return ""; }
};

export const generateAIReview = async (name, address) => {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    if (!apiKey) return null;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `請搜尋台灣的這間餐廳：${name} ${address} 的最新網路資訊。` }] }],
          tools: [{ googleSearch: {} }],
          systemInstruction: { parts: [{ text: "你是一個高端美食顧問 Fabrica。請用 50-80 字精煉總結這家餐廳的真實網路評價、特色招牌菜色。請務必確保語意完整、順利結尾。語氣要專業、具質感，直接給出純文字結果。" }] }
        })
      }
    );
    const data = await res.json();
    if (data.error) return null;
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch { return null; }
};

export const getMasterUid = async (username) => {
  if (!username) return "";
  try {
    const res = await fetch(`/api/get-master-uid?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    return data.masterUid || `threads_${username}`;
  } catch { return `threads_${username}`; }
};
