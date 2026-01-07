
'use client';

import React from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Youtube, Mic, MessageCircle, Rss, MoreHorizontal } from 'lucide-react';
import { Feed } from '@/lib/db';

interface SidebarFeedItemProps {
    feed: Feed;
    isActive: boolean;
    small?: boolean;
    onContextMenu: (e: React.MouseEvent) => void;
    onMenuClick: (e: React.MouseEvent) => void;
}

const SidebarFeedItemComponent = ({ feed, isActive, small, onContextMenu, onMenuClick }: SidebarFeedItemProps) => {
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
};

export const SidebarFeedItem = React.memo(SidebarFeedItemComponent, (prev, next) => {
    return (
        prev.isActive === next.isActive &&
        prev.small === next.small &&
        prev.feed.id === next.feed.id &&
        prev.feed.title === next.feed.title &&
        prev.feed.iconURL === next.feed.iconURL
    );
});
