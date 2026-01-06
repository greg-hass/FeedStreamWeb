/// <reference lib="webworker" />

// Custom Service Worker Extensions
// This file is merged with the auto-generated sw.js by the PWA plugin

declare const self: ServiceWorkerGlobalScope;

// Push notification event handler
self.addEventListener('push', (event: PushEvent) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const title = data.title || 'New Article';
        const options: NotificationOptions = {
            body: data.body || 'You have a new article to read',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: data.tag || 'article-notification',
            data: {
                url: data.url || '/',
                articleId: data.articleId,
            },
        };

        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    } catch (e) {
        console.error('Push notification error:', e);
    }
});

// Notification click handler
self.addEventListener('notificationclick', (event: NotificationEvent) => {
    event.notification.close();

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients: readonly WindowClient[]) => {
                // Check if a window is already open
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(url);
                        return client.focus();
                    }
                }
                // Open new window
                if (self.clients.openWindow) {
                    return self.clients.openWindow(url);
                }
            })
    );
});

// Push subscription change handler
self.addEventListener('pushsubscriptionchange', () => {
    console.log('Push subscription changed - may need to re-subscribe');
});

export { };
