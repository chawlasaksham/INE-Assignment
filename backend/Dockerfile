FROM mcr.microsoft.com/playwright:v1.50.1-noble

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose port
EXPOSE 5001

ENV PORT=5001
ENV NODE_ENV=production
ENV HEADLESS=true

CMD ["node", "src/server.js"]
