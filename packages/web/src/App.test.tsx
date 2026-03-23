import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('should be importable', async () => {
    const mod = await import('./App');
    expect(mod.App).toBeDefined();
  });
});
