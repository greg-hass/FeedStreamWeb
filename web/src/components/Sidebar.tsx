'use client';

import { usePathname } from 'next/navigation';
import { Rss, GripVertical, Settings, MoveRight, Trash2, FolderOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useScrollStore } from '@/store/scrollStore';
import { useUIStore } from '@/store/uiStore';
import { NavigationLinks } from './sidebar/NavigationLinks';
import { SmartFolders } from './sidebar/SmartFolders';
import { Subscriptions } from './sidebar/Subscriptions';

interface SidebarProps {
    className?: string;
}

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const isSyncing = useUIStore(s => s.isSyncing);
    const folders = useLiveQuery(() => db.folders.orderBy('position').toArray()) || [];
    const feeds = useLiveQuery(async () => {
        const all = await db.feeds.toArray();
        return all.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }) || [];

    // Sidebar counts - Pause during sync to avoid main thread jitter
    const liveCounts = useLiveQuery(async () => {
        if (useUIStore.getState().isSyncing) return 'SYNCING_PAUSE';
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const [today, all, saved] = await Promise.all([
            db.articles.where('[isRead+publishedAt]').between([0, todayStart], [0, new Date(Date.now() + 86400000)]).count(),
            db.articles.where('isRead').equals(0).count(),
            db.articles.where('isBookmarked').equals(1).count()
        ]);
        return { today, all, saved };
    }, [isSyncing]);

    const liveMediaCounts = useLiveQuery(async () => {
        if (useUIStore.getState().isSyncing) return 'SYNCING_PAUSE';
        const [youtube, podcast, reddit, rss] = await Promise.all([
            db.articles.where('mediaKind').equals('youtube').count(),
            db.articles.where('mediaKind').equals('podcast').count(),
            db.feeds.where('type').equals('reddit').toArray().then(fs => {
                if (fs.length === 0) return 0;
                return db.articles.where('feedID').anyOf(fs.map(f => f.id)).count();
            }),
            db.feeds.where('type').noneOf(['reddit', 'youtube', 'podcast']).primaryKeys().then(ids => {
                if (ids.length === 0) return 0;
                return db.articles.where('feedID').anyOf(ids as string[]).count();
            })
        ]);
        return { youtube, podcast, reddit, rss };
    }, [isSyncing]);

    const [counts, setCounts] = useState({ today: 0, all: 0, saved: 0 });
    const [mediaCounts, setMediaCounts] = useState({ youtube: 0, podcast: 0, reddit: 0, rss: 0 });

    useEffect(() => {
        if (liveCounts && typeof liveCounts !== 'string') setCounts(liveCounts);
    }, [liveCounts]);

    useEffect(() => {
        if (liveMediaCounts && typeof liveMediaCounts !== 'string') setMediaCounts(liveMediaCounts);
    }, [liveMediaCounts]);

    const { sidebarWidth, setSidebarWidth } = useScrollStore();
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLElement>(null);

    // Context Menus
    const [contextMenu, setContextMenu] = useState<{ type: 'feed' | 'folder'; id: string; x: number; y: number } | null>(null);
    const [showMoveModal, setShowMoveModal] = useState<string | null>(null);
    const [renameModal, setRenameModal] = useState<{ id: string, name: string } | null>(null);

    const handleFeedMenu = useCallback((e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setContextMenu({ type: 'feed', id, x: rect.right, y: rect.top });
    }, []);

    const handleFolderMenu = useCallback((e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setContextMenu({ type: 'folder', id, x: rect.right, y: rect.top });
    }, []);

    const handleRename = async () => {
        if (!renameModal) return;
        if (renameModal.name.trim()) {
            if (contextMenu?.type === 'feed') await db.feeds.update(renameModal.id, { title: renameModal.name });
            else await db.folders.update(renameModal.id, { name: renameModal.name });
        }
        setRenameModal(null);
        setContextMenu(null);
    };

    const handleDeleteFeed = async (feedId: string) => {
        if (!confirm('Delete this feed and all its articles?')) return;
        await db.articles.where('feedID').equals(feedId).delete();
        await db.feeds.delete(feedId);
        setContextMenu(null);
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!confirm('Delete this folder? Feeds will be moved to root.')) return;
        const folderFeeds = feeds.filter(f => f.folderID === folderId);
        for (const feed of folderFeeds) {
            await db.feeds.update(feed.id, { folderID: undefined });
        }
        await db.folders.delete(folderId);
        setContextMenu(null);
    };

    const handleMoveFeed = async (feedId: string, folderId: string | null) => {
        await db.feeds.update(feedId, { folderID: folderId || undefined });
        setShowMoveModal(null);
        setContextMenu(null);
    };

    // Resize logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => { if (isResizing) setSidebarWidth(e.clientX); };
        const handleMouseUp = () => setIsResizing(false);
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
        };
    }, [isResizing, setSidebarWidth]);

    // Close menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [contextMenu]);

    const handleRenameClick = () => {
        if (!contextMenu) return;
        let initialName = '';
        if (contextMenu.type === 'feed') {
            initialName = feeds.find(f => f.id === contextMenu.id)?.title || '';
        } else {
            initialName = folders.find(f => f.id === contextMenu.id)?.name || '';
        }
        setRenameModal({ id: contextMenu.id, name: initialName });
    };

    return (
        <aside
            ref={sidebarRef}
            style={{ width: sidebarWidth }}
            className={clsx("bg-zinc-950 border-r border-zinc-800/50 flex-col h-full hidden md:flex relative", className)}
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
                <NavigationLinks counts={counts} pathname={pathname} />
                <SmartFolders counts={mediaCounts} pathname={pathname} />
                <Subscriptions 
                    feeds={feeds} 
                    folders={folders} 
                    pathname={pathname}
                    onFeedMenu={handleFeedMenu}
                    onFolderMenu={handleFolderMenu}
                />
            </nav>

            {/* Modals and Context Menu */}
            {contextMenu && (
                <div className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px]" style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 160) }}>
                    <button onClick={handleRenameClick} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2">
                        <Settings size={14} /> Rename
                    </button>
                    {contextMenu.type === 'feed' && (
                        <>
                            <button onClick={() => setShowMoveModal(contextMenu.id)} className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2">
                                <MoveRight size={14} /> Move to...
                            </button>
                            <button onClick={() => handleDeleteFeed(contextMenu.id)} className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2">
                                <Trash2 size={14} /> Delete Feed
                            </button>
                        </>
                    )}
                    {contextMenu.type === 'folder' && (
                        <button onClick={() => handleDeleteFolder(contextMenu.id)} className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 flex items-center gap-2">
                            <Trash2 size={14} /> Delete Folder
                        </button>
                    )}
                </div>
            )}

            {renameModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRenameModal(null)}>
                    <div className="bg-zinc-900 rounded-xl w-full max-w-sm shadow-xl border border-zinc-700 p-4" onClick={e => e.stopPropagation()}>
                        <h3 className="font-semibold text-white mb-4">Rename {contextMenu?.type === 'feed' ? 'Feed' : 'Folder'}</h3>
                        <input type="text" value={renameModal.name} onChange={e => setRenameModal({ ...renameModal, name: e.target.value })} className="w-full bg-zinc-800 border-zinc-700 rounded-lg px-3 py-2 text-white mb-4 focus:ring-2 focus:ring-brand outline-none" autoFocus onKeyDown={e => e.key === 'Enter' && handleRename()} />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setRenameModal(null)} className="px-4 py-2 text-zinc-400 hover:text-white">Cancel</button>
                            <button onClick={handleRename} className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {showMoveModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowMoveModal(null)}>
                    <div className="bg-zinc-900 rounded-xl w-full max-w-xs shadow-xl border border-zinc-700" onClick={e => e.stopPropagation()}>
                        <div className="p-3 border-b border-zinc-800 font-medium text-sm">Move to...</div>
                        <ul className="p-2 max-h-48 overflow-y-auto">
                            <li><button onClick={() => handleMoveFeed(showMoveModal, null)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800 flex items-center gap-2 text-sm"><Rss size={14} className="text-zinc-400" /> Root</button></li>
                            {folders.map(f => (<li key={f.id}><button onClick={() => handleMoveFeed(showMoveModal, f.id)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800 flex items-center gap-2 text-sm"><FolderOpen size={14} className="text-amber-500" /> {f.name}</button></li>))}
                        </ul>
                    </div>
                </div>
            )}

            {/* Resize Handle */}
            <div onMouseDown={() => setIsResizing(true)} className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-brand/50 transition-colors group">
                <div className="absolute top-1/2 -translate-y-1/2 right-0 w-3 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical size={12} className="text-zinc-600" />
                </div>
            </div>
        </aside>
    );
}