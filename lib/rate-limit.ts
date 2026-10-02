/**
 * Rate limit ligero en memoria por IP, para que un solo cliente no agote la cuota
 * de la UNISWAP_API_KEY. Es "best-effort": vive en el proceso del servidor, así que
 * en un despliegue serverless con múltiples instancias (Vercel) el límite real es
 * "N por instancia", no un límite global estricto. Suficiente para frenar abuso
 * accidental o scripts simples en el MVP; si se necesita un límite global exacto,
 * habría que moverlo a un store compartido (ej. Upstash Redis).
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const MAX_TRACKED_KEYS = 10_000;

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [k, b] of buckets) {
      if (now - b.windowStart >= WINDOW_MS) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - bucket.windowStart) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}
