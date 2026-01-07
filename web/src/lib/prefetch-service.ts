import { db, Article } from './db';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Article Content Prefetch Service
 *
 * Prefetches article content and images in the background for offline reading.
 *
 * Features:
 * - Queue-based prefetching with rate limiting
 * - Image caching via service worker
 * - Respects WiFi-only setting
 * - Tracks prefetch statistics
 */

// Prefetch queue and state
let prefetchQueue: string[] = [];
let isPrefetching = false;
const PREFETCH_DELAY_MS = 2000; // 2 seconds between prefetches
const MAX_CONCURRENT_PREFETCHES = 2;
const IMAGE_CACHE_NAME = 'feedstream-images-v1';

export interface PrefetchStats {
    prefetched: number;
    pending: number;
    totalSize: number; // Estimated in bytes
}

/**
 * Check if on WiFi (best effort detection)
 */
function isOnWifi(): boolean {
    if (typeof navigator === 'undefined') return true;

    // Use Network Information API if available
    const connection = (navigator as any).connection;
    if (connection) {
        // WiFi types: wifi, ethernet
        // Cellular types: cellular, 2g, 3g, 4g
        const type = connection.effectiveType || connection.type;
        return type === 'wifi' || type === 'ethernet' || type === '4g';
    }

    // Fallback: assume WiFi if online
    return navigator.onLine;
}

/**
 * Check if prefetching is allowed based on settings
 */
function canPrefetch(): boolean {
    const settings = useSettingsStore.getState();

    if (!settings.prefetchEnabled) return false;
    if (settings.prefetchOnWifiOnly && !isOnWifi()) return false;

    return true;
}

export class PrefetchService {
    /**
     * Queue recent unread articles for prefetching
     */
    static async prefetchRecent(limit = 50): Promise<void> {
        if (!canPrefetch()) return;

        // Get recent unread articles that haven't been prefetched
        const articles = await db.articles
            .where('contentPrefetchedAt')
            .equals(undefined as any) // Not prefetched yet
            .filter(a => a.isRead === 0) // Unread only
            .limit(limit)
            .toArray();

        // Add to queue (avoid duplicates)
        const existingIds = new Set(prefetchQueue);
        for (const article of articles) {
            if (!existingIds.has(article.id)) {
                prefetchQueue.push(article.id);
            }
        }

        // Start processing if not already running
        this.processQueue();
    }

    /**
     * Queue a specific article for prefetching
     */
    static async queueArticle(articleId: string): Promise<void> {
        if (!canPrefetch()) return;
        if (prefetchQueue.includes(articleId)) return;

        prefetchQueue.push(articleId);
        this.processQueue();
    }

    /**
     * Prefetch a specific article immediately
     */
    static async prefetchArticle(articleId: string): Promise<boolean> {
        const article = await db.articles.get(articleId);
        if (!article) return false;

        try {
            // Fetch full article content if we only have a summary
            if (!article.contentHTML && article.url) {
                const fullContent = await this.fetchArticleContent(article.url);
                if (fullContent) {
                    await db.articles.update(articleId, {
                        contentHTML: fullContent,
                        contentPrefetchedAt: new Date(),
                    });
                }
            } else {
                // Just mark as prefetched
                await db.articles.update(articleId, {
                    contentPrefetchedAt: new Date(),
                });
            }

            // Prefetch images
            await this.prefetchImages(articleId);

            return true;
        } catch (error) {
            console.error(`Failed to prefetch article ${articleId}:`, error);
            return false;
        }
    }

    /**
     * Prefetch and cache images from an article
     */
    static async prefetchImages(articleId: string): Promise<void> {
        const article = await db.articles.get(articleId);
        if (!article) return;

        const content = article.contentHTML || article.summary || '';
        const imageUrls = this.extractImageUrls(content);

        // Add thumbnail if present
        if (article.thumbnailPath) {
            imageUrls.push(article.thumbnailPath);
        }

        if (imageUrls.length === 0) return;

        try {
            // Cache images via service worker
            const cache = await caches.open(IMAGE_CACHE_NAME);

            let cachedCount = 0;
            for (const url of imageUrls.slice(0, 10)) { // Limit to 10 images per article
                try {
                    // Check if already cached
                    const cached = await cache.match(url);
                    if (cached) {
                        cachedCount++;
                        continue;
                    }

                    // Fetch and cache
                    const response = await fetch(url, { mode: 'no-cors' });
                    if (response.ok || response.type === 'opaque') {
                        await cache.put(url, response);
                        cachedCount++;
                    }
                } catch {
                    // Ignore individual image failures
                }
            }

            // Update image cache status
            await db.articles.update(articleId, {
                imageCacheStatus: cachedCount > 0 ? 1 : 2, // 1 = cached, 2 = failed
            });

        } catch (error) {
            console.error(`Failed to prefetch images for article ${articleId}:`, error);
        }
    }

    /**
     * Check if an article is prefetched
     */
    static isPrefetched(article: Article): boolean {
        return !!article.contentPrefetchedAt;
    }

    /**
     * Get prefetch statistics
     */
    static async getStats(): Promise<PrefetchStats> {
        const prefetched = await db.articles
            .where('contentPrefetchedAt')
            .above(new Date(0))
            .count();

        const pending = prefetchQueue.length;

        // Estimate total size (rough estimate based on average content size)
        const AVG_CONTENT_SIZE = 50 * 1024; // 50KB average
        const totalSize = prefetched * AVG_CONTENT_SIZE;

        return {
            prefetched,
            pending,
            totalSize,
        };
    }

    /**
     * Clear prefetched content for old articles
     */
    static async clearOldPrefetched(daysOld: number): Promise<number> {
        const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

        const oldArticles = await db.articles
            .where('contentPrefetchedAt')
            .below(cutoff)
            .toArray();

        let clearedCount = 0;
        for (const article of oldArticles) {
            await db.articles.update(article.id, {
                contentHTML: undefined,
                readerHTML: undefined,
                contentPrefetchedAt: undefined,
                imageCacheStatus: 0,
            });
            clearedCount++;
        }

        return clearedCount;
    }

    /**
     * Process the prefetch queue
     */
    private static async processQueue(): Promise<void> {
        if (isPrefetching) return;
        if (prefetchQueue.length === 0) return;
        if (!canPrefetch()) return;

        isPrefetching = true;

        try {
            while (prefetchQueue.length > 0 && canPrefetch()) {
                // Take up to MAX_CONCURRENT items
                const batch = prefetchQueue.splice(0, MAX_CONCURRENT_PREFETCHES);

                // Prefetch in parallel
                await Promise.all(batch.map(id => this.prefetchArticle(id)));

                // Delay before next batch
                if (prefetchQueue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, PREFETCH_DELAY_MS));
                }
            }
        } finally {
            isPrefetching = false;
        }
    }

    /**
     * Fetch full article content via proxy
     */
    private static async fetchArticleContent(url: string): Promise<string | null> {
        try {
            const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
            if (!response.ok) return null;

            const html = await response.text();

            // Basic content extraction (could be enhanced with Readability.js)
            return this.extractMainContent(html);
        } catch {
            return null;
        }
    }

    /**
     * Extract main content from HTML (simple implementation)
     */
    private static extractMainContent(html: string): string {
        // For now, just return the HTML as-is
        // A more sophisticated implementation would use Readability.js
        // or similar to extract just the article content
        return html;
    }

    /**
     * Extract image URLs from HTML content
     */
    private static extractImageUrls(html: string): string[] {
        const urls: string[] = [];
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        let match;

        while ((match = imgRegex.exec(html)) !== null) {
            const url = match[1];
            if (url.startsWith('http')) {
                urls.push(url);
            }
        }

        return urls;
    }
}
