'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Rss, Clock, Calendar, Bookmark, Settings, Hash, Play, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { useArticles } from '@/hooks/useArticles';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

interface SidebarProps {
    className?: string;
}

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    // Real unread count
    const unreadCount = useLiveQuery(() => db.articles.where('isRead').equals(0).count()) ?? 0;
    const folders = useLiveQuery(() => db.folders.orderBy('position').toArray()) || [];
    const feeds = useLiveQuery(() => db.feeds.toArray()) || [];

    const links = [
        { href: '/', label: 'Today', icon: Calendar },
        { href: '/feeds/all', label: 'All Feeds', icon: LayoutGrid },
        { href: '/saved', label: 'Saved', icon: Bookmark },
        { href: '/history', label: 'History', icon: Clock },
        { href: '/settings', label: 'Settings', icon: Settings },
    ];

    return (
        <aside className={clsx("w-64 bg-zinc-50/50 dark:bg-black/50 border-r border-zinc-200 dark:border-zinc-800 flex-col h-full hidden md:flex backdrop-blur-xl", className)}>
            <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
                <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-brand-foreground font-bold">
                    FS
                </div>
                <span className="font-semibold text-white">FeedStream</span>
            </div>

            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                {links.map((link) => (
                    <SidebarLink
                        key={link.href}
                        href={link.href}
                        label={link.label}
                        icon={link.icon}
                        isActive={pathname === link.href}
                        className="text-sm"
                    />
                ))}

                <div className="mt-6 px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Library
                </div>
                <div className="mt-2 space-y-4">
                    {/* Root Feeds */}
                    <div className="space-y-1">
                        {feeds.filter(f => !f.folderID).map(feed => (
                            <SidebarLink
                                key={feed.id}
                                href={`/feed/${feed.id}`}
                                label={feed.title}
                                icon={feed.type === 'youtube' ? Play : (feed.type === 'podcast' ? Hash : Rss)}
                                isActive={pathname === `/feed/${feed.id}`}
                                className="truncate"
                            />
                        ))}
                    </div>

                    {/* Folders */}
                    {folders.map(folder => {
                        const folderFeeds = feeds.filter(f => f.folderID === folder.id);
                        if (folderFeeds.length === 0) return null;

                        return (
                            <div key={folder.id}>
                                <div className="px-3 py-1 flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    <span className="opacity-75">📂</span>
                                    <span className="truncate">{folder.name}</span>
                                </div>
                                <div className="mt-1 ml-2 pl-2 border-l border-zinc-200 dark:border-zinc-800 space-y-1">
                                    {folderFeeds.map(feed => (
                                        <SidebarLink
                                            key={feed.id}
                                            href={`/feed/${feed.id}`}
                                            label={feed.title}
                                            icon={feed.type === 'youtube' ? Play : (feed.type === 'podcast' ? Hash : Rss)}
                                            isActive={pathname === `/feed/${feed.id}`}
                                            className="truncate text-xs"
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </nav>
        </aside>
    );
}

function SidebarLink({ href, label, icon: Icon, isActive, className }: { href: string, label: string, icon: any, isActive: boolean, className?: string }) {
    return (
        <Link
            href={href}
            className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors block w-full",
                isActive
                    ? "bg-sidebar-active text-sidebar-active-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-zinc-800 hover:text-zinc-200",
                className
            )}
            title={label}
        >
            <Icon size={16} className="shrink-0" />
            <span className="truncate">{label}</span>
        </Link>
    );
}
