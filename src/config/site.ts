export const siteConfig = {
  name: 'Shop Inventory',
  description: 'ระบบบริหารสต็อกและการซื้อขายสำหรับร้านค้าขนาดเล็ก',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ogImage: 'https://placehold.co/1200x630/png?text=Shop+Inventory',
  links: {
    twitter: 'https://twitter.com/shopinv',
    github: 'https://github.com/shopinv/shopinv',
  },
  keywords: ['shop', 'inventory', 'pos', 'management', 'stock', 'sales'],
  authors: [
    {
      name: 'Napatdev.com',
      url: 'https://napatdev.com',
    },
  ],
  creator: 'Napatdev.com',
};
