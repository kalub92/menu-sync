import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  time,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Restaurants ──────────────────────────────────────────────────────────────

export const restaurants = pgTable('restaurants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  timezone: text('timezone').default('UTC').notNull(),
  active: boolean('active').default(true).notNull(),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  menus: many(menus),
  platformConnections: many(platformConnections),
}));

// ── Menus ────────────────────────────────────────────────────────────────────

export const menus = pgTable('menus', {
  id: uuid('id').defaultRandom().primaryKey(),
  restaurantId: uuid('restaurant_id')
    .references(() => restaurants.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const menusRelations = relations(menus, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [menus.restaurantId],
    references: [restaurants.id],
  }),
  categories: many(categories),
}));

// ── Categories ───────────────────────────────────────────────────────────────

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  menuId: uuid('menu_id')
    .references(() => menus.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  menu: one(menus, {
    fields: [categories.menuId],
    references: [menus.id],
  }),
  items: many(items),
}));

// ── Items ────────────────────────────────────────────────────────────────────

export const items = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  categoryId: uuid('category_id')
    .references(() => categories.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  basePrice: integer('base_price').notNull(), // cents
  imageUrl: text('image_url'),
  active: boolean('active').default(true).notNull(),
  availableFrom: time('available_from'),
  availableTo: time('available_to'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const itemsRelations = relations(items, ({ one, many }) => ({
  category: one(categories, {
    fields: [items.categoryId],
    references: [categories.id],
  }),
  modifierGroups: many(modifierGroups),
  platformPricing: many(platformPricing),
}));

// ── Modifier Groups ─────────────────────────────────────────────────────────

export const modifierGroups = pgTable('modifier_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id')
    .references(() => items.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  required: boolean('required').default(false).notNull(),
  minSelections: integer('min_selections').default(0).notNull(),
  maxSelections: integer('max_selections'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const modifierGroupsRelations = relations(
  modifierGroups,
  ({ one, many }) => ({
    item: one(items, {
      fields: [modifierGroups.itemId],
      references: [items.id],
    }),
    modifiers: many(modifiers),
  }),
);

// ── Modifiers ────────────────────────────────────────────────────────────────

export const modifiers = pgTable('modifiers', {
  id: uuid('id').defaultRandom().primaryKey(),
  modifierGroupId: uuid('modifier_group_id')
    .references(() => modifierGroups.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  priceAdjustment: integer('price_adjustment').default(0).notNull(), // cents
  active: boolean('active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const modifiersRelations = relations(modifiers, ({ one }) => ({
  modifierGroup: one(modifierGroups, {
    fields: [modifiers.modifierGroupId],
    references: [modifierGroups.id],
  }),
}));

// ── Platform Pricing ─────────────────────────────────────────────────────────

export const platformPricing = pgTable(
  'platform_pricing',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    itemId: uuid('item_id')
      .references(() => items.id, { onDelete: 'cascade' })
      .notNull(),
    platform: text('platform').notNull(), // 'doordash', 'uber_eats', etc.
    price: integer('price').notNull(), // cents
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('platform_pricing_item_platform_idx').on(table.itemId, table.platform)],
);

export const platformPricingRelations = relations(platformPricing, ({ one }) => ({
  item: one(items, {
    fields: [platformPricing.itemId],
    references: [items.id],
  }),
}));

// ── Platform Connections ────────────────────────────────────────────────────

export const platformConnections = pgTable(
  'platform_connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurantId: uuid('restaurant_id')
      .references(() => restaurants.id, { onDelete: 'cascade' })
      .notNull(),
    platform: text('platform').notNull(), // 'doordash', 'uber_eats'
    externalStoreId: text('external_store_id'), // platform-specific store/merchant ID
    credentials: jsonb('credentials').notNull(), // encrypted API keys, tokens, etc.
    enabled: boolean('enabled').default(true).notNull(),
    lastSyncAt: timestamp('last_sync_at'),
    lastSyncStatus: text('last_sync_status'), // 'success', 'error', 'pending'
    lastSyncError: text('last_sync_error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('platform_connections_restaurant_platform_idx').on(
      table.restaurantId,
      table.platform,
    ),
  ],
);

export const platformConnectionsRelations = relations(platformConnections, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [platformConnections.restaurantId],
    references: [restaurants.id],
  }),
  syncJobs: many(syncJobs),
  syncSnapshots: many(syncSnapshots),
  syncHistory: many(syncHistory),
}));

// ── Sync Jobs ───────────────────────────────────────────────────────────────

export const syncJobs = pgTable('sync_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  connectionId: uuid('connection_id')
    .references(() => platformConnections.id, { onDelete: 'cascade' })
    .notNull(),
  menuId: uuid('menu_id')
    .references(() => menus.id, { onDelete: 'cascade' })
    .notNull(),
  status: text('status').default('pending').notNull(), // pending, processing, completed, failed
  priority: integer('priority').default(0).notNull(),
  trigger: text('trigger').default('manual').notNull(), // manual, auto, retry
  attempt: integer('attempt').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(3).notNull(),
  externalJobId: text('external_job_id'),
  error: text('error'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  nextRetryAt: timestamp('next_retry_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const syncJobsRelations = relations(syncJobs, ({ one }) => ({
  connection: one(platformConnections, {
    fields: [syncJobs.connectionId],
    references: [platformConnections.id],
  }),
  menu: one(menus, {
    fields: [syncJobs.menuId],
    references: [menus.id],
  }),
}));

// ── Sync Snapshots ──────────────────────────────────────────────────────────

export const syncSnapshots = pgTable(
  'sync_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    connectionId: uuid('connection_id')
      .references(() => platformConnections.id, { onDelete: 'cascade' })
      .notNull(),
    menuId: uuid('menu_id')
      .references(() => menus.id, { onDelete: 'cascade' })
      .notNull(),
    snapshot: jsonb('snapshot').notNull(),
    checksum: text('checksum').notNull(),
    syncJobId: uuid('sync_job_id').references(() => syncJobs.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sync_snapshots_connection_menu_idx').on(table.connectionId, table.menuId),
  ],
);

export const syncSnapshotsRelations = relations(syncSnapshots, ({ one }) => ({
  connection: one(platformConnections, {
    fields: [syncSnapshots.connectionId],
    references: [platformConnections.id],
  }),
  menu: one(menus, {
    fields: [syncSnapshots.menuId],
    references: [menus.id],
  }),
  syncJob: one(syncJobs, {
    fields: [syncSnapshots.syncJobId],
    references: [syncJobs.id],
  }),
}));

// ── Sync History ────────────────────────────────────────────────────────────

export const syncHistory = pgTable('sync_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  connectionId: uuid('connection_id')
    .references(() => platformConnections.id, { onDelete: 'cascade' })
    .notNull(),
  menuId: uuid('menu_id')
    .references(() => menus.id, { onDelete: 'cascade' })
    .notNull(),
  syncJobId: uuid('sync_job_id').references(() => syncJobs.id, { onDelete: 'set null' }),
  status: text('status').notNull(), // success, error
  trigger: text('trigger').default('manual').notNull(),
  platform: text('platform').notNull(),
  restaurantId: uuid('restaurant_id')
    .references(() => restaurants.id, { onDelete: 'cascade' })
    .notNull(),
  changesSummary: jsonb('changes_summary'), // { added: N, modified: N, removed: N, details: [...] }
  externalJobId: text('external_job_id'),
  error: text('error'),
  durationMs: integer('duration_ms'),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const syncHistoryRelations = relations(syncHistory, ({ one }) => ({
  connection: one(platformConnections, {
    fields: [syncHistory.connectionId],
    references: [platformConnections.id],
  }),
  menu: one(menus, {
    fields: [syncHistory.menuId],
    references: [menus.id],
  }),
  restaurant: one(restaurants, {
    fields: [syncHistory.restaurantId],
    references: [restaurants.id],
  }),
  syncJob: one(syncJobs, {
    fields: [syncHistory.syncJobId],
    references: [syncJobs.id],
  }),
}));
