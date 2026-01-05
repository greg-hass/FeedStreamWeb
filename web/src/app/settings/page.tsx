
'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useSettingsStore } from '@/store/settingsStore';
import { md5 } from '@/lib/utils';
import { OpmlService } from '@/lib/opml-service';
import { FeverAPI } from '@/lib/fever-api';
import Link from 'next/link';
import { Sparkles, Workflow, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
    const { syncEndpoint, syncUsername, syncApiKey, setSyncConfig, setSyncEnabled, openaiApiKey, setOpenaiApiKey, geminiApiKey, setGeminiApiKey } = useSettingsStore();
    const [endpoint, setEndpoint] = useState('');
    const [username, setUsername] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [aiKey, setAiKey] = useState('');
    const [gKey, setGKey] = useState('');
    const [importProgress, setImportProgress] = useState<{ current: number, total: number, message: string } | null>(null);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        setEndpoint(syncEndpoint);
        setUsername(syncUsername);
        setApiKey(syncApiKey);
        setAiKey(openaiApiKey);
        setGKey(geminiApiKey);
    }, [syncEndpoint, syncUsername, syncApiKey, openaiApiKey, geminiApiKey]);

    const handleSaveSync = async () => {
        setSyncConfig(endpoint, username, apiKey);
        setSyncEnabled(true);
        alert('Sync Configured!');
    };

    const handleTestSync = async () => {
        if (!endpoint || !username || !apiKey) {
            setTestStatus('error');
            setTestMessage('Please fill in all fields');
            return;
        }

        setTestStatus('testing');
        setTestMessage('');

        try {
            const inputString = `${username}:${apiKey}`;
            const finalKey = await md5(inputString);
            const api = new FeverAPI(endpoint, finalKey);
            
            await api.getGroups(); // Simple fetch to verify auth
            setTestStatus('success');
            setTestMessage('Connection Successful!');
            
            // Auto-clear success after 3s
            setTimeout(() => {
                if (testStatus === 'success') setTestStatus('idle');
            }, 3000);

        } catch (e: any) {
            setTestStatus('error');
            setTestMessage(e.message || 'Connection Failed');
        }
    };

    const handleSaveAI = () => {
        setOpenaiApiKey(aiKey);
        setGeminiApiKey(gKey);
        alert('AI Keys Saved!');
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
                    <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Feeds & Automation</h2>
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <Link href="/feeds/manage" className="flex items-center justify-between p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition border-b border-zinc-200 dark:border-zinc-800">
                            <span className="text-sm font-medium">Manage Feeds</span>
                            <span className="text-xs text-zinc-500">Edit / Delete</span>
                        </Link>
                        <Link href="/settings/rules" className="flex items-center justify-between p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition border-b border-zinc-200 dark:border-zinc-800">
                            <span className="text-sm font-medium flex items-center gap-2"><Workflow size={16} /> Automation Rules</span>
                            <span className="text-xs text-zinc-500">Filters</span>
                        </Link>
                        <button
                            onClick={async () => {
                                if (!confirm('Delete ALL feeds, folders, and articles? This cannot be undone!')) return;
                                await db.articles.clear();
                                await db.feeds.clear();
                                await db.folders.clear();
                                alert('All feeds deleted!');
                            }}
                            className="flex items-center justify-between p-4 w-full text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        >
                            <span className="text-sm font-medium text-red-600">Delete All Feeds</span>
                            <span className="text-xs text-zinc-500">Master Reset</span>
                        </button>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">AI Intelligence</h2>
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                <Sparkles size={16} className="text-purple-500" /> OpenAI API
                            </p>
                        </div>
                        <p className="text-xs text-zinc-500">
                            Provide your API key to enable "Daily Briefings" and auto-summarization. Your key is stored locally in your browser.
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">OpenAI Key (sk-...)</label>
                                <input
                                    type="password"
                                    className="w-full text-sm p-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                                    value={aiKey}
                                    onChange={(e) => setAiKey(e.target.value)}
                                    placeholder="sk-..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Gemini Key (AIza...)</label>
                                <input
                                    type="password"
                                    className="w-full text-sm p-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                                    value={gKey}
                                    onChange={(e) => setGKey(e.target.value)}
                                    placeholder="AIza..."
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleSaveAI}
                            className="w-full py-2 bg-purple-600 text-white rounded text-sm font-medium hover:brightness-110 transition-all"
                        >
                            Save AI Key
                        </button>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Data Management</h2>
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800 space-y-4">

                        {/* Import */}
                        <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Import OPML</p>

                            {importProgress ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-zinc-500">
                                        <span>{importProgress.message}</span>
                                        <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
                                    </div>
                                    <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-brand transition-all duration-300 ease-out"
                                            style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <input
                                    type="file"
                                    accept=".opml,.xml"
                                    className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-brand/90 cursor-pointer"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        try {
                                            const text = await file.text();
                                            await OpmlService.importOPML(text, (current, total, message) => {
                                                setImportProgress({ current, total, message });
                                            });
                                            setImportProgress(null);
                                            alert('Import Successful!');
                                            // Reset input 
                                            e.target.value = '';
                                        } catch (err: any) {
                                            console.error(err);
                                            setImportProgress(null);
                                            alert('Import Failed: ' + (err.message || 'Unknown error'));
                                        }
                                    }}
                                />
                            )}
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

                        <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

                        {/* Settings Backup */}
                        <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Backup Settings</p>
                            <p className="text-xs text-zinc-500 mb-3">
                                Export your API keys and sync config to restore on another device.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={async () => {
                                        const settings = {
                                            syncEndpoint,
                                            syncUsername,
                                            syncApiKey,
                                            openaiApiKey,
                                            geminiApiKey,
                                            exportedAt: new Date().toISOString(),
                                        };
                                        const json = JSON.stringify(settings, null, 2);
                                        const blob = new Blob([json], { type: 'application/json' });
                                        const file = new File([blob], 'feedstream_settings.json', { type: 'application/json' });

                                        // Try Web Share API first (works on iOS Safari)
                                        if (navigator.share && navigator.canShare?.({ files: [file] })) {
                                            try {
                                                await navigator.share({
                                                    files: [file],
                                                    title: 'FeedStream Settings',
                                                });
                                                return;
                                            } catch (e) {
                                                // User cancelled or share failed, fall through
                                            }
                                        }

                                        // Fallback: try traditional download
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'feedstream_settings.json';
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
                                >
                                    Export Settings
                                </button>
                                <label className="px-4 py-2 bg-brand text-white rounded text-sm font-medium hover:brightness-110 transition cursor-pointer">
                                    Import Settings
                                    <input
                                        type="file"
                                        accept=".json"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            try {
                                                const text = await file.text();
                                                const settings = JSON.parse(text);
                                                if (settings.syncEndpoint !== undefined) {
                                                    setSyncConfig(
                                                        settings.syncEndpoint || '',
                                                        settings.syncUsername || '',
                                                        settings.syncApiKey || ''
                                                    );
                                                    setSyncEnabled(true);
                                                }
                                                if (settings.openaiApiKey) setOpenaiApiKey(settings.openaiApiKey);
                                                if (settings.geminiApiKey) setGeminiApiKey(settings.geminiApiKey);

                                                // Update local state
                                                setEndpoint(settings.syncEndpoint || '');
                                                setUsername(settings.syncUsername || '');
                                                setApiKey(settings.syncApiKey || '');
                                                setAiKey(settings.openaiApiKey || '');
                                                setGKey(settings.geminiApiKey || '');

                                                alert('Settings restored successfully!');
                                                e.target.value = '';
                                            } catch (err: any) {
                                                alert('Failed to import: ' + (err.message || 'Invalid file'));
                                            }
                                        }}
                                    />
                                </label>
                            </div>
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

                        {testMessage && (
                            <div className={`text-sm p-3 rounded flex items-center gap-2 ${testStatus === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                                {testStatus === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                {testMessage}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handleTestSync}
                                disabled={testStatus === 'testing' || !endpoint || !username || !apiKey}
                                className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {testStatus === 'testing' ? <Loader2 className="animate-spin" size={16} /> : 'Test Connection'}
                            </button>
                            <button
                                onClick={handleSaveSync}
                                className="flex-1 py-2 bg-brand text-white rounded text-sm font-medium hover:brightness-110 transition-all"
                            >
                                Save & Enable Sync
                            </button>
                        </div>
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
