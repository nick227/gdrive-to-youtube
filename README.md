# YouTube Upload Manager POC (Drive + Backend + Frontend)

This repo contains:

- `backend/` — Node + Express + TypeScript + Prisma + MySQL
- `frontend/` — Next.js app that talks to the backend

Backend:
- Prisma schema for users, YouTube channels, media items, upload jobs, render jobs.
- Google Drive sync worker (service account + shared folder).
- Upload job API + stub worker for YouTube uploads.

Frontend:
- Lists media (synced from Drive).
- Lists upload jobs (created via API / REST client for now).
