export declare class AIService {
    private geminiApiKey;
    constructor();
    generateBriefing(articles: Array<{
        title: string;
        summary?: string;
        content?: string;
    }>): Promise<string>;
    generateFeedRecommendations(userFeeds: Array<{
        title: string;
        type: string;
    }>): Promise<Array<{
        title: string;
        url: string;
        description: string;
        category: string;
        type: string;
    }>>;
}
//# sourceMappingURL=ai.d.ts.map