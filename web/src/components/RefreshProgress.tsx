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
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-50 animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-zinc-900/90 backdrop-blur-md text-white rounded-xl border border-zinc-700/50 shadow-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                        {/* Spinner */}
                        <div className="relative w-5 h-5 shrink-0">
                            <div className="absolute inset-0 rounded-full border-2 border-zinc-700"></div>
                            <div className="absolute inset-0 rounded-full border-t-2 border-brand animate-spin"></div>
                        </div>
                        
                        <div className="flex flex-col min-w-0">
                            <h4 className="font-semibold text-sm leading-none truncate">Refreshing Feeds</h4>
                            <p className="text-xs text-zinc-400 leading-none mt-1.5 truncate">
                                {current} / {total} {currentFeedName && `• ${currentFeedName}`}
                            </p>
                        </div>
                    </div>
                    
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="p-1.5 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="relative w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full bg-brand transition-all duration-300 ease-out"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
