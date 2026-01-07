'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { decrypt } from '@/lib/encryption-service';
import { SupabaseAuth, isSupabaseConfigured } from '@/lib/supabase-client';
import { useSettingsStore } from '@/store/settingsStore';

interface QRPayload {
    type: 'feedstream-device-link';
    version: 1;
    supabaseEmail: string;
    timestamp: number;
    expiresAt: number;
}

function LinkPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [status, setStatus] = useState<'loading' | 'password' | 'linking' | 'success' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [userPassword, setUserPassword] = useState('');
    const [email, setEmail] = useState('');
    const [encryptedData, setEncryptedData] = useState<string | null>(null);

    const setSupabaseEnabled = useSettingsStore((s) => s.setSupabaseEnabled);
    const setSupabaseEmail = useSettingsStore((s) => s.setSupabaseEmail);

    useEffect(() => {
        const data = searchParams.get('data');

        if (!data) {
            setError('No link data found. Please scan a valid QR code.');
            setStatus('error');
            return;
        }

        if (!isSupabaseConfigured()) {
            setError('Cloud sync is not configured on this server.');
            setStatus('error');
            return;
        }

        setEncryptedData(data);
        setStatus('password');
    }, [searchParams]);

    const handleDecrypt = async () => {
        if (!encryptedData) return;

        setStatus('linking');
        setError(null);

        try {
            // Decrypt the payload
            const decrypted = await decrypt(encryptedData, password);
            const payload: QRPayload = JSON.parse(decrypted);

            // Validate payload
            if (payload.type !== 'feedstream-device-link') {
                throw new Error('Invalid link type');
            }

            // Check expiry
            if (Date.now() > payload.expiresAt) {
                throw new Error('This link has expired. Please generate a new QR code.');
            }

            setEmail(payload.supabaseEmail);
            setStatus('password'); // Show password input for Supabase login

        } catch (err) {
            if (err instanceof Error && err.message.includes('Decryption failed')) {
                setError('Incorrect password. Please try again.');
            } else {
                setError(err instanceof Error ? err.message : 'Failed to process link');
            }
            setStatus('password');
        }
    };

    const handleLogin = async () => {
        if (!email || !userPassword) return;

        setStatus('linking');
        setError(null);

        try {
            const { user, error: authError } = await SupabaseAuth.signIn(email, userPassword);

            if (authError) {
                throw authError;
            }

            if (!user) {
                throw new Error('Login failed. Please try again.');
            }

            // Update settings
            setSupabaseEnabled(true);
            setSupabaseEmail(email);

            setStatus('success');

            // Redirect to home after 2 seconds
            setTimeout(() => {
                router.push('/');
            }, 2000);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
            setStatus('password');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold">Link Device</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Connect this device to your FeedStream account
                    </p>
                </div>

                {status === 'loading' && (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                )}

                {status === 'password' && !email && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Enter the temporary password you created when generating the QR code.
                        </p>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Temporary Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm">{error}</div>
                        )}

                        <button
                            onClick={handleDecrypt}
                            disabled={!password}
                            className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue
                        </button>
                    </div>
                )}

                {status === 'password' && email && (
                    <div className="space-y-4">
                        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                            <p className="text-sm text-green-800 dark:text-green-200">
                                Link verified! Now log in to complete setup.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                disabled
                                className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-gray-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                value={userPassword}
                                onChange={(e) => setUserPassword(e.target.value)}
                                placeholder="Your FeedStream password"
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm">{error}</div>
                        )}

                        <button
                            onClick={handleLogin}
                            disabled={!userPassword}
                            className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Log In & Link Device
                        </button>
                    </div>
                )}

                {status === 'linking' && (
                    <div className="flex flex-col items-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                        <p className="text-sm text-gray-500">Setting up your device...</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-green-600 dark:text-green-400">Device Linked!</h2>
                        <p className="text-sm text-gray-500 mt-2">Redirecting to home...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Link Failed</h2>
                        <p className="text-sm text-gray-500 mt-2">{error}</p>
                        <button
                            onClick={() => router.push('/')}
                            className="mt-4 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Go Home
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function LinkPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        }>
            <LinkPageContent />
        </Suspense>
    );
}
