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
     * Fetch YouTube channel icon from channel page or use video thumbnail as fallback
     */
    static async fetchYouTubeChannelIcon(feedURL: string, feedData?: any): Promise<string | null> {
        console.log(`[IconService] Fetching YouTube icon for ${feedURL}`);
        try {
            // 1. Try to extract channel ID from feed URL
            const channelIdMatch = feedURL.match(/channel_id=([a-zA-Z0-9_-]+)/);

            if (channelIdMatch) {
                const channelId = channelIdMatch[1];
                console.log(`[IconService] Detected YouTube Channel ID: ${channelId}`);

                // 2. Try to fetch channel page through our proxy to get the avatar
                try {
                    const proxyUrl = `/api/proxy?url=${encodeURIComponent(`https://www.youtube.com/channel/${channelId}`)}`;
                    const response = await fetch(proxyUrl);

                    if (response.ok) {
                        const html = await response.text();
                        // Look for avatar URL in the page (various patterns YouTube uses)
                        const avatarPatterns = [
                            /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/,
                            /"channelMetadataRenderer".*?"avatar".*?"url":"([^"]+)"/,
                            /yt-img-shadow.*?src="(https:\/\/yt3\.googleusercontent.com\/[^"]+)"/,
                            /"width":\d+,"height":\d+,"src":"(https:\/\/yt3\.googleusercontent.com\/[^"]+)"/
                        ];

                        for (const pattern of avatarPatterns) {
                            const match = html.match(pattern);
                            if (match && match[1]) {
                                let avatarUrl = match[1].replace(/\\u0026/g, '&');
                                // Try to get a larger version
                                avatarUrl = avatarUrl.replace(/=s\d+-/, '=s176-');
                                console.log(`[IconService] Found YouTube avatar via scraping: ${avatarUrl}`);
                                return avatarUrl;
                            }
                        }
                        console.warn(`[IconService] Failed to scrape avatar from YouTube channel page`);
                    } else {
                        console.warn(`[IconService] Proxy request failed: ${response.status}`);
                    }
                } catch (e) {
                    console.error('Error fetching YouTube channel page:', e);
                }
            }

            // 3. Fallback: Check feed author/thumbnail in XML data
            // YouTube Atom feeds don't usually have author thumbnail, but let's check common places
            if (feedData) {
                // Check feed.author.thumbnail (some implementations)
                const author = feedData.feed?.author || feedData.author;
                if (author?.['media:thumbnail']?.['@_url']) {
                    return author['media:thumbnail']['@_url'];
                }

                // Fallback to first video's thumbnail? (Maybe better than generic icon)
                // const firstEntry = Array.isArray(feedData.feed?.entry) ? feedData.feed.entry[0] : feedData.feed?.entry;
                // if (firstEntry?.['media:group']?.['media:thumbnail']?.['@_url']) {
                //      return firstEntry['media:group']['media:thumbnail']['@_url'];
                // }
            }

            // 4. Last resort: Use YouTube favicon (improved resolution)
            return 'https://www.google.com/s2/favicons?domain=youtube.com&sz=128';
        } catch (e) {
            console.error('Error fetching YouTube icon:', e);
            return null;
        }
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

            // Fetch subreddit info from Reddit JSON API - route through proxy for CORS
            const redditUrl = `https://www.reddit.com/r/${subreddit}/about.json`;
            const response = await fetch(`/api/proxy?url=${encodeURIComponent(redditUrl)}`);
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
        console.log(`[IconService] Extracting Podcast artwork...`);
        try {
            if (!feedData) return null;

            // Handle various feed data structures
            const channel = feedData.rss?.channel || feedData.channel || feedData.feed || feedData;

            if (channel) {
                // 1. Try itunes:image (standard)
                // Note: fast-xml-parser usually handles namespaced tags by keeping the prefix if configured (which it is)
                const itunesImage = channel['itunes:image'];
                if (itunesImage) {
                    if (typeof itunesImage === 'object' && itunesImage['@_href']) {
                        console.log(`[IconService] Found Podcast icon (itunes:image object): ${itunesImage['@_href']}`);
                        return itunesImage['@_href'];
                    }
                    if (typeof itunesImage === 'string') {
                        console.log(`[IconService] Found Podcast icon (itunes:image string): ${itunesImage}`);
                        return itunesImage;
                    }
                }

                // 2. Try standard image tag
                if (channel.image) {
                    if (channel.image.url) {
                        console.log(`[IconService] Found Podcast icon (image.url): ${channel.image.url}`);
                        return channel.image.url;
                    }
                    if (channel.image['@_href']) {
                        return channel.image['@_href'];
                    }
                }

                // 3. Try googleplay:image
                if (channel['googleplay:image']?.['@_href']) {
                    return channel['googleplay:image']['@_href'];
                }

                // 4. Try logo for Atom feeds
                if (channel.logo) {
                    return typeof channel.logo === 'string' ? channel.logo : channel.logo['#text'];
                }
            }

            console.warn(`[IconService] No podcast artwork found in feed data.`);
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
                    iconURL = await this.fetchYouTubeChannelIcon(feed.feedURL, feedData);
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
