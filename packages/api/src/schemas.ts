import { z } from 'zod';

// ── Restaurants ──────────────────────────────────────────────────────────────

export const createRestaurantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  contactEmail: z.string().email().nullish(),
  contactPhone: z.string().nullish(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  postalCode: z.string().nullish(),
  timezone: z.string().default('UTC'),
  active: z.boolean().default(true),
  settings: z.record(z.unknown()).nullish(),
});

export const updateRestaurantSchema = createRestaurantSchema.partial();

// ── Menus ────────────────────────────────────────────────────────────────────

export const createMenuSchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateMenuSchema = createMenuSchema.omit({ restaurantId: true }).partial();

// ── Categories ───────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  menuId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.omit({ menuId: true }).partial();

// ── Items ────────────────────────────────────────────────────────────────────

export const createItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  basePrice: z.number().int().min(0),
  imageUrl: z.string().url().nullish(),
  active: z.boolean().default(true),
  availableFrom: z.string().nullish(), // HH:MM format
  availableTo: z.string().nullish(),
  sortOrder: z.number().int().default(0),
});

export const updateItemSchema = createItemSchema.omit({ categoryId: true }).partial();

// ── Modifier Groups ─────────────────────────────────────────────────────────

export const createModifierGroupSchema = z.object({
  itemId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  required: z.boolean().default(false),
  minSelections: z.number().int().min(0).default(0),
  maxSelections: z.number().int().min(1).nullish(),
  sortOrder: z.number().int().default(0),
});

export const updateModifierGroupSchema = createModifierGroupSchema
  .omit({ itemId: true })
  .partial();

// ── Modifiers ────────────────────────────────────────────────────────────────

export const createModifierSchema = z.object({
  modifierGroupId: z.string().uuid(),
  name: z.string().min(1),
  priceAdjustment: z.number().int().default(0),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateModifierSchema = createModifierSchema
  .omit({ modifierGroupId: true })
  .partial();

// ── Platform Pricing ─────────────────────────────────────────────────────────

export const createPlatformPricingSchema = z.object({
  itemId: z.string().uuid(),
  platform: z.string().min(1),
  price: z.number().int().min(0),
});

export const updatePlatformPricingSchema = z.object({
  price: z.number().int().min(0),
});

// ── Platform Connections ────────────────────────────────────────────────────

const doordashCredentialsSchema = z.object({
  developerId: z.string().min(1),
  keyId: z.string().min(1),
  signingSecret: z.string().min(1),
});

const uberEatsCredentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

export const createPlatformConnectionSchema = z
  .object({
    restaurantId: z.string().uuid(),
    platform: z.enum(['doordash', 'uber_eats']),
    externalStoreId: z.string().min(1).nullish(),
    credentials: z.union([doordashCredentialsSchema, uberEatsCredentialsSchema]),
    enabled: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.platform === 'doordash') {
        return doordashCredentialsSchema.safeParse(data.credentials).success;
      }
      return uberEatsCredentialsSchema.safeParse(data.credentials).success;
    },
    { message: 'Credentials do not match the selected platform', path: ['credentials'] },
  );

export const updatePlatformConnectionSchema = z.object({
  externalStoreId: z.string().min(1).nullish(),
  credentials: z.union([doordashCredentialsSchema, uberEatsCredentialsSchema]).optional(),
  enabled: z.boolean().optional(),
});

export const menuSyncSchema = z.object({
  menuId: z.string().uuid(),
});
