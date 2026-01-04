import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { AudioPlayer } from "@/components/AudioPlayer";
import { TabBar } from "@/components/TabBar";

export const metadata: Metadata = {
  title: 'FeedStream',
  description: 'Your RSS Feed Reader',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
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

        <main className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-32 md:pb-0 scroll-smooth">
            {children}
          </div>
        </main>

        <div className="md:hidden">
          <TabBar />
        </div>

        <AudioPlayer />
      </body>
    </html>
  );
}
