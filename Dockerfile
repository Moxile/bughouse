FROM node:22-alpine AS base
# Build tools — better-sqlite3 normally has a musl prebuild, but if one is
# ever missing for the target arch this lets npm fall back to source compile
# instead of failing the build with an opaque gyp error.
RUN apk add --no-cache python3 make g++
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

# Strip dev deps so the runtime image only carries production deps. Keeps
# the native better-sqlite3 binding already compiled/installed for this arch.
RUN npm prune --omit=dev

# Production image — no npm install, just copies the pruned node_modules and
# built artifacts from the builder. Avoids re-downloading the native module
# and avoids needing build tools in the final image.
FROM node:22-alpine
WORKDIR /app
COPY --from=base /app/package.json /app/package-lock.json* ./
COPY --from=base /app/shared/package.json ./shared/
COPY --from=base /app/server/package.json ./server/
COPY --from=base /app/client/package.json ./client/
COPY --from=base /app/node_modules ./node_modules

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
