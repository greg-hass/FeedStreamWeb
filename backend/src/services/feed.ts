import { db } from '../db';
import { feeds, articles, articleStates } from '../db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { parseFeed } from './feed-parser';

export class FeedService {
  async syncFeed(feedId: string, userId: string): Promise<{ newArticles: number; updated: number }> {
    const feed = await db.query.feeds.findFirst({
      where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
    });

    if (!feed) {
      throw new Error('Feed not found');
    }

    if (feed.isPaused) {
      return { newArticles: 0, updated: 0 };
    }

    try {
      // Fetch feed content
      const headers: Record<string, string> = {
        'User-Agent': 'FeedStream/1.0',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*',
      };

      if (feed.etag) headers['If-None-Match'] = feed.etag;
      if (feed.lastModified) headers['If-Modified-Since'] = feed.lastModified;

      const response = await fetch(feed.feedUrl, { headers });

      if (response.status === 304) {
        // Not modified
        await db.update(feeds).set({
          lastSyncAt: new Date(),
          consecutiveFailures: 0,
        }).where(eq(feeds.id, feedId));
        return { newArticles: 0, updated: 0 };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const newEtag = response.headers.get('etag');
      const newLastModified = response.headers.get('last-modified');
      const text = await response.text();

      // Parse feed
      const parsed = await parseFeed(text, feed.feedUrl);

      // Update feed metadata
      await db.update(feeds).set({
        title: parsed.title,
        siteUrl: parsed.siteUrl,
        type: parsed.type,
        lastSyncAt: new Date(),
        consecutiveFailures: 0,
        etag: newEtag || feed.etag,
        lastModified: newLastModified || feed.lastModified,
      }).where(eq(feeds.id, feedId));

      // Insert/Update articles
      let newCount = 0;
      let updatedCount = 0;

      for (const article of parsed.articles) {
        // Check if article exists
        const existing = await db.query.articles.findFirst({
          where: and(
            eq(articles.feedId, feedId),
            eq(articles.externalId, article.id)
          ),
        });

        if (!existing) {
          // Insert new article
          await db.insert(articles).values({
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
        } else {
          // Update if content changed
          const hasChanged = 
            existing.title !== article.title ||
            existing.summary !== article.summary ||
            existing.content !== article.content;

          if (hasChanged) {
            await db.update(articles).set({
              title: article.title,
              summary: article.summary,
              content: article.content,
              thumbnailUrl: article.thumbnailUrl,
              searchVector: this.buildSearchVector(article.title, article.summary, article.content),
            }).where(eq(articles.id, existing.id));
            updatedCount++;
          }
        }
      }

      return { newArticles: newCount, updated: updatedCount };
    } catch (error) {
      // Update failure count
      await db.update(feeds).set({
        lastError: error instanceof Error ? error.message : 'Unknown error',
        consecutiveFailures: sql`${feeds.consecutiveFailures} + 1`,
      }).where(eq(feeds.id, feedId));

      throw error;
    }
  }

  async syncAllFeeds(userId: string, onProgress?: (current: number, total: number, feedTitle: string) => void): Promise<{
    totalFeeds: number;
    successful: number;
    failed: number;
    newArticles: number;
  }> {
    const userFeeds = await db.query.feeds.findMany({
      where: and(eq(feeds.userId, userId), eq(feeds.isPaused, false)),
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
      } catch (error) {
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

  async searchArticles(userId: string, query: string, limit = 50): Promise<typeof articles.$inferSelect[]> {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    
    if (searchTerms.length === 0) {
      return [];
    }

    // Simple search using ILIKE
    const conditions = searchTerms.map(term => 
      sql`(
        ${articles.searchVector} ILIKE ${`%${term}%`} OR
        ${articles.title} ILIKE ${`%${term}%`}
      )`
    );

    const results = await db.query.articles.findMany({
      where: and(
        eq(articles.userId, userId),
        sql`(${sql.join(conditions, sql` AND `)})`
      ),
      orderBy: desc(articles.publishedAt),
      limit,
    });

    return results;
  }

  async getUnreadArticles(userId: string, limit = 100): Promise<Array<{
    article: typeof articles.$inferSelect;
    isRead: boolean;
    isBookmarked: boolean;
  }>> {
    const result = await db.query.articles.findMany({
      where: eq(articles.userId, userId),
      orderBy: desc(articles.publishedAt),
      limit: limit * 2, // Get more to filter
    });

    const articleIds = result.map(a => a.id);
    const states = articleIds.length
      ? await db.query.articleStates.findMany({
          where: and(
            eq(articleStates.userId, userId),
            inArray(articleStates.articleId, articleIds)
          ),
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

  private buildSearchVector(title: string, summary?: string, content?: string): string {
    const parts = [title];
    if (summary) parts.push(summary);
    if (content) parts.push(content.slice(0, 1000)); // First 1000 chars
    return parts.join(' ').replace(/<[^>]*>/g, '').toLowerCase();
  }
}
