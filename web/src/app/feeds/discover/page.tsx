'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Plus, Loader2, Check, Rss, Youtube, MessageCircle, Mic } from 'lucide-react';
import { FeedDiscoveryService, FeedRecommendation } from '@/lib/feed-discovery';
import { FeedService } from '@/lib/feed-service';
import { clsx } from 'clsx';
import { toast } from 'sonner';

export default function DiscoverPage() {
    const [recommendations, setRecommendations] = useState<FeedRecommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
    const [processingUrl, setProcessingUrl] = useState<string | null>(null);

    const handleDiscover = async () => {
        setLoading(true);
        setError(null);
        try {
            const results = await FeedDiscoveryService.generateRecommendations();
            setRecommendations(results);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async (rec: FeedRecommendation) => {
        setProcessingUrl(rec.url);
        try {
            await FeedService.addFeed(rec.url);
            setSubscribed(prev => new Set(prev).add(rec.url));
            toast.success(`Subscribed to ${rec.title}`);
        } catch (e: any) {
            toast.error(`Failed to add feed: ${e.message}`);
        } finally {
            setProcessingUrl(null);
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'youtube': return Youtube;
            case 'reddit': return MessageCircle;
            case 'podcast': return Mic;
            default: return Rss;
        }
    };

    return (
        <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
            {/* Header */}
            <header className="header-blur sticky top-0 z-30 border-b border-zinc-200/50 dark:border-zinc-800/50">
                <div className="h-14 flex items-center gap-3 px-4 sm:px-6">
                    <Link href="/feeds/manage" className="p-2 -ml-2 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-xl font-bold tracking-tight flex-1 flex items-center gap-2">
                        <Sparkles className="text-purple-500" size={20} />
                        Discover Feeds
                    </h1>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="max-w-4xl mx-auto">
                    
                    {/* Hero / Empty State */}
                    {recommendations.length === 0 && !loading && (
                        <div className="text-center py-12 md:py-20">
                            <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <Sparkles className="text-purple-600 dark:text-purple-400 w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-bold mb-3">AI-Powered Discovery</h2>
                            <p className="text-zinc-500 max-w-md mx-auto mb-8">
                                FeedStream analyzes your existing subscriptions to find new blogs, YouTube channels, and subreddits tailored to your interests.
                            </p>
                            <button
                                onClick={handleDiscover}
                                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-purple-500/20 transition-all active:scale-95 flex items-center gap-2 mx-auto"
                            >
                                <Sparkles size={18} />
                                Analyze & Find Feeds
                            </button>
                            {error && (
                                <p className="mt-4 text-red-500 bg-red-50 dark:bg-red-900/10 py-2 px-4 rounded-lg inline-block text-sm">
                                    {error}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="text-center py-20">
                            <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-4" />
                            <p className="text-zinc-500 animate-pulse">Analyzing your library...</p>
                        </div>
                    )}

                    {/* Results Grid */}
                    {recommendations.length > 0 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-lg">Recommended for You</h3>
                                <button onClick={handleDiscover} className="text-sm text-purple-600 hover:underline">
                                    Refresh Recommendations
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {recommendations.map((rec, i) => {
                                    const Icon = getTypeIcon(rec.type);
                                    const isSubscribed = subscribed.has(rec.url);
                                    const isProcessing = processingUrl === rec.url;

                                    return (
                                        <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                                                    <Icon size={20} className="text-zinc-600 dark:text-zinc-400" />
                                                </div>
                                                <span className="text-xs font-medium px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500">
                                                    {rec.category}
                                                </span>
                                            </div>
                                            
                                            <h4 className="font-bold text-lg mb-1">{rec.title}</h4>
                                            <p className="text-sm text-zinc-500 mb-4 flex-1">{rec.description}</p>
                                            
                                            <button
                                                onClick={() => handleSubscribe(rec)}
                                                disabled={isSubscribed || isProcessing}
                                                className={clsx(
                                                    "w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all",
                                                    isSubscribed
                                                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default"
                                                        : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 active:scale-95"
                                                )}
                                            >
                                                {isProcessing ? (
                                                    <Loader2 size={16} className="animate-spin" />
                                                ) : isSubscribed ? (
                                                    <><Check size={16} /> Subscribed</>
                                                ) : (
                                                    <><Plus size={16} /> Subscribe</>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
