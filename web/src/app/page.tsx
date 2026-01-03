
'use client';

import { useArticles } from "@/hooks/useArticles";
import { ArticleList } from "@/components/ArticleList";
import { FeedService } from "@/lib/feed-service";
import { useState, useEffect } from "react";
import { Plus, RotateCw } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { FeedSearchModal } from "@/components/FeedSearchModal";

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
      // Sequential sync for RSS feeds
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

  // Auto-Refresh every 15 minutes (900000ms)
  useEffect(() => {
    const interval = setInterval(() => {
      handleSync();
    }, 900000);
    return () => clearInterval(interval);
  }, [feeds.length]); // Re-bind if feeds change, though strictly handleSync ref is stable enough usually or better use ref

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-zinc-950">
      <FeedSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 shrink-0">
        <h1 className="font-semibold text-lg">Today</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50"
            title="Sync All"
          >
            <RotateCw size={20} className={isSyncing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            title="Add Feed"
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {articles ? (
          <ArticleList articles={articles} />
        ) : (
          <div className="p-8 text-center text-zinc-500">Loading...</div>
        )}
      </div>
    </div>
  );
}
