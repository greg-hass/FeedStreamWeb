
'use client';

import React, { useState, useEffect } from 'react';
import { FeedSearchService, FeedSearchResult } from '@/lib/feed-search-service';
import { FeedType } from '@/lib/db';
import { Search, Plus, Loader2, Rss, Youtube, Mic, Hash, X } from 'lucide-react';
import { clsx } from 'clsx';
import { FeedService } from '@/lib/feed-service';

interface FeedSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TABS: { id: 'all' | FeedType, label: string, icon: any }[] = [
    { id: 'all', label: 'All', icon: Search },
    { id: 'youtube', label: 'YouTube', icon: Youtube },
    { id: 'podcast', label: 'Podcasts', icon: Mic },
    { id: 'reddit', label: 'Reddit', icon: Hash },
    { id: 'rss', label: 'RSS', icon: Rss },
];

export function FeedSearchModal({ isOpen, onClose }: FeedSearchModalProps) {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | FeedType>('all');
    const [results, setResults] = useState<FeedSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [addingUrl, setAddingUrl] = useState<string | null>(null);

    // Initial focus or reset
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
        }
    }, [isOpen]);

    // Real-time search with debounce
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (!query.trim()) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const res = await FeedSearchService.search(query, activeTab);
                setResults(res);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [query, activeTab]);

    const handleAdd = async (result: FeedSearchResult) => {
        setAddingUrl(result.url);
        try {
            await FeedService.addFeed(result.url);
            onClose();
            alert(`Added ${result.title}`);
        } catch (e: any) {
            alert("Failed to add feed: " + e.message);
        } finally {
            setAddingUrl(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header & Search */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold dark:text-white">Add Feed</h2>
                        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search keywords or paste URL..."
                            className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                                    activeTab === tab.id
                                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                )}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex items-center justify-center p-12 text-zinc-400">
                            <Loader2 className="animate-spin" />
                        </div>
                    ) : results.length > 0 ? (
                        <div className="grid gap-2">
                            {results.map((item, i) => (
                                <div key={i} className="flex items-center gap-4 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg group transition-colors">
                                    <div className="shrink-0 w-12 h-12 bg-zinc-200 dark:bg-zinc-800 rounded-md overflow-hidden">
                                        {item.thumbnail ? (
                                            <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                                <Rss size={20} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium truncate text-zinc-900 dark:text-zinc-100">{item.title}</h3>
                                        <p className="text-xs text-zinc-500 truncate">{item.description || item.url}</p>
                                    </div>

                                    <button
                                        onClick={() => handleAdd(item)}
                                        disabled={!!addingUrl}
                                        className="p-2 text-brand hover:bg-brand/10 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="Add"
                                    >
                                        {addingUrl === item.url ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : query ? (
                        <div className="text-center p-12 text-zinc-500">
                            <p>No results found for "{query}"</p>
                            <button
                                onClick={() => handleAdd({ title: query, url: query, type: 'rss', source: 'rss' })}
                                className="mt-4 text-brand hover:underline"
                            >
                                Try adding as direct URL
                            </button>
                        </div>
                    ) : (
                        <div className="text-center p-12 text-zinc-400">
                            <Search className="mx-auto mb-2 opacity-20" size={48} />
                            <p>Type to search or paste a URL</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Simple debounce hook implementation if not exists
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}
