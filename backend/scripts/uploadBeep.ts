// uploadBeep.ts
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { getDriveWriteClient } from '../src/rendering/driveClients';

dotenv.config();

function runFfmpeg(outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=1',
      '-ac',
      '2',
      '-ar',
      '48000',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '4',
      outputPath,
    ];

    const ff = spawn('ffmpeg', args);
    ff.stderr.on('data', (d) => process.stderr.write(d));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

async function main() {
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error('DRIVE_FOLDER_ID must be set to upload the test file');
  }

  const drive = getDriveWriteClient();

  const folderMeta = await drive.files.get({
    fileId: folderId,
    fields: 'id,name,driveId,capabilities/canAddChildren,parents',
    supportsAllDrives: true,
  });

  if (folderMeta.data.capabilities?.canAddChildren === false) {
    throw new Error(
      `Service account cannot add files to folder ${folderId}. Ensure it is a member of the shared drive with Content Manager or higher.`
    );
  }

  const tmpPath = path.join(os.tmpdir(), `beep-${Date.now()}.mp3`);
  console.log(`[beep] Generating test audio at ${tmpPath}`);
  await runFfmpeg(tmpPath);

  console.log(`[beep] Uploading to Drive folder ${folderId}...`);
  const res = await drive.files.create({
    requestBody: {
      name: 'beep.mp3',
      parents: [folderId],
    },
    media: {
      mimeType: 'audio/mpeg',
      body: fs.createReadStream(tmpPath),
    },
    supportsAllDrives: true,
    fields: 'id,name,parents',
  });

  console.log('[beep] Uploaded file:', res.data);
}

main().catch((err) => {
  console.error('[beep] Failed:', err);
  process.exit(1);
});
