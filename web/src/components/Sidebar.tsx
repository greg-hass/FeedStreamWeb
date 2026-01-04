'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Rss, Clock, Calendar, Bookmark, Settings, FolderOpen, Play, Radio } from 'lucide-react';
import { clsx } from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

interface SidebarProps {
    className?: string;
}

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const folders = useLiveQuery(() => db.folders.orderBy('position').toArray()) || [];
    const feeds = useLiveQuery(() => db.feeds.toArray()) || [];

    const links = [
        { href: '/', label: 'Today', icon: Calendar },
        { href: '/feeds/all', label: 'All Articles', icon: LayoutGrid },
        { href: '/saved', label: 'Bookmarks', icon: Bookmark },
        { href: '/history', label: 'History', icon: Clock },
    ];

    return (
        <aside className={clsx(
            "w-64 bg-zinc-950 border-r border-zinc-800/50 flex-col h-full hidden md:flex",
            className
        )}>
            {/* Logo */}
            <div className="h-14 px-4 flex items-center gap-3 border-b border-zinc-800/50">
                <div className="w-8 h-8 bg-gradient-to-br from-brand to-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand/20">
                    <Rss size={16} className="text-white" />
                </div>
                <span className="font-semibold text-white tracking-tight">FeedStream</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {links.map((link) => (
                    <SidebarLink
                        key={link.href}
                        href={link.href}
                        label={link.label}
                        icon={link.icon}
                        isActive={pathname === link.href}
                    />
                ))}

                {/* Settings at bottom of main nav */}
                <div className="pt-2 mt-2 border-t border-zinc-800/50">
                    <SidebarLink
                        href="/settings"
                        label="Settings"
                        icon={Settings}
                        isActive={pathname === '/settings'}
                    />
                </div>

                {/* Library Section */}
                <div className="pt-4 mt-4 border-t border-zinc-800/50">
                    <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Subscriptions
                    </div>

                    {/* Root Feeds */}
                    <div className="mt-1 space-y-0.5">
                        {feeds.filter(f => !f.folderID).map(feed => (
                            <SidebarLink
                                key={feed.id}
                                href={`/feed/${feed.id}`}
                                label={feed.title}
                                icon={feed.type === 'youtube' ? Play : (feed.type === 'podcast' ? Radio : Rss)}
                                isActive={pathname === `/feed/${feed.id}`}
                                small
                            />
                        ))}
                    </div>

                    {/* Folders */}
                    {folders.map(folder => {
                        const folderFeeds = feeds.filter(f => f.folderID === folder.id);
                        if (folderFeeds.length === 0) return null;

                        return (
                            <div key={folder.id} className="mt-3">
                                <div className="px-3 py-1 flex items-center gap-2 text-xs font-medium text-zinc-400">
                                    <FolderOpen size={14} />
                                    <span className="truncate">{folder.name}</span>
                                </div>
                                <div className="mt-0.5 ml-3 pl-3 border-l border-zinc-800 space-y-0.5">
                                    {folderFeeds.map(feed => (
                                        <SidebarLink
                                            key={feed.id}
                                            href={`/feed/${feed.id}`}
                                            label={feed.title}
                                            icon={feed.type === 'youtube' ? Play : (feed.type === 'podcast' ? Radio : Rss)}
                                            isActive={pathname === `/feed/${feed.id}`}
                                            small
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

function SidebarLink({ href, label, icon: Icon, isActive, small }: {
    href: string;
    label: string;
    icon: any;
    isActive: boolean;
    small?: boolean;
}) {
    return (
        <Link
            href={href}
            className={clsx(
                "flex items-center gap-3 rounded-lg transition-all duration-150",
                small ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm",
                isActive
                    ? "bg-zinc-800 text-white font-medium"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            )}
            title={label}
        >
            <Icon size={small ? 14 : 16} className={clsx("shrink-0", isActive && "text-brand")} />
            <span className="truncate">{label}</span>
        </Link>
    );
}
