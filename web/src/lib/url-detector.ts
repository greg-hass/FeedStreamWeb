import { FeedType } from './db';

/**
 * URLDetector - Smart URL detection and conversion for feed URLs
 * Handles YouTube channels, Reddit subreddits, and other special cases
 */
export class URLDetector {
    /**
     * Detect the type of feed from a URL
     */
    static detectFeedType(url: string): FeedType {
        const lowerURL = url.toLowerCase();

        if (lowerURL.includes('youtube.com') || lowerURL.includes('youtu.be')) {
            return 'youtube';
        }
        if (lowerURL.includes('reddit.com')) {
            return 'reddit';
        }
        if (lowerURL.includes('podcast') || lowerURL.includes('.mp3') || lowerURL.includes('itunes')) {
            return 'podcast';
        }

        return 'rss';
    }

    /**
     * Convert user-friendly URLs to actual RSS feed URLs
     */
    static async convertToFeedURL(url: string): Promise<string> {
        const lowerURL = url.toLowerCase();

        // YouTube channel URL
        if (lowerURL.includes('youtube.com')) {
            const converted = await this.parseYouTubeChannel(url);
            if (converted) return converted;
        }

        // Reddit subreddit URL  
        if (lowerURL.includes('reddit.com/r/')) {
            return this.parseRedditSubreddit(url);
        }

        // Already a feed URL, return as-is
        return url;
    }

    /**
     * Parse YouTube channel URL and convert to RSS feed
     */
    static async parseYouTubeChannel(url: string): Promise<string | null> {
        try {
            // Pattern 1: youtube.com/@username
            const atMatch = url.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
            if (atMatch) {
                // Need to resolve @username to channel ID
                // For now, try to fetch the page and extract channel ID
                // This would require a backend proxy to avoid CORS
                // Placeholder: return the feed URL format (needs channel ID)
                return `https://www.youtube.com/feeds/videos.xml?user=${atMatch[1]}`;
            }

            // Pattern 2: youtube.com/channel/CHANNEL_ID
            const channelMatch = url.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
            if (channelMatch) {
                return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelMatch[1]}`;
            }

            // Pattern 3: youtube.com/c/CustomName or youtube.com/user/Username
            const customMatch = url.match(/youtube\.com\/(c|user)\/([a-zA-Z0-9_-]+)/);
            if (customMatch) {
                return `https://www.youtube.com/feeds/videos.xml?user=${customMatch[2]}`;
            }

            // Pattern 4: Already a feed URL
            if (url.includes('/feeds/videos.xml')) {
                return url;
            }
        } catch (e) {
            console.error('Error parsing YouTube URL:', e);
        }

        return null;
    }

    /**
     * Parse Reddit subreddit URL and convert to RSS
     */
    static parseRedditSubreddit(url: string): string {
        // reddit.com/r/subreddit or reddit.com/r/subreddit/
        const match = url.match(/reddit\.com\/r\/([a-zA-Z0-9_-]+)/);
        if (match) {
            const subreddit = match[1];
            // Reddit RSS format
            return `https://www.reddit.com/r/${subreddit}.rss`;
        }

        // Already has .rss extension
        if (url.endsWith('.rss')) {
            return url;
        }

        // Fallback: add .rss
        return url.replace(/\/$/, '') + '.rss';
    }

    /**
     * Validate if a string looks like a URL
     */
    static isValidURL(str: string): boolean {
        try {
            new URL(str);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check if URL is already a feed URL
     */
    static isFeedURL(url: string): boolean {
        const lowerURL = url.toLowerCase();
        return (
            lowerURL.includes('/feed') ||
            lowerURL.includes('.rss') ||
            lowerURL.includes('.atom') ||
            lowerURL.includes('.xml') ||
            lowerURL.includes('feeds/videos.xml') // YouTube
        );
    }
}
