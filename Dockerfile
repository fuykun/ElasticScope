# Dockerfile for ElasticScope
# Multi-stage build for production

# ============================================
# Stage 1: Build Next.js app
# ============================================
FROM node:20-slim AS app-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . ./

# Build Next.js application
RUN npm run build

# ============================================
# Stage 2: Production image
# ============================================
FROM node:20-slim AS production

WORKDIR /app

# Install dumb-init and wget for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 elasticscope && \
    useradd -r -u 1001 -g elasticscope elasticscope

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built Next.js app and server-side modules
COPY --from=app-builder /app/.next ./.next
COPY --from=app-builder /app/public ./public
COPY --from=app-builder /app/next.config.mjs ./next.config.mjs
COPY --from=app-builder /app/server ./server

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R elasticscope:elasticscope /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/data

# Switch to non-root user
USER elasticscope

# Expose ports
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/status || exit 1

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]
