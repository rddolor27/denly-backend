/**
 * `CORS_ORIGINS` is a comma-separated list of exact browser origins. Entries are compared
 * byte-for-byte with the `Origin` request header, so each one must already be in the form a
 * browser sends: scheme + host (+ non-default port), lowercase, no path, query, fragment or
 * trailing slash. Anything else would silently never match, so it fails at boot instead.
 */
export function splitCorsOrigins(raw: string | undefined): readonly string[] {
  if (raw === undefined) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Why `entry` is not an acceptable origin, or `undefined` when it is. */
export function describeInvalidCorsOrigin(entry: string): string | undefined {
  if (entry === '*') {
    return 'wildcard "*" is not allowed; list exact origins';
  }

  let url: URL;
  try {
    url = new URL(entry);
  } catch {
    return `"${entry}" is not a URL`;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return `"${entry}" must use http or https`;
  }
  if (url.origin !== entry) {
    return `"${entry}" is not a bare origin (no path, query, trailing slash, credentials or default port; lowercase host); expected "${url.origin}"`;
  }
  return undefined;
}
