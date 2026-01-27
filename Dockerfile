# Dockerfile for ElasticScope
# Multi-stage build for production

# ============================================
# Stage 1: Build frontend
# ============================================
FROM node:25-slim AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . ./

# Build frontend
RUN npm run build

# ============================================
# Stage 2: Production image
# ============================================
FROM node:25-slim AS production

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

# Install production dependencies + tsx (needed for running TS)
RUN npm ci --omit=dev && \
    npm install tsx && \
    npm cache clean --force

# Copy backend source
COPY server ./server

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist ./dist

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
CMD ["npx", "tsx", "server/index.ts"]
