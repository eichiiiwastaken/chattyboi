FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec next build
RUN pnpm exec esbuild lib/db/migrate.ts --bundle --platform=node --format=cjs --outfile=dist/migrate.cjs

FROM base AS run
RUN apk add --no-cache curl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/dist/migrate.cjs ./dist/migrate.cjs
COPY --from=build /app/lib/db/migrations ./lib/db/migrations
EXPOSE 3232
CMD ["sh", "-c", "node dist/migrate.cjs && node server.js"]
