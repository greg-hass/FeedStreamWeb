
'use client';

import { useArticles } from "@/hooks/useArticles";
import { ArticleList } from "@/components/ArticleList";
import { FeedService } from "@/lib/feed-service";
import { useState, useEffect } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { FeedSearchModal } from "@/components/FeedSearchModal";
import { clsx } from "clsx";

export default function HomePage() {
  const [view, setView] = useState('today');
  const articles = useArticles(view);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const feeds = useLiveQuery(() => db.feeds.toArray()) || [];

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await FeedService.syncWithFever();
      for (const feed of feeds) {
        if (feed.type === 'rss') {
          await FeedService.refreshFeed(feed);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => handleSync(), 900000);
    return () => clearInterval(interval);
  }, [feeds.length]);

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <FeedSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Premium Glass Header */}
      <header className="header-blur sticky top-0 z-30 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="h-14 flex items-center justify-between px-4 sm:px-6">
          <h1 className="text-xl font-bold tracking-tight">Today</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={clsx(
                "p-2 rounded-full transition-colors",
                "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800",
                isSyncing && "opacity-50"
              )}
              title="Refresh"
            >
              <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 rounded-full bg-brand text-white hover:brightness-110 transition-all"
              title="Add Feed"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {articles ? (
          <ArticleList articles={articles} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-zinc-400">Loading...</div>
          </div>
        )}
      </div>
    </div>
  );
}
