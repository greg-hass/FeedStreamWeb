'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { PushService } from '@/lib/push-service';

interface NotificationSettingsProps {
    className?: string;
}

export function NotificationSettings({ className }: NotificationSettingsProps) {
    const [isSupported, setIsSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkState();
    }, []);

    const checkState = async () => {
        setIsLoading(true);
        const state = await PushService.getState();
        setIsSupported(state.isSupported);
        setIsSubscribed(state.isSubscribed);
        setPermission(state.permission);
        setIsLoading(false);
    };

    const handleToggle = async () => {
        setIsLoading(true);
        try {
            if (isSubscribed) {
                await PushService.unsubscribe();
                setIsSubscribed(false);
            } else {
                const subscription = await PushService.subscribe();
                setIsSubscribed(!!subscription);
            }
        } catch (error) {
            console.error('Toggle subscription failed:', error);
        }
        await checkState();
    };

    const handleTestNotification = async () => {
        await PushService.showNotification('Test Notification', {
            body: 'Push notifications are working!',
            tag: 'test',
        });
    };

    if (!isSupported) {
        return (
            <div className={className}>
                <div className="flex items-center gap-3 text-zinc-400">
                    <BellOff size={20} />
                    <span className="text-sm">Push notifications not supported in this browser</span>
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {isSubscribed ? (
                        <Bell size={20} className="text-green-500" />
                    ) : (
                        <BellOff size={20} className="text-zinc-400" />
                    )}
                    <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            Push Notifications
                        </p>
                        <p className="text-sm text-zinc-500">
                            {isSubscribed
                                ? 'You will receive notifications for new articles'
                                : permission === 'denied'
                                    ? 'Notifications blocked - check browser settings'
                                    : 'Get notified when new articles arrive'
                            }
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleToggle}
                    disabled={isLoading || permission === 'denied'}
                    className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : isSubscribed ? (
                        'Disable'
                    ) : (
                        'Enable'
                    )}
                </button>
            </div>

            {isSubscribed && (
                <button
                    onClick={handleTestNotification}
                    className="mt-3 text-sm text-blue-500 hover:text-blue-600"
                >
                    Send test notification
                </button>
            )}

            {!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && (
                <p className="mt-2 text-xs text-amber-500">
                    ⚠️ VAPID key not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable.
                </p>
            )}
        </div>
    );
}
