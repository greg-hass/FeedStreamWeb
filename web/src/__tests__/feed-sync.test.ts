
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedService } from '../lib/feed-service';
import { Article } from '../lib/db';

// Mocks
const mockTransaction = vi.fn((mode, tables, callback) => callback());
const mockBulkPut = vi.fn();
const mockUpdate = vi.fn();
const mockWhereAnyOf = vi.fn().mockReturnThis();
const mockToArray = vi.fn().mockResolvedValue([]);

vi.mock('../lib/db', () => ({
    db: {
        transaction: (mode: any, tables: any, cb: any) => mockTransaction(mode, tables, cb),
        articles: {
            where: (idx: string) => ({
                anyOf: (ids: string[]) => ({
                    toArray: () => mockToArray(ids) // Return what we configure
                })
            }),
            bulkPut: (items: any) => mockBulkPut(items),
            update: (id: any, changes: any) => mockUpdate(id, changes)
        },
        feeds: {
            update: vi.fn(),
            get: vi.fn()
        },
        rules: {
            filter: () => ({ toArray: () => Promise.resolve([]) }) // No rules for now
        }
    }
}));

vi.mock('../lib/feed-parser', () => ({
    parseFeed: vi.fn()
}));

vi.mock('../lib/icon-service', () => ({
    IconService: { updateFeedIcon: vi.fn() }
}));


describe('FeedService Sync Logic', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Access private method via prototype or by exporting it for testing?
    // Since it's private, we can't call it directly in TS.
    // However, we can test `refreshFeed` which calls it.
    // OR we can cast to any.
    
    it('should merge new articles correctly', async () => {
        const feedId = 'feed-1';
        const incoming: Article[] = [
            { id: '1', title: 'New Article', feedID: feedId, isRead: false } as Article,
            { id: '2', title: 'Existing Article', feedID: feedId, isRead: false } as Article
        ];

        // Mock DB State: Article 2 exists
        mockToArray.mockImplementation(async (ids: string[]) => {
            if (ids.includes('2')) return [{ id: '2', title: 'Existing Article', feedID: feedId, isRead: true } as Article];
            return [];
        });

        // We use 'any' to access private method for unit testing logic
        const service = FeedService as any;
        const newCount = await service.mergeArticles(feedId, incoming);

        // Expectation:
        // Article 1 is NEW -> bulkPut
        // Article 2 is UNCHANGED -> Ignored (optimization) or Updates?
        // In our logic: "Only update if content has actually changed". 
        // Title is same. So it should be skipped.

        // Wait, wait. "Existing Article" in incoming has isRead=false. DB has isRead=true.
        // Our logic: "isRead: existing.isRead || item.isRead".
        // 1 OR 0 = 1.
        // But if title/content matches, we DON'T update. 
        
        expect(mockBulkPut).toHaveBeenCalledTimes(1); // Only for new article 1
        // The first call (index 0) of bulkPut should contain Article 1
        const added = mockBulkPut.mock.calls[0][0];
        expect(added).toHaveLength(1);
        expect(added[0].id).toBe('1');
        
        expect(newCount).toBe(1);
    });

    it('should update changed articles but preserve read status', async () => {
        const feedId = 'feed-1';
        const incoming: Article[] = [
            { id: '2', title: 'Updated Title', feedID: feedId, isRead: false, summary: 'New' } as Article
        ];

        // Mock DB State: Article 2 exists, isRead=true
        mockToArray.mockImplementation(async () => {
            return [{ id: '2', title: 'Old Title', feedID: feedId, isRead: true, summary: 'Old' } as Article];
        });

        const service = FeedService as any;
        await service.mergeArticles(feedId, incoming);

        expect(mockBulkPut).toHaveBeenCalled();
        const updates = mockBulkPut.mock.calls[0][0]; // Depending on implementation, might be 2nd call or same
        // Actually code has: bulkPut(new); bulkPut(updates);
        // Since new is empty, it might be the first call if we check array length.

        expect(updates).toHaveLength(1);
        expect(updates[0].title).toBe('Updated Title');
        expect(updates[0].isRead).toBe(true); // Preserved from DB
    });

});
