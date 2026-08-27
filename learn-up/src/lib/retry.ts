export type RetryOptions = {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
};

const circuitBreakers = new Map<string, { failures: number; lastFailure: number }>();
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute

export class CircuitBreakerOpenError extends Error {
  constructor(provider: string) {
    super(`Circuit breaker is open for provider: ${provider}`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export async function withRetryAndCircuitBreaker<T>(
  provider: string,
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  let delay = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 10000;
  const factor = options.factor ?? 2;

  // Check Circuit Breaker
  const breakerState = circuitBreakers.get(provider);
  if (breakerState) {
    if (breakerState.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      if (Date.now() - breakerState.lastFailure < CIRCUIT_BREAKER_RESET_MS) {
        throw new CircuitBreakerOpenError(provider);
      } else {
        // Half-open state: allow one try
        circuitBreakers.set(provider, { failures: CIRCUIT_BREAKER_THRESHOLD - 1, lastFailure: Date.now() });
      }
    }
  }

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await operation();
      // On success, reset circuit breaker
      circuitBreakers.delete(provider);
      return result;
    } catch (error: any) {
      lastError = error;
      
      const isRateLimit = error?.message?.includes('429') || error?.status === 429;
      const isServerError = error?.message?.includes('500') || error?.status === 500 || error?.message?.includes('503') || error?.status === 503;
      
      // Don't retry on bad requests unless it's a rate limit or server error
      if (!isRateLimit && !isServerError && attempt > 1) {
          break; 
      }

      console.warn(`[Retry] ${provider} attempt ${attempt} failed: ${error.message}`);
      
      if (attempt <= maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * factor, maxDelayMs);
      }
    }
  }

  // Record failure in circuit breaker
  const state = circuitBreakers.get(provider) || { failures: 0, lastFailure: Date.now() };
  circuitBreakers.set(provider, {
    failures: state.failures + 1,
    lastFailure: Date.now()
  });

  throw lastError;
}
