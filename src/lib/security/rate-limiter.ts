// Rate limiter ligero en memoria para protección básica contra flooding.
// NOTA: Para producción a gran escala, migrar a @upstash/ratelimit o Redis.
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minuto
const DEFAULT_MAX_REQUESTS = 15; // Límite por IP por minuto

export function checkRateLimit(
  ip: string,
  maxRequests: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }

  record.count += 1;
  return { allowed: true };
}

export function resetRateLimits(): void {
  requestCounts.clear();
}
