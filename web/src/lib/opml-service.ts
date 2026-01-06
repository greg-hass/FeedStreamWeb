
import { db } from './db';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { FeedService } from './feed-service';
import { uuidv4 } from './utils';

export class OpmlService {

    static async importOPML(xmlContent: string, onProgress?: (current: number, total: number, message: string) => void) {
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "",
            processEntities: false, // Security: Prevent XXE
            ignoreDeclaration: true // Security: Ignore DTD
        });

        const result = parser.parse(xmlContent);
        if (!result.opml && !result.OPML) throw new Error("Invalid OPML file: No <opml> tag found");

        const body = result.opml?.body || result.OPML?.body;
        if (!body) throw new Error("Invalid OPML file: No <body> tag found");

        const outlines = Array.isArray(body.outline) ? body.outline : (body.outline ? [body.outline] : []);

        // Collection phase
        const feedsToImport: { url: string; title: string; folderId?: string }[] = [];
        const foldersToCreate: { id: string; name: string; position: number }[] = [];

        const traverse = (nodes: any[], currentFolderId?: string) => {
            for (const node of nodes) {
                if (!node) continue;
                
                const feedUrl = node.xmlUrl || node.xmlurl || node.url;
                const title = node.text || node.title || 'Untitled';

                if (feedUrl) {
                    feedsToImport.push({ url: feedUrl, title, folderId: currentFolderId });
                } else if (node.outline) {
                    const newId = uuidv4();
                    foldersToCreate.push({ id: newId, name: title, position: foldersToCreate.length });
                    const children = Array.isArray(node.outline) ? node.outline : [node.outline];
                    traverse(children, newId);
                }
            }
        };

        traverse(outlines);

        // 1. Bulk Create Folders
        if (foldersToCreate.length > 0) {
            await db.folders.bulkAdd(foldersToCreate);
        }

        // 2. Import Feeds Concurrently
        const total = feedsToImport.length;
        let processed = 0;
        const CONCURRENCY_LIMIT = 8;

        const processFeed = async (item: typeof feedsToImport[0]) => {
            try {
                await FeedService.addFeed(item.url, item.folderId);
            } catch (e) {
                console.error(`Failed to import feed ${item.url}`, e);
            } finally {
                processed++;
                if (onProgress) {
                    onProgress(processed, total, `Importing ${item.title}...`);
                }
            }
        };

        // Process in chunks to respect concurrency limit
        for (let i = 0; i < total; i += CONCURRENCY_LIMIT) {
            const chunk = feedsToImport.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(chunk.map(processFeed));
        }
    }

    static async exportOPML(): Promise<string> {
        const feeds = await db.feeds.toArray();
        const folders = await db.folders.toArray();

        // Group feeds by folder
        const folderMap = new Map<string, any[]>();
        const rootFeeds: any[] = [];

        for (const feed of feeds) {
            if (feed.folderID) {
                if (!folderMap.has(feed.folderID)) folderMap.set(feed.folderID, []);
                folderMap.get(feed.folderID)?.push(feed);
            } else {
                rootFeeds.push(feed);
            }
        }

        let outlinesXML = '';

        // Add Folders and their feeds
        for (const folder of folders) {
            const children = folderMap.get(folder.id) || [];
            if (children.length > 0) {
                outlinesXML += `\t<outline text="${this.escape(folder.name)}" title="${this.escape(folder.name)}">\n`;
                for (const feed of children) {
                    outlinesXML += `\t\t<outline text="${this.escape(feed.title)}" title="${this.escape(feed.title)}" type="rss" xmlUrl="${this.escape(feed.feedURL)}" htmlUrl="${this.escape(feed.siteURL || '')}"/>\n`;
                }
                outlinesXML += `\t</outline>\n`;
            }
        }

        // Add Root Feeds
        for (const feed of rootFeeds) {
            outlinesXML += `\t<outline text="${this.escape(feed.title)}" title="${this.escape(feed.title)}" type="rss" xmlUrl="${this.escape(feed.feedURL)}" htmlUrl="${this.escape(feed.siteURL || '')}"/>\n`;
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
    <head>
        <title>FeedStream Subscription Export</title>
        <dateCreated>${new Date().toUTCString()}</dateCreated>
    </head>
    <body>
${outlinesXML}
    </body>
</opml>`;
    }

    private static escape(str: string): string {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}
