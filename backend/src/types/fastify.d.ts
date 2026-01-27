import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      deviceId: string;
      createdAt: Date;
      updatedAt: Date;
    };
  }
}
