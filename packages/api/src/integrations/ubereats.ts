// ── Uber Eats Menu API client ───────────────────────────────────────────────

import { httpRequest } from './http-client.js';
import type {
  DeliveryPlatformClient,
  MenuPushResult,
  MenuPushStatus,
  PlatformCredentials,
  PlatformMenuPayload,
  UberEatsCredentials,
} from './types.js';

const UBER_EATS_API_BASE = 'https://api.uber.com';

/** In-memory token cache keyed by clientId. */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/** Clear the token cache (for testing). */
export function clearTokenCache(): void {
  tokenCache.clear();
}

function asUberEatsCreds(creds: PlatformCredentials): UberEatsCredentials {
  const c = creds as UberEatsCredentials;
  if (!c.clientId || !c.clientSecret) {
    throw new Error('Invalid Uber Eats credentials: missing clientId or clientSecret');
  }
  return c;
}

/**
 * Obtains an OAuth2 access token using client_credentials grant.
 * Caches the token until 60 seconds before expiry.
 */
async function getAccessToken(creds: UberEatsCredentials): Promise<string> {
  const cached = tokenCache.get(creds.clientId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const params = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'client_credentials',
    scope: 'eats.store eats.store.orders.read',
  });

  // OAuth token exchange uses form-encoded body, not JSON — use fetch directly
  const tokenResponse = await fetch(`${UBER_EATS_API_BASE}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Uber Eats auth failed: ${tokenResponse.status}`);
  }

  const data = (await tokenResponse.json()) as { access_token: string; expires_in: number };

  // Cache with 60-second safety margin
  tokenCache.set(creds.clientId, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  });

  return data.access_token;
}

/**
 * Transforms our platform-agnostic menu payload into Uber Eats' menu format.
 */
function toUberEatsMenu(payload: PlatformMenuPayload) {
  return {
    menus: [
      {
        title: { translations: { en: payload.menuName } },
        service_availability: [
          {
            day_of_week: 'monday',
            time_periods: [{ start_time: '00:00', end_time: '23:59' }],
          },
        ],
        category_ids: payload.categories.map((_c, i) => `cat_${i}`),
      },
    ],
    categories: payload.categories.map((cat, catIdx) => ({
      id: `cat_${catIdx}`,
      title: { translations: { en: cat.name } },
      entities: cat.items.map((_item, itemIdx) => ({
        id: `item_${catIdx}_${itemIdx}`,
        type: 'ITEM',
      })),
    })),
    items: payload.categories.flatMap((cat, catIdx) =>
      cat.items.map((item, itemIdx) => ({
        id: `item_${catIdx}_${itemIdx}`,
        external_data: item.externalId ?? `item_${catIdx}_${itemIdx}`,
        title: { translations: { en: item.name } },
        description: item.description
          ? { translations: { en: item.description } }
          : undefined,
        image_url: item.imageUrl ?? undefined,
        price_info: {
          price: item.price, // cents
          overrides: [],
        },
        modifier_group_ids: item.modifierGroups.length
          ? {
              ids: item.modifierGroups.map(
                (_mg, mgIdx) => `mg_${catIdx}_${itemIdx}_${mgIdx}`,
              ),
              overrides: [],
            }
          : undefined,
        suspension_info: item.active ? undefined : { suspension: { reason: 'OUT_OF_STOCK' } },
      })),
    ),
    modifier_groups: payload.categories.flatMap((cat, catIdx) =>
      cat.items.flatMap((item, itemIdx) =>
        item.modifierGroups.map((mg, mgIdx) => ({
          id: `mg_${catIdx}_${itemIdx}_${mgIdx}`,
          title: { translations: { en: mg.name } },
          quantity_info: {
            quantity: {
              min_permitted: mg.minSelections,
              max_permitted: mg.maxSelections ?? mg.modifiers.length,
            },
          },
          modifier_options: mg.modifiers.map((mod, modIdx) => ({
            id: `mod_${catIdx}_${itemIdx}_${mgIdx}_${modIdx}`,
            title: { translations: { en: mod.name } },
            price_info: {
              price: mod.priceAdjustment,
              overrides: [],
            },
          })),
        })),
      ),
    ),
  };
}

export class UberEatsClient implements DeliveryPlatformClient {
  readonly platform = 'uber_eats' as const;

  async pushMenu(
    payload: PlatformMenuPayload,
    credentials: PlatformCredentials,
  ): Promise<MenuPushResult> {
    try {
      const creds = asUberEatsCreds(credentials);
      const token = await getAccessToken(creds);
      const body = toUberEatsMenu(payload);

      const response = await httpRequest<{ status: string; menu_id?: string }>({
        method: 'PUT',
        url: `${UBER_EATS_API_BASE}/v2/eats/stores/${payload.storeId}/menus`,
        headers: { Authorization: `Bearer ${token}` },
        body,
      });

      return {
        success: true,
        externalMenuId: response.data.menu_id,
        jobId: response.data.menu_id, // Uber Eats uses menu_id for status checks
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error pushing menu to Uber Eats',
      };
    }
  }

  async getMenuStatus(
    jobId: string,
    credentials: PlatformCredentials,
  ): Promise<MenuPushStatus> {
    const creds = asUberEatsCreds(credentials);
    const token = await getAccessToken(creds);

    const response = await httpRequest<{
      status: string;
      errors?: Array<{ message: string }>;
    }>({
      method: 'GET',
      url: `${UBER_EATS_API_BASE}/v2/eats/menus/${jobId}/status`,
      headers: { Authorization: `Bearer ${token}` },
    });

    const statusMap: Record<string, MenuPushStatus['status']> = {
      PENDING: 'pending',
      IN_PROGRESS: 'processing',
      SUCCESS: 'success',
      FAILURE: 'error',
    };

    return {
      status: statusMap[response.data.status] ?? 'pending',
      message: response.data.errors?.map((e) => e.message).join('; '),
    };
  }

  async validateCredentials(
    credentials: PlatformCredentials,
    storeId: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const creds = asUberEatsCreds(credentials);

    try {
      const token = await getAccessToken(creds);
      await httpRequest({
        method: 'GET',
        url: `${UBER_EATS_API_BASE}/v1/eats/stores/${storeId}`,
        headers: { Authorization: `Bearer ${token}` },
      });
      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : 'Credential validation failed',
      };
    }
  }
}
