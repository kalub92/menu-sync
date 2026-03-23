import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DoorDashClient } from './doordash.js';
import type {
  DoorDashCredentials,
  PlatformMenuPayload,
} from './types.js';

const TEST_CREDS: DoorDashCredentials = {
  developerId: 'dev-123',
  keyId: 'key-456',
  signingSecret: Buffer.from('test-secret-key-for-hmac-sign').toString('base64'),
};

const TEST_PAYLOAD: PlatformMenuPayload = {
  storeId: 'store-789',
  menuName: 'Main Menu',
  categories: [
    {
      name: 'Burgers',
      sortOrder: 0,
      items: [
        {
          name: 'Classic Burger',
          description: 'A classic beef burger',
          price: 999,
          imageUrl: 'https://example.com/burger.jpg',
          active: true,
          categoryName: 'Burgers',
          modifierGroups: [
            {
              name: 'Size',
              required: true,
              minSelections: 1,
              maxSelections: 1,
              modifiers: [
                { name: 'Regular', priceAdjustment: 0, active: true },
                { name: 'Large', priceAdjustment: 200, active: true },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('DoorDashClient', () => {
  let client: DoorDashClient;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    client = new DoorDashClient();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should have platform set to doordash', () => {
    expect(client.platform).toBe('doordash');
  });

  describe('pushMenu', () => {
    it('should push menu successfully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ menu_id: 'menu-abc', job_id: 'job-xyz' }),
        headers: new Headers(),
      });

      const result = await client.pushMenu(TEST_PAYLOAD, TEST_CREDS);

      expect(result.success).toBe(true);
      expect(result.externalMenuId).toBe('menu-abc');
      expect(result.jobId).toBe('job-xyz');

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(fetchCall[0]).toContain('/developer/v1/stores/store-789/menu');
      expect(fetchCall[1]?.method).toBe('PUT');

      const headers = fetchCall[1]?.headers as Record<string, string>;
      expect(headers['Authorization']).toMatch(/^Bearer /);
    });

    it('should return error on API failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid store' }),
        text: async () => '{"error":"Invalid store"}',
        headers: new Headers(),
      });

      const result = await client.pushMenu(TEST_PAYLOAD, TEST_CREDS);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle network errors gracefully', { timeout: 30000 }, async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await client.pushMenu(TEST_PAYLOAD, TEST_CREDS);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should format the menu body correctly for DoorDash', async () => {
      let capturedBody: string | undefined;
      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        capturedBody = init?.body as string;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ menu_id: 'mid', job_id: 'jid' }),
          headers: new Headers(),
        });
      });

      await client.pushMenu(TEST_PAYLOAD, TEST_CREDS);

      const body = JSON.parse(capturedBody!);
      expect(body.store_id).toBe('store-789');
      expect(body.menu.name).toBe('Main Menu');
      expect(body.menu.categories).toHaveLength(1);
      expect(body.menu.categories[0].name).toBe('Burgers');
      expect(body.menu.categories[0].items[0].name).toBe('Classic Burger');
      expect(body.menu.categories[0].items[0].price).toBe(999);
      expect(body.menu.categories[0].items[0].extras).toHaveLength(1);
      expect(body.menu.categories[0].items[0].extras[0].name).toBe('Size');
      expect(body.menu.categories[0].items[0].extras[0].items).toHaveLength(2);
    });
  });

  describe('getMenuStatus', () => {
    it('should return success status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'COMPLETED', message: 'Menu published' }),
        headers: new Headers(),
      });

      const status = await client.getMenuStatus('job-xyz', TEST_CREDS);

      expect(status.status).toBe('success');
      expect(status.message).toBe('Menu published');
    });

    it('should map DoorDash statuses correctly', async () => {
      for (const [ddStatus, expected] of [
        ['PENDING', 'pending'],
        ['PROCESSING', 'processing'],
        ['COMPLETED', 'success'],
        ['FAILED', 'error'],
      ] as const) {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ status: ddStatus }),
          headers: new Headers(),
        });

        const status = await client.getMenuStatus('job-xyz', TEST_CREDS);
        expect(status.status).toBe(expected);
      }
    });
  });

  describe('validateCredentials', () => {
    it('should return valid for successful auth', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ store_id: 'store-789' }),
        headers: new Headers(),
      });

      const result = await client.validateCredentials(TEST_CREDS, 'store-789');

      expect(result.valid).toBe(true);
    });

    it('should return invalid for auth failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
        headers: new Headers(),
      });

      const result = await client.validateCredentials(TEST_CREDS, 'store-789');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('credential validation', () => {
    it('should reject invalid credentials shape', async () => {
      const invalidCreds = { clientId: 'x', clientSecret: 'y' }; // Uber Eats shape

      const result = await client.pushMenu(TEST_PAYLOAD, invalidCreds);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid DoorDash credentials');
    });
  });
});
