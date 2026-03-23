import { describe, it, expect } from 'vitest';
import { diffMenuSnapshots } from './diff.js';
import type { MenuSnapshot } from './snapshot.js';

function makeSnapshot(overrides?: Partial<MenuSnapshot>): MenuSnapshot {
  return {
    menuId: 'menu-1',
    menuName: 'Lunch Menu',
    categories: [],
    ...overrides,
  };
}

describe('diffMenuSnapshots', () => {
  it('treats null old snapshot as initial sync (everything added)', () => {
    const newSnap = makeSnapshot({
      categories: [
        {
          id: 'cat-1',
          name: 'Appetizers',
          description: null,
          sortOrder: 0,
          active: true,
          items: [
            {
              id: 'item-1',
              name: 'Spring Rolls',
              description: 'Crispy rolls',
              price: 899,
              imageUrl: null,
              active: true,
              availableFrom: null,
              availableTo: null,
              sortOrder: 0,
              modifierGroups: [],
            },
          ],
        },
      ],
    });

    const diff = diffMenuSnapshots(null, newSnap);

    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.added).toBe(2); // 1 category + 1 item
    expect(diff.summary.modified).toBe(0);
    expect(diff.summary.removed).toBe(0);
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0].type).toBe('added');
    expect(diff.changes[0].entityType).toBe('category');
  });

  it('returns no changes for identical snapshots', () => {
    const snap = makeSnapshot({
      categories: [
        {
          id: 'cat-1',
          name: 'Mains',
          description: null,
          sortOrder: 0,
          active: true,
          items: [
            {
              id: 'item-1',
              name: 'Burger',
              description: null,
              price: 1299,
              imageUrl: null,
              active: true,
              availableFrom: null,
              availableTo: null,
              sortOrder: 0,
              modifierGroups: [],
            },
          ],
        },
      ],
    });

    const diff = diffMenuSnapshots(snap, snap);

    expect(diff.hasChanges).toBe(false);
    expect(diff.summary.added).toBe(0);
    expect(diff.summary.modified).toBe(0);
    expect(diff.summary.removed).toBe(0);
  });

  it('detects added categories', () => {
    const oldSnap = makeSnapshot({ categories: [] });
    const newSnap = makeSnapshot({
      categories: [
        {
          id: 'cat-1',
          name: 'Desserts',
          description: null,
          sortOrder: 0,
          active: true,
          items: [],
        },
      ],
    });

    const diff = diffMenuSnapshots(oldSnap, newSnap);

    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.added).toBe(1);
    expect(diff.changes[0].type).toBe('added');
    expect(diff.changes[0].entityName).toBe('Desserts');
  });

  it('detects removed categories', () => {
    const oldSnap = makeSnapshot({
      categories: [
        {
          id: 'cat-1',
          name: 'Salads',
          description: null,
          sortOrder: 0,
          active: true,
          items: [
            {
              id: 'item-1',
              name: 'Caesar',
              description: null,
              price: 999,
              imageUrl: null,
              active: true,
              availableFrom: null,
              availableTo: null,
              sortOrder: 0,
              modifierGroups: [],
            },
          ],
        },
      ],
    });
    const newSnap = makeSnapshot({ categories: [] });

    const diff = diffMenuSnapshots(oldSnap, newSnap);

    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.removed).toBe(2); // 1 category + 1 item
    expect(diff.changes[0].type).toBe('removed');
  });

  it('detects modified item price', () => {
    const oldSnap = makeSnapshot({
      categories: [
        {
          id: 'cat-1',
          name: 'Mains',
          description: null,
          sortOrder: 0,
          active: true,
          items: [
            {
              id: 'item-1',
              name: 'Burger',
              description: null,
              price: 1299,
              imageUrl: null,
              active: true,
              availableFrom: null,
              availableTo: null,
              sortOrder: 0,
              modifierGroups: [],
            },
          ],
        },
      ],
    });
    const newSnap = makeSnapshot({
      categories: [
        {
          id: 'cat-1',
          name: 'Mains',
          description: null,
          sortOrder: 0,
          active: true,
          items: [
            {
              id: 'item-1',
              name: 'Burger',
              description: null,
              price: 1499,
              imageUrl: null,
              active: true,
              availableFrom: null,
              availableTo: null,
              sortOrder: 0,
              modifierGroups: [],
            },
          ],
        },
      ],
    });

    const diff = diffMenuSnapshots(oldSnap, newSnap);

    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.modified).toBe(1);
    const catChange = diff.changes[0];
    expect(catChange.type).toBe('modified');
    const itemChange = catChange.children![0];
    expect(itemChange.type).toBe('modified');
    expect(itemChange.fields).toEqual([
      { field: 'price', oldValue: 1299, newValue: 1499 },
    ]);
  });

  it('detects added items in existing category', () => {
    const oldSnap = makeSnapshot({
      categories: [
        {
          id: 'cat-1',
          name: 'Drinks',
          description: null,
          sortOrder: 0,
          active: true,
          items: [
            {
              id: 'item-1',
              name: 'Water',
              description: null,
              price: 199,
              imageUrl: null,
              active: true,
              availableFrom: null,
              availableTo: null,
              sortOrder: 0,
              modifierGroups: [],
            },
          ],
        },
      ],
    });
    const newSnap = makeSnapshot({
      categories: [
        {
          id: 'cat-1',
          name: 'Drinks',
          description: null,
          sortOrder: 0,
          active: true,
          items: [
            {
              id: 'item-1',
              name: 'Water',
              description: null,
              price: 199,
              imageUrl: null,
              active: true,
              availableFrom: null,
              availableTo: null,
              sortOrder: 0,
              modifierGroups: [],
            },
            {
              id: 'item-2',
              name: 'Soda',
              description: null,
              price: 299,
              imageUrl: null,
              active: true,
              availableFrom: null,
              availableTo: null,
              sortOrder: 1,
              modifierGroups: [],
            },
          ],
        },
      ],
    });

    const diff = diffMenuSnapshots(oldSnap, newSnap);

    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.added).toBe(1);
    const catChange = diff.changes[0];
    expect(catChange.children).toHaveLength(1);
    expect(catChange.children![0].type).toBe('added');
    expect(catChange.children![0].entityName).toBe('Soda');
  });

  it('detects modifier group changes', () => {
    const oldSnap = makeSnapshot({
      categories: [
        {
          id: 'cat-1',
          name: 'Mains',
          description: null,
          sortOrder: 0,
          active: true,
          items: [
            {
              id: 'item-1',
              name: 'Pizza',
              description: null,
              price: 1599,
              imageUrl: null,
              active: true,
              availableFrom: null,
              availableTo: null,
              sortOrder: 0,
              modifierGroups: [
                {
                  id: 'mg-1',
                  name: 'Size',
                  description: null,
                  required: true,
                  minSelections: 1,
                  maxSelections: 1,
                  sortOrder: 0,
                  modifiers: [
                    { id: 'mod-1', name: 'Small', priceAdjustment: 0, active: true, sortOrder: 0 },
                    { id: 'mod-2', name: 'Large', priceAdjustment: 300, active: true, sortOrder: 1 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const newSnap = makeSnapshot({
      categories: [
        {
          id: 'cat-1',
          name: 'Mains',
          description: null,
          sortOrder: 0,
          active: true,
          items: [
            {
              id: 'item-1',
              name: 'Pizza',
              description: null,
              price: 1599,
              imageUrl: null,
              active: true,
              availableFrom: null,
              availableTo: null,
              sortOrder: 0,
              modifierGroups: [
                {
                  id: 'mg-1',
                  name: 'Size',
                  description: null,
                  required: true,
                  minSelections: 1,
                  maxSelections: 1,
                  sortOrder: 0,
                  modifiers: [
                    { id: 'mod-1', name: 'Small', priceAdjustment: 0, active: true, sortOrder: 0 },
                    { id: 'mod-2', name: 'Large', priceAdjustment: 400, active: true, sortOrder: 1 },
                    { id: 'mod-3', name: 'XL', priceAdjustment: 600, active: true, sortOrder: 2 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const diff = diffMenuSnapshots(oldSnap, newSnap);

    expect(diff.hasChanges).toBe(true);
    expect(diff.summary.added).toBe(1); // new modifier
    expect(diff.summary.modified).toBe(1); // changed modifier price
  });

  it('detects menu name change', () => {
    const oldSnap = makeSnapshot({ menuName: 'Lunch Menu' });
    const newSnap = makeSnapshot({ menuName: 'Lunch Specials' });

    const diff = diffMenuSnapshots(oldSnap, newSnap);

    expect(diff.hasChanges).toBe(true);
    expect(diff.menuNameChanged).toBe(true);
    expect(diff.oldMenuName).toBe('Lunch Menu');
    expect(diff.newMenuName).toBe('Lunch Specials');
  });
});
