'use client';

import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface RefreshProgressProps {
    current: number;
    total: number;
    currentFeedName?: string;
    onDismiss?: () => void;
}

export function RefreshProgress({ current, total, currentFeedName, onDismiss }: RefreshProgressProps) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return (
        <div className="fixed bottom-28 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">Refreshing Feeds</h4>
                        <p className="text-xs text-zinc-500">
                            {current} / {total} {currentFeedName && `• ${currentFeedName}`}
                        </p>
                    </div>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
                <div className="relative w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full bg-brand transition-all duration-300 ease-out"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
