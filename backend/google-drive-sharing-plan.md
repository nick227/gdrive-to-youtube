OAuth only (no manual token entry)  
Per-user DriveConnection records  
Primary scope: drive.file  
Single root folder per connection  
Tokens encrypted at rest  
Connections are disposable (revocable, replaceable)  

Prisma schema (aligns with current DB)
--------------------------------------
// new
model DriveConnection {
  id                String   @id @default(cuid())
  userId            Int
  user              User     @relation(fields: [userId], references: [id])

  driveAccountEmail String
  scopes            String   @db.Text   // space-delimited
  status            DriveConnectionStatus @default(ACTIVE)
  lastError         String?  @db.Text

  rootFolderId      String
  rootFolderName    String
  rootFolderLink    String   @db.Text

  accessToken       String?  @db.Text
  refreshToken      String?  @db.Text
  tokenExpiresAt    DateTime?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  MediaItems        MediaItem[]
  RenderJobs        RenderJob[]
  UploadJobs        UploadJob[]
}

// new
enum DriveConnectionStatus {
  ACTIVE
  ERROR
  REVOKED
}

// optional but recommended; DB-backed state (no in-memory)
model DriveConsentState {
  state             String   @id
  userId            Int
  nonce             String
  redirectAfter     String?  @db.Text
  requestedFolderId String?
  createdAt         DateTime @default(now())
  expiresAt         DateTime
}

Tag existing entities
- MediaItem: add driveConnectionId String? (FK to DriveConnection.id); keep folderPath root-relative.
- UploadJob: add driveConnectionId String?.
- RenderJob: add driveConnectionId String?.

OAuth flow
----------
GET /drive/auth-url
- Requires authenticated user.
- Creates DriveConsentState (state + nonce + optional requestedFolderId).
- Generates OAuth URL with: access_type=offline, prompt=consent, scope=drive.file, state=<stored>.
- Response style: either `{ "url": "..." }` (frontend redirects) or direct HTTP redirect; pick one and stay consistent (YouTube route currently redirects).

GET /drive/callback
- Validate state from DB + expiration; delete state after use.
- Exchange code -> tokens.
- Call drive.about.get({ fields: "user(emailAddress)" }) to capture driveAccountEmail.
- Resolve root folder:
  - If requestedFolderId: files.get to verify it’s a folder and accessible.
  - Else: files.create({ mimeType: "application/vnd.google-apps.folder" }).
- Upsert DriveConnection for that user (refresh/replace tokens, reset status/lastError).
- Redirect to frontend with connectionId.

Routes (final set)
------------------
GET    /drive/auth-url
GET    /drive/callback
GET    /drive/connections
PATCH  /drive/connections/:id/folder      // validate folder id/link with user tokens
DELETE /drive/connections/:id             // soft revoke: status=REVOKED, null tokens
POST   /drive/connections/:id/refresh     // manual refresh attempt
POST   /drive/connections/:id/folders     // create child folder under root
POST   /drive/folder/resolve              // normalize/validate pasted folder id/link

Route rules
- All routes require session auth and validate connection.userId === current user.
- Tokens never leave backend or responses.

Token handling (Node)
---------------------
getDriveClient(driveConnectionId) {
  if (tokenExpiresAt < now + 60s) refresh
  if refresh fails -> status = ERROR (or REVOKED on invalid_grant)
  return google.drive({ auth })
}
- Retry refresh on 401/invalid_grant; set status REVOKED on invalid_grant, else ERROR + lastError.

Upload / render integration
---------------------------
uploadMp4ToDrive({ driveConnectionId, localPath, folderPath? })
- Load DriveConnection, get Drive client.
- Resolve target folder: rootFolderId (+ optional folderPath).
- Upload; on failure set status = ERROR and persist lastError.

Sync worker (syncDrive.ts)
--------------------------
- Query DriveConnection where status = ACTIVE.
- Loop connections independently (no shared auth).
- Sync with that user’s tokens (or explicitly keep the current service-account read mode if desired).
- Stamp mediaItem.driveConnectionId = connection.id.
- If refresh fails: mark connection ERROR and continue.

Folder resolution helper (UI-safe)
----------------------------------
POST /drive/folder/resolve
- Input: { "folder": "<url-or-id>" }
- Normalize to ID; files.get; ensure mimeType = folder; ensure accessible with user tokens.
- Output: { id, name, link }

Scope policy (explicit)
Need                         Scope
Upload + manage app files    drive.file
Browse arbitrary folders     drive (avoid unless required)
Rule: if scopes change, force re-auth and replace connection.
