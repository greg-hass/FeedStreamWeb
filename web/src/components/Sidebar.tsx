'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Rss, Clock, Calendar, Bookmark, Settings, FolderOpen, Play, Radio, MoreHorizontal, Trash2, MoveRight, GripVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Feed, Folder } from '@/lib/db';
import { useState, useRef, useEffect, useCallback } from 'react';
import { uuidv4 } from '@/lib/utils';
import { useScrollStore } from '@/store/scrollStore';

interface SidebarProps {
    className?: string;
}

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const folders = useLiveQuery(() => db.folders.orderBy('position').toArray()) || [];
    const feeds = useLiveQuery(() => db.feeds.toArray()) || [];

    const { sidebarWidth, setSidebarWidth } = useScrollStore();
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLElement>(null);

    const [contextMenu, setContextMenu] = useState<{ type: 'feed' | 'folder'; id: string; x: number; y: number } | null>(null);
    const [showMoveModal, setShowMoveModal] = useState<string | null>(null);

    const links = [
        { href: '/', label: 'Today', icon: Calendar },
        { href: '/feeds/all', label: 'All Articles', icon: LayoutGrid },
        { href: '/saved', label: 'Bookmarks', icon: Bookmark },
        { href: '/history', label: 'History', icon: Clock },
    ];

    const handleDeleteFeed = async (feedId: string) => {
        if (!confirm('Delete this feed and all its articles?')) return;
        await db.articles.where('feedID').equals(feedId).delete();
        await db.feeds.delete(feedId);
        setContextMenu(null);
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!confirm('Delete this folder? Feeds will be moved to root.')) return;
        await db.feeds.where('folderID').equals(folderId).modify({ folderID: undefined });
        await db.folders.delete(folderId);
        setContextMenu(null);
    };

    const handleMoveFeed = async (feedId: string, folderId: string | null) => {
        await db.feeds.update(feedId, { folderID: folderId || undefined });
        setShowMoveModal(null);
        setContextMenu(null);
    };

    // Resize handlers
    const startResize = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            setSidebarWidth(e.clientX);
        };
        const handleMouseUp = () => setIsResizing(false);

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, setSidebarWidth]);

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) {
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [contextMenu]);

    return (
        <aside
            ref={sidebarRef}
            style={{ width: sidebarWidth }}
            className={clsx(
                "bg-zinc-950 border-r border-zinc-800/50 flex-col h-full hidden md:flex relative",
                className
            )}
        >
            {/* Logo */}
            <div className="h-14 px-4 flex items-center gap-3 border-b border-zinc-800/50 shrink-0">
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

                {/* Settings */}
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
                            <SidebarFeedItem
                                key={feed.id}
                                feed={feed}
                                isActive={pathname === `/feed/${feed.id}`}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({ type: 'feed', id: feed.id, x: e.clientX, y: e.clientY });
                                }}
                                onMenuClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setContextMenu({ type: 'feed', id: feed.id, x: rect.right, y: rect.top });
                                }}
                            />
                        ))}
                    </div>

                    {/* Folders */}
                    {folders.map(folder => {
                        const folderFeeds = feeds.filter(f => f.folderID === folder.id);

                        return (
                            <div key={folder.id} className="mt-3">
                                <div className="group flex items-center">
                                    <Link
                                        href={`/folder/view/${folder.id}`}
                                        className="flex-1 px-3 py-1.5 flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition-colors"
                                    >
                                        <FolderOpen size={14} />
                                        <span className="truncate flex-1">{folder.name}</span>
                                        <span className="text-zinc-600">{folderFeeds.length}</span>
                                    </Link>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setContextMenu({ type: 'folder', id: folder.id, x: rect.right, y: rect.top });
                                        }}
                                        className="p-1 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MoreHorizontal size={14} />
                                    </button>
                                </div>
                                {folderFeeds.length > 0 && (
                                    <div className="mt-0.5 ml-3 pl-3 border-l border-zinc-800 space-y-0.5">
                                        {folderFeeds.map(feed => (
                                            <SidebarFeedItem
                                                key={feed.id}
                                                feed={feed}
                                                isActive={pathname === `/feed/${feed.id}`}
                                                small
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setContextMenu({ type: 'feed', id: feed.id, x: e.clientX, y: e.clientY });
                                                }}
                                                onMenuClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setContextMenu({ type: 'feed', id: feed.id, x: rect.right, y: rect.top });
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </nav>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px]"
                    style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 160) }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.type === 'feed' && (
                        <>
                            <button
                                onClick={() => setShowMoveModal(contextMenu.id)}
                                className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                            >
                                <MoveRight size={14} /> Move to...
                            </button>
                            <button
                                onClick={() => handleDeleteFeed(contextMenu.id)}
                                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2"
                            >
                                <Trash2 size={14} /> Delete Feed
                            </button>
                        </>
                    )}
                    {contextMenu.type === 'folder' && (
                        <button
                            onClick={() => handleDeleteFolder(contextMenu.id)}
                            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2"
                        >
                            <Trash2 size={14} /> Delete Folder
                        </button>
                    )}
                </div>
            )}

            {/* Move Modal */}
            {showMoveModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowMoveModal(null)}>
                    <div className="bg-zinc-900 rounded-xl w-full max-w-xs shadow-xl border border-zinc-700" onClick={(e) => e.stopPropagation()}>
                        <div className="p-3 border-b border-zinc-800 font-medium text-sm">Move to...</div>
                        <ul className="p-2 max-h-48 overflow-y-auto">
                            <li>
                                <button
                                    onClick={() => handleMoveFeed(showMoveModal, null)}
                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800 flex items-center gap-2 text-sm"
                                >
                                    <Rss size={14} className="text-zinc-400" /> Root
                                </button>
                            </li>
                            {folders.map(folder => (
                                <li key={folder.id}>
                                    <button
                                        onClick={() => handleMoveFeed(showMoveModal, folder.id)}
                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800 flex items-center gap-2 text-sm"
                                    >
                                        <FolderOpen size={14} className="text-amber-500" /> {folder.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* Resize Handle */}
            <div
                onMouseDown={startResize}
                className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-brand/50 transition-colors group"
            >
                <div className="absolute top-1/2 -translate-y-1/2 right-0 w-3 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical size={12} className="text-zinc-600" />
                </div>
            </div>
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

function SidebarFeedItem({ feed, isActive, small, onContextMenu, onMenuClick }: {
    feed: Feed;
    isActive: boolean;
    small?: boolean;
    onContextMenu: (e: React.MouseEvent) => void;
    onMenuClick: (e: React.MouseEvent) => void;
}) {
    const Icon = feed.type === 'youtube' ? Play : (feed.type === 'podcast' ? Radio : Rss);

    return (
        <div className="group flex items-center" onContextMenu={onContextMenu}>
            <Link
                href={`/feed/${feed.id}`}
                className={clsx(
                    "flex-1 flex items-center gap-3 rounded-lg transition-all duration-150",
                    small ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm",
                    isActive
                        ? "bg-zinc-800 text-white font-medium"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                )}
                title={feed.title}
            >
                <Icon size={small ? 14 : 16} className={clsx("shrink-0", isActive && "text-brand")} />
                <span className="truncate">{feed.title}</span>
            </Link>
            <button
                onClick={onMenuClick}
                className="p-1 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <MoreHorizontal size={14} />
            </button>
        </div>
    );
}
