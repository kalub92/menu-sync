import type {
  Restaurant,
  CreateRestaurant,
  Menu,
  CreateMenu,
  Category,
  CreateCategory,
  Item,
  CreateItem,
  ModifierGroup,
  CreateModifierGroup,
  Modifier,
  CreateModifier,
  PlatformConnection,
  CreatePlatformConnection,
  PlatformPricing,
  SyncHistoryEntry,
  SyncStatus,
  SyncDiff,
  SyncJob,
} from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Restaurants ─────────────────────────────────────────────────────────────

export const restaurants = {
  list: () => request<Restaurant[]>('/api/restaurants'),
  get: (id: string) => request<Restaurant>(`/api/restaurants/${id}`),
  create: (data: CreateRestaurant) =>
    request<Restaurant>('/api/restaurants', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateRestaurant>) =>
    request<Restaurant>(`/api/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/api/restaurants/${id}`, { method: 'DELETE' }),
};

// ── Menus ───────────────────────────────────────────────────────────────────

export const menus = {
  listForRestaurant: (restaurantId: string) =>
    request<Menu[]>(`/api/restaurants/${restaurantId}/menus`),
  get: (id: string) => request<Menu>(`/api/menus/${id}`),
  create: (data: CreateMenu) =>
    request<Menu>('/api/menus', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Omit<CreateMenu, 'restaurantId'>>) =>
    request<Menu>(`/api/menus/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/api/menus/${id}`, { method: 'DELETE' }),
};

// ── Categories ──────────────────────────────────────────────────────────────

export const categories = {
  listForMenu: (menuId: string) => request<Category[]>(`/api/menus/${menuId}/categories`),
  get: (id: string) => request<Category>(`/api/categories/${id}`),
  create: (data: CreateCategory) =>
    request<Category>('/api/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Omit<CreateCategory, 'menuId'>>) =>
    request<Category>(`/api/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/api/categories/${id}`, { method: 'DELETE' }),
};

// ── Items ───────────────────────────────────────────────────────────────────

export const items = {
  listForCategory: (categoryId: string) =>
    request<Item[]>(`/api/categories/${categoryId}/items`),
  get: (id: string) => request<Item>(`/api/items/${id}`),
  create: (data: CreateItem) =>
    request<Item>('/api/items', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Omit<CreateItem, 'categoryId'>>) =>
    request<Item>(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/api/items/${id}`, { method: 'DELETE' }),
};

// ── Modifier Groups ────────────────────────────────────────────────────────

export const modifierGroups = {
  listForItem: (itemId: string) =>
    request<ModifierGroup[]>(`/api/items/${itemId}/modifier-groups`),
  get: (id: string) => request<ModifierGroup>(`/api/modifier-groups/${id}`),
  create: (data: CreateModifierGroup) =>
    request<ModifierGroup>('/api/modifier-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Omit<CreateModifierGroup, 'itemId'>>) =>
    request<ModifierGroup>(`/api/modifier-groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => request<void>(`/api/modifier-groups/${id}`, { method: 'DELETE' }),
};

// ── Modifiers ──────────────────────────────────────────────────────────────

export const modifiers = {
  create: (data: CreateModifier) =>
    request<Modifier>('/api/modifiers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Omit<CreateModifier, 'modifierGroupId'>>) =>
    request<Modifier>(`/api/modifiers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/api/modifiers/${id}`, { method: 'DELETE' }),
};

// ── Platform Pricing ───────────────────────────────────────────────────────

export const platformPricing = {
  listForItem: (itemId: string) =>
    request<PlatformPricing[]>(`/api/items/${itemId}/pricing`),
  create: (data: { itemId: string; platform: string; price: number }) =>
    request<PlatformPricing>('/api/platform-pricing', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { price: number }) =>
    request<PlatformPricing>(`/api/platform-pricing/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => request<void>(`/api/platform-pricing/${id}`, { method: 'DELETE' }),
};

// ── Connections ────────────────────────────────────────────────────────────

export const connections = {
  listForRestaurant: (restaurantId: string) =>
    request<PlatformConnection[]>(`/api/restaurants/${restaurantId}/connections`),
  get: (id: string) => request<PlatformConnection>(`/api/connections/${id}`),
  create: (data: CreatePlatformConnection) =>
    request<PlatformConnection>('/api/connections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (
    id: string,
    data: Partial<Pick<CreatePlatformConnection, 'externalStoreId' | 'credentials' | 'enabled'>>,
  ) =>
    request<PlatformConnection>(`/api/connections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => request<void>(`/api/connections/${id}`, { method: 'DELETE' }),
  validate: (id: string) =>
    request<{ valid: boolean; error?: string }>(`/api/connections/${id}/validate`, {
      method: 'POST',
    }),
  sync: (id: string, data: { menuId: string }) =>
    request<{ jobId: string; status: string }>(`/api/connections/${id}/sync`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Sync ───────────────────────────────────────────────────────────────────

export const sync = {
  syncConnection: (
    connectionId: string,
    data: { menuId: string; trigger?: string; async?: boolean },
  ) =>
    request<{ jobId: string; status: string }>(`/api/sync/connections/${connectionId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  syncRestaurant: (restaurantId: string, data: { menuId: string; trigger?: string }) =>
    request<{
      restaurantId: string;
      menuId: string;
      results: Array<{ connectionId: string; platform: string; status: string }>;
      totalConnections: number;
      synced: number;
      skipped: number;
      failed: number;
    }>(`/api/sync/restaurants/${restaurantId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  diff: (connectionId: string, menuId: string) =>
    request<SyncDiff>(`/api/sync/connections/${connectionId}/diff?menuId=${menuId}`),
  getJob: (jobId: string) => request<SyncJob>(`/api/sync/jobs/${jobId}`),
  restaurantHistory: (restaurantId: string, limit = 50, offset = 0) =>
    request<SyncHistoryEntry[]>(
      `/api/sync/restaurants/${restaurantId}/history?limit=${limit}&offset=${offset}`,
    ),
  connectionHistory: (connectionId: string) =>
    request<SyncHistoryEntry[]>(`/api/sync/connections/${connectionId}/history`),
  restaurantStatus: (restaurantId: string) =>
    request<SyncStatus>(`/api/sync/restaurants/${restaurantId}/status`),
};
