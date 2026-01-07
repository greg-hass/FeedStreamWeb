import { createClient, SupabaseClient, User, Session, AuthChangeEvent } from '@supabase/supabase-js';

/**
 * Supabase Client for FeedStream Cloud Sync
 *
 * Features:
 * - Email/Password Authentication
 * - Session management
 * - Auth state change listeners
 *
 * Required Environment Variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

// Supabase client singleton
let supabaseInstance: SupabaseClient | null = null;

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
    return !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
}

/**
 * Get or create the Supabase client instance
 */
export function getSupabase(): SupabaseClient {
    if (!supabaseInstance) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error(
                'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'
            );
        }

        supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
        });
    }

    return supabaseInstance;
}

// Export the Supabase client for direct use
export const supabase = {
    get client(): SupabaseClient {
        return getSupabase();
    },
};

/**
 * Supabase Authentication Helper Class
 */
export class SupabaseAuth {
    /**
     * Sign up a new user with email and password
     */
    static async signUp(email: string, password: string): Promise<{ user: User | null; error: Error | null }> {
        try {
            const { data, error } = await getSupabase().auth.signUp({
                email,
                password,
            });

            if (error) {
                return { user: null, error: new Error(error.message) };
            }

            return { user: data.user, error: null };
        } catch (err) {
            return { user: null, error: err as Error };
        }
    }

    /**
     * Sign in an existing user with email and password
     */
    static async signIn(email: string, password: string): Promise<{ user: User | null; session: Session | null; error: Error | null }> {
        try {
            const { data, error } = await getSupabase().auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return { user: null, session: null, error: new Error(error.message) };
            }

            return { user: data.user, session: data.session, error: null };
        } catch (err) {
            return { user: null, session: null, error: err as Error };
        }
    }

    /**
     * Sign out the current user
     */
    static async signOut(): Promise<{ error: Error | null }> {
        try {
            const { error } = await getSupabase().auth.signOut();

            if (error) {
                return { error: new Error(error.message) };
            }

            return { error: null };
        } catch (err) {
            return { error: err as Error };
        }
    }

    /**
     * Get the current session
     */
    static async getSession(): Promise<{ session: Session | null; error: Error | null }> {
        try {
            const { data, error } = await getSupabase().auth.getSession();

            if (error) {
                return { session: null, error: new Error(error.message) };
            }

            return { session: data.session, error: null };
        } catch (err) {
            return { session: null, error: err as Error };
        }
    }

    /**
     * Get the current user
     */
    static async getUser(): Promise<{ user: User | null; error: Error | null }> {
        try {
            const { data, error } = await getSupabase().auth.getUser();

            if (error) {
                return { user: null, error: new Error(error.message) };
            }

            return { user: data.user, error: null };
        } catch (err) {
            return { user: null, error: err as Error };
        }
    }

    /**
     * Subscribe to auth state changes
     */
    static onAuthStateChange(
        callback: (event: AuthChangeEvent, session: Session | null) => void
    ): { unsubscribe: () => void } {
        const { data: { subscription } } = getSupabase().auth.onAuthStateChange(callback);

        return {
            unsubscribe: () => subscription.unsubscribe(),
        };
    }

    /**
     * Send password reset email
     */
    static async resetPassword(email: string): Promise<{ error: Error | null }> {
        try {
            const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
                redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`,
            });

            if (error) {
                return { error: new Error(error.message) };
            }

            return { error: null };
        } catch (err) {
            return { error: err as Error };
        }
    }

    /**
     * Update user password (when logged in)
     */
    static async updatePassword(newPassword: string): Promise<{ error: Error | null }> {
        try {
            const { error } = await getSupabase().auth.updateUser({
                password: newPassword,
            });

            if (error) {
                return { error: new Error(error.message) };
            }

            return { error: null };
        } catch (err) {
            return { error: err as Error };
        }
    }

    /**
     * Check if user is authenticated
     */
    static async isAuthenticated(): Promise<boolean> {
        const { session } = await this.getSession();
        return session !== null;
    }
}

/**
 * Database types for Supabase tables
 */
export interface SyncFolder {
    id: string;
    user_id: string;
    name: string;
    position: number;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

export interface SyncFeed {
    id: string;
    user_id: string;
    title: string;
    feed_url: string;
    site_url: string | null;
    folder_id: string | null;
    icon_url: string | null;
    type: string;
    is_paused: boolean;
    sort_order: number;
    is_favorite: boolean;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

export interface SyncArticleState {
    id: string;
    user_id: string;
    article_url: string; // Use URL as stable identifier across devices
    feed_id: string;
    is_read: boolean;
    is_bookmarked: boolean;
    playback_position: number;
    created_at: string;
    updated_at: string;
}

export interface SyncSettings {
    user_id: string;
    settings_json: string; // Encrypted JSON
    updated_at: string;
}

/**
 * Supabase Database Operations
 */
export class SupabaseDB {
    // Folders
    static async getFolders(since?: Date): Promise<SyncFolder[]> {
        let query = getSupabase()
            .from('sync_folders')
            .select('*')
            .is('deleted_at', null);

        if (since) {
            query = query.gte('updated_at', since.toISOString());
        }

        const { data, error } = await query;

        if (error) throw new Error(`Failed to get folders: ${error.message}`);
        return data || [];
    }

    static async upsertFolder(folder: Partial<SyncFolder>): Promise<void> {
        const { error } = await getSupabase()
            .from('sync_folders')
            .upsert({
                ...folder,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });

        if (error) throw new Error(`Failed to upsert folder: ${error.message}`);
    }

    static async deleteFolder(id: string): Promise<void> {
        const { error } = await getSupabase()
            .from('sync_folders')
            .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw new Error(`Failed to delete folder: ${error.message}`);
    }

    // Feeds
    static async getFeeds(since?: Date): Promise<SyncFeed[]> {
        let query = getSupabase()
            .from('sync_feeds')
            .select('*')
            .is('deleted_at', null);

        if (since) {
            query = query.gte('updated_at', since.toISOString());
        }

        const { data, error } = await query;

        if (error) throw new Error(`Failed to get feeds: ${error.message}`);
        return data || [];
    }

    static async upsertFeed(feed: Partial<SyncFeed>): Promise<void> {
        const { error } = await getSupabase()
            .from('sync_feeds')
            .upsert({
                ...feed,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });

        if (error) throw new Error(`Failed to upsert feed: ${error.message}`);
    }

    static async deleteFeed(id: string): Promise<void> {
        const { error } = await getSupabase()
            .from('sync_feeds')
            .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw new Error(`Failed to delete feed: ${error.message}`);
    }

    // Article States
    static async getArticleStates(since?: Date): Promise<SyncArticleState[]> {
        let query = getSupabase()
            .from('sync_article_states')
            .select('*');

        if (since) {
            query = query.gte('updated_at', since.toISOString());
        }

        const { data, error } = await query;

        if (error) throw new Error(`Failed to get article states: ${error.message}`);
        return data || [];
    }

    static async upsertArticleState(state: Partial<SyncArticleState>): Promise<void> {
        const { error } = await getSupabase()
            .from('sync_article_states')
            .upsert({
                ...state,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });

        if (error) throw new Error(`Failed to upsert article state: ${error.message}`);
    }

    // Settings
    static async getSettings(): Promise<SyncSettings | null> {
        const { data, error } = await getSupabase()
            .from('sync_settings')
            .select('*')
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            throw new Error(`Failed to get settings: ${error.message}`);
        }

        return data;
    }

    static async upsertSettings(settingsJson: string): Promise<void> {
        const { data: user } = await getSupabase().auth.getUser();
        if (!user.user) throw new Error('Not authenticated');

        const { error } = await getSupabase()
            .from('sync_settings')
            .upsert({
                user_id: user.user.id,
                settings_json: settingsJson,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        if (error) throw new Error(`Failed to upsert settings: ${error.message}`);
    }
}
