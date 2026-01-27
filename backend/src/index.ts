import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { routes } from './routes';

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// Register plugins
await app.register(cors, {
  origin: config.CORS_ORIGIN,
  credentials: true,
});

await app.register(rateLimit, {
  max: parseInt(config.RATE_LIMIT_MAX),
  timeWindow: '1 minute',
});

// Register routes
await app.register(routes, { prefix: '/api' });

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Start server
try {
  await app.listen({ port: parseInt(config.PORT), host: '0.0.0.0' });
  app.log.info(`Server listening on port ${config.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
