# Frontend/Backend API Contract Review

## Summary

Several misalignments found between frontend and backend after adding authentication.

---

## Issues Found

### 1. ❌ Auth: Frontend sends `requestedByUserId` but backend ignores it

**Frontend** (`payloadBuilders.ts`):
```typescript
requestedByUserId: 1, // MVP: hardcoded user
```

**Backend** (`uploadJobs.ts`):
```typescript
requestedByUserId: user.id, // Uses session, ignores body
```

**Fix**: Remove `requestedByUserId` from frontend request type and payload builder.

---

### 2. ❌ Missing credentials in fetch calls

**Frontend** protected route calls don't include credentials:
```typescript
// QuickUploadModal.tsx, CreateVideoModal.tsx
fetch(`${backendUrl}/upload-jobs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
}); // Missing credentials: 'include'
```

**Backend** now requires auth:
```typescript
app.use('/upload-jobs', requireAuth, uploadJobRoutes);
app.use('/render-jobs', requireAuth, renderJobRoutes);
```

**Fix**: Add `credentials: 'include'` to all protected route fetch calls.

---

### 3. ❌ useMediaDashboard fetches protected routes without credentials

**Frontend** (`useMediaDashboard.ts`):
```typescript
fetch(`${backendUrl}/upload-jobs`), // No credentials
fetch(`${backendUrl}/render-jobs`), // No credentials
```

**Result**: Returns 401, frontend silently gets empty arrays.

**Fix**: Add `credentials: 'include'` to fetch calls.

---

### 4. ❌ Cancel/Retry routes don't exist on backend

**Frontend** (`page.tsx`):
```typescript
await fetch(`${backendUrl}/upload-jobs/${jobId}`, { method: 'DELETE' });
await fetch(`${backendUrl}/upload-jobs/${jobId}/retry`, { method: 'POST' });
```

**Backend**: These routes don't exist.

**Fix**: Either add backend routes or remove frontend buttons.

---

### 5. ⚠️ Missing User type for /auth/me

**Backend** returns:
```json
{ "id": 1, "email": "user@example.com", "name": "User Name" }
```

**Frontend**: No `User` type or auth state management.

**Fix**: Add `User` interface and auth context (optional for MVP).

---

## API Contract Summary

### Public Routes (no auth)
| Method | Endpoint | Frontend Uses | Status |
|--------|----------|---------------|--------|
| GET | `/health` | No | ✅ |
| GET | `/media` | Yes | ✅ |
| GET | `/channels` | Yes | ✅ |
| GET | `/channels/auth-url?userId=` | Yes | ✅ |
| GET | `/channels/callback` | No (redirect) | ✅ |
| GET | `/channels/:id` | No | ✅ |
| GET | `/videos` | No | ✅ |
| GET | `/auth/me` | No | ✅ |
| GET | `/auth/google` | No | ✅ |
| POST | `/auth/logout` | No | ✅ |

### Protected Routes (require auth + credentials)
| Method | Endpoint | Frontend Uses | Status |
|--------|----------|---------------|--------|
| GET | `/upload-jobs` | Yes | ❌ Missing credentials |
| POST | `/upload-jobs` | Yes | ❌ Missing credentials |
| DELETE | `/upload-jobs/:id` | Yes | ❌ Route doesn't exist |
| POST | `/upload-jobs/:id/retry` | Yes | ❌ Route doesn't exist |
| GET | `/render-jobs` | Yes | ❌ Missing credentials |
| POST | `/render-jobs` | Yes | ❌ Missing credentials |

---

## Required Fixes

### Frontend Changes

1. **`types/api.ts`**: Remove `requestedByUserId` from `CreateUploadJobRequest`
2. **`utils/payloadBuilders.ts`**: Remove `requestedByUserId` from payload
3. **`hooks/useMediaDashboard.ts`**: Add `credentials: 'include'` 
4. **`components/QuickUploadModal.tsx`**: Add `credentials: 'include'`
5. **`components/CreateVideoModal.tsx`**: Add `credentials: 'include'`
6. **`app/page.tsx`**: Remove or disable cancel/retry buttons (routes don't exist)

### Backend Changes (Optional)

1. Add `DELETE /upload-jobs/:id` route (cancel job)
2. Add `POST /upload-jobs/:id/retry` route (retry failed job)

---

## Recommended Fix Order

1. Fix frontend fetch credentials (critical - unblocks testing)
2. Remove requestedByUserId from frontend
3. Decide on cancel/retry feature (add backend routes or remove UI)

