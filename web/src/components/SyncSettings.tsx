'use client';

import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { SupabaseAuth, isSupabaseConfigured } from '@/lib/supabase-client';
import { SyncService, SyncState } from '@/lib/sync-service';
import { QRCodeSetup } from './QRCodeSetup';

export function SyncSettings() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showQRSetup, setShowQRSetup] = useState(false);
    const [syncState, setSyncState] = useState<SyncState | null>(null);

    const supabaseEnabled = useSettingsStore((s) => s.supabaseEnabled);
    const supabaseEmail = useSettingsStore((s) => s.supabaseEmail);
    const lastSyncAt = useSettingsStore((s) => s.lastSyncAt);
    const syncOnStartup = useSettingsStore((s) => s.syncOnStartup);
    const syncInterval = useSettingsStore((s) => s.syncInterval);
    const setSupabaseEnabled = useSettingsStore((s) => s.setSupabaseEnabled);
    const setSupabaseEmail = useSettingsStore((s) => s.setSupabaseEmail);
    const setSyncOnStartup = useSettingsStore((s) => s.setSyncOnStartup);
    const setSyncInterval = useSettingsStore((s) => s.setSyncInterval);

    const isConfigured = isSupabaseConfigured();

    useEffect(() => {
        // Subscribe to sync state changes
        const unsubscribe = SyncService.subscribe(setSyncState);
        return () => unsubscribe();
    }, []);

    const handleSignUp = async () => {
        if (!email || !password) {
            setError('Please enter email and password');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { user, error: signUpError } = await SupabaseAuth.signUp(email, password);

            if (signUpError) {
                setError(signUpError.message);
                return;
            }

            if (user) {
                setSuccess('Account created! Please check your email to verify your account.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign up failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignIn = async () => {
        if (!email || !password) {
            setError('Please enter email and password');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { user, error: signInError } = await SupabaseAuth.signIn(email, password);

            if (signInError) {
                setError(signInError.message);
                return;
            }

            if (user) {
                setSupabaseEnabled(true);
                setSupabaseEmail(email);
                setSuccess('Signed in successfully!');

                // Trigger initial sync
                SyncService.fullSync().catch(console.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign in failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignOut = async () => {
        setIsLoading(true);
        setError(null);

        try {
            await SupabaseAuth.signOut();
            setSupabaseEnabled(false);
            setSupabaseEmail('');
            setSuccess('Signed out successfully');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign out failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSync = async () => {
        setIsLoading(true);
        setError(null);

        try {
            await SyncService.fullSync();
            setSuccess('Sync completed!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sync failed');
        } finally {
            setIsLoading(false);
        }
    };

    const formatLastSync = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        return date.toLocaleString();
    };

    if (!isConfigured) {
        return (
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Cloud Sync</h3>
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Cloud sync is not configured on this server. To enable sync, the server administrator needs to set up Supabase environment variables.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-medium">Cloud Sync</h3>

            {!supabaseEnabled ? (
                // Login/Signup form
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Sign in to sync your feeds, read states, and bookmarks across devices.
                    </p>

                    <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            placeholder="your@email.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            placeholder="Min 6 characters"
                        />
                    </div>

                    {error && <div className="text-red-500 text-sm">{error}</div>}
                    {success && <div className="text-green-500 text-sm">{success}</div>}

                    <div className="flex gap-3">
                        <button
                            onClick={handleSignIn}
                            disabled={isLoading}
                            className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                        >
                            {isLoading ? 'Loading...' : 'Sign In'}
                        </button>
                        <button
                            onClick={handleSignUp}
                            disabled={isLoading}
                            className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                            Sign Up
                        </button>
                    </div>
                </div>
            ) : (
                // Logged in state
                <div className="space-y-4">
                    {/* Account info */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                            <p className="font-medium">{supabaseEmail}</p>
                            <p className="text-sm text-gray-500">
                                Last synced: {formatLastSync(lastSyncAt)}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {syncState?.isSyncing && (
                                <span className="text-sm text-blue-500 animate-pulse">Syncing...</span>
                            )}
                            {syncState && syncState.pendingChanges > 0 && (
                                <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                                    {syncState.pendingChanges} pending
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Sync actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleSync}
                            disabled={isLoading || syncState?.isSyncing}
                            className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                        >
                            {syncState?.isSyncing ? 'Syncing...' : 'Sync Now'}
                        </button>
                        <button
                            onClick={() => setShowQRSetup(true)}
                            className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                            title="Link another device"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                        </button>
                    </div>

                    {/* Sync settings */}
                    <div className="space-y-3 pt-4 border-t dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="font-medium">Sync on Startup</label>
                                <p className="text-sm text-gray-500">Automatically sync when the app opens</p>
                            </div>
                            <button
                                onClick={() => setSyncOnStartup(!syncOnStartup)}
                                className={`w-12 h-6 rounded-full transition-colors ${syncOnStartup ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${syncOnStartup ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <label className="font-medium">Auto Sync Interval</label>
                                <p className="text-sm text-gray-500">How often to sync in background</p>
                            </div>
                            <select
                                value={syncInterval}
                                onChange={(e) => setSyncInterval(Number(e.target.value))}
                                className="px-3 py-1.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value={0}>Manual only</option>
                                <option value={5}>Every 5 minutes</option>
                                <option value={15}>Every 15 minutes</option>
                                <option value={30}>Every 30 minutes</option>
                                <option value={60}>Every hour</option>
                            </select>
                        </div>
                    </div>

                    {error && <div className="text-red-500 text-sm">{error}</div>}
                    {success && <div className="text-green-500 text-sm">{success}</div>}

                    {/* Sign out */}
                    <button
                        onClick={handleSignOut}
                        disabled={isLoading}
                        className="w-full py-2 px-4 text-red-500 border border-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                    >
                        Sign Out
                    </button>
                </div>
            )}

            {/* QR Code Setup Modal */}
            {showQRSetup && <QRCodeSetup onClose={() => setShowQRSetup(false)} />}
        </div>
    );
}
