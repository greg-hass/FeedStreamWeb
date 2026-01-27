# FeedStream Dockge Deployment Guide

## Prerequisites

1. GitHub repository with the code
2. GitHub Container Registry enabled
3. Dockge installed on your Ubuntu server
4. Tailscale configured on your server

## Setup Steps

### 1. Configure GitHub Repository Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these **Repository Secrets**:
- `GITHUB_TOKEN` (already provided by GitHub)

Add these **Repository Variables**:
- `NEXT_PUBLIC_API_URL`: Your Tailscale IP with port 3300 (e.g., `http://100.x.x.x:3300/api`)

### 2. Configure GitHub Actions

The workflow file (`.github/workflows/docker-build.yml`) is already set up.

On push to `main` or tags, it will:
1. Build both API and Web images
2. Push to GitHub Container Registry (ghcr.io)

### 3. On Your Ubuntu Server (Dockge)

1. **Create a new stack in Dockge:**
   ```
   Name: feedstream
   ```

2. **Copy the compose file:**
   Use the contents from `docker-compose.dockge.yml`

3. **Create environment file:**
   In Dockge, go to the stack's "Environment" tab and add:
   
   ```env
   # Database
   DB_PASSWORD=your-secure-password-here
   
   # JWT Secret (generate: openssl rand -base64 32)
   JWT_SECRET=your-jwt-secret-here
   
   # Gemini API Key (from Google AI Studio)
   GEMINI_API_KEY=your-gemini-api-key
   
   # CORS (your Tailscale IP or domain)
   CORS_ORIGIN=http://100.x.x.x:3300
   
   # Rate limiting
   RATE_LIMIT_MAX=100
   
   # GitHub username/repo for image names
   GITHUB_REPOSITORY=yourusername/feedstream
   ```

4. **Update the image names in compose:**
   Replace `${GITHUB_REPOSITORY}` with your actual GitHub username/repo:
   ```yaml
   image: ghcr.io/yourusername/feedstream-api:latest
   image: ghcr.io/yourusername/feedstream-web:latest
   ```

5. **Deploy:**
   Click "Deploy" in Dockge

### 4. First Time Setup

After deployment, run migrations:
```bash
docker exec feedstream-api npx drizzle-kit migrate
```

Or use Dockge's container console to run:
```bash
npx drizzle-kit migrate
```

### 5. Access Your App

- **Web UI**: `http://your-tailscale-ip:3000`
- **API**: `http://your-tailscale-ip:3300`
- **Health Check**: `http://your-tailscale-ip:3300/health`

## Updating

When you push to GitHub:
1. GitHub Actions builds new images
2. In Dockge, click "Pull" to get the latest images
3. Click "Redeploy" to restart with new images

## Troubleshooting

**Images not found:**
- Make sure GitHub Actions completed successfully
- Check that your repository is public or you have GitHub token configured in Dockge

**Database connection errors:**
- Verify `DB_PASSWORD` is set correctly in Dockge environment
- Check that postgres container is running

**CORS errors:**
- Update `CORS_ORIGIN` to match your actual Tailscale IP

## File Structure

```
FeedStreamWeb/
├── .github/
│   └── workflows/
│       └── docker-build.yml    # GitHub Actions workflow
├── backend/
│   ├── Dockerfile              # API Dockerfile
│   └── src/                    # Backend source
├── web/
│   ├── Dockerfile              # Frontend Dockerfile
│   └── src/                    # Frontend source
├── docker-compose.dockge.yml   # Dockge compose file
└── docker-compose.yml          # Local development compose
```
