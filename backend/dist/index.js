"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const config_1 = require("./config");
const routes_1 = require("./routes");
const health_1 = require("./health");
const app = (0, fastify_1.default)({
    logger: {
        level: config_1.config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
});
async function start() {
    await app.register(cors_1.default, {
        origin: config_1.config.CORS_ORIGIN,
        credentials: true,
    });
    await app.register(rate_limit_1.default, {
        max: parseInt(config_1.config.RATE_LIMIT_MAX),
        timeWindow: '1 minute',
    });
    await app.register(routes_1.routes, { prefix: '/api' });
    app.get('/health', async () => {
        const dbHealth = await (0, health_1.checkDatabaseHealth)();
        return {
            status: dbHealth.status === 'healthy' ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            services: {
                database: dbHealth,
                api: 'online',
            },
        };
    });
    try {
        await app.listen({ port: parseInt(config_1.config.PORT), host: '0.0.0.0' });
        app.log.info(`Server listening on port ${config_1.config.PORT}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
void start();
//# sourceMappingURL=index.js.map