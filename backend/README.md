# Backend (Node + Express + TypeScript + Prisma + MySQL)

This backend powers the YouTube upload manager:

- MySQL + Prisma schema for users, channels, media, upload jobs, render jobs.
- Google Drive sync worker to mirror a shared folder into `MediaItem`.
- YouTube OAuth2 authentication flow for channel management.
- YouTube Data API integration for video uploads.
- Upload job processing worker that downloads from Drive and uploads to YouTube.
- Simple REST API for the Next.js frontend.

## Quick start

1. Install deps:

   ```bash
   cd backend
   npm install
   ```

2. Configure `.env`:

   ```bash
   cp .env.example .env
   ```

   Required variables:
   - `DATABASE_URL` - MySQL connection string (e.g., `mysql://root@localhost:3306/media_drive`)
   - `GOOGLE_APPLICATION_CREDENTIALS` - Path to Google Drive service account JSON key
   - `DRIVE_FOLDER_ID` - Google Drive folder ID to sync from
   
   YouTube OAuth (choose one method):
   - Option 1: `YOUTUBE_APPLICATION_CREDENTIALS` - Path to OAuth2 JSON credentials file (recommended)
   - Option 2: `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` - Individual OAuth2 credentials
   
   Optional variables:
   - `YOUTUBE_REDIRECT_URI` - OAuth callback URL (default: `http://localhost:4000/channels/callback`)
     Note: This must match the redirect URI configured in your Google Cloud Console
   
   Optional variables:
   - `SERVER_PORT` - Backend server port (default: 4000)
   - `FRONTEND_URL` - Frontend URL for CORS and OAuth redirects (default: `http://localhost:3000`)

3. Run Prisma:

   ```bash
   npx prisma generate
   npm run prisma:migrate
   ```

4. Sync media from Drive:

   ```bash
   npm run worker:sync-drive
   ```

5. Run the API server:

   ```bash
   npm run dev
   ```

API Endpoints:

- `GET /health` - Health check
- `GET /media` - List media items from Drive
- `GET /upload-jobs` - List upload jobs
- `POST /upload-jobs` - Create new upload job
- `GET /videos` - List uploaded YouTube videos
- `GET /channels` - List YouTube channels
- `GET /channels/:id` - Get channel details
- `GET /channels/auth-url?userId=1` - Get OAuth authorization URL
- `GET /channels/callback` - OAuth callback handler

6. Process upload jobs:

   ```bash
   npm run worker:upload-jobs
   ```

   This worker:
   - Finds PENDING upload jobs that are ready to process
   - Downloads video files from Google Drive
   - Uploads videos to YouTube using the YouTube Data API
   - Creates YoutubeVideo records on success
   - Updates job status (RUNNING → SUCCESS/FAILED)
