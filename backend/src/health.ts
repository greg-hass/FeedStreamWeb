import { db } from './db';

export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  database: 'connected' | 'disconnected';
  latency?: number;
  error?: string;
}> {
  const start = Date.now();
  
  try {
    // Simple query to test connection
    const result = await db.execute({ sql: 'SELECT 1' });
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      database: 'connected',
      latency,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
