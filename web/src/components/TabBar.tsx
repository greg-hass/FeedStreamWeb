
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Bookmark, Menu, Settings, Clock, Youtube, Mic, MessageCircle, Rss, FolderOpen, X, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';
import { useAudioStore } from '@/store/audioStore';
import { Drawer } from 'vaul';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export function TabBar() {
    const pathname = usePathname();
    const { isExpanded } = useAudioStore();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const folders = useLiveQuery(() => db.folders.orderBy('position').toArray()) || [];
    const feeds = useLiveQuery(() => db.feeds.toArray()) || [];

    // Counters (Same as Sidebar)
    const counts = useLiveQuery(async () => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [today, all, saved] = await Promise.all([
            db.articles.filter(a => a.publishedAt instanceof Date && a.publishedAt >= todayStart && a.isRead === false).count(),
            db.articles.filter(a => a.isRead === false).count(),
            db.articles.filter(a => Boolean(a.isBookmarked)).count(),
        ]);

        return { today, all, saved };
    }) || { today: 0, all: 0, saved: 0 };

    const mediaCounts = useLiveQuery(async () => {
        const [youtube, podcast, reddit, rss] = await Promise.all([
            db.articles.where('mediaKind').equals('youtube').count(),
            db.articles.where('mediaKind').equals('podcast').count(),
            db.feeds.where('type').equals('reddit').toArray().then(feeds => {
                if (feeds.length === 0) return 0;
                return db.articles.where('feedID').anyOf(feeds.map(f => f.id)).count();
            }),
            db.feeds.where('type').noneOf(['reddit', 'youtube', 'podcast']).primaryKeys().then(allowedIds => {
                if (allowedIds.length === 0) return 0;
                return db.articles.where('feedID').anyOf(allowedIds as string[]).count();
            })
        ]);
        return { youtube, podcast, reddit, rss };
    }) || { youtube: 0, podcast: 0, reddit: 0, rss: 0 };

    // Hide TabBar if Audio Player is full screen (expanded)
    if (isExpanded) return null;

    const tabs = [
        { name: 'Today', icon: Home, href: '/', count: counts.today },
        { name: 'All', icon: LayoutGrid, href: '/feeds/all', count: counts.all },
        { name: 'Saved', icon: Bookmark, href: '/saved', count: counts.saved },
    ];

    const menuLinks = [
        { name: 'History', icon: Clock, href: '/history' },
        { name: 'Stats', icon: BarChart3, href: '/stats' },
        { name: 'YouTube', icon: Youtube, href: '/folder/youtube', count: mediaCounts.youtube },
        { name: 'Podcasts', icon: Mic, href: '/folder/podcasts', count: mediaCounts.podcast },
        { name: 'Reddit', icon: MessageCircle, href: '/folder/reddit', count: mediaCounts.reddit },
        { name: 'RSS', icon: Rss, href: '/folder/rss', count: mediaCounts.rss },
        { name: 'Settings', icon: Settings, href: '/settings' },
    ];

    return (
        <>
            {/* Slide-in Menu Drawer */}
            <Drawer.Root direction="left" open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
                    <Drawer.Content className="fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-zinc-950 border-r border-zinc-800 flex flex-col outline-none">
                        <Drawer.Title className="sr-only">Menu</Drawer.Title>

                        {/* Header */}
                        <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-800 shrink-0 pt-[env(safe-area-inset-top)]">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-brand to-emerald-600 rounded-lg flex items-center justify-center">
                                    <Rss size={16} className="text-white" />
                                </div>
                                <span className="font-semibold text-white">FeedStream</span>
                            </div>
                            <button onClick={() => setIsMenuOpen(false)} className="p-2 text-zinc-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Menu Content */}
                        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                            {/* Quick Links */}
                            {menuLinks.map(link => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setIsMenuOpen(false)}
                                    className={clsx(
                                        "flex items-center justify-between px-4 py-3 rounded-lg transition-all",
                                        pathname === link.href
                                            ? "bg-brand/10 text-brand font-medium"
                                            : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <link.icon size={20} />
                                        <span>{link.name}</span>
                                    </div>
                                    {link.count !== undefined && link.count > 0 && (
                                        <span className="text-xs font-mono font-semibold bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                                            {link.count}
                                        </span>
                                    )}
                                </Link>
                            ))}

                            {/* Folders */}
                            {folders.length > 0 && (
                                <div className="pt-4 mt-4 border-t border-zinc-800">
                                    <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase">
                                        Folders
                                    </div>
                                    {folders.map(folder => (
                                        <Link
                                            key={folder.id}
                                            href={`/folder/view/${folder.id}`}
                                            onClick={() => setIsMenuOpen(false)}
                                            className={clsx(
                                                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                                                pathname === `/folder/view/${folder.id}`
                                                    ? "bg-brand/10 text-brand font-medium"
                                                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                            )}
                                        >
                                            <FolderOpen size={18} className="text-amber-500" />
                                            <span className="flex-1">{folder.name}</span>
                                            <span className="text-xs text-zinc-500">
                                                {feeds.filter(f => f.folderID === folder.id).length}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            )}

                            {/* Manage Feeds Link */}
                            <div className="pt-4 mt-4 border-t border-zinc-800">
                                <Link
                                    href="/feeds/manage"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                >
                                    <Settings size={20} />
                                    <span>Manage Feeds</span>
                                </Link>
                            </div>
                        </nav>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>

            {/* Tab Bar */}
            <nav className={clsx(
                "md:hidden fixed bottom-0 left-0 right-0 z-40",
                "bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/50",
                "pb-[env(safe-area-inset-bottom)]"
            )}>
                <div className="h-14 flex items-center justify-around">
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className="flex flex-col items-center justify-center w-16 h-full space-y-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                        <Menu size={24} />
                        <span className="text-[10px] font-medium">Menu</span>
                    </button>

                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = pathname === tab.href;
                        return (
                            <Link
                                key={tab.name}
                                href={tab.href}
                                className={clsx(
                                    "relative flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors",
                                    isActive
                                        ? "text-brand"
                                        : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                                )}
                            >
                                <div className="relative">
                                    <Icon size={24} className={isActive ? "fill-current" : ""} />
                                    {tab.count !== undefined && tab.count > 0 && (
                                        <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1 border-2 border-white dark:border-zinc-950">
                                            {tab.count > 99 ? '99+' : tab.count}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] font-medium">{tab.name}</span>
                            </Link>
                        );
                    })}

                    {/* More Button - Opens Drawer */}
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className={clsx(
                            "flex flex-col items-center justify-center w-full h-full space-y-[2px]",
                            "active:scale-90 transition-transform duration-200",
                            isMenuOpen ? "text-brand" : "text-zinc-400 dark:text-zinc-500"
                        )}
                    >
                        <Menu size={24} strokeWidth={2} />
                        <span className="text-[10px] font-medium tracking-tight">More</span>
                    </button>
                </div>
            </nav>
        </>
    );
}
