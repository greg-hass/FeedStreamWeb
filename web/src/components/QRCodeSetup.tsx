'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { encrypt } from '@/lib/encryption-service';
import { useSettingsStore } from '@/store/settingsStore';

interface QRCodeSetupProps {
    onClose: () => void;
}

interface QRPayload {
    type: 'feedstream-device-link';
    version: 1;
    supabaseEmail: string;
    timestamp: number;
    expiresAt: number;
}

export function QRCodeSetup({ onClose }: QRCodeSetupProps) {
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expiresIn, setExpiresIn] = useState(600); // 10 minutes in seconds

    const supabaseEmail = useSettingsStore((s) => s.supabaseEmail);

    // Countdown timer for expiry
    useEffect(() => {
        if (!qrDataUrl) return;

        const timer = setInterval(() => {
            setExpiresIn((prev) => {
                if (prev <= 1) {
                    // QR code expired, clear it
                    setQrDataUrl(null);
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [qrDataUrl]);

    const generateQRCode = async () => {
        if (!password || password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (!supabaseEmail) {
            setError('You must be logged in to Supabase first');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            // Create payload with 10-minute expiry
            const now = Date.now();
            const payload: QRPayload = {
                type: 'feedstream-device-link',
                version: 1,
                supabaseEmail,
                timestamp: now,
                expiresAt: now + 10 * 60 * 1000, // 10 minutes
            };

            // Encrypt the payload with the password
            const payloadJson = JSON.stringify(payload);
            const encryptedPayload = await encrypt(payloadJson, password);

            // Create link URL
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
            const linkUrl = `${baseUrl}/link?data=${encodeURIComponent(encryptedPayload)}`;

            // Generate QR code
            const dataUrl = await QRCode.toDataURL(linkUrl, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff',
                },
                errorCorrectionLevel: 'M',
            });

            setQrDataUrl(dataUrl);
            setExpiresIn(600); // Reset countdown

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate QR code');
        } finally {
            setIsGenerating(false);
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Link Another Device</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {!qrDataUrl ? (
                    // Password input form
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Create a temporary password to protect this device link.
                            The QR code will expire in 10 minutes.
                        </p>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Temporary Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 6 characters"
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm">{error}</div>
                        )}

                        <button
                            onClick={generateQRCode}
                            disabled={isGenerating || password.length < 6}
                            className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? 'Generating...' : 'Generate QR Code'}
                        </button>
                    </div>
                ) : (
                    // QR code display
                    <div className="space-y-4">
                        <div className="flex justify-center">
                            <img src={qrDataUrl} alt="Device link QR code" className="rounded-lg" />
                        </div>

                        <div className="text-center">
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                                Scan this code with your other device
                            </p>
                            <div className={`text-sm font-mono ${expiresIn < 60 ? 'text-red-500' : 'text-gray-500'}`}>
                                Expires in {formatTime(expiresIn)}
                            </div>
                        </div>

                        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                <strong>Remember your password:</strong> You&apos;ll need to enter it on the other device.
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                setQrDataUrl(null);
                                setPassword('');
                            }}
                            className="w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Generate New Code
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
