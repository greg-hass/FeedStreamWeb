import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { AudioPlayer } from "@/components/AudioPlayer";
import { TabBar } from "@/components/TabBar";
import { GlobalUI } from "@/components/GlobalUI";

export const metadata: Metadata = {
  title: 'FeedStream',
  description: 'Your RSS Feed Reader',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FeedStream',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 h-screen w-screen overflow-hidden flex flex-row">
        <Sidebar className="hidden md:flex" />

        <main className="flex-1 w-full h-full relative overflow-hidden flex flex-col pt-[env(safe-area-inset-top)] md:pt-0">
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-32 md:pb-0 scroll-smooth">
            {children}
          </div>
        </main>

        <div className="md:hidden">
          <TabBar />
        </div>

        <AudioPlayer />
        <GlobalUI />
      </body>
    </html>
  );
}
