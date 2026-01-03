
'use client';

import React from 'react';
import { db } from '@/lib/db';

export default function SettingsPage() {

    const handleReset = async () => {
        if (confirm('Are you sure you want to clear all data?')) {
            await db.delete();
            await db.open();
            window.location.reload();
        }
    };

    return (
        <div className="h-screen flex flex-col bg-white dark:bg-zinc-950">
            <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 shrink-0">
                <h1 className="font-semibold text-lg">Settings</h1>
            </header>

            <div className="p-6 max-w-2xl mx-auto w-full space-y-8">
                <section className="space-y-4">
                    <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Storage</h2>
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
                        <button
                            onClick={handleReset}
                            className="text-red-600 hover:text-red-700 font-medium text-sm"
                        >
                            Clear Database & Reset App
                        </button>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Sync</h2>
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
                        <p className="text-sm text-zinc-500 mb-2">FreshRSS / Fever API Sync</p>
                        <button className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded text-sm font-medium disabled:opacity-50" disabled>
                            Connect Account (Coming Soon)
                        </button>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">About</h2>
                    <div className="text-sm text-zinc-500">
                        <p>FeedStream Web v1.0.0</p>
                        <p>Port of FeedStream iOS</p>
                    </div>
                </section>
            </div>
        </div>
    );
}
