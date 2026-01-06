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

// Image caching for offline thumbnails
const IMAGE_CACHE_NAME = 'article-thumbnails-v1';
const CACHEABLE_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'];

self.addEventListener('fetch', (event: FetchEvent) => {
    const url = new URL(event.request.url);
    
    // Cache article thumbnails and feed icons
    const isImage = CACHEABLE_IMAGE_EXTENSIONS.some(ext => url.pathname.toLowerCase().endsWith(ext));
    
    // Identify Proxy images or external icon services
    const isProxyImage = url.pathname.startsWith('/api/proxy');
    const isGoogleFavicon = url.hostname.includes('google.com') && url.pathname.includes('favicons');
    const isYouTubeIcon = url.hostname.includes('ytimg.com') || url.hostname.includes('ggpht.com');

    if (event.request.method === 'GET' && (isImage || isProxyImage || isGoogleFavicon || isYouTubeIcon)) {
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                
                // Stale-while-revalidate strategy
                const fetchedResponse = fetch(event.request).then((networkResponse) => {
                    if (networkResponse.ok) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // Fail silently, we'll use cache if available
                    return null;
                });

                return cachedResponse || fetchedResponse as Promise<Response>;
            })
        );
    }
});

export { };
