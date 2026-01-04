import { db, Article } from './db';

/**
 * FeedDiscovery - Extract feed URLs from user's reading patterns
 * Provides personalized feed suggestions based on actual usage
 */
export class FeedDiscovery {
    /**
     * Extract unique URLs mentioned in articles
     * Returns potential feed sources from sites the user reads about
     */
    static async extractURLsFromArticles(): Promise<{ url: string; count: number; title?: string }[]> {
        try {
            // Get all articles with content
            const articles = await db.articles
                .filter(a => !!(a.contentHTML || a.summary))
                .toArray();

            const urlCounts: Map<string, { count: number; title?: string }> = new Map();

            // Extract URLs from content using regex
            const urlRegex = /https?:\/\/[^\s<>"]+/g;

            for (const article of articles) {
                const content = (article.contentHTML || article.summary || '');
                const matches = content.match(urlRegex) || [];

                for (const urlMatch of matches) {
                    try {
                        const url = new URL(urlMatch);
                        // Get base domain
                        const domain = `${url.protocol}//${url.hostname}`;

                        // Skip some common but not feed-worthy domains
                        if (this.shouldSkipDomain(url.hostname)) {
                            continue;
                        }

                        const existing = urlCounts.get(domain);
                        if (existing) {
                            existing.count++;
                        } else {
                            urlCounts.set(domain, { count: 1, title: url.hostname });
                        }
                    } catch (e) {
                        // Invalid URL, skip
                    }
                }
            }

            // Convert to array and sort by count
            return Array.from(urlCounts.entries())
                .map(([url, data]) => ({ url, ...data }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 20); // Top 20 mentioned sites
        } catch (e) {
            console.error('Error extracting URLs:', e);
            return [];
        }
    }

    /**
     * Skip domains that are unlikely to have useful feeds
     */
    private static shouldSkipDomain(hostname: string): boolean {
        const skipPatterns = [
            'twitter.com',
            'x.com',
            'facebook.com',
            'instagram.com',
            'linkedin.com',
            'google.com',
            'youtube.com', // We already handle YouTube specially
            'reddit.com', // We already handle Reddit specially
            'imgur.com',
            'giphy.com',
            'tiktok.com',
            'amazon.com',
            'ebay.com',
        ];

        return skipPatterns.some(pattern => hostname.includes(pattern));
    }

    /**
     * Get feeds that appear frequently in user's reading
     * Analyzes which feeds the user actually reads vs just subscribes to
     */
    static async getFrequentlyReadFeeds(): Promise<{ feedId: string; title: string; readCount: number }[]> {
        try {
            const feeds = await db.feeds.toArray();
            const feedStats = await Promise.all(
                feeds.map(async (feed) => {
                    const readCount = await db.articles
                        .where({ feedID: feed.id, isRead: true })
                        .count();

                    return {
                        feedId: feed.id,
                        title: feed.title,
                        readCount
                    };
                })
            );

            return feedStats
                .filter(stat => stat.readCount > 0)
                .sort((a, b) => b.readCount - a.readCount)
                .slice(0, 10);
        } catch (e) {
            console.error('Error getting frequently read feeds:', e);
            return [];
        }
    }

    /**
     * Suggest potential feed URLs from discovered domains
     * Tries common feed URL patterns
     */
    static async suggestFeedURLs(domains: string[]): Promise<string[]> {
        const suggestions: string[] = [];

        for (const domain of domains) {
            // Common feed URL patterns
            const patterns = [
                `${domain}/feed`,
                `${domain}/rss`,
                `${domain}/atom.xml`,
                `${domain}/feed.xml`,
                `${domain}/rss.xml`,
                `${domain}/blog/feed`,
                `${domain}/index.xml`,
            ];

            suggestions.push(...patterns);
        }

        return suggestions;
    }
}
