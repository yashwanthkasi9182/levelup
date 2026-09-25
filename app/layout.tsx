import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'LevelUp — A little stronger, every day',
  description:
    'Your goals, your pace. Small daily actions, visible progress, and someone in your corner.',
  icons: { icon: '/favicon.svg', apple: '/icon.svg' },
  manifest: '/manifest.webmanifest',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#111310' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
