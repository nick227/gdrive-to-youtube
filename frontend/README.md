# Frontend (Next.js)

Minimal Next.js app that talks to the backend:

- Fetches media from `GET /media`
- Fetches upload jobs from `GET /upload-jobs`
- Displays them in simple tables.

## Setup

1. Install deps:

   ```bash
   cd frontend
   npm install
   ```

2. Configure backend URL:

   ```bash
   cp .env.example .env.local
   ```

   Set:

   ```env
   NEXT_PUBLIC_BACKEND_URL="http://localhost:4000"
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

Visit `http://localhost:3000`.

Make sure the backend is running and your DB + Drive sync are configured.
