
'use client';

import { useArticles } from "@/hooks/useArticles";
import { ArticleList } from "@/components/ArticleList";
import { FeedService } from "@/lib/feed-service";
import { useState } from "react";
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
    setIsSyncing(true);
    try {
      await FeedService.syncWithFever();
      // Sequential sync for RSS feeds
      for (const feed of feeds) {
        if (feed.type === 'rss') { // Only sync RSS. Fever handled separately
          await FeedService.refreshFeed(feed);
        }
      }
    } catch (e) {
      console.error(e);
      alert("Sync Error");
    } finally {
      setIsSyncing(false);
    }
  };

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
