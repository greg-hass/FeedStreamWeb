
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Bookmark, Menu, Settings, Clock, Youtube, Mic, MessageCircle, Rss, FolderOpen, X } from 'lucide-react';
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

    // Hide TabBar if Audio Player is full screen (expanded)
    if (isExpanded) return null;

    const tabs = [
        { name: 'Today', icon: Home, href: '/' },
        { name: 'All', icon: LayoutGrid, href: '/feeds/all' },
        { name: 'Saved', icon: Bookmark, href: '/saved' },
    ];

    const menuLinks = [
        { name: 'History', icon: Clock, href: '/history' },
        { name: 'YouTube', icon: Youtube, href: '/folder/youtube' },
        { name: 'Podcasts', icon: Mic, href: '/folder/podcasts' },
        { name: 'Reddit', icon: MessageCircle, href: '/folder/reddit' },
        { name: 'RSS', icon: Rss, href: '/folder/rss' },
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
                                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                                        pathname === link.href
                                            ? "bg-brand/10 text-brand font-medium"
                                            : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                    )}
                                >
                                    <link.icon size={20} />
                                    <span>{link.name}</span>
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
                "bg-white/85 dark:bg-black/85 backdrop-blur-xl border-t border-zinc-200/50 dark:border-zinc-800/50",
                "pb-[env(safe-area-inset-bottom)] pt-2"
            )}>
                <div className="flex justify-around items-center h-12">
                    {tabs.map((tab) => {
                        const isActive = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
                        return (
                            <Link
                                key={tab.name}
                                href={tab.href}
                                className={clsx(
                                    "flex flex-col items-center justify-center w-full h-full space-y-[2px]",
                                    "active:scale-90 transition-transform duration-200",
                                    isActive ? "text-brand" : "text-zinc-400 dark:text-zinc-500"
                                )}
                            >
                                <tab.icon
                                    size={24}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className={clsx(isActive && "drop-shadow-sm")}
                                />
                                <span className="text-[10px] font-medium tracking-tight">
                                    {tab.name}
                                </span>
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
