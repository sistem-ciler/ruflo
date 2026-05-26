# Multi-stage build — distroless-inspired minimal image
# Non-root user, read-only filesystem compatible

FROM node:22-slim AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc -p tsconfig.json

FROM node:22-slim AS runner
RUN addgroup --system --gid 1001 csaas && \
    adduser --system --uid 1001 --gid 1001 csaas
WORKDIR /app

COPY --from=builder /app/package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist/ ./dist/

USER csaas

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health/live').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
