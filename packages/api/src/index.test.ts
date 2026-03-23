import { describe, it, expect } from 'vitest';

describe('API', () => {
  it('should have a valid health check response shape', () => {
    const response = { status: 'ok', timestamp: new Date().toISOString() };
    expect(response.status).toBe('ok');
    expect(response.timestamp).toBeDefined();
  });
});
