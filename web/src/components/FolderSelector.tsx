'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, Folder } from '@/lib/db';
import { ChevronDown, Plus, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { uuidv4 } from '@/lib/utils';

interface FolderSelectorProps {
    selectedFolderId?: string | null;
    onChange: (folderId: string | null) => void;
    className?: string;
}

export function FolderSelector({ selectedFolderId, onChange, className }: FolderSelectorProps) {
    const folders = useLiveQuery(() => db.folders.orderBy('position').toArray()) || [];
    const [isCreating, setIsCreating] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const selectedFolder = folders.find(f => f.id === selectedFolderId);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        const newFolder: Folder = {
            id: uuidv4(),
            name: newFolderName.trim(),
            position: folders.length
        };

        await db.folders.add(newFolder);
        onChange(newFolder.id);
        setNewFolderName('');
        setIsCreating(false);
    };

    return (
        <div className={clsx('space-y-3', className)}>
            <label className="block text-base font-semibold text-zinc-900 dark:text-zinc-100">
                📁 Add to folder
            </label>

            {!isCreating ? (
                <div className="space-y-3">
                    {/* Folder dropdown */}
                    <select
                        value={selectedFolderId || ''}
                        onChange={(e) => onChange(e.target.value || null)}
                        className="w-full px-4 py-3 text-base bg-zinc-100 dark:bg-zinc-800 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 focus:border-brand focus:ring-2 focus:ring-brand/20 text-zinc-900 dark:text-zinc-100 font-medium"
                    >
                        <option value="">📂 No folder (Root)</option>
                        {folders.map(folder => (
                            <option key={folder.id} value={folder.id}>
                                📁 {folder.name}
                            </option>
                        ))}
                    </select>

                    {/* Create new folder button */}
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 text-base text-brand hover:text-brand/80 transition-colors font-medium"
                    >
                        <Plus size={18} />
                        Create new folder
                    </button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Folder name..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                        className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg border-none focus:ring-2 focus:ring-brand text-zinc-900 dark:text-zinc-100"
                        autoFocus
                    />
                    <button
                        onClick={handleCreateFolder}
                        disabled={!newFolderName.trim()}
                        className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Create
                    </button>
                    <button
                        onClick={() => {
                            setIsCreating(false);
                            setNewFolderName('');
                        }}
                        className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}
