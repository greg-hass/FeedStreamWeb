
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatsService } from '../lib/stats-service';
import Dexie from 'dexie';

// Hoisted Mocks
const mocks = vi.hoisted(() => ({
    count: vi.fn().mockResolvedValue(100),
    each: vi.fn(),
    toArray: vi.fn().mockResolvedValue([]),
    last: vi.fn()
}));

vi.mock('../lib/db', () => ({
    db: {
        articles: {
            count: () => mocks.count(),
            where: (idx: string) => {
                // Handle different where clauses
                if (idx === 'publishedAt') return { above: () => ({ each: mocks.each }) };
                if (idx === 'isRead') return { equals: () => ({ count: mocks.count }) };
                if (idx === 'isBookmarked') return { equals: () => ({ count: mocks.count }) };
                if (idx === '[feedID+publishedAt]') return {
                    between: () => ({ last: mocks.last })
                };
                return { equals: () => ({ count: mocks.count }) };
            }
        },
        feeds: {
            toArray: mocks.toArray
        }
    }
}));

describe('StatsService Performance', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should use memory-efficient iteration for top feeds', async () => {
        // Setup mock data
        mocks.toArray.mockResolvedValue([
            { id: 'feed-1', title: 'Feed 1' },
            { id: 'feed-2', title: 'Feed 2' }
        ]);

        // Mock each() to simulate iterating over 10,000 articles
        mocks.each.mockImplementation(async (callback: any) => {
            for (let i = 0; i < 1000; i++) {
                callback({ feedID: 'feed-1', publishedAt: new Date() });
            }
            for (let i = 0; i < 500; i++) {
                callback({ feedID: 'feed-2', publishedAt: new Date() });
            }
        });

        const start = performance.now();
        const stats = await StatsService.getStats();
        const end = performance.now();

        expect(stats.topFeeds[0].id).toBe('feed-1');
        expect(stats.topFeeds[0].count).toBe(1000);
        expect(stats.topFeeds[1].id).toBe('feed-2');
        expect(stats.topFeeds[1].count).toBe(500);

        // Verify we called each(), not toArray() for articles
        expect(mocks.each).toHaveBeenCalled();
        
        console.log(`Stats calculation took ${end - start}ms`);
    });

    it('should use index for ghost detection', async () => {
        mocks.toArray.mockResolvedValue([{ id: 'feed-ghost', title: 'Ghost Feed' }]);
        
        // Mock finding the last article using index
        const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
        mocks.last.mockResolvedValue({ publishedAt: oldDate });

        const stats = await StatsService.getStats();

        expect(stats.ghostFeeds).toHaveLength(1);
        expect(stats.ghostFeeds[0].id).toBe('feed-ghost');
        
        expect(mocks.last).toHaveBeenCalled();
    });
});
