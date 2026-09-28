const encoder = new TextEncoder();

/**
 * Compare secrets without exposing their length or early mismatch timing.
 * Hashing first gives Web Crypto fixed-size values for timingSafeEqual.
 */
export async function timingSafeEqualText(
  provided: string | null | undefined,
  expected: string | null | undefined,
): Promise<boolean> {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

/**
 * Cookie-authenticated writes must originate from this site. Requests without
 * Origin/Referer remain usable for trusted command-line clients; Fetch Metadata
 * still rejects an explicitly cross-site browser request.
 */
export function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (fetchSite === 'cross-site') return false;

  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  if (origin) return origin === requestOrigin;

  const referer = request.headers.get('Referer');
  if (!referer) return true;
  try {
    return new URL(referer).origin === requestOrigin;
  } catch {
    return false;
  }
}
