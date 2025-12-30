# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S grantready -u 1001

# Install runtime dependencies
RUN apk add --no-cache curl

# Copy from builder
COPY --from=builder --chown=grantready:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=grantready:nodejs /app/dist ./dist
COPY --from=builder --chown=grantready:nodejs /app/package.json ./package.json
COPY --from=builder --chown=grantready:nodejs /app/prisma ./prisma

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs
RUN chown -R grantready:nodejs /app/uploads /app/logs
md
# Switch to non-root user
USER grantready

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/index.js"].
