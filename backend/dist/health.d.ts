export declare function checkDatabaseHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    database: 'connected' | 'disconnected';
    latency?: number;
    error?: string;
}>;
//# sourceMappingURL=health.d.ts.map