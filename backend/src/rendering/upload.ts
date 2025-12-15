import fs from 'fs';
import path from 'path';
import { getDriveServiceClient, getDriveWriteClient } from './driveClients';

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '');
}

function getTimestampString(date = new Date()): string {
  return date.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

export async function uploadMp4ToDrive(
  localPath: string,
  baseName: string
): Promise<{ id: string; name: string }> {
  const outputFolderId = process.env.DRIVE_FOLDER_ID;
  if (!outputFolderId) {
    throw new Error('DRIVE_FOLDER_ID is not set');
  }

  // Use user OAuth for uploads (service accounts cannot write to My Drive).
  const drive = getDriveWriteClient();

  const timestamp = getTimestampString();
  const sanitizedBase = sanitizeFileName(baseName) || 'rendered_video';
  const finalName = `${sanitizedBase}_${timestamp}.mp4`;

  console.log(
    `[upload] Uploading ${localPath} to Drive folder ${outputFolderId} as ${finalName}...`
  );

  const fileMetadata = {
    name: finalName,
    parents: [outputFolderId],
  };

  const media = {
    mimeType: 'video/mp4',
    body: fs.createReadStream(localPath),
  };

  let res;
  try {
    res = await drive.files.create({
      requestBody: fileMetadata,
      media,
      supportsAllDrives: true,
      fields: 'id,name,parents,driveId',
    });
  } catch (err) {
    // Bubble a clearer error when tokens are expired/revoked.
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : String(err);
    throw new Error(
      `[upload] Drive upload failed (check DRIVE_OAUTH_TOKENS): ${message}`
    );
  }

  const id = res.data.id;
  const name = res.data.name;

  if (!id || !name) {
    throw new Error('Drive file upload did not return id/name');
  }

  console.log(`[upload] Uploaded: id=${id}, name=${name}`);
  return { id, name };
}
