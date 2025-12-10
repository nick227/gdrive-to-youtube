// src/getDriveTokens.ts
import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';

// Load backend/.env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function askQuestion(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  const clientId = process.env.DRIVE_CLIENT_ID;
  const clientSecret = process.env.DRIVE_CLIENT_SECRET;
  const redirectUri = process.env.DRIVE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error(
      'Missing OAuth credentials. Check DRIVE_CLIENT_ID, DRIVE_CLIENT_SECRET, DRIVE_REDIRECT_URI in .env'
    );
    process.exit(1);
  }

  console.log('[getDriveTokens] Using OAuth client:');
  console.log('  clientId:', clientId);
  console.log('  redirectUri:', redirectUri);

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });

  console.log('\n=====================================');
  console.log('  OPEN THIS URL IN YOUR BROWSER:');
  console.log('=====================================\n');
  console.log(authUrl);
  console.log('\nAfter approving, Google will redirect you to:');
  console.log('  http://localhost:4000/oauth2callback?code=XXXXX\n');
  console.log('Copy the `code` value and paste it here.\n');

  const code = await askQuestion('Paste the code here: ');

  const { tokens } = await oauth2Client.getToken(code.trim());

  console.log('\n=====================================');
  console.log(' YOUR DRIVE_OAUTH_TOKENS VALUE:');
  console.log('=====================================\n');
  console.log(JSON.stringify(tokens, null, 2));
  console.log('\nAdd this to your .env:\n');
  console.log(`DRIVE_OAUTH_TOKENS='${JSON.stringify(tokens)}'`);

  process.exit(0);
}

main().catch((err: unknown) => {
  // keep it simple but typed
  console.error(err);
  process.exit(1);
});
