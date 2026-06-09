<img alt="chattyboi" src="app/(chat)/opengraph-image.png">
<h1 align="center">chattyboi</h1>

<p align="center">
    chattyboi is a self-hosted AI chat app built with Next.js, Auth.js, PostgreSQL, Redis, and the AI SDK.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deployment"><strong>Deployment</strong></a>
</p>
<br/>

## Features

- [Next.js](https://nextjs.org) App Router
- [AI SDK](https://ai-sdk.dev/docs/introduction) with unified API for LLMs
- [shadcn/ui](https://ui.shadcn.com) components with [Tailwind CSS](https://tailwindcss.com)
- [Neon Serverless Postgres](https://vercel.com/marketplace/neon) for chat history and user data
- [Vercel Blob](https://vercel.com/storage/blob) for file storage
- [Auth.js](https://authjs.dev) authentication

## Model Providers

This template uses the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) to access multiple AI models through a unified interface. Models are configured in `lib/ai/models.ts` with per-model provider routing. Included models: Mistral, Moonshot, DeepSeek, OpenAI, and xAI.

Additional providers (OpenCodeGo, OpenRouter) are configured directly in `lib/ai/providers.ts`.

## Deployment

chattyboi is deployed via **Docker Compose**. Images are built automatically by **GitHub Actions** and pushed to **GitHub Container Registry (GHCR)**.

### Prerequisites

- A GitHub account
- [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) on your server
- A GitHub Personal Access Token (classic) with `read:packages` scope

### Setup

**1. Fork this repository**

**2. Run the GitHub Actions workflow**

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds a multi-arch Docker image and pushes it to GHCR. No GitHub Secrets configuration is needed — the workflow uses the built-in `GITHUB_TOKEN`.

**3. Create your environment file**

```bash
cp .env.example .env
```

Edit `.env` with your API keys and secrets. See the comments in `.env.example` for details.

**4. Login to GHCR on your server**

```bash
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

**5. Set the image in `.env`**

```bash
CHATTYBOI_IMAGE=ghcr.io/YOUR_GITHUB_USERNAME/chattyboi:latest
```

**6. Start the services**

```bash
docker compose up -d
```

The app will be available at `http://localhost:3232`.

### Fixing an existing Postgres volume

Postgres only applies `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` when its data directory is first initialized. If the app logs `Role "chattyboi" does not exist`, your existing `pgdata` volume was created with different credentials.

For an empty database, the simplest fix is to recreate the Postgres volume:

```bash
docker compose down
docker volume rm chattyboi_pgdata
docker compose up -d
```

If you need to keep existing data, create the missing role and grant it access instead:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE ROLE chattyboi WITH LOGIN PASSWORD '\''change-me'\'';"'
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "GRANT ALL PRIVILEGES ON DATABASE chattyboi TO chattyboi;"'
```

### Updating

```bash
docker compose pull
docker compose up -d
docker image prune -f
```

### Local Docker Build

To build the app image from your local checkout instead of pulling from GHCR:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```
