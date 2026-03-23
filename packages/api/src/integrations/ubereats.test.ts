import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UberEatsClient, clearTokenCache } from './ubereats.js';
import type {
  UberEatsCredentials,
  PlatformMenuPayload,
} from './types.js';

const TEST_CREDS: UberEatsCredentials = {
  clientId: 'client-123',
  clientSecret: 'secret-456',
};

const TEST_PAYLOAD: PlatformMenuPayload = {
  storeId: 'store-789',
  menuName: 'Dinner Menu',
  categories: [
    {
      name: 'Pasta',
      sortOrder: 0,
      items: [
        {
          name: 'Spaghetti Carbonara',
          description: 'Classic Italian pasta',
          price: 1499,
          imageUrl: null,
          active: true,
          categoryName: 'Pasta',
          modifierGroups: [
            {
              name: 'Add-ons',
              required: false,
              minSelections: 0,
              maxSelections: 3,
              modifiers: [
                { name: 'Extra Parmesan', priceAdjustment: 150, active: true },
                { name: 'Truffle Oil', priceAdjustment: 300, active: true },
              ],
            },
          ],
        },
        {
          name: 'Penne Arrabbiata',
          description: 'Spicy tomato sauce',
          price: 1299,
          imageUrl: null,
          active: true,
          categoryName: 'Pasta',
          modifierGroups: [],
        },
      ],
    },
  ],
};

/** Helper to mock a successful OAuth token response followed by the actual API call */
function mockUberEatsAuth(apiResponse: { ok: boolean; status: number; body: unknown }) {
  let callCount = 0;
  return vi.fn().mockImplementation((_url: string) => {
    callCount++;
    // First call is the OAuth token request
    if (callCount === 1) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'test-token-abc', expires_in: 3600 }),
        headers: new Headers(),
      });
    }
    // Subsequent calls are API requests
    return Promise.resolve({
      ok: apiResponse.ok,
      status: apiResponse.status,
      json: async () => apiResponse.body,
      headers: new Headers(),
    });
  });
}

describe('UberEatsClient', () => {
  let client: UberEatsClient;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    client = new UberEatsClient();
    originalFetch = globalThis.fetch;
    clearTokenCache(); // Ensure no cached tokens between tests
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should have platform set to uber_eats', () => {
    expect(client.platform).toBe('uber_eats');
  });

  describe('pushMenu', () => {
    it('should push menu successfully', async () => {
      globalThis.fetch = mockUberEatsAuth({
        ok: true,
        status: 200,
        body: { status: 'SUCCESS', menu_id: 'uber-menu-123' },
      });

      const result = await client.pushMenu(TEST_PAYLOAD, TEST_CREDS);

      expect(result.success).toBe(true);
      expect(result.externalMenuId).toBe('uber-menu-123');
    });

    it('should return error on API failure', async () => {
      globalThis.fetch = mockUberEatsAuth({
        ok: false,
        status: 400,
        body: { message: 'Invalid menu format' },
      });

      const result = await client.pushMenu(TEST_PAYLOAD, TEST_CREDS);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should format the menu body correctly for Uber Eats', async () => {
      let capturedBody: string | undefined;
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        callCount++;
        if (callCount === 1) {
          // OAuth token call
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'tok', expires_in: 3600 }),
            headers: new Headers(),
          });
        }
        // API call — capture body
        capturedBody = init?.body as string;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: 'SUCCESS', menu_id: 'mid' }),
          headers: new Headers(),
        });
      });

      await client.pushMenu(TEST_PAYLOAD, TEST_CREDS);

      expect(capturedBody).toBeDefined();
      const body = JSON.parse(capturedBody!);
      expect(body.menus).toHaveLength(1);
      expect(body.menus[0].title.translations.en).toBe('Dinner Menu');
      expect(body.categories).toHaveLength(1);
      expect(body.categories[0].title.translations.en).toBe('Pasta');
      expect(body.items).toHaveLength(2);
      expect(body.items[0].title.translations.en).toBe('Spaghetti Carbonara');
      expect(body.items[0].price_info.price).toBe(1499);
      expect(body.modifier_groups).toHaveLength(1);
      expect(body.modifier_groups[0].title.translations.en).toBe('Add-ons');
      expect(body.modifier_groups[0].modifier_options).toHaveLength(2);
    });
  });

  describe('getMenuStatus', () => {
    it('should return mapped status', async () => {
      globalThis.fetch = mockUberEatsAuth({
        ok: true,
        status: 200,
        body: { status: 'SUCCESS' },
      });

      const status = await client.getMenuStatus('uber-menu-123', TEST_CREDS);

      expect(status.status).toBe('success');
    });

    it('should map Uber Eats statuses correctly', async () => {
      for (const [ueStatus, expected] of [
        ['PENDING', 'pending'],
        ['IN_PROGRESS', 'processing'],
        ['SUCCESS', 'success'],
        ['FAILURE', 'error'],
      ] as const) {
        clearTokenCache(); // Clear cache between iterations
        globalThis.fetch = mockUberEatsAuth({
          ok: true,
          status: 200,
          body: { status: ueStatus },
        });

        const status = await client.getMenuStatus('job-id', TEST_CREDS);
        expect(status.status).toBe(expected);
      }
    });

    it('should include error messages', async () => {
      globalThis.fetch = mockUberEatsAuth({
        ok: true,
        status: 200,
        body: {
          status: 'FAILURE',
          errors: [{ message: 'Invalid category' }, { message: 'Missing price' }],
        },
      });

      const status = await client.getMenuStatus('job-id', TEST_CREDS);

      expect(status.status).toBe('error');
      expect(status.message).toBe('Invalid category; Missing price');
    });
  });

  describe('validateCredentials', () => {
    it('should return valid when auth + store check succeed', async () => {
      globalThis.fetch = mockUberEatsAuth({
        ok: true,
        status: 200,
        body: { store_id: 'store-789' },
      });

      const result = await client.validateCredentials(TEST_CREDS, 'store-789');

      expect(result.valid).toBe(true);
    });

    it('should return invalid on auth failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'invalid_client' }),
        headers: new Headers(),
      });

      const result = await client.validateCredentials(TEST_CREDS, 'store-789');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('credential validation', () => {
    it('should reject invalid credentials shape', async () => {
      const invalidCreds = { developerId: 'x', keyId: 'y', signingSecret: 'z' }; // DoorDash shape

      const result = await client.pushMenu(TEST_PAYLOAD, invalidCreds);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid Uber Eats credentials');
    });
  });
});
