import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { AudioPlayer } from "@/components/AudioPlayer";
import { TabBar } from "@/components/TabBar";
import { GlobalUI } from "@/components/GlobalUI";

import { Toaster } from 'sonner';

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
      <head>
        <script src="/env-config.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                if (e.message && e.message.indexOf('Loading chunk') !== -1) {
                  window.location.reload();
                }
              }, true);
            `,
          }}
        />
      </head>
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
        <Toaster position="bottom-center" toastOptions={{
          style: {
            background: 'var(--background)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          },
          className: 'dark:bg-zinc-900 dark:text-white dark:border-zinc-800 bg-white text-zinc-900 border-zinc-200'
        }} />
      </body>
    </html>
  );
}
