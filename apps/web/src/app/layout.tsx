import type { Metadata } from 'next';
import { Bricolage_Grotesque, Geist } from 'next/font/google';
import type { ReactNode } from 'react';
import { SITE_URL } from '@/lib/site';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

// Wordmark only (weight 800), see components/brand/logo.tsx.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: '800',
  variable: '--font-bricolage',
  display: 'swap',
});

export const metadata: Metadata = {
  // Absolute URLs for OpenGraph and canonical links.
  metadataBase: new URL(SITE_URL),
  title: { default: 'arenaz', template: '%s · arenaz' },
  description: 'Reserve quadras esportivas e monte o seu jogo.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
