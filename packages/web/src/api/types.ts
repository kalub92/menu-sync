// ── Core entities ───────────────────────────────────────────────────────────

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  timezone: string;
  active: boolean;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  menus?: Menu[];
}

export interface Menu {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  categories?: Category[];
}

export interface Category {
  id: string;
  menuId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  items?: Item[];
}

export interface Item {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  active: boolean;
  availableFrom: string | null;
  availableTo: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  modifierGroups?: ModifierGroup[];
  platformPricing?: PlatformPricing[];
}

export interface ModifierGroup {
  id: string;
  itemId: string;
  name: string;
  description: string | null;
  required: boolean;
  minSelections: number;
  maxSelections: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  modifiers?: Modifier[];
}

export interface Modifier {
  id: string;
  modifierGroupId: string;
  name: string;
  priceAdjustment: number;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPricing {
  id: string;
  itemId: string;
  platform: string;
  price: number;
  createdAt: string;
  updatedAt: string;
}

// ── Platform connections ────────────────────────────────────────────────────

export type Platform = 'doordash' | 'uber_eats';

export interface PlatformConnection {
  id: string;
  restaurantId: string;
  platform: Platform;
  externalStoreId: string | null;
  credentials: Record<string, string>;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Sync ────────────────────────────────────────────────────────────────────

export interface SyncJob {
  id: string;
  connectionId: string;
  menuId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  trigger: 'manual' | 'auto' | 'retry';
  attempt: number;
  maxAttempts: number;
  externalJobId: string | null;
  error: string | null;
  nextRetryAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncHistoryEntry {
  id: string;
  connectionId: string;
  menuId: string;
  restaurantId: string;
  syncJobId: string;
  status: 'success' | 'error';
  trigger: 'manual' | 'auto';
  platform: string;
  changesSummary: {
    added: number;
    modified: number;
    removed: number;
    details?: Array<{ type: string; entityType: string; entityName: string }>;
  } | null;
  externalJobId: string | null;
  error: string | null;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface SyncStatus {
  restaurantId: string;
  connections: Array<{
    id: string;
    platform: Platform;
    enabled: boolean;
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    lastSyncError: string | null;
  }>;
}

export interface SyncDiff {
  connectionId: string;
  platform: string;
  menuId: string;
  wouldSync: boolean;
  diff: {
    hasChanges: boolean;
    summary: { added: number; modified: number; removed: number };
    changes: Array<{
      type: 'added' | 'removed' | 'modified';
      entityType: string;
      entityId: string;
      entityName: string;
    }>;
  } | null;
  lastSyncedAt: string | null;
}

// ── Create/update payloads ──────────────────────────────────────────────────

export interface CreateRestaurant {
  name: string;
  slug: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  timezone?: string;
  active?: boolean;
}

export interface CreateMenu {
  restaurantId: string;
  name: string;
  description?: string | null;
  active?: boolean;
  sortOrder?: number;
}

export interface CreateCategory {
  menuId: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export interface CreateItem {
  categoryId: string;
  name: string;
  description?: string | null;
  basePrice: number;
  imageUrl?: string | null;
  active?: boolean;
  availableFrom?: string | null;
  availableTo?: string | null;
  sortOrder?: number;
}

export interface CreateModifierGroup {
  itemId: string;
  name: string;
  description?: string | null;
  required?: boolean;
  minSelections?: number;
  maxSelections?: number | null;
  sortOrder?: number;
}

export interface CreateModifier {
  modifierGroupId: string;
  name: string;
  priceAdjustment?: number;
  active?: boolean;
  sortOrder?: number;
}

export interface CreatePlatformConnection {
  restaurantId: string;
  platform: Platform;
  externalStoreId?: string | null;
  credentials: Record<string, string>;
  enabled?: boolean;
}
