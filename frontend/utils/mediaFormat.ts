/**
 * Human-readable byte formatter shared across media views.
 */
export function formatBytes(bytes: string | number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '-?"';
  const num = typeof bytes === 'number' ? bytes : parseInt(bytes, 10);
  if (Number.isNaN(num)) return '-?"';

  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Case-insensitive string comparison used in table sorting.
 */
export function compareString(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}
