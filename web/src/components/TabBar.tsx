
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Bookmark, MoreHorizontal } from 'lucide-react';
import { clsx } from 'clsx';
import { useAudioStore } from '@/store/audioStore';

export function TabBar() {
    const pathname = usePathname();
    const { currentTrack, isExpanded } = useAudioStore();

    // Hide TabBar if Audio Player is full screen (expanded)
    if (isExpanded) return null;

    const tabs = [
        { name: 'Today', icon: Home, href: '/' },
        { name: 'All', icon: LayoutGrid, href: '/feeds/all' },
        { name: 'Saved', icon: Bookmark, href: '/saved' },
        { name: 'More', icon: MoreHorizontal, href: '/more' },
    ];

    return (
        <nav className={clsx(
            "md:hidden fixed bottom-0 left-0 right-0 z-40",
            "bg-white/85 dark:bg-black/85 backdrop-blur-xl border-t border-zinc-200/50 dark:border-zinc-800/50",
            "pb-[env(safe-area-inset-bottom)] pt-2"
        )}>
            <div className="flex justify-around items-center h-12">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            className={clsx(
                                "flex flex-col items-center justify-center w-full h-full space-y-[2px]",
                                "active:scale-90 transition-transform duration-200", // Haptic-like press effect
                                isActive ? "text-brand" : "text-zinc-400 dark:text-zinc-500"
                            )}
                            onClick={() => {
                                // navigator.vibrate?.(5); // Simple haptic if supported
                            }}
                        >
                            <tab.icon
                                size={24}
                                strokeWidth={isActive ? 2.5 : 2}
                                className={clsx(isActive && "drop-shadow-sm")}
                            />
                            <span className="text-[10px] font-medium tracking-tight">
                                {tab.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
