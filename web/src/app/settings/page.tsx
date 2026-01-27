
'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { OpmlService } from '@/lib/opml-service';
import { BackupService } from '@/lib/backup-service';
import Link from 'next/link';
import { Sparkles, Workflow, Loader2, Bell } from 'lucide-react';
import { NotificationSettings } from '@/components/NotificationSettings';

import { useUIStore } from '@/store/uiStore';

export default function SettingsPage() {
    const { geminiApiKey, setGeminiApiKey, backupFrequency, setBackupFrequency } = useSettingsStore();
    const { isImporting, current, total, feedName, startImport, setImportProgress, endImport } = useUIStore();
    const [gKey, setGKey] = useState('');

    useEffect(() => {
        setGKey(geminiApiKey);
    }, [geminiApiKey]);

    const handleSaveAI = () => {
        setGeminiApiKey(gKey);
        alert('AI Key Saved!');
    };

    const handleReset = async () => {
        if (confirm('Are you sure you want to clear all local data?')) {
            // Clear localStorage
            localStorage.clear();
            // Clear IndexedDB
            const dbs = await window.indexedDB.databases();
            for (const db of dbs) {
                if (db.name) {
                    window.indexedDB.deleteDatabase(db.name);
                }
            }
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
                    <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                        <Bell size={14} /> Notifications
                    </h2>
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
                        <NotificationSettings />
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
                            onClick={handleReset}
                            className="flex items-center justify-between p-4 w-full text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        >
                            <span className="text-sm font-medium text-red-600">Clear Local Data</span>
                            <span className="text-xs text-zinc-500">Reset browser storage</span>
                        </button>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">AI Intelligence</h2>
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                <Sparkles size={16} className="text-purple-500" /> AI Services
                            </p>
                        </div>
                        <p className="text-xs text-zinc-500">
                            Configure Gemini to enable "Daily Briefings" and auto-summarization. Key is stored locally and included in Master Backups.
                        </p>
                        <div className="space-y-3">
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

                            {isImporting ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-zinc-500">
                                        <span>{feedName || 'Importing...'}</span>
                                        <span>{Math.round((current / total) * 100)}%</span>
                                    </div>
                                    <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-brand transition-all duration-300 ease-out"
                                            style={{ width: `${(current / total) * 100}%` }}
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
                                            // Initialize global progress
                                            startImport(0); 
                                            await OpmlService.importOPML(text, (curr, tot, msg) => {
                                                if (tot > 0) setImportProgress(curr, tot, msg);
                                            });
                                            endImport();
                                            alert('Import Successful!');
                                            e.target.value = '';
                                        } catch (err: any) {
                                            console.error(err);
                                            endImport();
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

                        {/* Backup Schedule */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Backup Reminders</p>
                                <select
                                    value={backupFrequency}
                                    onChange={(e) => setBackupFrequency(e.target.value as any)}
                                    className="text-xs bg-zinc-100 dark:bg-zinc-800 border-none rounded px-2 py-1 text-zinc-600 dark:text-zinc-400 focus:ring-0 cursor-pointer"
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="never">Never</option>
                                </select>
                            </div>
                            <p className="text-xs text-zinc-500">
                                Get reminded to download a backup of your data.
                            </p>
                        </div>

                        <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

                        {/* Master Backup */}
                        <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Master Backup</p>
                            <p className="text-xs text-zinc-500 mb-3">
                                Comprehensive backup: Includes all feeds, folders, bookmarks, read status, and <strong>AI API Keys</strong>. Use this to move to a new device or protect your data.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                    onClick={async () => {
                                        try {
                                            const backup = await BackupService.createMasterBackup();
                                            BackupService.downloadBackup(backup);
                                        } catch (e: any) {
                                            alert('Export failed: ' + e.message);
                                        }
                                    }}
                                    className="flex-1 px-4 py-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-sm font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition flex items-center justify-center gap-2"
                                >
                                    Export All Data
                                </button>
                                <label className="flex-1 px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-semibold hover:brightness-110 transition cursor-pointer flex items-center justify-center gap-2">
                                    Import Backup
                                    <input
                                        type="file"
                                        accept=".json"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            if (!confirm('Importing a backup will OVERWRITE all current feeds and articles. Continue?')) return;
                                            
                                            try {
                                                const text = await file.text();
                                                const backup = JSON.parse(text);
                                                await BackupService.restoreMasterBackup(backup);
                                                alert('Master Backup restored! The app will now reload.');
                                                window.location.reload();
                                            } catch (err: any) {
                                                alert('Restore Failed: ' + (err.message || 'Invalid file'));
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                </section>

                {/* FreshRSS Sync Section Removed */}

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
