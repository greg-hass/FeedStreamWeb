"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedService = void 0;
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const common_1 = require("@feedstream/common");
class FeedService {
    async syncFeed(feedId, userId) {
        const feed = await db_1.db.query.feeds.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.feeds.id, feedId), (0, drizzle_orm_1.eq)(schema_1.feeds.userId, userId)),
        });
        if (!feed) {
            throw new Error('Feed not found');
        }
        if (feed.isPaused) {
            return { newArticles: 0, updated: 0 };
        }
        try {
            // Fetch feed content
            const headers = {
                'User-Agent': 'FeedStream/1.0',
                'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*',
            };
            if (feed.etag)
                headers['If-None-Match'] = feed.etag;
            if (feed.lastModified)
                headers['If-Modified-Since'] = feed.lastModified;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
            try {
                const response = await fetch(feed.feedUrl, {
                    headers,
                    signal: controller.signal
                });
                clearTimeout(timeout);
                if (response.status === 304) {
                    // Not modified
                    await db_1.db.update(schema_1.feeds).set({
                        lastSyncAt: new Date(),
                        consecutiveFailures: 0,
                    }).where((0, drizzle_orm_1.eq)(schema_1.feeds.id, feedId));
                    return { newArticles: 0, updated: 0 };
                }
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const newEtag = response.headers.get('etag');
                const newLastModified = response.headers.get('last-modified');
                const text = await response.text();
                // Parse feed
                const parsed = await (0, common_1.parseFeed)(text, feed.feedUrl);
                // Update feed metadata
                await db_1.db.update(schema_1.feeds).set({
                    title: parsed.title,
                    siteUrl: parsed.siteUrl,
                    type: parsed.type,
                    lastSyncAt: new Date(),
                    consecutiveFailures: 0,
                    etag: newEtag || feed.etag,
                    lastModified: newLastModified || feed.lastModified,
                }).where((0, drizzle_orm_1.eq)(schema_1.feeds.id, feedId));
                // Insert/Update articles
                let newCount = 0;
                let updatedCount = 0;
                for (const article of parsed.articles) {
                    // Check if article exists
                    const existing = await db_1.db.query.articles.findFirst({
                        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.articles.feedId, feedId), (0, drizzle_orm_1.eq)(schema_1.articles.externalId, article.id)),
                    });
                    if (!existing) {
                        // Insert new article
                        await db_1.db.insert(schema_1.articles).values({
                            feedId,
                            userId,
                            externalId: article.id,
                            title: article.title,
                            author: article.author,
                            summary: article.summary,
                            content: article.content,
                            url: article.url,
                            publishedAt: article.publishedAt,
                            mediaKind: article.mediaKind,
                            thumbnailUrl: article.thumbnailUrl,
                            enclosureUrl: article.enclosureUrl,
                            enclosureType: article.enclosureType,
                            searchVector: this.buildSearchVector(article.title, article.summary, article.content),
                        });
                        newCount++;
                    }
                    else {
                        // Update if content changed
                        const hasChanged = existing.title !== article.title ||
                            existing.summary !== article.summary ||
                            existing.content !== article.content;
                        if (hasChanged) {
                            await db_1.db.update(schema_1.articles).set({
                                title: article.title,
                                summary: article.summary,
                                content: article.content,
                                thumbnailUrl: article.thumbnailUrl,
                                searchVector: this.buildSearchVector(article.title, article.summary, article.content),
                            }).where((0, drizzle_orm_1.eq)(schema_1.articles.id, existing.id));
                            updatedCount++;
                        }
                    }
                }
                return { newArticles: newCount, updated: updatedCount };
            }
            catch (error) {
                clearTimeout(timeout);
                throw error;
            }
            finally {
                // Cleanup: Keep only the latest 1000 articles for this feed to prevent infinite growth
                // This is a rough maintenance task ran after each sync
                try {
                    const oldArticles = await db_1.db.query.articles.findMany({
                        where: (0, drizzle_orm_1.eq)(schema_1.articles.feedId, feedId),
                        orderBy: (0, drizzle_orm_1.desc)(schema_1.articles.publishedAt),
                        offset: 1000,
                        columns: { id: true }
                    });
                    if (oldArticles.length > 0) {
                        const idsToDelete = oldArticles.map(a => a.id);
                        await db_1.db.delete(schema_1.articles).where((0, drizzle_orm_1.inArray)(schema_1.articles.id, idsToDelete));
                        console.log(`[Cleanup] Removed ${idsToDelete.length} old articles from feed ${feedId}`);
                    }
                }
                catch (cleanupError) {
                    console.error(`[Cleanup] Failed to prune feed ${feedId}:`, cleanupError);
                }
            }
        }
        catch (error) {
            // Update failure count
            await db_1.db.update(schema_1.feeds).set({
                lastError: error instanceof Error ? error.message : 'Unknown error',
                consecutiveFailures: (0, drizzle_orm_1.sql) `${schema_1.feeds.consecutiveFailures} + 1`,
            }).where((0, drizzle_orm_1.eq)(schema_1.feeds.id, feedId));
            throw error;
        }
    }
    async syncAllFeeds(userId, onProgress) {
        const userFeeds = await db_1.db.query.feeds.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.feeds.userId, userId), (0, drizzle_orm_1.eq)(schema_1.feeds.isPaused, false)),
        });
        let successful = 0;
        let failed = 0;
        let totalNew = 0;
        for (let i = 0; i < userFeeds.length; i++) {
            const feed = userFeeds[i];
            if (onProgress) {
                onProgress(i + 1, userFeeds.length, feed.title);
            }
            // Skip feeds with too many consecutive failures
            const failures = feed.consecutiveFailures ?? 0;
            if (failures >= 5) {
                console.log(`Skipping ${feed.title} - ${failures} consecutive failures`);
                continue;
            }
            try {
                const result = await this.syncFeed(feed.id, userId);
                successful++;
                totalNew += result.newArticles;
            }
            catch (error) {
                failed++;
                console.error(`Failed to sync ${feed.title}:`, error);
            }
            // Small delay between feeds to be nice to servers
            if (i < userFeeds.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        return {
            totalFeeds: userFeeds.length,
            successful,
            failed,
            newArticles: totalNew,
        };
    }
    async searchArticles(userId, query, limit = 50) {
        const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        if (searchTerms.length === 0) {
            return [];
        }
        // Simple search using ILIKE
        const conditions = searchTerms.map(term => (0, drizzle_orm_1.sql) `(
        ${schema_1.articles.searchVector} ILIKE ${`%${term}%`} OR
        ${schema_1.articles.title} ILIKE ${`%${term}%`}
      )`);
        const results = await db_1.db.query.articles.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.articles.userId, userId), (0, drizzle_orm_1.sql) `(${drizzle_orm_1.sql.join(conditions, (0, drizzle_orm_1.sql) ` AND `)})`),
            orderBy: (0, drizzle_orm_1.desc)(schema_1.articles.publishedAt),
            limit,
        });
        return results;
    }
    async getUnreadArticles(userId, limit = 100) {
        const result = await db_1.db.query.articles.findMany({
            where: (0, drizzle_orm_1.eq)(schema_1.articles.userId, userId),
            orderBy: (0, drizzle_orm_1.desc)(schema_1.articles.publishedAt),
            limit: limit * 2, // Get more to filter
        });
        const articleIds = result.map(a => a.id);
        const states = articleIds.length
            ? await db_1.db.query.articleStates.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.articleStates.userId, userId), (0, drizzle_orm_1.inArray)(schema_1.articleStates.articleId, articleIds)),
            })
            : [];
        const statesMap = new Map(states.map(s => [s.articleId, s]));
        const unread = result
            .filter(a => !statesMap.get(a.id)?.isRead)
            .slice(0, limit)
            .map(a => ({
            article: a,
            isRead: statesMap.get(a.id)?.isRead || false,
            isBookmarked: statesMap.get(a.id)?.isBookmarked || false,
        }));
        return unread;
    }
    buildSearchVector(title, summary, content) {
        const parts = [title];
        if (summary)
            parts.push(summary);
        if (content)
            parts.push(content.slice(0, 1000)); // First 1000 chars
        return parts.join(' ').replace(/<[^>]*>/g, '').toLowerCase();
    }
}
exports.FeedService = FeedService;
//# sourceMappingURL=feed.js.map