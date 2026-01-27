import { getFeedRecommendations } from './api-client';

export interface FeedRecommendation {
    title: string;
    url: string;
    description: string;
    category: string;
    type: 'rss' | 'youtube' | 'reddit' | 'podcast';
}

/**
 * Feed Discovery Service using Backend AI
 * 
 * Now uses the backend API with Gemini 2.5-flash for recommendations
 */
export class FeedDiscoveryService {

    static async generateRecommendations(): Promise<FeedRecommendation[]> {
        try {
            const recommendations = await getFeedRecommendations();
            
            return recommendations.map(item => ({
                title: item.title,
                url: item.url,
                description: item.description,
                category: item.category,
                type: (item.type || 'rss') as FeedRecommendation['type']
            }));
        } catch (error: any) {
            console.error("Feed Discovery Failed", error);
            throw new Error(error.message || "Failed to generate recommendations");
        }
    }
}
