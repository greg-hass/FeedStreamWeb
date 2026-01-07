
'use client';

import React from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';

interface SidebarLinkProps {
    href: string;
    label: string;
    icon: any;
    isActive: boolean;
    small?: boolean;
    count?: number;
}

export const SidebarLink = React.memo(({ href, label, icon: Icon, isActive, small, count }: SidebarLinkProps) => {
    return (
        <Link
            href={href}
            className={clsx(
                "flex items-center justify-between gap-3 rounded-lg transition-all duration-150",
                small ? "px-2 py-1.5 text-xs" : "px-3 py-2.5 text-sm",
                isActive
                    ? "bg-brand/10 text-brand font-medium"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
            title={label}
        >
            <div className="flex items-center gap-3">
                <Icon size={small ? 14 : 18} className="shrink-0" />
                <span className="truncate">{label}</span>
            </div>
            {count !== undefined && count > 0 && (
                <span className="text-sm font-mono text-brand font-semibold">
                    {count > 999 ? '999+' : count}
                </span>
            )}
        </Link>
    );
});
