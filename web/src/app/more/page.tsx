'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import Link from 'next/link';
import {
    ChevronRight,
    FileText,
    MessageCircle,
    Youtube,
    Mic,
    FolderOpen,
    Rss,
    Clock,
    Settings as SettingsIcon,
    Edit2,
    Play,
    Radio
} from 'lucide-react';
import { clsx } from 'clsx';

export default function MorePage() {
    const folders = useLiveQuery(() => db.folders.orderBy('position').toArray()) || [];
    const feeds = useLiveQuery(() => db.feeds.toArray()) || [];

    // Smart folder counts
    const mediaCounts = useLiveQuery(async () => {
        const [youtube, podcast, reddit, rss] = await Promise.all([
            db.articles.where('mediaKind').equals('youtube').count(),
            db.articles.where('mediaKind').equals('podcast').count(),
            db.feeds.where('type').equals('reddit').toArray().then(feeds => {
                if (feeds.length === 0) return 0;
                return db.articles.where('feedID').anyOf(feeds.map(f => f.id)).count();
            }),
            db.feeds.where('type').anyOf(['reddit', 'youtube', 'podcast']).toArray().then(async excludedFeeds => {
                if (excludedFeeds.length === 0) {
                    return db.articles.count();
                }
                const excludedIds = excludedFeeds.map(f => f.id);
                const allArticles = await db.articles.toArray();
                return allArticles.filter(a => !excludedIds.includes(a.feedID)).length;
            })
        ]);
        return { youtube, podcast, reddit, rss };
    }) || { youtube: 0, podcast: 0, reddit: 0, rss: 0 };

    const smartFolders = [
        { href: '/folder/rss', label: 'RSS', icon: FileText, count: mediaCounts.rss },
        { href: '/folder/reddit', label: 'Reddit', icon: MessageCircle, count: mediaCounts.reddit },
        { href: '/folder/youtube', label: 'YouTube', icon: Youtube, count: mediaCounts.youtube },
        { href: '/folder/podcasts', label: 'Podcasts', icon: Mic, count: mediaCounts.podcast },
    ];

    return (
        <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
            <header className="header-blur sticky top-0 z-30 border-b border-zinc-200/50 dark:border-zinc-800/50">
                <div className="h-14 flex items-center px-4 sm:px-6">
                    <h1 className="text-xl font-bold tracking-tight">More</h1>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto pb-32">
                <div className="p-4 space-y-6">
                    {/* Smart Folders Section */}
                    <section>
                        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-3">
                            Smart Folders
                        </h2>
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
                            {smartFolders.map((folder) => (
                                <Link
                                    key={folder.href}
                                    href={folder.href}
                                    className="flex items-center gap-3 px-4 py-3 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors"
                                >
                                    <folder.icon size={20} className="text-brand shrink-0" />
                                    <span className="flex-1 font-medium">{folder.label}</span>
                                    {folder.count > 0 && (
                                        <span className="text-sm text-zinc-500 font-medium tabular-nums">
                                            {folder.count}
                                        </span>
                                    )}
                                    <ChevronRight size={18} className="text-zinc-400" />
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Library Section */}
                    <section>
                        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-3">
                            Library
                        </h2>
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                            {/* Folders */}
                            {folders.map((folder) => {
                                const folderFeeds = feeds.filter(f => f.folderID === folder.id);
                                return (
                                    <div key={folder.id}>
                                        <Link
                                            href={`/folder/view/${folder.id}`}
                                            className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors"
                                        >
                                            <FolderOpen size={18} className="text-amber-500 shrink-0" />
                                            <span className="flex-1 font-medium text-sm">{folder.name}</span>
                                            <span className="text-xs text-zinc-500 tabular-nums">{folderFeeds.length}</span>
                                            <ChevronRight size={18} className="text-zinc-400" />
                                        </Link>
                                    </div>
                                );
                            })}

                            {/* Root Feeds */}
                            {feeds.filter(f => !f.folderID).map((feed) => {
                                const Icon = feed.type === 'youtube' ? Youtube :
                                    feed.type === 'podcast' ? Mic :
                                        feed.type === 'reddit' ? MessageCircle : Rss;

                                return (
                                    <Link
                                        key={feed.id}
                                        href={`/feed/${feed.id}`}
                                        className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 last:border-b-0 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors"
                                    >
                                        <Icon size={16} className="text-zinc-400 shrink-0" />
                                        <span className="flex-1 font-medium text-sm truncate">{feed.title}</span>
                                        <ChevronRight size={18} className="text-zinc-400" />
                                    </Link>
                                );
                            })}

                            {folders.length === 0 && feeds.length === 0 && (
                                <div className="px-4 py-8 text-center text-zinc-400 text-sm">
                                    No feeds or folders yet
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Actions Section */}
                    <section>
                        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-3">
                            Actions
                        </h2>
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
                            <Link
                                href="/history"
                                className="flex items-center gap-3 px-4 py-3 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors"
                            >
                                <Clock size={20} className="text-zinc-500 shrink-0" />
                                <span className="flex-1 font-medium">History</span>
                                <ChevronRight size={18} className="text-zinc-400" />
                            </Link>
                            <Link
                                href="/feeds/manage"
                                className="flex items-center gap-3 px-4 py-3 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors"
                            >
                                <Edit2 size={20} className="text-zinc-500 shrink-0" />
                                <span className="flex-1 font-medium">Manage Feeds</span>
                                <ChevronRight size={18} className="text-zinc-400" />
                            </Link>
                            <Link
                                href="/settings"
                                className="flex items-center gap-3 px-4 py-3 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors"
                            >
                                <SettingsIcon size={20} className="text-zinc-500 shrink-0" />
                                <span className="flex-1 font-medium">Settings</span>
                                <ChevronRight size={18} className="text-zinc-400" />
                            </Link>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
