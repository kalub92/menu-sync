// ── DoorDash Menu API client ────────────────────────────────────────────────

import { createHmac } from 'node:crypto';
import { httpRequest } from './http-client.js';
import type {
  DeliveryPlatformClient,
  DoorDashCredentials,
  MenuPushResult,
  MenuPushStatus,
  PlatformCredentials,
  PlatformMenuPayload,
} from './types.js';

const DOORDASH_API_BASE = 'https://openapi.doordash.com';

/**
 * Generates a DoorDash JWT for API authentication.
 * DoorDash uses a custom JWT signed with HMAC-SHA256.
 */
function createDoorDashJwt(creds: DoorDashCredentials): string {
  const header = Buffer.from(
    JSON.stringify({
      alg: 'HS256',
      typ: 'JWT',
      'dd-ver': 'DD-JWT-V1',
    }),
  ).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      aud: 'doordash',
      iss: creds.developerId,
      kid: creds.keyId,
      iat: now,
      exp: now + 300, // 5 minute expiry
    }),
  ).toString('base64url');

  const signature = createHmac('sha256', Buffer.from(creds.signingSecret, 'base64'))
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

function asDoorDashCreds(creds: PlatformCredentials): DoorDashCredentials {
  const c = creds as DoorDashCredentials;
  if (!c.developerId || !c.keyId || !c.signingSecret) {
    throw new Error('Invalid DoorDash credentials: missing developerId, keyId, or signingSecret');
  }
  return c;
}

/**
 * Transforms our platform-agnostic menu payload into DoorDash's menu format.
 */
function toDoorDashMenu(payload: PlatformMenuPayload) {
  return {
    store_id: payload.storeId,
    menu: {
      name: payload.menuName,
      categories: payload.categories.map((cat) => ({
        name: cat.name,
        sort_order: cat.sortOrder,
        items: cat.items.map((item) => ({
          name: item.name,
          description: item.description ?? '',
          price: item.price, // DoorDash uses cents
          image_url: item.imageUrl ?? undefined,
          active: item.active,
          extras: item.modifierGroups.map((mg) => ({
            name: mg.name,
            min_num_options: mg.minSelections,
            max_num_options: mg.maxSelections ?? mg.modifiers.length,
            items: mg.modifiers.map((mod) => ({
              name: mod.name,
              price: mod.priceAdjustment,
              active: mod.active,
            })),
          })),
        })),
      })),
    },
  };
}

export class DoorDashClient implements DeliveryPlatformClient {
  readonly platform = 'doordash' as const;

  async pushMenu(
    payload: PlatformMenuPayload,
    credentials: PlatformCredentials,
  ): Promise<MenuPushResult> {
    try {
      const creds = asDoorDashCreds(credentials);
      const jwt = createDoorDashJwt(creds);
      const body = toDoorDashMenu(payload);
      const response = await httpRequest<{ menu_id: string; job_id: string }>({
        method: 'PUT',
        url: `${DOORDASH_API_BASE}/developer/v1/stores/${payload.storeId}/menu`,
        headers: { Authorization: `Bearer ${jwt}` },
        body,
      });

      return {
        success: true,
        externalMenuId: response.data.menu_id,
        jobId: response.data.job_id,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error pushing menu to DoorDash',
      };
    }
  }

  async getMenuStatus(
    jobId: string,
    credentials: PlatformCredentials,
  ): Promise<MenuPushStatus> {
    const creds = asDoorDashCreds(credentials);
    const jwt = createDoorDashJwt(creds);

    const response = await httpRequest<{ status: string; message?: string }>({
      method: 'GET',
      url: `${DOORDASH_API_BASE}/developer/v1/menu/jobs/${jobId}`,
      headers: { Authorization: `Bearer ${jwt}` },
    });

    const statusMap: Record<string, MenuPushStatus['status']> = {
      PENDING: 'pending',
      PROCESSING: 'processing',
      COMPLETED: 'success',
      FAILED: 'error',
    };

    return {
      status: statusMap[response.data.status] ?? 'pending',
      message: response.data.message,
    };
  }

  async validateCredentials(
    credentials: PlatformCredentials,
    storeId: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const creds = asDoorDashCreds(credentials);
    const jwt = createDoorDashJwt(creds);

    try {
      await httpRequest({
        method: 'GET',
        url: `${DOORDASH_API_BASE}/developer/v1/stores/${storeId}`,
        headers: { Authorization: `Bearer ${jwt}` },
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
