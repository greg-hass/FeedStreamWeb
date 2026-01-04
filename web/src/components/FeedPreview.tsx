'use client';

import { useState, useEffect } from 'react';
import { Loader2, X, Check, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { parseFeed } from '@/lib/feed-parser';
import { formatDistanceToNow } from 'date-fns';
import { Article } from '@/lib/db';

interface FeedPreviewProps {
    feedUrl: string;
    onCancel: () => void;
    onConfirm: () => void;
}

export function FeedPreview({ feedUrl, onCancel, onConfirm }: FeedPreviewProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [feedData, setFeedData] = useState<{
        title: string;
        description?: string;
        icon?: string;
        articles: Article[];
    } | null>(null);

    useEffect(() => {
        const fetchPreview = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch feed via proxy
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(feedUrl)}`;
                const response = await fetch(proxyUrl);

                if (!response.ok) {
                    throw new Error('Failed to fetch feed');
                }

                const text = await response.text();
                const parsed = await parseFeed(text, feedUrl);

                setFeedData({
                    title: parsed.title || 'Untitled Feed',
                    description: parsed.site,
                    icon: parsed.avatarURL,
                    articles: parsed.articles.slice(0, 5) // Only show first 5
                });
            } catch (e: any) {
                console.error('Feed preview error:', e);
                setError(e.message || 'Failed to load feed preview');
            } finally {
                setLoading(false);
            }
        };

        fetchPreview();
    }, [feedUrl]);

    if (loading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="animate-spin text-brand" size={32} />
                <p className="text-sm text-zinc-500">Loading feed preview...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 space-y-4">
                <div className="text-center">
                    <div className="text-red-500 mb-2">⚠️</div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
                    <p className="text-xs text-zinc-500 mt-2">You can still try adding this feed</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2 px-4 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2 px-4 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors"
                    >
                        Add Anyway
                    </button>
                </div>
            </div>
        );
    }

    if (!feedData) return null;

    return (
        <div className="p-4 sm:p-6 space-y-4">
            {/* Feed Header */}
            <div className="flex gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                {feedData.icon && (
                    <img
                        src={feedData.icon}
                        alt=""
                        className="w-16 h-16 rounded-lg object-cover bg-zinc-200 dark:bg-zinc-800"
                    />
                )}
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {feedData.title}
                    </h3>
                    {feedData.description && (
                        <p className="text-sm text-zinc-500 truncate">{feedData.description}</p>
                    )}
                </div>
            </div>

            {/* Recent Articles */}
            <div>
                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    Recent Articles ({feedData.articles.length})
                </h4>

                {feedData.articles.length > 0 ? (
                    <div className="space-y-2">
                        {feedData.articles.map((article, i) => (
                            <div
                                key={i}
                                className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
                            >
                                <h5 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2 mb-1">
                                    {article.title}
                                </h5>
                                {article.publishedAt && (
                                    <p className="text-xs text-zinc-500">
                                        {formatDistanceToNow(article.publishedAt, { addSuffix: true })}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-zinc-500 text-center py-8">
                        No recent articles found
                    </p>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
                <button
                    onClick={onCancel}
                    className="flex-1 py-2.5 px-4 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors font-medium"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className="flex-1 py-2.5 px-4 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors font-medium flex items-center justify-center gap-2"
                >
                    <Check size={18} />
                    Add Feed
                </button>
            </div>
        </div>
    );
}
