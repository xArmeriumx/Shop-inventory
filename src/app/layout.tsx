import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Shop Inventory | ระบบบริหารสต็อกและการขาย',
  description: 'ระบบบริหารสต็อกและการซื้อขายสำหรับร้านค้าขนาดเล็ก',
  manifest: '/manifest.json',
  themeColor: '#09090b',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false, // Prevent zooming for native app feel
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ShopInv',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
