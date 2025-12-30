import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Memory {
  id?: string;
  user_id: string;
  session_id: string;
  content: string;
  metadata?: any;
  embedding?: number[];
  created_at?: string;
  updated_at?: string;
}

export interface Session {
  id?: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  duration?: number;
  transcript?: string;
  metadata?: any;
}

export interface UserProfile {
  id?: string;
  name?: string;
  age?: number;
  condition?: string;
  hotwords?: string[];
  preferences?: any;
  created_at?: string;
  updated_at?: string;
}

export class SupabaseService {
  private client: SupabaseClient;
  private static instance: SupabaseService;

  private constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables: SUPABASE_URL, SUPABASE_ANON_KEY');
    }

    this.client = createClient(supabaseUrl, supabaseAnonKey);
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // === User Profiles ===
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.client
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
    return data;
  }

  async createUserProfile(profile: UserProfile): Promise<UserProfile | null> {
    const { data, error } = await this.client
      .from('user_profiles')
      .insert(profile)
      .select()
      .single();

    if (error) {
      console.error('Error creating user profile:', error);
      return null;
    }
    return data;
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const { data, error } = await this.client
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return null;
    }
    return data;
  }

  // === Sessions ===
  async createSession(session: Session): Promise<Session | null> {
    const { data, error } = await this.client
      .from('sessions')
      .insert(session)
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return null;
    }
    return data;
  }

  async endSession(sessionId: string, endTime: string, transcript?: string): Promise<Session | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const duration = Math.floor((new Date(endTime).getTime() - new Date(session.start_time).getTime()) / 1000);

    const { data, error } = await this.client
      .from('sessions')
      .update({ end_time: endTime, duration, transcript })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error ending session:', error);
      return null;
    }
    return data;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const { data, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('Error fetching session:', error);
      return null;
    }
    return data;
  }

  async getUserSessions(userId: string, limit: number = 10): Promise<Session[]> {
    const { data, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user sessions:', error);
      return [];
    }
    return data || [];
  }

  // === Memories ===
  async addMemory(memory: Memory): Promise<Memory | null> {
    const { data, error } = await this.client
      .from('memories')
      .insert(memory)
      .select()
      .single();

    if (error) {
      console.error('Error adding memory:', error);
      return null;
    }
    return data;
  }

  async getMemories(userId: string, limit: number = 50): Promise<Memory[]> {
    const { data, error } = await this.client
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching memories:', error);
      return [];
    }
    return data || [];
  }

  async searchMemories(userId: string, query: string, limit: number = 10): Promise<Memory[]> {
    // TODO: Implement semantic search with pgvector
    // For now, simple text search
    const { data, error } = await this.client
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .textSearch('content', query)
      .limit(limit);

    if (error) {
      console.error('Error searching memories:', error);
      return [];
    }
    return data || [];
  }

  async updateMemory(memoryId: string, updates: Partial<Memory>): Promise<Memory | null> {
    const { data, error } = await this.client
      .from('memories')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', memoryId)
      .select()
      .single();

    if (error) {
      console.error('Error updating memory:', error);
      return null;
    }
    return data;
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    const { error } = await this.client
      .from('memories')
      .delete()
      .eq('id', memoryId);

    if (error) {
      console.error('Error deleting memory:', error);
      return false;
    }
    return true;
  }

  // === Hotwords Extraction ===
  async extractHotwords(userId: string): Promise<string[]> {
    // Get user sessions
    const sessions = await this.getUserSessions(userId, 20);
    
    // Simple frequency-based hotword extraction
    const wordFreq: { [key: string]: number } = {};
    
    sessions.forEach(session => {
      if (!session.transcript) return;
      
      // Tokenize Chinese text (simple character-based for now)
      const words = session.transcript.match(/[\u4e00-\u9fa5]+/g) || [];
      words.forEach(word => {
        if (word.length >= 2 && word.length <= 4) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
    });

    // Sort by frequency and return top 20
    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word);
  }

  // === Analytics ===
  async getUserStats(userId: string): Promise<any> {
    const sessions = await this.getUserSessions(userId, 100);
    const memories = await this.getMemories(userId, 1000);

    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

    return {
      total_sessions: totalSessions,
      total_duration_seconds: totalDuration,
      avg_session_duration_seconds: avgDuration,
      total_memories: memories.length,
      last_session: sessions[0]?.start_time || null,
    };
  }
}

export default SupabaseService.getInstance();
