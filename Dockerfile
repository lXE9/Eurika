# =====================================================
# Multi-Stage Dockerfile für IT-Problems Tracker Backend
# Optimiert für Production mit kleiner Image-Größe
# =====================================================

# ==================== Stage 1: Builder ====================
FROM node:20-slim AS builder

# Build-Argumente
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Arbeitsverzeichnis
WORKDIR /app

# Package-Dateien kopieren (für Layer-Caching)
COPY package*.json ./

# Dependencies installieren (nur production)
RUN npm ci --only=production && \
    npm cache clean --force

# Anwendungscode kopieren
COPY . .

# ==================== Stage 2: Runner ====================
FROM node:20-slim AS runner

# Metadata
LABEL maintainer="IT-Problems Tracker"
LABEL version="2.0.0"
LABEL description="Backend API mit Semantic Search"

# System-Dependencies für ONNX Runtime installieren
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Non-root User erstellen (Security)
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs

# Arbeitsverzeichnis
WORKDIR /app

# Dependencies von Builder kopieren
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Anwendungscode kopieren
COPY --chown=nodejs:nodejs . .

# Logs-Verzeichnis erstellen
RUN mkdir -p logs && \
    chown -R nodejs:nodejs logs

# Environment
ENV NODE_ENV=production \
    PORT=3000

# User wechseln (Security)
USER nodejs

# Port exposieren
EXPOSE 3000

# Health-Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health/live', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start-Command
CMD ["node", "server.js"]
