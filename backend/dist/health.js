"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDatabaseHealth = checkDatabaseHealth;
const db_1 = require("./db");
const drizzle_orm_1 = require("drizzle-orm");
async function checkDatabaseHealth() {
    const start = Date.now();
    try {
        // Simple query to test connection
        await db_1.db.execute((0, drizzle_orm_1.sql) `SELECT 1`);
        const latency = Date.now() - start;
        return {
            status: 'healthy',
            database: 'connected',
            latency,
        };
    }
    catch (error) {
        return {
            status: 'unhealthy',
            database: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
//# sourceMappingURL=health.js.map