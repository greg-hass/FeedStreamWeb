import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { clsx } from 'clsx';
import { AudioPlayer } from "@/components/AudioPlayer";

export const metadata: Metadata = {
  title: 'FeedStream',
  description: 'Self-hosted RSS Reader and PWA',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FeedStream',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-background text-foreground">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className={clsx(
            "flex-1 md:ml-64 min-h-screen transition-all duration-200 ease-in-out",
            "pb-20 md:pb-0" // Padding for mobile tabbar
          )}>
            {children}
          </main>
          {/* MobileTabbar will go here */}
        </div>
        <AudioPlayer />
      </body>
    </html>
  );
}
