'use client';

import React, { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { StatsService, FeedStats } from '@/lib/stats-service';
import { BarChart3, BookOpen, Bookmark, Ghost, Flame, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

export default function StatsPage() {
    const [stats, setStats] = useState<FeedStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        StatsService.getStats().then(data => {
            setStats(data);
            setLoading(false);
        });
    }, []);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
            <AppHeader title="Reading Insights" showRefresh={false} />

            <div className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-8">
                
                {/* Header Text */}
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Your Reading Habits</h2>
                    <p className="text-zinc-500">Insights into your content diet.</p>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
                        ))}
                    </div>
                ) : stats ? (
                    <>
                        {/* Key Metrics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                icon={<BookOpen className="text-blue-500" />}
                                label="Total Articles"
                                value={stats.totalArticles.toLocaleString()}
                                subValue={`${stats.readArticles.toLocaleString()} read`}
                            />
                            <StatCard
                                icon={<Activity className="text-emerald-500" />}
                                label="Unread Queue"
                                value={stats.unreadArticles.toLocaleString()}
                                subValue="Articles waiting"
                            />
                            <StatCard
                                icon={<Bookmark className="text-amber-500" />}
                                label="Saved for Later"
                                value={stats.bookmarkedArticles.toLocaleString()}
                                subValue="Bookmarks"
                            />
                            <StatCard
                                icon={<Flame className="text-orange-500" />}
                                label="Most Active Feed"
                                value={stats.topFeeds[0]?.title || '-'}
                                subValue={`${stats.topFeeds[0]?.count || 0} posts (30d)`}
                            />
                        </div>

                        {/* Split Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            {/* Top Feeds */}
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                    <BarChart3 size={20} className="text-zinc-400" />
                                    Busiest Feeds (Last 30 Days)
                                </h3>
                                <div className="space-y-4">
                                    {stats.topFeeds.map((feed, idx) => (
                                        <div key={feed.id} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <span className="text-sm font-mono text-zinc-400 w-4">{idx + 1}</span>
                                                <span className="font-medium truncate text-zinc-700 dark:text-zinc-300">{feed.title}</span>
                                            </div>
                                            <span className="text-sm font-medium bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-600 dark:text-zinc-400">
                                                {feed.count}
                                            </span>
                                        </div>
                                    ))}
                                    {stats.topFeeds.length === 0 && (
                                        <p className="text-zinc-400 italic">No recent activity.</p>
                                    )}
                                </div>
                            </div>

                            {/* Ghost Feeds */}
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                    <Ghost size={20} className="text-purple-500" />
                                    Ghost Feeds
                                </h3>
                                <p className="text-sm text-zinc-500 mb-4">Feeds that haven't posted in over 90 days.</p>
                                
                                <div className="space-y-4">
                                    {stats.ghostFeeds.map((feed) => (
                                        <div key={feed.id} className="flex items-center justify-between">
                                            <span className="font-medium truncate text-zinc-700 dark:text-zinc-300">{feed.title}</span>
                                            <span className="text-xs text-zinc-400">
                                                Last: {format(feed.lastPostDate, 'MMM d, yyyy')}
                                            </span>
                                        </div>
                                    ))}
                                    {stats.ghostFeeds.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
                                            <Ghost size={32} className="mb-2 opacity-20" />
                                            <p>Your feeds are healthy!</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, subValue }: { icon: React.ReactNode, label: string, value: string, subValue: string }) {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-3 text-zinc-500 text-sm font-medium">
                {icon}
                {label}
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">
                {value}
            </div>
            <div className="text-xs text-zinc-400 font-medium">
                {subValue}
            </div>
        </div>
    );
}
