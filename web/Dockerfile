FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app

# 1. Copy common package first
COPY packages/common ./packages/common

# 2. Build common package
WORKDIR /usr/src/app/packages/common
RUN npm install
RUN npm run build

# 3. Setup web dependencies
WORKDIR /usr/src/app/web
COPY web/package.json web/package-lock.json* ./

RUN \
  if [ -f package-lock.json ]; then npm ci; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /usr/src/app

# Copy built common from deps
COPY --from=deps /usr/src/app/packages/common ./packages/common

# Setup web
WORKDIR /usr/src/app/web
COPY --from=deps /usr/src/app/web/node_modules ./node_modules
COPY web/ .

# Disable telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build args
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /usr/src/app/web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /usr/src/app/web/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /usr/src/app/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /usr/src/app/web/.next/static ./.next/static

# Create startup script
USER root
RUN mkdir -p /usr/src/app/web/public && \
    echo '#!/bin/sh' > ./start.sh && \
    echo 'echo "window.__ENV__ = { NEXT_PUBLIC_API_URL: \"${NEXT_PUBLIC_API_URL}\" };" > ./public/env-config.js' >> ./start.sh && \
    echo 'exec node server.js' >> ./start.sh && \
    chmod +x ./start.sh && \
    chown nextjs:nodejs ./start.sh ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["./start.sh"]
