'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, LayoutGrid, Bookmark, Settings, List, ChevronRight, ChevronDown, FolderOpen, Rss, Youtube, Mic, MessageCircle, MoreVertical, Edit2, Trash2, FolderInput, Folder as FolderIcon, Clock, FileText, MoreHorizontal, MoveRight, GripVertical, BarChart3, Search, X, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Feed, Folder } from '@/lib/db';
import { useState, useRef, useEffect, useCallback } from 'react';
import { uuidv4 } from '@/lib/utils';
import { useScrollStore } from '@/store/scrollStore';
import { useUIStore } from '@/store/uiStore';

interface SidebarProps {
    className?: string;
}

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const { isSyncing } = useUIStore();
    const folders = useLiveQuery(() => db.folders.orderBy('position').toArray()) || [];
    const feeds = useLiveQuery(async () => {
        const all = await db.feeds.toArray();
        return all.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }) || [];
    const [searchQuery, setSearchQuery] = useState('');

    // Sidebar counts - Optimized with Indexes
    const liveCounts = useLiveQuery(async () => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Optimization: Skip fresh check during sync to prevent lag
        // This query loads objects and is expensive
        let freshFolders = new Set<string>();
        if (!useUIStore.getState().isSyncing) {
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const freshArticles = await db.articles.where('publishedAt').above(oneHourAgo).toArray();
            const freshFeedIds = new Set(freshArticles.filter(a => !a.isRead).map(a => a.feedID));
            
            // Map fresh feed IDs to folder IDs
            // Note: 'feeds' is from hook, might be stale here. Querying directly is safer but slower.
            // We'll use a direct query for correctness since this runs infrequently when not syncing.
            const allFeeds = await db.feeds.toArray();
            allFeeds.forEach(f => {
                if (freshFeedIds.has(f.id)) {
                    if (f.folderID) {
                        freshFolders.add(f.folderID);
                    }
                }
            });
        }

        const [today, all, saved] = await Promise.all([
            // [isRead+publishedAt] index usage
            db.articles.where('[isRead+publishedAt]')
                .between([0, todayStart], [0, new Date(Date.now() + 86400000)]) // 0=false (unread)
                .count(),
            // Simple index
            db.articles.where('isRead').equals(0).count(),
            // Simple index
            db.articles.where('isBookmarked').equals(1).count()
        ]);

        return { today, all, saved, freshFolders };
    });

    const [counts, setCounts] = useState(liveCounts || { today: 0, all: 0, saved: 0, freshFolders: new Set<string>() });

    // Debounce counts update
    useEffect(() => {
        if (!liveCounts) return;
        
        // Immediate update on first load
        if (counts.today === 0 && counts.all === 0 && counts.saved === 0) {
            setCounts(liveCounts);
            return;
        }

        const handler = setTimeout(() => {
            setCounts(liveCounts);
        }, isSyncing ? 3000 : 1000); // Increased debounce to prevent flickering

        return () => clearTimeout(handler);
    }, [liveCounts, isSyncing]);


    // Smart Feed counts - Optimized
    const liveMediaCounts = useLiveQuery(async () => {
        const [youtube, podcast, reddit, rss] = await Promise.all([
            // Simple index
            db.articles.where('mediaKind').equals('youtube').count(),
            db.articles.where('mediaKind').equals('podcast').count(),
            // Reddit requires finding feeds first
            db.feeds.where('type').equals('reddit').toArray().then(feeds => {
                if (feeds.length === 0) return 0;
                return db.articles.where('feedID').anyOf(feeds.map(f => f.id)).count();
            }),
            // RSS/Articles (generic)
            db.feeds.where('type').noneOf(['reddit', 'youtube', 'podcast']).primaryKeys().then(allowedIds => {
                if (allowedIds.length === 0) return 0;
                return db.articles.where('feedID').anyOf(allowedIds as string[]).count();
            })
        ]);
        return { youtube, podcast, reddit, rss };
    });

    const [mediaCounts, setMediaCounts] = useState(liveMediaCounts || { youtube: 0, podcast: 0, reddit: 0, rss: 0 });

    // Debounce media counts
    useEffect(() => {
        if (!liveMediaCounts) return;
        
        if (mediaCounts.rss === 0 && mediaCounts.youtube === 0) {
            setMediaCounts(liveMediaCounts);
            return;
        }

        const handler = setTimeout(() => {
            setMediaCounts(liveMediaCounts);
        }, isSyncing ? 3000 : 1000);

        return () => clearTimeout(handler);
    }, [liveMediaCounts, isSyncing]);

    const { sidebarWidth, setSidebarWidth } = useScrollStore();
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLElement>(null);

    const [contextMenu, setContextMenu] = useState<{ type: 'feed' | 'folder'; id: string; x: number; y: number } | null>(null);
    const [showMoveModal, setShowMoveModal] = useState<string | null>(null);
    const [renameModal, setRenameModal] = useState<{ id: string, name: string } | null>(null);

    const handleRenameFeed = async () => {
        if (!renameModal) return;
        if (renameModal.name.trim()) {
            await db.feeds.update(renameModal.id, { title: renameModal.name });
        }
        setRenameModal(null);
        setContextMenu(null);
    };

    // Collapsible folder state - persisted in localStorage
    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('feedstream-collapsed-folders');
            if (saved) {
                try {
                    setCollapsedFolders(new Set(JSON.parse(saved)));
                } catch (e) {
                    console.warn('Failed to parse collapsed folders state', e);
                    // Reset invalid state
                    localStorage.removeItem('feedstream-collapsed-folders');
                }
            }
        }
    }, []);

    const toggleFolderCollapse = (folderId: string) => {
        setCollapsedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
            } else {
                newSet.add(folderId);
            }
            localStorage.setItem('feedstream-collapsed-folders', JSON.stringify([...newSet]));
            return newSet;
        });
    };

    const links = [
        { href: '/', label: 'Today', icon: Calendar, count: counts.today },
        { href: '/feeds/all', label: 'All Articles', icon: LayoutGrid, count: counts.all },
        { href: '/saved', label: 'Bookmarks', icon: Bookmark, count: counts.saved },
        { href: '/history', label: 'History', icon: Clock },
        { href: '/stats', label: 'Stats', icon: BarChart3 },
    ];

    const smartFolders = [
        { href: '/folder/rss', label: 'RSS', icon: FileText, count: mediaCounts.rss },
        { href: '/folder/reddit', label: 'Reddit', icon: MessageCircle, count: mediaCounts.reddit },
        { href: '/folder/youtube', label: 'YouTube', icon: Youtube, count: mediaCounts.youtube },
        { href: '/folder/podcasts', label: 'Podcasts', icon: Mic, count: mediaCounts.podcast },
    ];

    const handleDeleteFeed = async (feedId: string) => {
        if (!confirm('Delete this feed and all its articles?')) return;
        await db.articles.where('feedID').equals(feedId).delete();
        await db.feeds.delete(feedId);
        setContextMenu(null);
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!confirm('Delete this folder and ALL feeds inside it? This cannot be undone.')) return;
        // Get all feeds in this folder
        const folderFeeds = await db.feeds.where('folderID').equals(folderId).toArray();
        // Delete all articles from these feeds
        for (const feed of folderFeeds) {
            await db.articles.where('feedID').equals(feed.id).delete();
        }
        // Delete all feeds in folder
        await db.feeds.where('folderID').equals(folderId).delete();
        // Delete folder
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
                    <Link
                        key={link.href}
                        href={link.href}
                        className={clsx(
                            'flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg transition-all',
                            pathname === link.href
                                ? 'bg-brand/10 text-brand font-medium'
                                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <link.icon size={20} />
                            <span>{link.label}</span>
                        </div>
                        {link.count !== undefined && link.count > 0 && (
                            <span className="text-sm font-mono text-brand font-semibold">
                                {link.count}
                            </span>
                        )}
                    </Link>
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

                {/* Smart Folders */}
                <nav className="space-y-1 mt-6">
                    <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Smart Folders
                    </div>
                    {smartFolders.map(link => (
                        <SidebarLink
                            key={link.href}
                            {...link}
                            isActive={pathname === link.href}
                        />
                    ))}
                </nav>

                {/* Library Section */}
                <div className="pt-4 mt-4 border-t border-zinc-800/50">
                    <div className="px-3 py-2 flex items-center justify-between group">
                        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                            Subscriptions
                        </div>
                        <Link href="/feeds/discover" className="p-1 -mr-1 text-zinc-500 hover:text-purple-400 transition-colors" title="Discover New Feeds">
                            <Sparkles size={14} />
                        </Link>
                    </div>

                    {/* Filter Input */}
                    <div className="px-3 mb-2">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Filter feeds..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-zinc-700 rounded-md px-2 py-1.5 pl-8 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none transition-colors"
                            />
                            <div className="absolute left-2.5 top-1.5 text-zinc-600 pointer-events-none">
                                <Search size={12} />
                            </div>
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1.5 text-zinc-600 hover:text-zinc-400"
                                >
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
                    {folders
                        .filter(folder => {
                            if (!searchQuery) return true;
                            // Show folder if name matches OR if it contains matching feeds
                            const folderFeeds = feeds.filter(f => f.folderID === folder.id);
                            const hasMatchingFeeds = folderFeeds.some(f => f.title.toLowerCase().includes(searchQuery.toLowerCase()));
                            return folder.name.toLowerCase().includes(searchQuery.toLowerCase()) || hasMatchingFeeds;
                        })
                        .map(folder => {
                            const folderFeeds = feeds.filter(f => f.folderID === folder.id);
                            // If searching, always expand relevant folders
                            const isCollapsed = searchQuery ? false : collapsedFolders.has(folder.id);
                            
                            // Filter feeds inside folder if searching
                            const displayFeeds = searchQuery 
                                ? folderFeeds.filter(f => f.title.toLowerCase().includes(searchQuery.toLowerCase())) 
                                : folderFeeds;

                            return (
                                <div key={folder.id} className="mt-3">
                                    <div className="group flex items-center">
                                        <button
                                            onClick={() => toggleFolderCollapse(folder.id)}
                                            className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                                        >
                                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                        <Link
                                            href={`/folder/view/${folder.id}`}
                                            className={clsx(
                                                "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                                                pathname === `/folder/view/${folder.id}`
                                                    ? "bg-brand/10 text-brand font-medium"
                                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                                            )}
                                        >
                                            <FolderIcon size={16} />
                                            <span className="flex-1 truncate">{folder.name}</span>
                                            {/* Fresh Indicator */}
                                            {counts.freshFolders.has(folder.id) && (
                                                <div className="w-2 h-2 bg-green-500 rounded-full shrink-0 animate-pulse" title="New articles in last hour" />
                                            )}
                                            <span className="text-xs font-mono text-brand font-semibold">{folderFeeds.length}</span>
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
                                    {!isCollapsed && displayFeeds.length > 0 && (
                                        <div className="mt-0.5 ml-6 pl-3 border-l border-zinc-800 space-y-0.5">
                                            {displayFeeds.map(feed => (
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
                                onClick={() => setRenameModal({ id: contextMenu.id, name: feeds.find(f => f.id === contextMenu.id)?.title || '' })}
                                className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                            >
                                <Settings size={14} /> Rename
                            </button>

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
                        <>
                            <button
                                onClick={() => {
                                    const folder = folders.find(f => f.id === contextMenu.id);
                                    setRenameModal({ id: contextMenu.id, name: folder?.name || '' });
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                            >
                                <Edit2 size={14} /> Rename
                            </button>
                            <button
                                onClick={async () => {
                                    if (confirm('Delete this folder? Feeds will be moved to root.')) {
                                        // Move feeds to root first
                                        const folderFeeds = feeds.filter(f => f.folderID === contextMenu.id);
                                        for (const feed of folderFeeds) {
                                            await db.feeds.update(feed.id, { folderID: undefined });
                                        }
                                        await db.folders.delete(contextMenu.id);
                                        setContextMenu(null);
                                    }
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2"
                            >
                                <Trash2 size={14} /> Delete Folder
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Rename Modal */}
            {renameModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRenameModal(null)}>
                    <div className="bg-zinc-900 rounded-xl w-full max-w-sm shadow-xl border border-zinc-700 p-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="font-semibold text-white mb-4">Rename Feed</h3>
                        <input
                            type="text"
                            value={renameModal.name}
                            onChange={(e) => setRenameModal({ ...renameModal, name: e.target.value })}
                            className="w-full bg-zinc-800 border-zinc-700 rounded-lg px-3 py-2 text-white mb-4 focus:ring-2 focus:ring-brand outline-none"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleRenameFeed()}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setRenameModal(null)} className="px-4 py-2 text-zinc-400 hover:text-white">Cancel</button>
                            <button onClick={handleRenameFeed} className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Move Modal */}
            {/* ... */}

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

function SidebarLink({ href, label, icon: Icon, isActive, small, count }: {
    href: string;
    label: string;
    icon: any;
    isActive: boolean;
    small?: boolean;
    count?: number;
}) {
    return (
        <Link
            href={href}
            className={clsx(
                "flex items-center justify-between gap-3 rounded-lg transition-all duration-150",
                small ? "px-2 py-1.5 text-xs" : "px-3 py-2.5 text-sm",
                isActive
                    ? "bg-brand/10 text-brand font-medium"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
            title={label}
        >
            <div className="flex items-center gap-3">
                <Icon size={small ? 14 : 18} className="shrink-0" />
                <span className="truncate">{label}</span>
            </div>
            {count !== undefined && count > 0 && (
                <span className="text-sm font-mono text-brand font-semibold">
                    {count > 999 ? '999+' : count}
                </span>
            )}
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
    const getTypeIcon = () => {
        switch (feed.type) {
            case 'youtube': return Youtube;
            case 'podcast': return Mic;
            case 'reddit': return MessageCircle;
            default: return Rss;
        }
    };

    const getIconColor = () => {
        switch (feed.type) {
            case 'youtube': return 'text-red-500';
            case 'podcast': return 'text-purple-500';
            case 'reddit': return 'text-orange-500';
            default: return isActive ? 'text-brand' : 'text-zinc-400';
        }
    };

    const Icon = getTypeIcon();
    const iconColor = getIconColor();

    return (
        <div className="group flex items-center" onContextMenu={onContextMenu}>
            <Link
                href={`/feed/${feed.id}`}
                className={clsx(
                    "flex-1 flex items-center gap-3 rounded-lg transition-all duration-150",
                    small ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm",
                    isActive
                        ? "bg-brand/10 text-brand font-medium"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                )}
                title={feed.title}
            >
                {/* Show feed icon if available, otherwise show type icon */}
                {feed.iconURL ? (
                    <div className="relative shrink-0">
                        <img
                            src={feed.iconURL}
                            alt=""
                            className={clsx(
                                "rounded object-cover bg-zinc-800",
                                small ? "w-3.5 h-3.5" : "w-4 h-4"
                            )}
                            loading="lazy"
                            onError={(e) => {
                                // Fallback to type icon on error
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    </div>
                ) : (
                    <Icon size={small ? 14 : 16} className={clsx("shrink-0", iconColor)} />
                )}
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
