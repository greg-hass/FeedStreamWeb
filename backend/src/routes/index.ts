import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { users, feeds, articles, folders, articleStates, briefings, syncQueue, userSettings } from '../db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { FeedService } from '../services/feed';
import { AIService } from '../services/ai';
import { parseFeed } from '@feedstream/common';

const feedService = new FeedService();
const aiService = new AIService();

// Auth middleware - simple device-based
async function authenticate(request: any, reply: any) {
  const deviceId = request.headers['x-device-id'];
  if (!deviceId) {
    reply.code(401).send({ error: 'Missing device ID' });
    return;
  }

  let user = await db.query.users.findFirst({
    where: eq(users.deviceId, deviceId),
  });

  if (!user) {
    // Create new user
    const [newUser] = await db.insert(users).values({
      deviceId,
    }).returning();
    user = newUser;
  }

  request.user = user;
}

export async function routes(app: FastifyInstance) {
  // Auth hook
  app.addHook('preHandler', authenticate);

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  // === FEEDS ===
  
  app.get('/feeds', async (request) => {
    const userFeeds = await db.query.feeds.findMany({
      where: and(
        eq(feeds.userId, request.user.id),
        sql`${feeds.deletedAt} IS NULL`
      ),
      orderBy: feeds.sortOrder,
    });
    return userFeeds;
  });

  app.post('/feeds', async (request, reply) => {
    const schema = z.object({
      url: z.string().url(),
      folderId: z.string().uuid().optional(),
    });

    const body = schema.parse(request.body);

    // Check if feed already exists
    const existing = await db.query.feeds.findFirst({
      where: and(
        eq(feeds.userId, request.user.id),
        eq(feeds.feedUrl, body.url),
        sql`${feeds.deletedAt} IS NULL`
      ),
    });

    if (existing) {
      reply.code(409).send({ error: 'Feed already exists' });
      return;
    }

    // Fetch and parse feed
    const response = await fetch(body.url, {
      headers: {
        'User-Agent': 'FeedStream/1.0',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*',
      },
    });

    if (!response.ok) {
      reply.code(400).send({ error: 'Failed to fetch feed' });
      return;
    }

    const text = await response.text();
    const parsed = await parseFeed(text, body.url);

    // Create feed
    const [feed] = await db.insert(feeds).values({
      userId: request.user.id,
      folderId: body.folderId,
      title: parsed.title,
      feedUrl: body.url,
      siteUrl: parsed.siteUrl,
      type: parsed.type,
    }).returning();

    // Sync articles immediately
    await feedService.syncFeed(feed.id, request.user.id);

    return feed;
  });

  app.delete('/feeds/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    await db.update(feeds).set({
      deletedAt: new Date(),
    }).where(and(eq(feeds.id, id), eq(feeds.userId, request.user.id)));

    reply.code(204).send();
  });

  app.post('/feeds/:id/sync', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const result = await feedService.syncFeed(id, request.user.id);
      return result;
    } catch (error) {
      reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Sync failed' 
      });
    }
  });

  app.post('/feeds/sync-all', async (request) => {
    const result = await feedService.syncAllFeeds(request.user.id);
    return result;
  });

  // === ARTICLES ===

  app.get('/articles', async (request) => {
    const { feedId, unread, bookmarked, limit = '50', offset = '0' } = request.query as {
      feedId?: string;
      unread?: string;
      bookmarked?: string;
      limit?: string;
      offset?: string;
    };

    let query = db.query.articles.findMany({
      where: eq(articles.userId, request.user.id),
      orderBy: desc(articles.publishedAt),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    if (feedId) {
      query = db.query.articles.findMany({
        where: and(eq(articles.userId, request.user.id), eq(articles.feedId, feedId)),
        orderBy: desc(articles.publishedAt),
        limit: parseInt(limit),
      });
    }

    const result = await query;

    // Get states for each article
    const articleIds = result.map(a => a.id);
    const states = articleIds.length
      ? await db.query.articleStates.findMany({
          where: and(
            eq(articleStates.userId, request.user.id),
            inArray(articleStates.articleId, articleIds)
          ),
        })
      : [];

    const statesMap = new Map(states.map(s => [s.articleId, s]));

    return result.map(article => ({
      ...article,
      isRead: statesMap.get(article.id)?.isRead || false,
      isBookmarked: statesMap.get(article.id)?.isBookmarked || false,
      playbackPosition: statesMap.get(article.id)?.playbackPosition || 0,
    }));
  });

  app.get('/articles/search', async (request) => {
    const { q, limit = '50' } = request.query as { q: string; limit?: string };
    
    if (!q) {
      return [];
    }

    const results = await feedService.searchArticles(request.user.id, q, parseInt(limit));
    return results;
  });

  app.post('/articles/:id/read', async (request) => {
    const { id } = request.params as { id: string };
    const { isRead } = request.body as { isRead: boolean };

    await db.insert(articleStates).values({
      userId: request.user.id,
      articleId: id,
      isRead,
      readAt: isRead ? new Date() : undefined,
    }).onConflictDoUpdate({
      target: [articleStates.userId, articleStates.articleId],
      set: {
        isRead,
        readAt: isRead ? new Date() : undefined,
        updatedAt: new Date(),
      },
    });

    return { success: true };
  });

  app.post('/articles/:id/bookmark', async (request) => {
    const { id } = request.params as { id: string };
    const { isBookmarked } = request.body as { isBookmarked: boolean };

    await db.insert(articleStates).values({
      userId: request.user.id,
      articleId: id,
      isBookmarked,
      bookmarkedAt: isBookmarked ? new Date() : undefined,
    }).onConflictDoUpdate({
      target: [articleStates.userId, articleStates.articleId],
      set: {
        isBookmarked,
        bookmarkedAt: isBookmarked ? new Date() : undefined,
        updatedAt: new Date(),
      },
    });

    return { success: true };
  });

  // === FOLDERS ===

  app.get('/folders', async (request) => {
    const userFolders = await db.query.folders.findMany({
      where: and(
        eq(folders.userId, request.user.id),
        sql`${folders.deletedAt} IS NULL`
      ),
      orderBy: folders.position,
    });
    return userFolders;
  });

  app.post('/folders', async (request) => {
    const schema = z.object({
      name: z.string().min(1).max(255),
      position: z.number().optional(),
    });

    const body = schema.parse(request.body);

    const [folder] = await db.insert(folders).values({
      userId: request.user.id,
      name: body.name,
      position: body.position || 0,
    }).returning();

    return folder;
  });

  // === AI FEATURES ===

  app.post('/ai/briefing', async (request, reply) => {
    try {
      // Get recent unread articles
      const unreadArticles = await feedService.getUnreadArticles(request.user.id, 30);
      
      if (unreadArticles.length === 0) {
        return { content: 'No recent unread articles to summarize.' };
      }

      const briefing = await aiService.generateBriefing(
        unreadArticles.map(a => ({
          title: a.article.title,
          summary: a.article.summary || undefined,
          content: a.article.content || undefined,
        }))
      );

      // Save briefing
      const today = new Date().toISOString().split('T')[0];
      await db.insert(briefings).values({
        userId: request.user.id,
        date: today,
        content: briefing,
        articlesCovered: unreadArticles.map(a => a.article.id),
      }).onConflictDoUpdate({
        target: [briefings.userId, briefings.date],
        set: {
          content: briefing,
          articlesCovered: unreadArticles.map(a => a.article.id),
          generatedAt: new Date(),
        },
      });

      return { content: briefing };
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to generate briefing',
      });
    }
  });

  app.get('/ai/briefing', async (request) => {
    const today = new Date().toISOString().split('T')[0];
    const briefing = await db.query.briefings.findFirst({
      where: and(eq(briefings.userId, request.user.id), eq(briefings.date, today)),
    });

    return briefing || null;
  });

  app.post('/ai/recommendations', async (request, reply) => {
    try {
      const userFeeds = await db.query.feeds.findMany({
        where: and(
          eq(feeds.userId, request.user.id),
          sql`${feeds.deletedAt} IS NULL`
        ),
      });

      const recommendations = await aiService.generateFeedRecommendations(
        userFeeds.map(f => ({ title: f.title, type: f.type ?? 'rss' }))
      );

      return recommendations;
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to generate recommendations',
      });
    }
  });

  // === SYNC ===

  app.post('/sync', async (request) => {
    const body = request.body as {
      folders?: any[];
      feeds?: any[];
      articles?: any[];
      since?: string;
    };

    // Process incoming changes
    if (body.folders?.length) {
      for (const folder of body.folders) {
        await db.insert(folders).values({
          id: folder.id,
          userId: request.user.id,
          name: folder.name,
          position: folder.position,
        }).onConflictDoUpdate({
          target: folders.id,
          set: {
            name: folder.name,
            position: folder.position,
            updatedAt: new Date(),
          },
        });
      }
    }

    // Return server changes since timestamp
    const since = body.since ? new Date(body.since) : new Date(0);

    const serverFolders = await db.query.folders.findMany({
      where: and(
        eq(folders.userId, request.user.id),
        sql`${folders.updatedAt} > ${since}`
      ),
    });

    const serverFeeds = await db.query.feeds.findMany({
      where: and(
        eq(feeds.userId, request.user.id),
        sql`${feeds.updatedAt} > ${since}`
      ),
    });

    return {
      folders: serverFolders,
      feeds: serverFeeds,
      serverTime: new Date().toISOString(),
    };
  });

  // === SETTINGS ===

  app.get('/settings', async (request) => {
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, request.user.id),
    });

    return settings?.settings || {};
  });

  app.post('/settings', async (request) => {
    const body = request.body as Record<string, any>;

    await db.insert(userSettings).values({
      userId: request.user.id,
      settings: body,
    }).onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        settings: body,
        updatedAt: new Date(),
      },
    });

    return { success: true };
  });
}
