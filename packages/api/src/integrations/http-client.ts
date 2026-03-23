// ── HTTP client with retry and rate-limit awareness ────────────────────────

export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseBody: unknown,
    message?: string,
  ) {
    super(message ?? `HTTP ${status}`);
    this.name = 'HttpError';
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

export class RateLimitError extends HttpError {
  constructor(
    public readonly retryAfterMs: number,
    responseBody: unknown,
  ) {
    super(429, responseBody, `Rate limited, retry after ${retryAfterMs}ms`);
    this.name = 'RateLimitError';
  }
}

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

const DEFAULT_TIMEOUT_MS = 30000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Makes an HTTP request with automatic retry for transient failures
 * and rate-limit awareness (backs off on 429).
 */
export async function httpRequest<T = unknown>(
  options: HttpRequestOptions,
  retry: RetryConfig = DEFAULT_RETRY,
): Promise<HttpResponse<T>> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retry.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const timer = setTimeout(() => controller.abort(), timeout);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      };

      const response = await fetch(options.url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const retryMs = retryAfter ? Number(retryAfter) * 1000 : retry.baseDelayMs * 2 ** attempt;
        const clampedMs = Math.min(retryMs, retry.maxDelayMs);

        if (attempt < retry.maxRetries) {
          await sleep(clampedMs);
          continue;
        }

        const body = await response.text().catch(() => '');
        throw new RateLimitError(clampedMs, body);
      }

      const data = (await response.json().catch(() => null)) as T;

      if (!response.ok) {
        const error = new HttpError(response.status, data);
        if (error.retryable && attempt < retry.maxRetries) {
          const delayMs = Math.min(retry.baseDelayMs * 2 ** attempt, retry.maxDelayMs);
          await sleep(delayMs);
          continue;
        }
        throw error;
      }

      return { status: response.status, data, headers: responseHeaders };
    } catch (err) {
      lastError = err as Error;

      if (err instanceof HttpError && !err.retryable) {
        throw err;
      }

      // Retry on network/timeout errors
      if (attempt < retry.maxRetries && !(err instanceof HttpError)) {
        const delayMs = Math.min(retry.baseDelayMs * 2 ** attempt, retry.maxDelayMs);
        await sleep(delayMs);
        continue;
      }
    }
  }

  throw lastError ?? new Error('Request failed after retries');
}
