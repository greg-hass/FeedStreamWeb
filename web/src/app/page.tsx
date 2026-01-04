
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

import { Search, X } from "lucide-react";

// ... existing imports

export default function HomePage() {
  const [view, setView] = useState('today');

  // Use 'today' hook for 'today' view, 'last24h' for others to get initial data correctly?
  // Actually, we should pass the current 'view' state to useArticles directly
  // But for 'search' to work across 'all', we might want to fetch 'all' and filter client side?
  // User asked for "Smart Search". 
  // Let's rely on useArticles to fetch the base dataset (e.g. today/week/all) and then filter in UI.

  const articles = useArticles(view);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const feeds = useLiveQuery(() => db.feeds.toArray()) || [];

  // Filter articles client-side based on search query
  const filteredArticles = (articles || []).filter(article => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      article.title.toLowerCase().includes(q) ||
      article.summary?.toLowerCase().includes(q) ||
      (article.contentHTML && article.contentHTML.toLowerCase().includes(q))
    );
  });

  // ... handleSync ...
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

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <FeedSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Premium Glass Header */}
      <header className="header-blur sticky top-0 z-30 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="h-14 flex items-center justify-between px-4 sm:px-6 gap-4">

          {/* Search Bar - Replaces Title when active or just always visible? 
              Let's make it always visible but small, or expandable using proper UI.
              Given user wants "Smart Search", a dedicated bar is better.
          */}
          <div className="flex-1 max-w-md relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-full py-1.5 pl-9 pr-8 text-sm focus:ring-2 focus:ring-brand/20 transition-all placeholder:text-zinc-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {/* Filter Tabs */}
            <div className="hidden sm:flex bg-zinc-200 dark:bg-zinc-800 rounded-lg p-0.5">
              {['today', 'last24h', 'week', 'all'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={clsx(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all capitalize",
                    view === v
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  {v === 'last24h' ? '24h' : v}
                </button>
              ))}
            </div>

            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={clsx(
                "p-2 rounded-full transition-colors",
                "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800",
                isSyncing && "opacity-50"
              )}
              title="Refresh Feeds"
            >
              <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 rounded-full bg-brand text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20"
              title="Add Feed"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Mobile Filter Tabs (Visible only on small screens) */}
        <div className="sm:hidden px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {['today', 'last24h', 'week', 'all'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={clsx(
                  "px-3 py-1.5 text-xs font-medium rounded-full border transition-all capitalize whitespace-nowrap",
                  view === v
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent"
                    : "bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                )}
              >
                {v === 'last24h' ? 'Last 24h' : v}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {filteredArticles ? (
          <ArticleList articles={filteredArticles} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-zinc-400">Loading...</div>
          </div>
        )}
      </div>
    </div>
  );
}
