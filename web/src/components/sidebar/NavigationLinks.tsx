
'use client';

import React from 'react';
import { SidebarLink } from './SidebarLink';
import { Calendar, LayoutGrid, Bookmark, Clock, BarChart3, Settings } from 'lucide-react';

interface NavigationLinksProps {
    counts: {
        today: number;
        all: number;
        saved: number;
    };
    pathname: string;
}

export const NavigationLinks = React.memo(({ counts, pathname }: NavigationLinksProps) => {
    const links = [
        { href: '/', label: 'Today', icon: Calendar, count: counts.today },
        { href: '/feeds/all', label: 'All Articles', icon: LayoutGrid, count: counts.all },
        { href: '/saved', label: 'Bookmarks', icon: Bookmark, count: counts.saved },
        { href: '/history', label: 'History', icon: Clock },
        { href: '/stats', label: 'Stats', icon: BarChart3 },
    ];

    return (
        <>
            {links.map((link) => (
                <SidebarLink
                    key={link.href}
                    {...link}
                    isActive={pathname === link.href}
                />
            ))}
            <div className="pt-2 mt-2 border-t border-zinc-800/50">
                <SidebarLink
                    href="/settings"
                    label="Settings"
                    icon={Settings}
                    isActive={pathname === '/settings'}
                />
            </div>
        </>
    );
});
