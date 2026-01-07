/// <reference lib="webworker" />

// Custom Service Worker Extensions
// This file is merged with the auto-generated sw.js by the PWA plugin

declare const self: ServiceWorkerGlobalScope;

// Background Sync Tags
const SYNC_TAG_READ_STATE = 'sync-read-state';
const SYNC_TAG_BOOKMARKS = 'sync-bookmarks';
const SYNC_TAG_CLOUD = 'sync-cloud';

// IndexedDB database name (must match db.ts)
const DB_NAME = 'FeedStreamDB';
const SYNC_QUEUE_STORE = 'syncQueue';

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

// Background Sync event handler
self.addEventListener('sync', (event: SyncEvent) => {
    console.log('[SW] Background sync triggered:', event.tag);

    if (event.tag === SYNC_TAG_CLOUD) {
        event.waitUntil(syncCloudData());
    } else if (event.tag === SYNC_TAG_READ_STATE || event.tag === SYNC_TAG_BOOKMARKS) {
        event.waitUntil(syncCloudData());
    }
});

// Periodic Background Sync (if supported)
self.addEventListener('periodicsync', (event: any) => {
    if (event.tag === 'sync-feeds') {
        event.waitUntil(syncCloudData());
    }
});

/**
 * Sync pending changes to cloud
 * Reads from IndexedDB syncQueue and processes items
 */
async function syncCloudData(): Promise<void> {
    try {
        // Open IndexedDB
        const db = await openIndexedDB();
        if (!db) {
            console.log('[SW] Could not open IndexedDB');
            return;
        }

        // Get pending sync items
        const tx = db.transaction(SYNC_QUEUE_STORE, 'readonly');
        const store = tx.objectStore(SYNC_QUEUE_STORE);
        const items = await promisifyRequest(store.getAll());

        if (items.length === 0) {
            console.log('[SW] No pending sync items');
            db.close();
            return;
        }

        console.log(`[SW] Processing ${items.length} sync items`);

        // Get Supabase credentials from stored settings
        const supabaseUrl = await getStoredSetting('NEXT_PUBLIC_SUPABASE_URL');
        const supabaseKey = await getStoredSetting('NEXT_PUBLIC_SUPABASE_ANON_KEY');

        if (!supabaseUrl || !supabaseKey) {
            console.log('[SW] Supabase not configured, skipping cloud sync');
            db.close();
            return;
        }

        // Process each item
        for (const item of items) {
            try {
                await processSyncItem(item, supabaseUrl, supabaseKey);

                // Remove from queue on success
                const deleteTx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
                const deleteStore = deleteTx.objectStore(SYNC_QUEUE_STORE);
                deleteStore.delete(item.id);
                await promisifyRequest(deleteTx);

            } catch (error) {
                console.error(`[SW] Failed to sync item ${item.id}:`, error);
                // Leave in queue for retry
            }
        }

        db.close();
        console.log('[SW] Background sync completed');

    } catch (error) {
        console.error('[SW] Background sync error:', error);
    }
}

/**
 * Process a single sync queue item
 */
async function processSyncItem(
    item: { table: string; recordId: string; operation: string; data: any },
    supabaseUrl: string,
    supabaseKey: string
): Promise<void> {
    const endpoint = `${supabaseUrl}/rest/v1`;
    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    };

    switch (item.table) {
        case 'articles': {
            // Only sync article states
            const body = {
                id: item.recordId,
                article_url: item.data.url || item.recordId,
                feed_id: item.data.feedID,
                is_read: item.data.isRead === 1,
                is_bookmarked: item.data.isBookmarked === 1,
                playback_position: item.data.playbackPosition || 0,
                updated_at: new Date().toISOString(),
            };

            await fetch(`${endpoint}/sync_article_states`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                body: JSON.stringify(body),
            });
            break;
        }

        case 'folders': {
            if (item.operation === 'delete') {
                await fetch(`${endpoint}/sync_folders?id=eq.${item.recordId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
                });
            } else {
                await fetch(`${endpoint}/sync_folders`, {
                    method: 'POST',
                    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                    body: JSON.stringify({
                        id: item.recordId,
                        name: item.data.name,
                        position: item.data.position,
                        updated_at: new Date().toISOString(),
                    }),
                });
            }
            break;
        }

        case 'feeds': {
            if (item.operation === 'delete') {
                await fetch(`${endpoint}/sync_feeds?id=eq.${item.recordId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
                });
            } else {
                await fetch(`${endpoint}/sync_feeds`, {
                    method: 'POST',
                    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                    body: JSON.stringify({
                        id: item.recordId,
                        title: item.data.title,
                        feed_url: item.data.feedURL,
                        site_url: item.data.siteURL,
                        folder_id: item.data.folderID,
                        icon_url: item.data.iconURL,
                        type: item.data.type,
                        is_paused: item.data.isPaused,
                        sort_order: item.data.sortOrder,
                        is_favorite: item.data.isFavorite,
                        updated_at: new Date().toISOString(),
                    }),
                });
            }
            break;
        }
    }
}

/**
 * Open IndexedDB database
 */
function openIndexedDB(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME);

        request.onerror = () => {
            console.error('[SW] IndexedDB error:', request.error);
            resolve(null);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };
    });
}

/**
 * Promisify IndexedDB request
 */
function promisifyRequest<T>(request: IDBRequest<T> | IDBTransaction): Promise<T> {
    return new Promise((resolve, reject) => {
        if (request instanceof IDBTransaction) {
            request.oncomplete = () => resolve(undefined as T);
            request.onerror = () => reject(request.error);
        } else {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        }
    });
}

/**
 * Get stored setting (placeholder - would need to read from localStorage via message)
 */
async function getStoredSetting(_key: string): Promise<string | null> {
    // In service worker, we can't access localStorage directly
    // These would typically be passed from the main thread or stored in IndexedDB
    // For now, return null (cloud sync won't work without configuration)
    return null;
}

export { SYNC_TAG_READ_STATE, SYNC_TAG_BOOKMARKS, SYNC_TAG_CLOUD };
