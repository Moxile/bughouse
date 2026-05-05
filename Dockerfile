FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm install --frozen-lockfile

# Build shared
COPY shared ./shared
RUN npm --workspace shared run build

# Build client
COPY client ./client
RUN npm --workspace client run build

# Build server
COPY server ./server
RUN npm --workspace server run build

# Production image
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm install --omit=dev --frozen-lockfile

COPY --from=base /app/shared/dist ./shared/dist
COPY --from=base /app/server/dist ./server/dist
COPY --from=base /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=3000
# SERVER_PKG_DIR is the server package directory; used to locate client/dist.
ENV CLIENT_DIST=/app/client/dist

EXPOSE 3000
WORKDIR /app/server
CMD ["node", "dist/src/index.js"]
