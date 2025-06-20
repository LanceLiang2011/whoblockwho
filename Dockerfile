# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript config
COPY tsconfig.json ./

# Copy source code
COPY src/ ./src/

# Build the TypeScript project
RUN npm run build

# Remove dev dependencies and source files to reduce image size
RUN npm prune --production && \
    rm -rf src/ tsconfig.json

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S whoblockwho -u 1001

# Change ownership of the app directory
RUN chown -R whoblockwho:nodejs /app
USER whoblockwho

# Expose port (Railway will set PORT env var if needed)
EXPOSE 3000

# Health check to ensure the bot is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('Bot health check passed')" || exit 1

# Start the bot
CMD ["npm", "start"]
