import { generateBriefing, getTodayBriefing, getFeedRecommendations } from './api-client';

/**
 * AI Service using Backend API
 * 
 * All AI features are now processed on the backend using Gemini 2.5-flash
 * This provides better performance and keeps API keys secure
 */

export class AIService {
    /**
     * Generate daily briefing using backend AI service
     */
    static async generateDailyBriefing(): Promise<string> {
        try {
            const { content } = await generateBriefing();
            return content;
        } catch (error: any) {
            console.error("Briefing Generation Failed", error);
            throw error;
        }
    }

    /**
     * Get today's briefing from backend
     */
    static async getTodayBriefing(): Promise<string | null> {
        try {
            const briefing = await getTodayBriefing();
            return briefing?.content || null;
        } catch (error) {
            console.error("Failed to get today's briefing", error);
            return null;
        }
    }

    /**
     * Get AI-powered feed recommendations
     */
    static async getRecommendations(): Promise<Array<{
        title: string;
        url: string;
        description: string;
        category: string;
        type: string;
    }>> {
        try {
            return await getFeedRecommendations();
        } catch (error: any) {
            console.error("Feed Discovery Failed", error);
            throw error;
        }
    }
}
