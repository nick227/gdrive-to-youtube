import dotenv from 'dotenv';
import { google } from 'googleapis';
import path from 'node:path';
import process from 'node:process';

dotenv.config();

async function main() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const folderId = process.env.DRIVE_FOLDER_ID;

  if (!keyPath) {
    console.error('Missing GOOGLE_APPLICATION_CREDENTIALS in .env');
    process.exit(1);
  }

  if (!folderId) {
    console.error('Missing DRIVE_FOLDER_ID in .env');
    process.exit(1);
  }

  const resolvedKeyPath = path.resolve(keyPath);

  console.log('Using service account key at:', resolvedKeyPath);
  console.log('Listing files in Drive folder:', folderId);
  console.log('');

  const auth = new google.auth.GoogleAuth({
    keyFile: resolvedKeyPath,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const client = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: client });

  let pageToken = undefined;
  let totalCount = 0;

  try {
    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
        pageSize: 50,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = res.data.files || [];

      if (files.length === 0 && !pageToken) {
        console.log('No files found in this folder. Make sure the folder ID is correct and shared with the service account.');
        break;
      }

      for (const file of files) {
        totalCount++;
        const size = file.size ? `${file.size} bytes` : 'unknown size';
        console.log(
          `${totalCount}. ${file.name} (${file.id})\n` +
          `   mimeType: ${file.mimeType}\n` +
          `   size: ${size}\n` +
          `   modified: ${file.modifiedTime}\n`
        );
      }

      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    console.log(`Done. Listed ${totalCount} file(s).`);
  } catch (err) {
    console.error('Error while listing files from Google Drive:');
    console.error(err);
    process.exit(1);
  }
}

main();
