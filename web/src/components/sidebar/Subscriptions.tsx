
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, X, Sparkles, ChevronRight, ChevronDown, Folder as FolderIcon, MoreHorizontal, Rss } from 'lucide-react';
import { SidebarFeedItem } from '../SidebarItem';
import { Feed, Folder } from '@/lib/db';
import { clsx } from 'clsx';

interface SubscriptionsProps {
    feeds: Feed[];
    folders: Folder[];
    pathname: string;
    onFeedMenu: (e: React.MouseEvent, id: string) => void;
    onFolderMenu: (e: React.MouseEvent, id: string) => void;
}

export const Subscriptions = React.memo(({ feeds, folders, pathname, onFeedMenu, onFolderMenu }: SubscriptionsProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

    const toggleFolderCollapse = (folderId: string) => {
        setCollapsedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) newSet.delete(folderId);
            else newSet.add(folderId);
            return newSet;
        });
    };

    return (
        <div className="pt-4 mt-4 border-t border-zinc-800/50">
            <div className="px-3 py-2 flex items-center justify-between group">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Subscriptions
                </div>
                <Link href="/feeds/discover" className="p-1 -mr-1 text-zinc-500 hover:text-purple-400 transition-colors">
                    <Sparkles size={14} />
                </Link>
            </div>

            {/* Filter */}
            <div className="px-3 mb-2">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Filter feeds..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-zinc-700 rounded-md px-2 py-1.5 pl-8 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none"
                    />
                    <div className="absolute left-2.5 top-1.5 text-zinc-600 pointer-events-none">
                        <Search size={12} />
                    </div>
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1.5 text-zinc-600 hover:text-zinc-400">
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Root Feeds */}
            <div className="mt-1 space-y-0.5">
                {feeds
                    .filter(f => !f.folderID && f.title.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(feed => (
                        <SidebarFeedItem
                            key={feed.id}
                            feed={feed}
                            isActive={pathname === `/feed/${feed.id}`}
                            onContextMenu={(e) => onFeedMenu(e, feed.id)}
                            onMenuClick={(e) => onFeedMenu(e, feed.id)}
                        />
                    ))}
            </div>

            {/* Folders */}
            {folders
                .filter(folder => {
                    if (!searchQuery) return true;
                    const folderFeeds = feeds.filter(f => f.folderID === folder.id);
                    return folder.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           folderFeeds.some(f => f.title.toLowerCase().includes(searchQuery.toLowerCase()));
                })
                .map(folder => {
                    const folderFeeds = feeds.filter(f => f.folderID === folder.id);
                    const isCollapsed = searchQuery ? false : collapsedFolders.has(folder.id);
                    const displayFeeds = searchQuery 
                        ? folderFeeds.filter(f => f.title.toLowerCase().includes(searchQuery.toLowerCase())) 
                        : folderFeeds;

                    return (
                        <div key={folder.id} className="mt-3">
                            <div className="group flex items-center">
                                <button onClick={() => toggleFolderCollapse(folder.id)} className="p-1 text-zinc-600 hover:text-zinc-300">
                                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                </button>
                                <Link
                                    href={`/folder/view/${folder.id}`}
                                    className={clsx(
                                        "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                                        pathname === `/folder/view/${folder.id}`
                                            ? "bg-brand/10 text-brand font-medium"
                                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                    )}
                                >
                                    <FolderIcon size={16} />
                                    <span className="flex-1 truncate">{folder.name}</span>
                                    <span className="text-xs font-mono text-brand font-semibold">{folderFeeds.length}</span>
                                </Link>
                                <button
                                    onClick={(e) => onFolderMenu(e, folder.id)}
                                    className="p-1 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100"
                                >
                                    <MoreHorizontal size={14} />
                                </button>
                            </div>
                            {!isCollapsed && displayFeeds.length > 0 && (
                                <div className="mt-0.5 ml-6 pl-3 border-l border-zinc-800 space-y-0.5">
                                    {displayFeeds.map(feed => (
                                        <SidebarFeedItem
                                            key={feed.id}
                                            feed={feed}
                                            isActive={pathname === `/feed/${feed.id}`}
                                            small
                                            onContextMenu={(e) => onFeedMenu(e, feed.id)}
                                            onMenuClick={(e) => onFeedMenu(e, feed.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
        </div>
    );
});
