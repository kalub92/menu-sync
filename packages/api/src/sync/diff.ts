import type {
  MenuSnapshot,
  CategorySnapshot,
  ItemSnapshot,
  ModifierGroupSnapshot,
  ModifierSnapshot,
} from './snapshot.js';

// ── Change types ────────────────────────────────────────────────────────────

export type ChangeType = 'added' | 'removed' | 'modified';

export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface EntityChange {
  type: ChangeType;
  entityType: 'category' | 'item' | 'modifier_group' | 'modifier';
  entityId: string;
  entityName: string;
  fields?: FieldChange[];
  children?: EntityChange[];
}

export interface MenuDiff {
  hasChanges: boolean;
  menuNameChanged: boolean;
  oldMenuName?: string;
  newMenuName?: string;
  changes: EntityChange[];
  summary: {
    added: number;
    modified: number;
    removed: number;
  };
}

// ── Diff engine ─────────────────────────────────────────────────────────────

/**
 * Compare two menu snapshots and produce a structured diff.
 * The canonical menu (newSnapshot) is source of truth.
 */
export function diffMenuSnapshots(
  oldSnapshot: MenuSnapshot | null,
  newSnapshot: MenuSnapshot,
): MenuDiff {
  if (!oldSnapshot) {
    // First sync — everything is new
    const changes: EntityChange[] = newSnapshot.categories.map((cat) => ({
      type: 'added' as const,
      entityType: 'category' as const,
      entityId: cat.id,
      entityName: cat.name,
      children: cat.items.map((item) => ({
        type: 'added' as const,
        entityType: 'item' as const,
        entityId: item.id,
        entityName: item.name,
      })),
    }));

    const totalItems = newSnapshot.categories.reduce((sum, c) => sum + c.items.length, 0);
    return {
      hasChanges: true,
      menuNameChanged: false,
      changes,
      summary: {
        added: newSnapshot.categories.length + totalItems,
        modified: 0,
        removed: 0,
      },
    };
  }

  const changes: EntityChange[] = [];
  let added = 0;
  let modified = 0;
  let removed = 0;

  const menuNameChanged = oldSnapshot.menuName !== newSnapshot.menuName;

  // Index old categories by ID for O(1) lookup
  const oldCatMap = new Map(oldSnapshot.categories.map((c) => [c.id, c]));
  const newCatMap = new Map(newSnapshot.categories.map((c) => [c.id, c]));

  // Find added and modified categories
  for (const newCat of newSnapshot.categories) {
    const oldCat = oldCatMap.get(newCat.id);
    if (!oldCat) {
      added++;
      const itemChanges = newCat.items.map((item) => {
        added++;
        return {
          type: 'added' as const,
          entityType: 'item' as const,
          entityId: item.id,
          entityName: item.name,
        };
      });
      changes.push({
        type: 'added',
        entityType: 'category',
        entityId: newCat.id,
        entityName: newCat.name,
        children: itemChanges,
      });
    } else {
      const catChange = diffCategory(oldCat, newCat);
      if (catChange) {
        changes.push(catChange.change);
        added += catChange.added;
        modified += catChange.modified;
        removed += catChange.removed;
      }
    }
  }

  // Find removed categories
  for (const oldCat of oldSnapshot.categories) {
    if (!newCatMap.has(oldCat.id)) {
      removed++;
      removed += oldCat.items.length;
      changes.push({
        type: 'removed',
        entityType: 'category',
        entityId: oldCat.id,
        entityName: oldCat.name,
        children: oldCat.items.map((item) => ({
          type: 'removed' as const,
          entityType: 'item' as const,
          entityId: item.id,
          entityName: item.name,
        })),
      });
    }
  }

  return {
    hasChanges: changes.length > 0 || menuNameChanged,
    menuNameChanged,
    oldMenuName: menuNameChanged ? oldSnapshot.menuName : undefined,
    newMenuName: menuNameChanged ? newSnapshot.menuName : undefined,
    changes,
    summary: { added, modified, removed },
  };
}

function diffCategory(
  oldCat: CategorySnapshot,
  newCat: CategorySnapshot,
): { change: EntityChange; added: number; modified: number; removed: number } | null {
  let added = 0;
  let modified = 0;
  let removed = 0;

  // Check category-level field changes
  const catFields = diffFields(oldCat, newCat, ['name', 'description', 'sortOrder']);
  const children: EntityChange[] = [];

  // Diff items
  const oldItemMap = new Map(oldCat.items.map((i) => [i.id, i]));
  const newItemMap = new Map(newCat.items.map((i) => [i.id, i]));

  for (const newItem of newCat.items) {
    const oldItem = oldItemMap.get(newItem.id);
    if (!oldItem) {
      added++;
      children.push({
        type: 'added',
        entityType: 'item',
        entityId: newItem.id,
        entityName: newItem.name,
      });
    } else {
      const itemChange = diffItem(oldItem, newItem);
      if (itemChange) {
        children.push(itemChange.change);
        added += itemChange.added;
        modified += itemChange.modified;
        removed += itemChange.removed;
      }
    }
  }

  for (const oldItem of oldCat.items) {
    if (!newItemMap.has(oldItem.id)) {
      removed++;
      children.push({
        type: 'removed',
        entityType: 'item',
        entityId: oldItem.id,
        entityName: oldItem.name,
      });
    }
  }

  if (catFields.length === 0 && children.length === 0) return null;

  if (catFields.length > 0) modified++;

  return {
    change: {
      type: 'modified',
      entityType: 'category',
      entityId: newCat.id,
      entityName: newCat.name,
      fields: catFields.length > 0 ? catFields : undefined,
      children: children.length > 0 ? children : undefined,
    },
    added,
    modified,
    removed,
  };
}

function diffItem(
  oldItem: ItemSnapshot,
  newItem: ItemSnapshot,
): { change: EntityChange; added: number; modified: number; removed: number } | null {
  let added = 0;
  let modified = 0;
  let removed = 0;

  const itemFields = diffFields(oldItem, newItem, [
    'name',
    'description',
    'price',
    'imageUrl',
    'active',
    'availableFrom',
    'availableTo',
    'sortOrder',
  ]);

  const children: EntityChange[] = [];

  // Diff modifier groups
  const oldMgMap = new Map(oldItem.modifierGroups.map((mg) => [mg.id, mg]));
  const newMgMap = new Map(newItem.modifierGroups.map((mg) => [mg.id, mg]));

  for (const newMg of newItem.modifierGroups) {
    const oldMg = oldMgMap.get(newMg.id);
    if (!oldMg) {
      added++;
      children.push({
        type: 'added',
        entityType: 'modifier_group',
        entityId: newMg.id,
        entityName: newMg.name,
      });
    } else {
      const mgChange = diffModifierGroup(oldMg, newMg);
      if (mgChange) {
        children.push(mgChange.change);
        added += mgChange.added;
        modified += mgChange.modified;
        removed += mgChange.removed;
      }
    }
  }

  for (const oldMg of oldItem.modifierGroups) {
    if (!newMgMap.has(oldMg.id)) {
      removed++;
      children.push({
        type: 'removed',
        entityType: 'modifier_group',
        entityId: oldMg.id,
        entityName: oldMg.name,
      });
    }
  }

  if (itemFields.length === 0 && children.length === 0) return null;

  if (itemFields.length > 0) modified++;

  return {
    change: {
      type: 'modified',
      entityType: 'item',
      entityId: newItem.id,
      entityName: newItem.name,
      fields: itemFields.length > 0 ? itemFields : undefined,
      children: children.length > 0 ? children : undefined,
    },
    added,
    modified,
    removed,
  };
}

function diffModifierGroup(
  oldMg: ModifierGroupSnapshot,
  newMg: ModifierGroupSnapshot,
): { change: EntityChange; added: number; modified: number; removed: number } | null {
  let added = 0;
  let modified = 0;
  let removed = 0;

  const mgFields = diffFields(oldMg, newMg, [
    'name',
    'description',
    'required',
    'minSelections',
    'maxSelections',
    'sortOrder',
  ]);

  const children: EntityChange[] = [];

  const oldModMap = new Map(oldMg.modifiers.map((m) => [m.id, m]));
  const newModMap = new Map(newMg.modifiers.map((m) => [m.id, m]));

  for (const newMod of newMg.modifiers) {
    const oldMod = oldModMap.get(newMod.id);
    if (!oldMod) {
      added++;
      children.push({
        type: 'added',
        entityType: 'modifier',
        entityId: newMod.id,
        entityName: newMod.name,
      });
    } else {
      const modFields = diffFields(oldMod, newMod, [
        'name',
        'priceAdjustment',
        'active',
        'sortOrder',
      ]);
      if (modFields.length > 0) {
        modified++;
        children.push({
          type: 'modified',
          entityType: 'modifier',
          entityId: newMod.id,
          entityName: newMod.name,
          fields: modFields,
        });
      }
    }
  }

  for (const oldMod of oldMg.modifiers) {
    if (!newModMap.has(oldMod.id)) {
      removed++;
      children.push({
        type: 'removed',
        entityType: 'modifier',
        entityId: oldMod.id,
        entityName: oldMod.name,
      });
    }
  }

  if (mgFields.length === 0 && children.length === 0) return null;

  if (mgFields.length > 0) modified++;

  return {
    change: {
      type: 'modified',
      entityType: 'modifier_group',
      entityId: newMg.id,
      entityName: newMg.name,
      fields: mgFields.length > 0 ? mgFields : undefined,
      children: children.length > 0 ? children : undefined,
    },
    added,
    modified,
    removed,
  };
}

function diffFields<T>(
  oldObj: T,
  newObj: T,
  fields: (keyof T & string)[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fields) {
    const oldVal = oldObj[field];
    const newVal = newObj[field];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field, oldValue: oldVal, newValue: newVal });
    }
  }
  return changes;
}
