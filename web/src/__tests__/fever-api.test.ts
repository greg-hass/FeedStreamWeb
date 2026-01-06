import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeverAPI } from '@/lib/fever-api';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FeverAPI', () => {
    let api: FeverAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
        api = new FeverAPI('https://freshrss.example.com/api/fever.php', 'abc123def456');
    });

    describe('authentication', () => {
        it('should reject with auth=0 response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ api_version: 3, auth: 0 }),
            });

            await expect(api.getGroups()).rejects.toThrow('Fever API Authentication Failed');
        });

        it('should accept auth=1 response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ api_version: 3, auth: 1, groups: [] }),
            });

            const result = await api.getGroups();
            expect(result.auth).toBe(1);
        });
    });

    describe('getItems', () => {
        it('should fetch items without since_id', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    api_version: 3,
                    auth: 1,
                    items: [{ id: 1, title: 'Test' }]
                }),
            });

            const result = await api.getItems();
            expect(result.items).toHaveLength(1);

            // Verify the URL constructed
            const calledUrl = decodeURIComponent(mockFetch.mock.calls[0][0]);
            expect(calledUrl).toContain('items=1');
        });

        it('should fetch items with since_id for pagination', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    api_version: 3,
                    auth: 1,
                    items: [{ id: 101, title: 'New Item' }]
                }),
            });

            const result = await api.getItems(100);
            expect(result.items).toHaveLength(1);

            const calledUrl = decodeURIComponent(mockFetch.mock.calls[0][0]);
            expect(calledUrl).toContain('since_id=100');
        });
    });

    describe('mark actions', () => {
        it('should mark item as read', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ api_version: 3, auth: 1 }),
            });

            await api.markItemRead(123);

            const calledUrl = decodeURIComponent(mockFetch.mock.calls[0][0]);
            expect(calledUrl).toContain('mark=item');
            expect(calledUrl).toContain('as=read');
            expect(calledUrl).toContain('id=123');
        });

        it('should mark item as saved', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ api_version: 3, auth: 1 }),
            });

            await api.markItemSaved(456);

            const calledUrl = decodeURIComponent(mockFetch.mock.calls[0][0]);
            expect(calledUrl).toContain('as=saved');
        });
    });

    describe('getUnreadItemIds', () => {
        it('should return comma-separated unread IDs', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    api_version: 3,
                    auth: 1,
                    unread_item_ids: '1,2,3,4,5'
                }),
            });

            const result = await api.getUnreadItemIds();
            expect(result.unread_item_ids).toBe('1,2,3,4,5');
        });
    });
});
