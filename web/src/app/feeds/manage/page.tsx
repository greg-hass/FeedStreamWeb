
'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { FeedService } from '@/lib/feed-service';
import { Trash2, Edit2, Check, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function FeedManagementPage() {
    const feeds = useLiveQuery(() => db.feeds.toArray()) ?? [];
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this feed? All articles will be removed.')) {
            await FeedService.deleteFeed(id);
        }
    };

    const startEdit = (feed: any) => {
        setEditingId(feed.id);
        setEditTitle(feed.title);
    };

    const saveEdit = async () => {
        if (editingId && editTitle.trim()) {
            await db.feeds.update(editingId, { title: editTitle.trim() });
            setEditingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 pb-20">
            <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 h-14 flex items-center px-4 justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/settings" className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="font-semibold text-lg">Manage Feeds</h1>
                </div>
            </header>

            <div className="p-4 space-y-2">
                {feeds.length === 0 && (
                    <div className="text-center py-20 text-zinc-500">
                        No feeds subscribed.
                    </div>
                )}

                {feeds.map(feed => (
                    <div key={feed.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">

                        {editingId === feed.id ? (
                            <div className="flex-1 flex gap-2 mr-2">
                                <input
                                    className="flex-1 px-2 py-1 bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded text-sm"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={saveEdit} className="p-1.5 bg-brand text-white rounded"><Check size={16} /></button>
                                <button onClick={() => setEditingId(null)} className="p-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 rounded"><X size={16} /></button>
                            </div>
                        ) : (
                            <div className="flex-1 min-w-0 mr-4">
                                <h3 className="font-medium truncate">{feed.title}</h3>
                                <p className="text-xs text-zinc-500 truncate">{feed.feedURL}</p>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            {!editingId && (
                                <button
                                    onClick={() => startEdit(feed)}
                                    className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                                >
                                    <Edit2 size={18} />
                                </button>
                            )}
                            <button
                                onClick={() => handleDelete(feed.id)}
                                className="p-2 text-red-400 hover:text-red-500"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
