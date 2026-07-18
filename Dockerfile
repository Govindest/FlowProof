FROM mcr.microsoft.com/playwright:v1.55.0-noble

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NODE_ENV=production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/demo-suite/package.json apps/demo-suite/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/fixtures/package.json packages/fixtures/package.json
COPY packages/github/package.json packages/github/package.json
COPY prisma/schema.prisma prisma/schema.prisma
COPY scripts/postinstall.ts scripts/postinstall.ts

RUN NODE_ENV=development DATABASE_URL=file:/tmp/flowproof-build.db pnpm install --frozen-lockfile

COPY . .

RUN DATABASE_URL=file:/tmp/flowproof-build.db pnpm prisma generate && pnpm --filter @flowproof/demo-suite build
RUN mkdir -p /data/artifacts

EXPOSE 8080

CMD ["./node_modules/.bin/tsx", "scripts/start-railway.ts"]
