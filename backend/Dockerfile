FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# 1. Copy common package
COPY packages/common ./packages/common

# 2. Build common package
WORKDIR /usr/src/app/packages/common
RUN npm install
RUN npm run build

# 3. Setup backend
WORKDIR /usr/src/app/backend
COPY backend/package*.json ./

# 4. Install backend dependencies
RUN npm install

# 5. Copy backend source and build
COPY backend/ .
RUN npm run build

# --- Production Stage ---
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy built common package (required for symlinks)
COPY --from=builder /usr/src/app/packages/common ./packages/common

# Setup backend
WORKDIR /usr/src/app/backend

# Copy built backend files
COPY --from=builder /usr/src/app/backend/dist ./dist
COPY --from=builder /usr/src/app/backend/package*.json ./
COPY --from=builder /usr/src/app/backend/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

CMD ["node", "dist/index.js"]
