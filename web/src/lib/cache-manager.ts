import { db } from './db';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Cache Manager for FeedStream
 *
 * Manages storage usage and provides cleanup utilities for:
 * - Article content cache
 * - Image cache
 * - Prefetched content
 *
 * Features:
 * - Storage quota monitoring
 * - Automatic cleanup based on age
 * - Manual cache clearing
 */

export interface CacheUsage {
    quota: number;       // Total available storage in bytes
    used: number;        // Total used storage in bytes
    usedPercent: number; // Percentage used
    articles: number;    // Estimated article storage in bytes
    images: number;      // Estimated image cache in bytes
    prefetched: number;  // Estimated prefetched content in bytes
    syncQueue: number;   // Sync queue items
}

// Cache names used by service worker
const IMAGE_CACHE_NAME = 'article-thumbnails-v1';
const PREFETCH_IMAGE_CACHE_NAME = 'feedstream-images-v1';

export class CacheManager {
    /**
     * Get current storage usage statistics
     */
    static async getUsage(): Promise<CacheUsage> {
        // Get storage quota info
        let quota = 0;
        let used = 0;

        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                quota = estimate.quota || 0;
                used = estimate.usage || 0;
            } catch (e) {
                console.warn('Could not estimate storage:', e);
            }
        }

        // Count articles with content
        const articlesWithContent = await db.articles
            .filter(a => !!a.contentHTML || !!a.readerHTML)
            .count();

        // Estimate article storage (average 50KB per article with content)
        const AVG_ARTICLE_SIZE = 50 * 1024;
        const articles = articlesWithContent * AVG_ARTICLE_SIZE;

        // Get image cache size
        let images = 0;
        try {
            const cache = await caches.open(IMAGE_CACHE_NAME);
            const keys = await cache.keys();
            // Estimate 100KB per image on average
            images = keys.length * 100 * 1024;
        } catch {
            // Caches API might not be available
        }

        // Get prefetch cache size
        let prefetched = 0;
        try {
            const cache = await caches.open(PREFETCH_IMAGE_CACHE_NAME);
            const keys = await cache.keys();
            prefetched = keys.length * 100 * 1024;
        } catch {
            // Caches API might not be available
        }

        // Get sync queue count
        const syncQueue = await db.syncQueue.count();

        return {
            quota,
            used,
            usedPercent: quota > 0 ? Math.round((used / quota) * 100) : 0,
            articles,
            images,
            prefetched,
            syncQueue,
        };
    }

    /**
     * Clear old articles (by age in days)
     * Removes content but keeps article metadata for history
     */
    static async clearOldArticles(daysOld: number): Promise<number> {
        const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

        // Get old articles that haven't been bookmarked
        const oldArticles = await db.articles
            .where('publishedAt')
            .below(cutoff)
            .filter(a => a.isBookmarked !== 1)
            .toArray();

        let deletedCount = 0;

        for (const article of oldArticles) {
            // Clear content but keep metadata
            await db.articles.update(article.id, {
                contentHTML: undefined,
                readerHTML: undefined,
                summary: article.summary?.slice(0, 500), // Keep truncated summary
                contentPrefetchedAt: undefined,
                imageCacheStatus: 0,
            });
            deletedCount++;
        }

        return deletedCount;
    }

    /**
     * Delete old articles completely (by age in days)
     * Use with caution - this removes articles entirely
     */
    static async deleteOldArticles(daysOld: number, keepBookmarked = true): Promise<number> {
        const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

        let query = db.articles.where('publishedAt').below(cutoff);

        if (keepBookmarked) {
            const oldArticles = await query.filter(a => a.isBookmarked !== 1).toArray();
            const ids = oldArticles.map(a => a.id);
            await db.articles.bulkDelete(ids);
            return ids.length;
        } else {
            const oldArticles = await query.toArray();
            const ids = oldArticles.map(a => a.id);
            await db.articles.bulkDelete(ids);
            return ids.length;
        }
    }

    /**
     * Clear all cached images
     */
    static async clearImageCache(): Promise<void> {
        try {
            await caches.delete(IMAGE_CACHE_NAME);
            await caches.delete(PREFETCH_IMAGE_CACHE_NAME);

            // Reset image cache status in articles
            await db.articles
                .where('imageCacheStatus')
                .equals(1)
                .modify({ imageCacheStatus: 0 });

        } catch (e) {
            console.warn('Could not clear image cache:', e);
        }
    }

    /**
     * Clear prefetched article content
     */
    static async clearPrefetchedContent(): Promise<void> {
        // Clear content from articles that were prefetched
        const prefetchedArticles = await db.articles
            .where('contentPrefetchedAt')
            .above(new Date(0))
            .toArray();

        for (const article of prefetchedArticles) {
            await db.articles.update(article.id, {
                contentHTML: undefined,
                readerHTML: undefined,
                contentPrefetchedAt: undefined,
                imageCacheStatus: 0,
            });
        }

        // Clear prefetch image cache
        try {
            await caches.delete(PREFETCH_IMAGE_CACHE_NAME);
        } catch {
            // Ignore errors
        }
    }

    /**
     * Clear sync queue
     */
    static async clearSyncQueue(): Promise<void> {
        await db.syncQueue.clear();
    }

    /**
     * Auto cleanup based on settings
     * Called periodically or when storage is low
     */
    static async autoCleanup(): Promise<{
        articlesCleared: number;
        imagesCleared: boolean;
    }> {
        const settings = useSettingsStore.getState();
        let articlesCleared = 0;
        let imagesCleared = false;

        // Auto-clear old articles based on settings
        if (settings.autoClearOldArticles && settings.maxArticleAge > 0) {
            articlesCleared = await this.clearOldArticles(settings.maxArticleAge);
        }

        // Check if we need to clear caches due to size limit
        if (settings.maxCacheSize > 0) {
            const usage = await this.getUsage();
            const maxBytes = settings.maxCacheSize * 1024 * 1024;

            if (usage.images + usage.prefetched > maxBytes) {
                await this.clearImageCache();
                imagesCleared = true;
            }
        }

        return { articlesCleared, imagesCleared };
    }

    /**
     * Get human-readable size string
     */
    static formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Request persistent storage (prevents browser from auto-clearing)
     */
    static async requestPersistentStorage(): Promise<boolean> {
        if ('storage' in navigator && 'persist' in navigator.storage) {
            try {
                const isPersisted = await navigator.storage.persist();
                return isPersisted;
            } catch {
                return false;
            }
        }
        return false;
    }

    /**
     * Check if storage is persistent
     */
    static async isPersistent(): Promise<boolean> {
        // iOS standalone mode (Home Screen PWA) - storage is automatically persistent
        // but navigator.storage.persisted() often returns false incorrectly
        if (this.isIOSStandalone()) {
            return true;
        }

        if ('storage' in navigator && 'persisted' in navigator.storage) {
            try {
                return await navigator.storage.persisted();
            } catch {
                return false;
            }
        }
        return false;
    }

    /**
     * Check if running as iOS standalone PWA (added to Home Screen)
     */
    static isIOSStandalone(): boolean {
        if (typeof window === 'undefined') return false;

        // iOS Safari standalone mode
        const isIOSStandalone = (navigator as any).standalone === true;

        // Also check display-mode media query (works on iOS 13+)
        const isDisplayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;

        // Check if iOS device
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

        return isIOS && (isIOSStandalone || isDisplayModeStandalone);
    }
}
