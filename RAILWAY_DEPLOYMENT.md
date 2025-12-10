# Railway Deployment Guide

## Overview
This project is configured to serve both frontend and backend from a single Railway service.

## Build Process
1. **Frontend**: Next.js builds static export to `frontend/out`
2. **Backend**: TypeScript compiles and copies frontend to `backend/public`
3. **Server**: Express serves static files from `backend/public` in production

## Railway Configuration

### Required Environment Variables

#### Database
- `DATABASE_URL` - MySQL connection string (Railway provides this if you add a MySQL service)

#### Google OAuth (Backend)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth callback URL (e.g., `https://your-app.railway.app/auth/google/callback`)
- `SESSION_SECRET` - Random secret for session encryption

#### Google Drive (Service Account)
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account JSON (or use env vars)
- `DRIVE_FOLDER_ID` - Google Drive folder ID to sync from

#### Google Drive (OAuth for Uploads)
- `DRIVE_CLIENT_ID` - Google OAuth client ID for Drive
- `DRIVE_CLIENT_SECRET` - Google OAuth client secret for Drive
- `DRIVE_REDIRECT_URI` - OAuth callback URL for Drive
- `DRIVE_OAUTH_TOKENS` - JSON string of OAuth tokens
- `DRIVE_FOLDER_ID` - Output folder ID for rendered videos

#### Frontend
- `NEXT_PUBLIC_BACKEND_URL` - Backend URL (set to Railway app URL)
- `FRONTEND_URL` - Frontend URL (set to Railway app URL)

#### Server
- `NODE_ENV` - Set to `production`
- `PORT` - Railway automatically sets this (defaults to 4000)

### Setup Steps

1. **Create Railway Project**
   - Connect your GitHub repository
   - Railway will auto-detect the `nixpacks.toml` configuration

2. **Add MySQL Database**
   - Add MySQL service in Railway
   - Railway will provide `DATABASE_URL` automatically

3. **Run Prisma Migrations**
   - In Railway, add a one-time command: `cd backend && npx prisma migrate deploy`
   - Or run manually after first deploy

4. **Set Environment Variables**
   - Add all required environment variables listed above
   - For `DRIVE_OAUTH_TOKENS`, use a JSON string like: `{"access_token":"...","refresh_token":"..."}`

5. **Deploy**
   - Railway will automatically:
     - Install dependencies (`npm install` in frontend and backend)
     - Build frontend (`npm run build` in frontend)
     - Generate Prisma client and build backend (`npm run build` in backend)
     - Start server (`npm start` from root, which runs `cd backend && npm start`)

## Important Notes

- **Scheduler**: The job scheduler automatically starts in production mode (see `backend/src/server.ts`)
- **Static Files**: Frontend is built as static export and served by Express
- **API Routes**: All API routes are served before the static frontend catch-all
- **Port**: Railway sets `PORT` automatically - the app uses `process.env.PORT || 4000`

## Troubleshooting

- **Frontend not loading**: Check that `backend/public` directory exists after build
- **Database errors**: Ensure `DATABASE_URL` is set and migrations are run
- **OAuth not working**: Verify redirect URIs match your Railway app URL
- **Jobs not processing**: Check that scheduler started (look for logs: "Job scheduler started")
