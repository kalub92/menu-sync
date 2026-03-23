// ── Platform registry ──────────────────────────────────────────────────────

import type { DeliveryPlatformClient, PlatformKey } from './types.js';
import { DoorDashClient } from './doordash.js';
import { UberEatsClient } from './ubereats.js';

const clients = new Map<PlatformKey, DeliveryPlatformClient>();

// Register built-in platform clients
clients.set('doordash', new DoorDashClient());
clients.set('uber_eats', new UberEatsClient());

export function getPlatformClient(platform: PlatformKey): DeliveryPlatformClient {
  const client = clients.get(platform);
  if (!client) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return client;
}

export function getSupportedPlatforms(): PlatformKey[] {
  return Array.from(clients.keys());
}
