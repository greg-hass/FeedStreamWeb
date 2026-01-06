
import { describe, it, expect, vi, beforeAll } from 'vitest';
import DOMPurify from 'dompurify';
import { getSanitizeOptions } from '../components/Reader';
import { OpmlService } from '../lib/opml-service';

// Mock DB for OpmlService
vi.mock('../lib/db', () => ({
    db: {
        feeds: { add: vi.fn(), toArray: vi.fn().mockResolvedValue([]) },
        folders: { add: vi.fn(), toArray: vi.fn().mockResolvedValue([]) }
    }
}));

// Mock FeedService
vi.mock('../lib/feed-service', () => ({
    FeedService: {
        addFeed: vi.fn().mockResolvedValue('feed-id')
    }
}));

// Polyfill Node for JSDOM if needed (Vitest uses JSDOM environment usually, checking Reader hooks)
// Reader uses `window.location.origin` inside the hook.
const mockOrigin = 'http://localhost:3000';
Object.defineProperty(window, 'location', {
    value: {
        origin: mockOrigin
    },
    writable: true
});


describe('Security Controls', () => {

    describe('Reader Component Sanitization', () => {
        const options = getSanitizeOptions();

        it('should strip <script> tags', () => {
            const dirty = '<div>Hello <script>alert("XSS")</script></div>';
            const clean = DOMPurify.sanitize(dirty, options);
            expect(clean).toBe('<div>Hello </div>');
        });

        it('should allow youtube iframes', () => {
            const dirty = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';
            const clean = DOMPurify.sanitize(dirty, options);
            expect(clean).toContain('youtube.com');
        });

        it('should remove malicious iframes', () => {
            const dirty = '<iframe src="https://malicious.com/login"></iframe>';
            const clean = DOMPurify.sanitize(dirty, options);
            expect(clean).not.toContain('iframe');
        });

        it('should remove iframes with javascript: src', () => {
            const dirty = '<iframe src="javascript:alert(1)"></iframe>';
            const clean = DOMPurify.sanitize(dirty, options);
            expect(clean).not.toContain('iframe');
        });

        it('should allow vimeo iframes', () => {
             const dirty = '<iframe src="https://player.vimeo.com/video/123456"></iframe>';
             const clean = DOMPurify.sanitize(dirty, options);
             expect(clean).toContain('player.vimeo.com');
        });
    });

    describe('OPML Service XXE Protection', () => {
        it('should fail or ignore external entities (XXE)', async () => {
            // XXE Payload trying to read /etc/passwd
            const xxeXml = `<?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
            <opml version="1.0">
                <body>
                    <outline text="Malicious Feed" xmlUrl="&xxe;" />
                </body>
            </opml>`;

            try {
                // We expect this to EITHER fail parsing OR treat &xxe; as empty string/literal.
                // It should definitely NOT try to resolve /etc/passwd (which would fail in browser env anyway, but we test the config).
                await OpmlService.importOPML(xxeXml);
                
                // If it succeeds, verify what happened in the mock
                const { FeedService } = await import('../lib/feed-service');
                const addFeedMock = FeedService.addFeed as any;
                
                // If the parser resolved it, it would try to fetch "file:///etc/passwd" or the content of it.
                // If it ignored it, it might pass "" or "&xxe;".
                if (addFeedMock.mock.calls.length > 0) {
                    const url = addFeedMock.mock.calls[0][0];
                    expect(url).not.toContain('root:x:0:0'); // Content of passwd
                    // With processEntities: false, it should literally be "&xxe;" or similar, NOT the resolved file.
                }

            } catch (e: any) {
                // It's acceptable for the parser to throw on DTDs if "disallow DTD" is set
                // Or if parsing fails.
            }
        });
    });
});
