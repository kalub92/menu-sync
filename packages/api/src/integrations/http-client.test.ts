import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { httpRequest, HttpError, RateLimitError } from './http-client.js';

describe('httpRequest', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should make a successful GET request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const response = await httpRequest({ method: 'GET', url: 'https://api.example.com/test' });

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ data: 'test' });
  });

  it('should make a POST request with body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: '123' }),
      headers: new Headers(),
    });

    const response = await httpRequest({
      method: 'POST',
      url: 'https://api.example.com/items',
      body: { name: 'Test' },
    });

    expect(response.status).toBe(201);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(JSON.parse(fetchCall[1]?.body as string)).toEqual({ name: 'Test' });
  });

  it('should throw HttpError on non-retryable failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Bad request' }),
      headers: new Headers(),
    });

    await expect(
      httpRequest({ method: 'GET', url: 'https://api.example.com/bad' }),
    ).rejects.toThrow(HttpError);
  });

  it('should retry on 500 errors', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal server error' }),
          headers: new Headers(),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: 'recovered' }),
        headers: new Headers(),
      });
    });

    const response = await httpRequest(
      { method: 'GET', url: 'https://api.example.com/flaky' },
      { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 }, // Fast retries for test
    );

    expect(response.data).toEqual({ data: 'recovered' });
    expect(callCount).toBe(3);
  });

  it('should handle rate limiting with retry-after header', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          json: async () => ({}),
          text: async () => '',
          headers: new Headers({ 'retry-after': '1' }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: 'ok' }),
        headers: new Headers(),
      });
    });

    const response = await httpRequest(
      { method: 'GET', url: 'https://api.example.com/limited' },
      { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 2000 },
    );

    expect(response.data).toEqual({ data: 'ok' });
    expect(callCount).toBe(2);
  });

  it('should throw RateLimitError after all retries exhausted on 429', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
      text: async () => 'rate limited',
      headers: new Headers(),
    });

    await expect(
      httpRequest(
        { method: 'GET', url: 'https://api.example.com/limited' },
        { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 10 },
      ),
    ).rejects.toThrow(RateLimitError);
  });

  it('should retry on network errors', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 2) {
        return Promise.reject(new Error('ECONNRESET'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: 'ok' }),
        headers: new Headers(),
      });
    });

    const response = await httpRequest(
      { method: 'GET', url: 'https://api.example.com/flaky' },
      { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 },
    );

    expect(response.data).toEqual({ data: 'ok' });
  });

  it('HttpError.retryable should be true for 500+ and 429', () => {
    expect(new HttpError(429, null).retryable).toBe(true);
    expect(new HttpError(500, null).retryable).toBe(true);
    expect(new HttpError(503, null).retryable).toBe(true);
    expect(new HttpError(400, null).retryable).toBe(false);
    expect(new HttpError(401, null).retryable).toBe(false);
    expect(new HttpError(404, null).retryable).toBe(false);
  });
});
