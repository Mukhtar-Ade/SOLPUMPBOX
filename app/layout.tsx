import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppWalletProvider } from '@/components/wallet/WalletProvider';
import { SiteHeader } from '@/components/layout/SiteHeader';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SOLPUMPBOX | Unbox The Next Pump',
  description: 'Trade trending Solana memecoins with Jupiter routing, live charts and safety scores.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-black`}>
        <AppWalletProvider>
          <SiteHeader />
          <main>{children}</main>
        </AppWalletProvider>
      </body>
    </html>
  );
}
