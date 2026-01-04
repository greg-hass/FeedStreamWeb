import { db, Feed } from './db';

/**
 * IconService handles fetching and updating feed icons
 * Supports: RSS favicons, YouTube channel icons, Reddit subreddit icons, Podcast artwork
 */
export class IconService {
    /**
     * Fetch favicon using Google Favicon API with DuckDuckGo fallback
     */
    static async fetchFavicon(feedURL: string): Promise<string | null> {
        try {
            const url = new URL(feedURL);
            const domain = url.hostname;

            // Try Google Favicon Service first (64x64)
            const googleFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

            // Test if icon exists (we'll just use it, browser will handle failures)
            return googleFavicon;
        } catch (e) {
            console.error('Error fetching favicon:', e);
            return null;
        }
    }

    /**
     * Extract YouTube channel icon from feed data
     */
    static extractYouTubeIcon(feedData: any): string | null {
        try {
            // YouTube feeds often have media:thumbnail or itunes:image
            if (feedData.channel) {
                const channel = feedData.channel;

                // Try itunes:image first
                if (channel['itunes:image']?.['@_href']) {
                    return channel['itunes:image']['@_href'];
                }

                // Try media:thumbnail
                if (channel['media:thumbnail']?.['@_url']) {
                    return channel['media:thumbnail']['@_url'];
                }

                // Try image tag
                if (channel.image?.url) {
                    return channel.image.url;
                }
            }
        } catch (e) {
            console.error('Error extracting YouTube icon:', e);
        }
        return null;
    }

    /**
     * Fetch Reddit subreddit icon from Reddit API
     */
    static async fetchRedditIcon(feedURL: string): Promise<string | null> {
        try {
            // Extract subreddit name from URL
            const match = feedURL.match(/reddit\.com\/r\/([^\/]+)/);
            if (!match) return null;

            const subreddit = match[1];

            // Fetch subreddit info from Reddit JSON API
            const response = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`);
            if (!response.ok) return null;

            const data = await response.json();
            const iconUrl = data.data?.community_icon || data.data?.icon_img;

            if (iconUrl) {
                // Reddit returns HTML-encoded URLs sometimes
                return iconUrl.replace(/&amp;/g, '&');
            }
        } catch (e) {
            console.error('Error fetching Reddit icon:', e);
        }
        return null;
    }

    /**
     * Extract podcast artwork from feed data
     */
    static extractPodcastArtwork(feedData: any): string | null {
        try {
            if (feedData.channel) {
                const channel = feedData.channel;

                // Try itunes:image (most common for podcasts)
                if (channel['itunes:image']?.['@_href']) {
                    return channel['itunes:image']['@_href'];
                }

                // Try image tag
                if (channel.image?.url) {
                    return channel.image.url;
                }
            }
        } catch (e) {
            console.error('Error extracting podcast artwork:', e);
        }
        return null;
    }

    /**
     * Main function to update feed icon based on feed type
     * Call this after adding a feed or during manual icon refresh
     */
    static async updateFeedIcon(feed: Feed, feedData?: any): Promise<void> {
        try {
            let iconURL: string | null = null;

            switch (feed.type) {
                case 'youtube':
                    if (feedData) {
                        iconURL = this.extractYouTubeIcon(feedData);
                    }
                    // Fallback to favicon if no channel icon found
                    if (!iconURL && feed.feedURL) {
                        iconURL = await this.fetchFavicon(feed.feedURL);
                    }
                    break;

                case 'reddit':
                    iconURL = await this.fetchRedditIcon(feed.feedURL);
                    // Fallback to Reddit favicon
                    if (!iconURL) {
                        iconURL = 'https://www.google.com/s2/favicons?domain=reddit.com&sz=64';
                    }
                    break;

                case 'podcast':
                    if (feedData) {
                        iconURL = this.extractPodcastArtwork(feedData);
                    }
                    // Fallback to favicon
                    if (!iconURL && feed.feedURL) {
                        iconURL = await this.fetchFavicon(feed.feedURL);
                    }
                    break;

                case 'rss':
                default:
                    // Standard RSS feed - use favicon
                    iconURL = await this.fetchFavicon(feed.feedURL);
                    break;
            }

            // Update feed in database if icon was found
            if (iconURL) {
                await db.feeds.update(feed.id, { iconURL });
            }
        } catch (e) {
            console.error('Error updating feed icon:', e);
        }
    }

    /**
     * Batch update icons for all feeds
     * Useful for migrating existing feeds or manual refresh
     */
    static async updateAllFeedIcons(): Promise<void> {
        try {
            const feeds = await db.feeds.toArray();

            for (const feed of feeds) {
                await this.updateFeedIcon(feed);
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (e) {
            console.error('Error updating all feed icons:', e);
        }
    }
}
