import { InvalidScanCursorError } from '../errors/scans.errors.js';

export interface ScanCursor {
  readonly createdAt: Date;
  readonly id: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeScanCursor(cursor: ScanCursor): string {
  return Buffer.from(
    `${cursor.createdAt.toISOString()}|${cursor.id}`,
    'utf8',
  ).toString('base64url');
}

export function decodeScanCursor(value: string): ScanCursor {
  const [timestamp, id, ...rest] = Buffer.from(value, 'base64url')
    .toString('utf8')
    .split('|');
  if (timestamp === undefined || id === undefined || rest.length > 0) {
    throw new InvalidScanCursorError();
  }
  const createdAt = new Date(timestamp);
  if (
    Number.isNaN(createdAt.getTime()) ||
    createdAt.toISOString() !== timestamp ||
    !UUID_PATTERN.test(id)
  ) {
    throw new InvalidScanCursorError();
  }
  return { createdAt, id };
}
