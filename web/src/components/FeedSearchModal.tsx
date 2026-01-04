'use client';

import React, { useState, useEffect } from 'react';
import { FeedSearchService, FeedSearchResult } from '@/lib/feed-search-service';
import { FeedType } from '@/lib/db';
import { Search, Plus, Loader2, Rss, Youtube, Mic, Hash, X, Link as LinkIcon, List } from 'lucide-react';
import { clsx } from 'clsx';
import { FeedService } from '@/lib/feed-service';
import { FolderSelector } from './FolderSelector';
import { URLDetector } from '@/lib/url-detector';

interface FeedSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = 'search' | 'url' | 'bulk';

const FEED_TABS: { id: 'all' | FeedType, label: string, icon: any }[] = [
    { id: 'all', label: 'All', icon: Search },
    { id: 'youtube', label: 'YouTube', icon: Youtube },
    { id: 'podcast', label: 'Podcasts', icon: Mic },
    { id: 'reddit', label: 'Reddit', icon: Hash },
    { id: 'rss', label: 'RSS', icon: Rss },
];

export function FeedSearchModal({ isOpen, onClose }: FeedSearchModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('url');
    const [query, setQuery] = useState('');
    const [feedTypeFilter, setFeedTypeFilter] = useState<'all' | FeedType>('all');
    const [results, setResults] = useState<FeedSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [addingUrl, setAddingUrl] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [bulkUrls, setBulkUrls] = useState('');
    const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setBulkUrls('');
            setSelectedFolderId(null);
        }
    }, [isOpen]);

    // Search with debounce
    useEffect(() => {
        if (activeTab !== 'search') return;

        const timeoutId = setTimeout(async () => {
            if (!query.trim()) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const res = await FeedSearchService.search(query, feedTypeFilter);
                setResults(res);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [query, feedTypeFilter, activeTab]);

    const handleAdd = async (url: string, title?: string) => {
        setAddingUrl(url);
        try {
            // Auto-convert YouTube/Reddit URLs
            const convertedUrl = await URLDetector.convertToFeedURL(url);
            await FeedService.addFeed(convertedUrl, selectedFolderId || undefined);
            onClose();
            alert(`Added ${title || 'feed'}`);
        } catch (e: any) {
            alert("Failed to add feed: " + e.message);
        } finally {
            setAddingUrl(null);
        }
    };

    const handleBulkAdd = async () => {
        const urls = bulkUrls.split('\n').map(u => u.trim()).filter(u => u);
        if (urls.length === 0) return;

        setBulkProgress({ current: 0, total: urls.length });
        let added = 0;
        let failed = 0;

        for (let i = 0; i < urls.length; i++) {
            try {
                const url = urls[i];
                const convertedUrl = await URLDetector.convertToFeedURL(url);
                await FeedService.addFeed(convertedUrl, selectedFolderId || undefined);
                added++;
            } catch (e) {
                console.error('Failed to add:', urls[i], e);
                failed++;
            }
            setBulkProgress({ current: i + 1, total: urls.length });
        }

        setBulkProgress(null);
        alert(`Added ${added} feeds${failed > 0 ? `, ${failed} failed` : ''}`);
        if (added > 0) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            {/* Bottom sheet on mobile, center modal on desktop */}
            <div
                className={clsx(
                    "bg-white dark:bg-zinc-900 overflow-hidden flex flex-col",
                    // Mobile: bottom sheet
                    "fixed bottom-0 left-0 right-0 rounded-t-2xl max-h-[85vh]",
                    // Desktop: center modal
                    "md:relative md:mx-auto md:my-auto md:top-1/2 md:-translate-y-1/2 md:max-w-2xl md:rounded-xl md:shadow-2xl md:max-h-[80vh]"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag handle (mobile only) */}
                <div className="md:hidden flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold dark:text-white">Add Feed</h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Main tabs */}
                    <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 -mb-3">
                        <button
                            onClick={() => setActiveTab('url')}
                            className={clsx(
                                "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                                activeTab === 'url'
                                    ? "border-brand text-brand"
                                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            )}
                        >
                            <LinkIcon size={16} />
                            URL
                        </button>
                        <button
                            onClick={() => setActiveTab('search')}
                            className={clsx(
                                "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                                activeTab === 'search'
                                    ? "border-brand text-brand"
                                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            )}
                        >
                            <Search size={16} />
                            Search
                        </button>
                        <button
                            onClick={() => setActiveTab('bulk')}
                            className={clsx(
                                "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                                activeTab === 'bulk'
                                    ? "border-brand text-brand"
                                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            )}
                        >
                            <List size={16} />
                            Bulk
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'url' && (
                        <div className="p-4 sm:p-6 space-y-4">
                            <div className="relative">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Paste feed URL, YouTube channel, or Reddit subreddit..."
                                    className="w-full pl-10 pr-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-zinc-900 dark:text-zinc-100"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {query && URLDetector.isValidURL(query) && (
                                <div className="text-sm text-zinc-500">
                                    {URLDetector.isFeedURL(query) ? (
                                        <span className="text-emerald-600 dark:text-emerald-400">✓ Valid feed URL detected</span>
                                    ) : (
                                        <span className="text-amber-600 dark:text-amber-400">⚠ Will attempt auto-conversion (YouTube/Reddit)</span>
                                    )}
                                </div>
                            )}

                            <FolderSelector
                                selectedFolderId={selectedFolderId}
                                onChange={setSelectedFolderId}
                            />

                            <button
                                onClick={() => handleAdd(query)}
                                disabled={!query.trim() || !!addingUrl}
                                className="w-full py-3 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {addingUrl ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="animate-spin" size={20} />
                                        Adding...
                                    </div>
                                ) : (
                                    'Add Feed'
                                )}
                            </button>
                        </div>
                    )}

                    {activeTab === 'search' && (
                        <div className="p-4 sm:p-6 space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search for feeds..."
                                    className="w-full pl-10 pr-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-zinc-900 dark:text-zinc-100"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {/* Feed type filters */}
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {FEED_TABS.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setFeedTypeFilter(tab.id)}
                                        className={clsx(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                                            feedTypeFilter === tab.id
                                                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                        )}
                                    >
                                        <tab.icon size={14} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <FolderSelector
                                selectedFolderId={selectedFolderId}
                                onChange={setSelectedFolderId}
                            />

                            {/* Search results */}
                            <div className="min-h-[200px]">
                                {loading ? (
                                    <div className="flex items-center justify-center p-12 text-zinc-400">
                                        <Loader2 className="animate-spin" />
                                    </div>
                                ) : results.length > 0 ? (
                                    <div className="space-y-2">
                                        {results.map((item, i) => (
                                            <div key={i} className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg group transition-colors">
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
                                                    onClick={() => handleAdd(item.url, item.title)}
                                                    disabled={!!addingUrl}
                                                    className="p-2 bg-brand text-white rounded-full hover:bg-brand/80 transition-colors"
                                                >
                                                    {addingUrl === item.url ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : query ? (
                                    <div className="text-center p-12 text-zinc-500">
                                        <p>No results found</p>
                                    </div>
                                ) : (
                                    <div className="text-center p-12 text-zinc-400">
                                        <Search className="mx-auto mb-2 opacity-20" size={48} />
                                        <p>Type to search for feeds</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'bulk' && (
                        <div className="p-4 sm:p-6 space-y-4">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                Paste multiple feed URLs (one per line). YouTube channels and Reddit subreddits will be auto-converted.
                            </p>

                            <textarea
                                placeholder="https://example.com/feed&#10;https://www.youtube.com/@channel&#10;https://reddit.com/r/subreddit"
                                className="w-full h-48 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-zinc-900 dark:text-zinc-100 font-mono text-sm resize-none"
                                value={bulkUrls}
                                onChange={(e) => setBulkUrls(e.target.value)}
                                autoFocus
                            />

                            <FolderSelector
                                selectedFolderId={selectedFolderId}
                                onChange={setSelectedFolderId}
                            />

                            {bulkProgress && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                                        <span>Adding feeds...</span>
                                        <span>{bulkProgress.current} / {bulkProgress.total}</span>
                                    </div>
                                    <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-brand transition-all duration-300"
                                            style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleBulkAdd}
                                disabled={!bulkUrls.trim() || !!bulkProgress}
                                className="w-full py-3 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {bulkProgress ? 'Adding...' : `Add ${bulkUrls.split('\n').filter(u => u.trim()).length} Feeds`}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
