
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Rss, Clock, Calendar, Bookmark, Settings, Hash, Play } from 'lucide-react';
import { clsx } from 'clsx';

export function Sidebar() {
    const pathname = usePathname();

    const links = [
        { href: '/', label: 'Today', icon: Calendar },
        { href: '/feeds/all', label: 'All Feeds', icon: LayoutGrid },
        { href: '/saved', label: 'Saved', icon: Bookmark },
        { href: '/history', label: 'History', icon: Clock },
        { href: '/settings', label: 'Settings', icon: Settings },
    ];

    return (
        <aside className="w-64 bg-sidebar border-r border-zinc-800 hidden md:flex flex-col h-screen fixed left-0 top-0">
            <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
                <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-brand-foreground font-bold">
                    FS
                </div>
                <span className="font-semibold text-white">FeedStream</span>
            </div>

            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={clsx(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                                isActive
                                    ? "bg-sidebar-active text-sidebar-active-foreground font-medium"
                                    : "text-sidebar-foreground hover:bg-zinc-800 hover:text-zinc-200"
                            )}
                        >
                            <Icon size={18} />
                            {link.label}
                        </Link>
                    );
                })}

                <div className="mt-6 px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Smart Folders
                </div>
                <div className="mt-2 space-y-1">
                    <Link
                        href="/folder/youtube"
                        className={clsx(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                            pathname === '/folder/youtube'
                                ? "bg-sidebar-active text-sidebar-active-foreground font-medium"
                                : "text-sidebar-foreground hover:bg-zinc-800 hover:text-zinc-200"
                        )}
                    >
                        <span className="text-red-500"><Play size={18} fill="currentColor" /></span>
                        YouTube
                    </Link>
                    <Link
                        href="/folder/podcasts"
                        className={clsx(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                            pathname === '/folder/podcasts'
                                ? "bg-sidebar-active text-sidebar-active-foreground font-medium"
                                : "text-sidebar-foreground hover:bg-zinc-800 hover:text-zinc-200"
                        )}
                    >
                        <span className="text-purple-500"><Hash size={18} /></span>
                        Podcasts
                    </Link>
                    <Link
                        href="/folder/reddit"
                        className={clsx(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                            pathname === '/folder/reddit'
                                ? "bg-sidebar-active text-sidebar-active-foreground font-medium"
                                : "text-sidebar-foreground hover:bg-zinc-800 hover:text-zinc-200"
                        )}
                    >
                        <span className="text-orange-500"><Hash size={18} /></span>
                        Reddit
                    </Link>
                </div>
            </nav>
        </aside>
    );
}
