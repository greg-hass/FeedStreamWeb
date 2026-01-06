/**
 * Push Notification Service
 * Handles Web Push subscription and notification management
 */

// VAPID public key - set this in your environment or Settings
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

interface PushSubscriptionState {
    isSupported: boolean;
    isSubscribed: boolean;
    permission: NotificationPermission;
}

export class PushService {
    /**
     * Check if push notifications are supported
     */
    static isSupported(): boolean {
        return 'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window;
    }

    /**
     * Get current subscription state
     */
    static async getState(): Promise<PushSubscriptionState> {
        if (!this.isSupported()) {
            return {
                isSupported: false,
                isSubscribed: false,
                permission: 'denied'
            };
        }

        const permission = Notification.permission;
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        return {
            isSupported: true,
            isSubscribed: !!subscription,
            permission
        };
    }

    /**
     * Request notification permission
     */
    static async requestPermission(): Promise<NotificationPermission> {
        if (!this.isSupported()) {
            console.warn('Push notifications not supported');
            return 'denied';
        }

        const permission = await Notification.requestPermission();
        return permission;
    }

    /**
     * Subscribe to push notifications
     */
    static async subscribe(): Promise<PushSubscription | null> {
        if (!this.isSupported()) {
            console.error('Push not supported');
            return null;
        }

        if (!VAPID_PUBLIC_KEY) {
            console.error('VAPID public key not configured');
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Check if already subscribed
            let subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                console.log('Already subscribed to push');
                return subscription;
            }

            // Request permission if not granted
            const permission = await this.requestPermission();
            if (permission !== 'granted') {
                console.log('Notification permission denied');
                return null;
            }

            // Subscribe with VAPID
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
            });

            console.log('Push subscription created:', subscription.endpoint);

            // Store subscription in localStorage for later use
            localStorage.setItem('push_subscription', JSON.stringify(subscription.toJSON()));

            // TODO: Send subscription to your server for storage
            // await fetch('/api/push/subscribe', {
            //     method: 'POST',
            //     body: JSON.stringify(subscription),
            //     headers: { 'Content-Type': 'application/json' }
            // });

            return subscription;
        } catch (error) {
            console.error('Failed to subscribe to push:', error);
            return null;
        }
    }

    /**
     * Unsubscribe from push notifications
     */
    static async unsubscribe(): Promise<boolean> {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                console.log('No push subscription to unsubscribe');
                return true;
            }

            await subscription.unsubscribe();
            localStorage.removeItem('push_subscription');

            console.log('Unsubscribed from push');
            return true;
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
            return false;
        }
    }

    /**
     * Show a local notification (for testing)
     */
    static async showNotification(title: string, options?: NotificationOptions): Promise<void> {
        if (!this.isSupported()) return;

        const permission = await this.requestPermission();
        if (permission !== 'granted') return;

        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            ...options
        });
    }

    /**
     * Convert VAPID key from base64 to Uint8Array
     */
    private static urlBase64ToUint8Array(base64String: string): Uint8Array {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}
