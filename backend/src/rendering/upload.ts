import fs from 'fs';
import { DriveConnectionStatus } from '@prisma/client';
import { getDriveClientById, markDriveConnectionStatus } from '../utils/driveConnectionClient';

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '');
}

function getTimestampString(date = new Date()): string {
  return date.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

export async function uploadMp4ToDrive(params: {
  driveConnectionId: string;
  localPath: string;
  baseName: string;
  folderPath?: string;
}): Promise<{ id: string; name: string; driveConnectionId: string }> {
  const { driveConnectionId, localPath, baseName } = params;

  const { drive, connection } = await getDriveClientById(driveConnectionId);
  const outputFolderId = connection.rootFolderId;

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
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : String(err);

    const status =
      (err as { response?: { status?: number; data?: { error?: string } } }).response?.data
        ?.error === 'invalid_grant' ||
      (err as { response?: { status?: number } }).response?.status === 401
        ? DriveConnectionStatus.REVOKED
        : DriveConnectionStatus.ERROR;
    await markDriveConnectionStatus(driveConnectionId, status, message);

    throw new Error(`[upload] Drive upload failed: ${message}`);
  }

  const id = res.data.id;
  const name = res.data.name;

  if (!id || !name) {
    throw new Error('Drive file upload did not return id/name');
  }

  console.log(`[upload] Uploaded: id=${id}, name=${name}`);
  return { id, name, driveConnectionId };
}
