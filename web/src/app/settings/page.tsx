
'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useSettingsStore } from '@/store/settingsStore';
import { md5 } from '@/lib/utils';
import { OpmlService } from '@/lib/opml-service';
import Link from 'next/link';

export default function SettingsPage() {
    const { syncEndpoint, syncUsername, syncApiKey, setSyncConfig, setSyncEnabled } = useSettingsStore();
    const [endpoint, setEndpoint] = useState('');
    const [username, setUsername] = useState('');
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        setEndpoint(syncEndpoint);
        setUsername(syncUsername);
        setApiKey(syncApiKey);
    }, [syncEndpoint, syncUsername, syncApiKey]);

    const handleSaveSync = async () => {
        // If user provided raw password, compute md5
        // Ideally UI should ask "Is this API Key or Password?"
        // For Fever, standard is md5(username:password) -> apiKey
        // We will save as is for now, assuming user knows Fever requires API Key usually.
        setSyncConfig(endpoint, username, apiKey);
        setSyncEnabled(true);
        alert('Sync Configured!');
    };

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
                    <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Feeds</h2>
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <Link href="/feeds/manage" className="flex items-center justify-between p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                            <span className="text-sm font-medium">Manage Feeds</span>
                            <span className="text-xs text-zinc-500">Edit / Delete</span>
                        </Link>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Data Management</h2>
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800 space-y-4">

                        {/* Import */}
                        <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Import OPML</p>
                            <input
                                type="file"
                                accept=".opml,.xml"
                                className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-brand/90"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                        const text = await file.text();
                                        await OpmlService.importOPML(text);
                                        alert('Import Successful!');
                                    } catch (err) {
                                        console.error(err);
                                        alert('Import Failed');
                                    }
                                }}
                            />
                        </div>

                        <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

                        {/* Export */}
                        <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Export OPML</p>
                            <button
                                onClick={async () => {
                                    const xml = await OpmlService.exportOPML();
                                    const blob = new Blob([xml], { type: 'text/xml' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'feedstream_export.opml';
                                    a.click();
                                }}
                                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
                            >
                                Download OPML File
                            </button>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Sync</h2>
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">FreshRSS / Fever API</p>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">API Endpoint</label>
                                <input
                                    type="text"
                                    placeholder="https://freshrss.example.com/api/fever.php"
                                    className="w-full text-sm p-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                                    value={endpoint}
                                    onChange={(e) => setEndpoint(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Username</label>
                                <input
                                    type="text"
                                    className="w-full text-sm p-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">API Key</label>
                                <input
                                    type="password"
                                    className="w-full text-sm p-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSaveSync}
                            className="w-full py-2 bg-brand text-white rounded text-sm font-medium hover:brightness-110 transition-all"
                        >
                            Save & Enable Sync
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
