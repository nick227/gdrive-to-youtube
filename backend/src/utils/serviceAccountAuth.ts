import path from 'node:path';
import { google } from 'googleapis';

/**
 * Builds a GoogleAuth client using either a file path (legacy) or a JSON
 * string provided via the GOOGLE_APPLICATION_CREDENTIALS env var.
 */
export function getServiceAccountAuth(scopes: string[]) {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!raw) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set');
  }

  const trimmed = raw.trim();
  const useInlineJson = trimmed.startsWith('{');

  return new google.auth.GoogleAuth({
    ...(useInlineJson
      ? { credentials: JSON.parse(trimmed) }
      : { keyFile: path.resolve(trimmed) }),
    scopes,
  });
}
