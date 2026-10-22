# Academic Curriculum Portal — production image (README §10).
# One container: Express serves the API (/api) and the built React app.
# Stages: deps → build → app

FROM node:24-bookworm-slim AS deps
ENV HUSKY=0
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY backend/prisma backend/prisma
COPY backend/prisma.config.js backend/
# Installs every workspace; the backend's postinstall generates the Prisma client.
RUN npm ci --no-audit --no-fund

# --- Build the React app, then drop development-only packages ---------------------------------
FROM deps AS build
COPY . .
RUN npm run build -w frontend \
 && npm prune --omit=dev --no-audit --no-fund

# --- Runtime --------------------------------------------------------------------------------------
FROM node:24-bookworm-slim AS app
ENV NODE_ENV=production PORT=4000 HUSKY=0
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/backend ./backend
COPY --from=build --chown=node:node /app/frontend/package.json ./frontend/package.json
COPY --from=build --chown=node:node /app/frontend/dist ./frontend/dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/me').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/src/server.js"]
