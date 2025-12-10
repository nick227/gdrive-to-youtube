# Railway Deployment Plan

## Overview
- Repo is already linked to Railway via GitHub. Build once at the monorepo root so the frontend static export is copied into `backend/public` during the backend build.
- Runtime should only need the backend; the exported frontend is served from `backend/public`.
- Use Railway MySQL (or another SQL) for `DATABASE_URL` and run Prisma migrations before first traffic.

## Build & Start Commands
- Build command (root): `npm ci && npm run build`
- Start command (from root): `cd backend && npm start`
  - `npm run build` already runs `npm run build:frontend` (Next.js export to `frontend/out`) then `npm run build:backend` (TS compile + copy `frontend/out` into `backend/public`).

## Environment Variables (Railway)
Set these in the Railway service. Mark secrets as private.
- `NODE_ENV=production`
- `PORT` (Railway provides; app also reads `SERVER_PORT`/`PORT`)
- `DATABASE_URL` (Railway MySQL URL)
- `SESSION_SECRET` (>=32 chars random)
- `FRONTEND_URL` (Railway domain for the app, e.g., `https://<project>.up.railway.app`)
- `AUTH_CALLBACK_URL` (e.g., `https://<project>.up.railway.app/auth/google/callback`)
- Google Drive service account
  - `GOOGLE_APPLICATION_CREDENTIALS` (path to the service account JSON written at deploy time, e.g., `/app/backend/credentials/service-account.json`)
  - `DRIVE_FOLDER_ID` (target Drive folder)
- Drive OAuth (for upload/render workers)
  - `DRIVE_CLIENT_ID`
  - `DRIVE_CLIENT_SECRET`
  - `DRIVE_REDIRECT_URI` (Railway callback URL, e.g., `https://<project>.up.railway.app/oauth2callback`)
  - `DRIVE_OAUTH_TOKENS` (JSON string with access/refresh tokens)
- YouTube API
  - `YOUTUBE_APPLICATION_CREDENTIALS` (path to the YouTube OAuth client JSON written at deploy time, e.g., `/app/backend/credentials/youtube-client.json`)
  - `YOUTUBE_CLIENT_ID`
  - `YOUTUBE_CLIENT_SECRET`
  - `YOUTUBE_REDIRECT_URI` (e.g., `https://<project>.up.railway.app/channels/callback`)
- Frontend build needs only `NEXT_PUBLIC_BACKEND_URL` (same domain as `FRONTEND_URL`). Set this as a Railway variable so the build picks it up.

### Handling JSON Credentials on Railway
Because the code expects file paths, write JSON secrets to disk during deploy:
1) Add Railway variables:
   - `GOOGLE_CREDS_JSON` = contents of the service account JSON
   - `YOUTUBE_CREDS_JSON` = contents of the YouTube OAuth client JSON
2) Add a `prestart` command in Railway (or prepend the start command) to materialize files:
   - `powershell -Command "New-Item -ItemType Directory -Force backend/credentials; Set-Content -Path backend/credentials/service-account.json -Value $env:GOOGLE_CREDS_JSON; Set-Content -Path backend/credentials/youtube-client.json -Value $env:YOUTUBE_CREDS_JSON"`
   - Ensure `GOOGLE_APPLICATION_CREDENTIALS` and `YOUTUBE_APPLICATION_CREDENTIALS` point to those paths.

## One-Time Setup
1) Connect the Railway service to the GitHub repo (already linked per context) and select the default branch.
2) Set all environment variables above. Verify callback URLs match your Railway domain and OAuth console settings.
3) Provision a Railway MySQL instance (or external DB) and paste its `DATABASE_URL`.
4) Deploy once to build artifacts.

## Database Migrations
- After the first successful build, run migrations on Railway:
  - `railway run "cd backend && npx prisma migrate deploy"`
- Confirm tables exist: `railway connect mysql` ? `SHOW TABLES;` (or use a DB client with the provided URL).

## Ongoing Operations
- Deploys trigger automatically on GitHub pushes to the selected branch.
- For schema changes: commit Prisma schema, then after deploy run `railway run "cd backend && npx prisma migrate deploy"`.
- Rotate secrets (SESSION_SECRET, OAuth tokens) as needed via Railway variables and redeploy.
