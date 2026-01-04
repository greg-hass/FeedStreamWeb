'use client';

import { useArticles } from "@/hooks/useArticles";
import { ArticleList } from "@/components/ArticleList";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { clsx } from "clsx";

export default function HomePage() {
  const [view, setView] = useState('today');
  const articles = useArticles(view);
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <AppHeader
        showSearch={true}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Filter Tabs */}
      <div className="px-4 sm:px-6 py-3 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm sticky top-14 z-20">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {['today', 'last24h', 'week', 'all'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={clsx(
                "px-3 py-1.5 text-xs font-medium rounded-full border transition-all capitalize whitespace-nowrap shrink-0",
                view === v
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent"
                  : "bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
              )}
            >
              {v === 'last24h' ? 'Last 24h' : v}
            </button>
          ))}
        </div>
      </div>

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
