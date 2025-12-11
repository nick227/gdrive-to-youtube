import path from 'node:path';
import { google } from 'googleapis';

export function getServiceAccountAuth(scopes: string[]) {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!raw) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set');
  }

  let trimmed = raw.trim();

  // 1) If it looks like a file path (no leading '{' or '"'), use keyFile
  if (!trimmed.startsWith('{') && !trimmed.startsWith('"')) {
    return new google.auth.GoogleAuth({
      keyFile: path.resolve(trimmed),
      scopes,
    });
  }

  // 2) If it starts with a quote, it's probably JSON-stringified JSON: "\"{...}\""
  //    or escaped JSON starting with \"...\", so unwrap then unescape.
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    trimmed = JSON.parse(trimmed); // unwrap outer quotes
  }

  // 3) Handle escaped JSON strings that start with a backslash (e.g. \"{...}\")
  if (trimmed.startsWith('\\')) {
    trimmed = trimmed.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  // 4) Now trimmed should be a raw JSON object string: "{...}"
  const credentials: any = JSON.parse(trimmed);

  // Ensure private_key has real newlines (in case they are escaped)
  if (typeof credentials.private_key === 'string') {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes,
  });
}
