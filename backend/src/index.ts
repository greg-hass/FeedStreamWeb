import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { routes } from './routes';
import { checkDatabaseHealth } from './health';

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

async function start() {
  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: parseInt(config.RATE_LIMIT_MAX),
    timeWindow: '1 minute',
  });

  await app.register(routes, { prefix: '/api' });

  app.get('/health', async () => {
    const dbHealth = await checkDatabaseHealth();
    
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
    await app.listen({ port: parseInt(config.PORT), host: '0.0.0.0' });
    app.log.info(`Server listening on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
