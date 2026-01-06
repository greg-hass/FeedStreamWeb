'use client';

import React from 'react';
import { X } from 'lucide-react';

interface KeyboardHelpProps {
    isOpen: boolean;
    onClose: () => void;
}

const shortcuts = [
    { key: 'j', description: 'Next article' },
    { key: 'k', description: 'Previous article' },
    { key: 'Enter', description: 'Open article' },
    { key: 'o', description: 'Open article' },
    { key: 'Shift + O', description: 'Open in new tab' },
    { key: 'm', description: 'Toggle read/unread' },
    { key: 's', description: 'Toggle star/bookmark' },
    { key: '/', description: 'Focus search' },
    { key: '?', description: 'Show this help' },
];

export function KeyboardHelp({ isOpen, onClose }: KeyboardHelpProps) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-zinc-200 dark:border-zinc-800"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        Keyboard Shortcuts
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={20} className="text-zinc-500" />
                    </button>
                </div>

                <div className="space-y-2">
                    {shortcuts.map(({ key, description }) => (
                        <div
                            key={key}
                            className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                        >
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                {description}
                            </span>
                            <kbd className="px-2 py-1 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                                {key}
                            </kbd>
                        </div>
                    ))}
                </div>

                <p className="mt-4 text-xs text-zinc-400 text-center">
                    Press <kbd className="px-1 font-mono bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400">Esc</kbd> or click outside to close
                </p>
            </div>
        </div>
    );
}
