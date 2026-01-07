
'use client';

import React from 'react';
import { SidebarLink } from './SidebarLink';
import { FileText, MessageCircle, Youtube, Mic } from 'lucide-react';

interface SmartFoldersProps {
    counts: {
        rss: number;
        reddit: number;
        youtube: number;
        podcast: number;
    };
    pathname: string;
}

export const SmartFolders = React.memo(({ counts, pathname }: SmartFoldersProps) => {
    const smartFolders = [
        { href: '/folder/rss', label: 'RSS', icon: FileText, count: counts.rss },
        { href: '/folder/reddit', label: 'Reddit', icon: MessageCircle, count: counts.reddit },
        { href: '/folder/youtube', label: 'YouTube', icon: Youtube, count: counts.youtube },
        { href: '/folder/podcasts', label: 'Podcasts', icon: Mic, count: counts.podcast },
    ];

    return (
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
    );
});
