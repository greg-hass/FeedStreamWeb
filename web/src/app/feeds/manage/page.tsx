'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, Feed, Folder } from '@/lib/db';
import { useState } from 'react';
import { Trash2, FolderPlus, ArrowLeft, MoreVertical, FolderOpen, Rss, Play, Radio, MoveRight, Check, X, Edit2, MessageCircle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { uuidv4 } from '@/lib/utils';

export default function ManageFeedsPage() {
    const feeds = useLiveQuery(() => db.feeds.toArray()) || [];
    const folders = useLiveQuery(() => db.folders.orderBy('position').toArray()) || [];

    const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const handleDeleteFeed = async (feedId: string) => {
        if (!confirm('Delete this feed and all its articles?')) return;
        await db.articles.where('feedID').equals(feedId).delete();
        await db.feeds.delete(feedId);
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!confirm('Delete this folder? Feeds inside will be moved to Uncategorized.')) return;
        const folderFeeds = await db.feeds.where('folderID').equals(folderId).toArray();
        for (const feed of folderFeeds) {
            await db.feeds.update(feed.id, { folderID: undefined });
        }
        await db.folders.delete(folderId);
    };

    const handleMoveFeed = async (feedId: string, folderId: string | null) => {
        await db.feeds.update(feedId, { folderID: folderId || undefined });
        setShowMoveModal(false);
        setSelectedFeed(null);
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        await db.folders.add({
            id: uuidv4(),
            name: newFolderName.trim(),
            position: folders.length
        });
        setNewFolderName('');
        setShowNewFolderModal(false);
    };

    const rootFeeds = feeds.filter(f => !f.folderID);

    const [showBulkRenameModal, setShowBulkRenameModal] = useState(false);
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [previewChanges, setPreviewChanges] = useState<{ id: string, old: string, new: string }[]>([]);

    const handlePreviewReplace = () => {
        if (!findText) {
            setPreviewChanges([]);
            return;
        }
        const changes = feeds
            .filter(f => f.title.includes(findText))
            .map(f => ({
                id: f.id,
                old: f.title,
                new: f.title.replace(new RegExp(findText, 'g'), replaceText)
            }));
        setPreviewChanges(changes);
    };

    const handleApplyBulkRename = async () => {
        for (const change of previewChanges) {
            await db.feeds.update(change.id, { title: change.new });
        }
        setShowBulkRenameModal(false);
        setFindText('');
        setReplaceText('');
        setPreviewChanges([]);
    };

    return (
        <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
            <header className="header-blur sticky top-0 z-30 border-b border-zinc-200/50 dark:border-zinc-800/50">
                <div className="h-14 flex items-center gap-3 px-4 sm:px-6">
                    <Link href="/settings" className="p-2 -ml-2 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-xl font-bold tracking-tight flex-1">Manage Feeds</h1>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/feeds/discover"
                            className="p-2 rounded-full text-purple-600 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                            title="Discover Feeds"
                        >
                            <Sparkles size={20} />
                        </Link>
                        <button
                            onClick={() => setShowBulkRenameModal(true)}
                            className="p-2 rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            title="Bulk Rename"
                        >
                            <Edit2 size={20} />
                        </button>
                        <button
                            onClick={() => setShowNewFolderModal(true)}
                            className="p-2 rounded-full bg-brand text-white hover:brightness-110"
                            title="Create Folder"
                        >
                            <FolderPlus size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">

                {/* Bulk Rename Modal */}
                {showBulkRenameModal && (
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-lg shadow-xl flex flex-col max-h-[80vh]">
                            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                                <h3 className="font-semibold">Bulk Rename Feeds</h3>
                                <p className="text-xs text-zinc-500">Find and replace text across all feed titles.</p>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-zinc-500">Find</label>
                                        <input
                                            type="text"
                                            value={findText}
                                            onChange={e => setFindText(e.target.value)}
                                            onBlur={handlePreviewReplace}
                                            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                            placeholder="Text to find..."
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-zinc-500">Replace with</label>
                                        <input
                                            type="text"
                                            value={replaceText}
                                            onChange={e => setReplaceText(e.target.value)}
                                            onBlur={handlePreviewReplace}
                                            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                            placeholder="Replacement..."
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button onClick={handlePreviewReplace} className="text-sm text-brand font-medium hover:underline">
                                        Preview Changes
                                    </button>
                                </div>

                                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 h-48 overflow-y-auto border border-zinc-100 dark:border-zinc-800/50">
                                    {previewChanges.length > 0 ? (
                                        <ul className="space-y-2 text-sm">
                                            {previewChanges.map(change => (
                                                <li key={change.id} className="flex flex-col">
                                                    <span className="text-red-500 line-through text-xs opacity-70">{change.old}</span>
                                                    <span className="text-emerald-500 font-medium">{change.new}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-zinc-400 text-sm text-center py-12">Enter text to see preview...</p>
                                    )}
                                </div>
                            </div>
                            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
                                <button onClick={() => setShowBulkRenameModal(false)} className="flex-1 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-lg border border-zinc-200 dark:border-zinc-700">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleApplyBulkRename}
                                    disabled={previewChanges.length === 0}
                                    className="flex-1 py-2 bg-brand text-white rounded-lg font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Apply to {previewChanges.length} Feeds
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="max-w-2xl mx-auto space-y-6">
                    {/* Folders */}
                    {folders.map(folder => (
                        <FolderGroup
                            key={folder.id}
                            folder={folder}
                            feeds={feeds.filter(f => f.folderID === folder.id)}
                            onDeleteFolder={() => handleDeleteFolder(folder.id)}
                            onDeleteFeed={handleDeleteFeed}
                            onMoveFeed={(id) => { setSelectedFeed(id); setShowMoveModal(true); }}
                        />
                    ))}

                    {/* Root Feeds */}
                    {rootFeeds.length > 0 && (
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            <div className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800/50 font-medium rounded-t-xl">Uncategorized</div>
                            <ul>
                                {rootFeeds.map((feed, index) => (
                                    <FeedRow
                                        key={feed.id}
                                        feed={feed}
                                        onDelete={() => handleDeleteFeed(feed.id)}
                                        onMove={() => { setSelectedFeed(feed.id); setShowMoveModal(true); }}
                                        isLast={index === rootFeeds.length - 1}
                                    />
                                ))}
                            </ul>
                        </div>
                    )}

                    {feeds.length === 0 && (
                        <div className="text-center py-12 text-zinc-400">
                            <Rss size={48} className="mx-auto opacity-20 mb-2" />
                            <p>No feeds yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Move Feed Modal */}
            {showMoveModal && selectedFeed && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-sm shadow-xl">
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                            <h3 className="font-semibold">Move Feed To...</h3>
                        </div>
                        <ul className="p-2 max-h-64 overflow-y-auto">
                            <li>
                                <button
                                    onClick={() => handleMoveFeed(selectedFeed, null)}
                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3"
                                >
                                    <Rss size={16} className="text-zinc-400" />
                                    Uncategorized (Root)
                                </button>
                            </li>
                            {folders.map(folder => (
                                <li key={folder.id}>
                                    <button
                                        onClick={() => handleMoveFeed(selectedFeed, folder.id)}
                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3"
                                    >
                                        <FolderOpen size={16} className="text-amber-500" />
                                        {folder.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
                            <button onClick={() => { setShowMoveModal(false); setSelectedFeed(null); }} className="w-full py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Folder Modal */}
            {showNewFolderModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-sm shadow-xl">
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                            <h3 className="font-semibold">Create Folder</h3>
                        </div>
                        <div className="p-4">
                            <input
                                type="text"
                                placeholder="Folder name..."
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                autoFocus
                            />
                        </div>
                        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
                            <button onClick={() => setShowNewFolderModal(false)} className="flex-1 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-lg border border-zinc-200 dark:border-zinc-700">
                                Cancel
                            </button>
                            <button onClick={handleCreateFolder} className="flex-1 py-2 bg-brand text-white rounded-lg font-medium hover:brightness-110">
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function FeedRow({ feed, onDelete, onMove, isLast }: { feed: Feed; onDelete: () => void; onMove: () => void; isLast?: boolean }) {
    const getIcon = () => {
        if (feed.type === 'youtube') return Play;
        if (feed.type === 'podcast') return Radio;
        if (feed.type === 'reddit') return MessageCircle;
        return Rss;
    };
    const Icon = getIcon();
    const [showMenu, setShowMenu] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(feed.title);

    const handleTypeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        await db.feeds.update(feed.id, { type: e.target.value as any });
    };

    const handleRename = async () => {
        if (!editTitle.trim()) return;
        await db.feeds.update(feed.id, { title: editTitle.trim() });
        setIsEditing(false);
    };

    const isLocal = isNaN(parseInt(feed.id));

    return (
        <li className={clsx(
            "flex items-center gap-3 px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 first:border-t-0 group relative",
            isLast && "rounded-b-xl"
        )}>
            <Icon size={16} className="text-zinc-400 shrink-0" />
            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename();
                                if (e.key === 'Escape') { setIsEditing(false); setEditTitle(feed.title); }
                            }}
                        />
                        <button onClick={handleRename} className="p-1 text-brand"><Check size={18} /></button>
                        <button onClick={() => { setIsEditing(false); setEditTitle(feed.title); }} className="p-1 text-zinc-500"><X size={18} /></button>
                    </div>
                ) : (
                    <>
                        <p className="font-medium text-sm truncate flex items-center gap-2">
                            {feed.title}
                            {isLocal && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                    LOCAL
                                </span>
                            )}
                        </p>
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-zinc-500 truncate max-w-[200px]">{feed.feedURL}</p>
                            <select
                                value={feed.type || 'rss'}
                                onChange={handleTypeChange}
                                className="text-xs bg-zinc-100 dark:bg-zinc-800 border-none rounded px-1.5 py-0.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 focus:ring-0 cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <option value="rss">RSS</option>
                                <option value="podcast">Podcast</option>
                                <option value="youtube">YouTube</option>
                                <option value="reddit">Reddit</option>
                            </select>
                        </div>
                    </>
                )}
            </div>

            {/* Desktop Actions */}
            {!isEditing && (
                <div className="hidden md:flex items-center gap-1">
                    <button
                        onClick={() => { setIsEditing(true); setEditTitle(feed.title); }}
                        className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Rename"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button onClick={onMove} className="p-2 text-zinc-400 hover:text-brand rounded-full hover:bg-brand/10 transition-colors" title="Move">
                        <MoveRight size={16} />
                    </button>
                    <button onClick={onDelete} className="p-2 text-zinc-400 hover:text-red-500 rounded-full hover:bg-red-500/10 transition-colors" title="Delete">
                        <Trash2 size={16} />
                    </button>
                </div>
            )}

            {/* Mobile Menu */}
            {!isEditing && (
                <div className="md:hidden relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 -mr-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                        <MoreVertical size={20} />
                    </button>

                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 z-20 py-1">
                                <button
                                    onClick={() => { setShowMenu(false); setIsEditing(true); setEditTitle(feed.title); }}
                                    className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
                                >
                                    <Edit2 size={16} /> Rename Feed
                                </button>
                                <button
                                    onClick={() => { setShowMenu(false); onMove(); }}
                                    className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
                                >
                                    <MoveRight size={16} /> Move to Folder
                                </button>
                                <button
                                    onClick={() => { setShowMenu(false); onDelete(); }}
                                    className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                >
                                    <Trash2 size={16} /> Delete Feed
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </li>
    );
}

function FolderGroup({ folder, feeds, onDeleteFolder, onDeleteFeed, onMoveFeed }: { 
    folder: Folder; 
    feeds: Feed[]; 
    onDeleteFolder: () => void;
    onDeleteFeed: (id: string) => void;
    onMoveFeed: (id: string) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(folder.name);
    const [showMenu, setShowMenu] = useState(false);

    const handleRename = async () => {
        if (!editName.trim()) return;
        await db.folders.update(folder.id, { name: editName.trim() });
        setIsEditing(false);
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800/50 flex items-center gap-3 group relative rounded-t-xl">
                <FolderOpen size={18} className="text-amber-500" />
                
                {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                        <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename();
                                if (e.key === 'Escape') setIsEditing(false);
                            }}
                        />
                        <button onClick={handleRename} className="p-1 text-brand"><Check size={18} /></button>
                        <button onClick={() => { setIsEditing(false); setEditName(folder.name); }} className="p-1 text-zinc-500"><X size={18} /></button>
                    </div>
                ) : (
                    <>
                        <span className="font-medium flex-1 truncate">{folder.name}</span>
                        
                        {/* Desktop Actions */}
                        <div className="hidden md:flex items-center gap-1">
                            <button 
                                onClick={() => { setIsEditing(true); setEditName(folder.name); }} 
                                className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                title="Rename Folder"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button 
                                onClick={onDeleteFolder} 
                                className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                title="Delete Folder"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>

                        {/* Mobile Menu */}
                        <div className="md:hidden relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 -mr-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                            >
                                <MoreVertical size={20} />
                            </button>

                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 z-20 py-1">
                                        <button
                                            onClick={() => { setShowMenu(false); setIsEditing(true); setEditName(folder.name); }}
                                            className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
                                        >
                                            <Edit2 size={16} /> Rename Folder
                                        </button>
                                        <button
                                            onClick={() => { setShowMenu(false); onDeleteFolder(); }}
                                            className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                        >
                                            <Trash2 size={16} /> Delete Folder
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
            {feeds.length > 0 ? (
                <ul>
                    {feeds.map((feed, index) => (
                        <FeedRow
                            key={feed.id}
                            feed={feed}
                            onDelete={() => onDeleteFeed(feed.id)}
                            onMove={() => onMoveFeed(feed.id)}
                            isLast={index === feeds.length - 1}
                        />
                    ))}
                </ul>
            ) : (
                <div className="px-4 py-3 text-sm text-zinc-400 rounded-b-xl">No feeds in this folder</div>
            )}
        </div>
    );
}
