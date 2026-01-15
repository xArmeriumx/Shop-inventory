import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});



export const metadata: Metadata = {
  title: 'Shop Inventory | ระบบบริหารสต็อกและการขาย',
  description: 'ระบบบริหารสต็อกและการซื้อขายสำหรับร้านค้าขนาดเล็ก',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ShopInv',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

