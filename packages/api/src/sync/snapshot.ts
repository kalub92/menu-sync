import { createHash } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  menus,
  categories,
  items,
  modifierGroups,
  modifiers,
  platformPricing,
} from '../db/schema.js';

/**
 * Normalized snapshot of a menu for diffing.
 * All arrays are sorted by sortOrder for deterministic comparison.
 */
export interface MenuSnapshot {
  menuId: string;
  menuName: string;
  categories: CategorySnapshot[];
}

export interface CategorySnapshot {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  items: ItemSnapshot[];
}

export interface ItemSnapshot {
  id: string;
  name: string;
  description: string | null;
  price: number; // effective price (platform-specific or base)
  imageUrl: string | null;
  active: boolean;
  availableFrom: string | null;
  availableTo: string | null;
  sortOrder: number;
  modifierGroups: ModifierGroupSnapshot[];
}

export interface ModifierGroupSnapshot {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  minSelections: number;
  maxSelections: number | null;
  sortOrder: number;
  modifiers: ModifierSnapshot[];
}

export interface ModifierSnapshot {
  id: string;
  name: string;
  priceAdjustment: number;
  active: boolean;
  sortOrder: number;
}

/**
 * Build a normalized snapshot of a menu's current state.
 * Includes only active categories/items for sync purposes.
 * Uses platform-specific pricing when available.
 */
export async function buildMenuSnapshot(
  menuId: string,
  platform: string,
): Promise<MenuSnapshot | null> {
  const menu = await db.query.menus.findFirst({
    where: eq(menus.id, menuId),
  });
  if (!menu) return null;

  const menuCategories = await db.query.categories.findMany({
    where: eq(categories.menuId, menuId),
    orderBy: (c, { asc }) => [asc(c.sortOrder), asc(c.name)],
  });

  const categorySnapshots: CategorySnapshot[] = await Promise.all(
    menuCategories
      .filter((c) => c.active)
      .map(async (cat) => {
        const catItems = await db.query.items.findMany({
          where: eq(items.categoryId, cat.id),
          orderBy: (i, { asc }) => [asc(i.sortOrder), asc(i.name)],
        });

        const itemSnapshots: ItemSnapshot[] = await Promise.all(
          catItems
            .filter((i) => i.active)
            .map(async (item) => {
              const groups = await db.query.modifierGroups.findMany({
                where: eq(modifierGroups.itemId, item.id),
                orderBy: (mg, { asc }) => [asc(mg.sortOrder), asc(mg.name)],
              });

              const groupSnapshots: ModifierGroupSnapshot[] = await Promise.all(
                groups.map(async (g) => {
                  const mods = await db.query.modifiers.findMany({
                    where: eq(modifiers.modifierGroupId, g.id),
                    orderBy: (m, { asc }) => [asc(m.sortOrder), asc(m.name)],
                  });

                  return {
                    id: g.id,
                    name: g.name,
                    description: g.description,
                    required: g.required,
                    minSelections: g.minSelections,
                    maxSelections: g.maxSelections,
                    sortOrder: g.sortOrder,
                    modifiers: mods.map((m) => ({
                      id: m.id,
                      name: m.name,
                      priceAdjustment: m.priceAdjustment,
                      active: m.active,
                      sortOrder: m.sortOrder,
                    })),
                  };
                }),
              );

              // Platform-specific pricing override
              const pricing = await db.query.platformPricing.findFirst({
                where: and(
                  eq(platformPricing.itemId, item.id),
                  eq(platformPricing.platform, platform),
                ),
              });

              return {
                id: item.id,
                name: item.name,
                description: item.description,
                price: pricing?.price ?? item.basePrice,
                imageUrl: item.imageUrl,
                active: item.active,
                availableFrom: item.availableFrom,
                availableTo: item.availableTo,
                sortOrder: item.sortOrder,
                modifierGroups: groupSnapshots,
              };
            }),
        );

        return {
          id: cat.id,
          name: cat.name,
          description: cat.description,
          sortOrder: cat.sortOrder,
          active: cat.active,
          items: itemSnapshots,
        };
      }),
  );

  return {
    menuId: menu.id,
    menuName: menu.name,
    categories: categorySnapshots,
  };
}

/**
 * Compute a deterministic checksum for a snapshot.
 * Used to quickly detect if anything changed.
 */
export function computeChecksum(snapshot: MenuSnapshot): string {
  const json = JSON.stringify(snapshot);
  return createHash('sha256').update(json).digest('hex');
}
