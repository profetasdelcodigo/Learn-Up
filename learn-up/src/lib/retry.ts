export type RetryOptions = {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
};

const circuitBreakers = new Map<string, { failures: number; lastFailure: number }>();
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60000;

export class CircuitBreakerOpenError extends Error {
  constructor(provider: string) {
    super(`Circuit breaker is open for provider: ${provider}`);
    this.name = "CircuitBreakerOpenError";
  }
}

function getStatus(error: any): number | null {
  if (typeof error?.status === "number") return error.status;
  const message = String(error?.message || "");
  const match = message.match(/(?:^|[\s(])([245]\d{2})(?:[\s):]|$)/);
  return match ? Number(match[1]) : null;
}

function isQuota429(error: any): boolean {
  const message = String(error?.message || "").toLowerCase();
  return getStatus(error) === 429 && (
    message.includes("quota") ||
    message.includes("free_tier_requests") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  );
}

function isRetryable(error: any): boolean {
  const status = getStatus(error);
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 413) return false;
  if (isQuota429(error)) return false;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export async function withRetryAndCircuitBreaker<T>(
  provider: string,
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = Math.min(Math.max(options.maxRetries ?? 2, 0), 2);
  let delay = options.initialDelayMs ?? 750;
  const maxDelayMs = options.maxDelayMs ?? 8000;
  const factor = options.factor ?? 2;

  const breakerState = circuitBreakers.get(provider);
  if (breakerState && breakerState.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    if (Date.now() - breakerState.lastFailure < CIRCUIT_BREAKER_RESET_MS) {
      throw new CircuitBreakerOpenError(provider);
    }
    circuitBreakers.delete(provider);
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      const result = await operation();
      circuitBreakers.delete(provider);
      return result;
    } catch (error: any) {
      lastError = error;
      const status = getStatus(error);
      if (!isRetryable(error) || attempt > maxRetries) break;

      const jitter = Math.floor(Math.random() * 400);
      const waitMs = Math.min(delay, maxDelayMs) + jitter;
      console.warn(
        `[Retry] ${provider} attempt ${attempt}/${maxRetries + 1} failed with ${status ?? "unknown"}; retrying in ${waitMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      delay = Math.min(delay * factor, maxDelayMs);
    }
  }

  const state = circuitBreakers.get(provider) || { failures: 0, lastFailure: Date.now() };
  circuitBreakers.set(provider, {
    failures: state.failures + 1,
    lastFailure: Date.now(),
  });

  throw lastError;
}
