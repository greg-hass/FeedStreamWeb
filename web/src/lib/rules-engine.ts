import { db, Article, AutomationRule } from './db';

export class RulesEngine {
    /**
     * Applies active rules to a list of articles.
     * Returns the modified list (if delete action) and performs side effects (DB updates).
     * Note: This runs BEFORE articles are inserted into the main list or immediately after.
     * Better approach: Run on the objects *before* bulkPut.
     */
    static async applyRules(articles: Article[]): Promise<Article[]> {
        const rules = await db.rules.filter(r => r.isActive).toArray();
        if (rules.length === 0) return articles;

        const resultArticles: Article[] = [];
        const discardedIds = new Set<string>();

        for (const article of articles) {
            let shouldDelete = false;
            let modifiedArticle = { ...article };

            for (const rule of rules) {
                if (this.matches(rule, modifiedArticle)) {
                    console.log(`[Rules] Article "${article.title}" matched rule "${rule.name}"`);
                    
                    switch (rule.action) {
                        case 'mark_read':
                            modifiedArticle.isRead = true;
                            break;
                        case 'star':
                            modifiedArticle.isBookmarked = true;
                            break;
                        case 'delete':
                            shouldDelete = true;
                            break;
                        // tag_important could set a flag or put in a folder, sticking to simple boolean flags for now
                    }
                }
            }

            if (!shouldDelete) {
                resultArticles.push(modifiedArticle);
            } else {
                discardedIds.add(article.id);
            }
        }

        return resultArticles;
    }

    private static matches(rule: AutomationRule, article: Article): boolean {
        const value = rule.conditionValue.toLowerCase();

        switch (rule.conditionType) {
            case 'title_contains':
                return (article.title || '').toLowerCase().includes(value);
            case 'content_contains':
                // Check summary too
                return (article.contentHTML || '').toLowerCase().includes(value) || 
                       (article.summary || '').toLowerCase().includes(value);
            case 'author_contains':
                return (article.author || '').toLowerCase().includes(value);
            case 'feed_is':
                return article.feedID === rule.conditionValue;
            default:
                return false;
        }
    }
}
