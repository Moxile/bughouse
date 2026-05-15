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

# Build client (VITE_ vars must be baked in at build time)
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
COPY client ./client
RUN npm --workspace client run build

# Build server
COPY server ./server
RUN npm --workspace server run build

RUN npm prune --omit=dev

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
ENV CLIENT_DIST=/app/client/dist

EXPOSE 3000
WORKDIR /app/server
CMD ["node", "dist/src/index.js"]
