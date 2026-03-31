FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# ---

FROM node:22-alpine AS runner

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# Шаблоны и статика копируются из src (не компилируются)
COPY src/web/templates ./dist/web/templates
COPY src/web/static ./dist/web/static

VOLUME ["/app/data"]
EXPOSE 3000

CMD ["node", "dist/index.js"]
