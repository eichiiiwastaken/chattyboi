# Deployment Setup

## GitHub Container Registry (GHCR)

Images are built by GitHub Actions on push to `main` and published to `ghcr.io/<owner>/chattyboi`.

### Server Setup

1. **Create a GitHub PAT** at [github.com/settings/tokens](https://github.com/settings/tokens) with `read:packages` scope.

2. **Login to GHCR** on your server:
   ```bash
   echo "YOUR_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
   ```

3. **Prepare the project directory:**
   ```bash
   mkdir -p /opt/chattyboi
   ```

4. **Copy `docker-compose.yml` and `.env.example`** to the server. Rename `.env.example` to `.env` and fill in your secrets.

5. **Set `CHATTYBOI_IMAGE` in `.env`** if you want Compose to pull from GHCR:
   ```bash
   CHATTYBOI_IMAGE=ghcr.io/YOUR_USERNAME/chattyboi:latest
   ```

6. **Deploy:**
   ```bash
   cd /opt/chattyboi
   docker compose pull
   docker compose up -d
   docker image prune -f
   ```

### Optional: Deploy Alias

Add to `~/.bashrc`:
```bash
alias deploy-chatty='cd /opt/chattyboi && docker compose pull && docker compose up -d && docker image prune -f'
```

Then `source ~/.bashrc` and run `deploy-chatty` to update.
