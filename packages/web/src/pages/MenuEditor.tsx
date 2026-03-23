import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menus, categories, items, modifierGroups, modifiers } from '../api/client';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import type {
  Menu,
  Category,
  Item,
  ModifierGroup,
  CreateMenu,
  CreateCategory,
  CreateItem,
  CreateModifierGroup,
  CreateModifier,
} from '../api/types';

export function MenuEditor() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const queryClient = useQueryClient();
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const { data: menuList = [], isLoading } = useQuery({
    queryKey: ['menus', restaurantId],
    queryFn: () => menus.listForRestaurant(restaurantId!),
    enabled: !!restaurantId,
  });

  const createMenuMutation = useMutation({
    mutationFn: menus.create,
    onSuccess: (newMenu) => {
      queryClient.invalidateQueries({ queryKey: ['menus', restaurantId] });
      setShowCreateMenu(false);
      setSelectedMenuId(newMenu.id);
    },
  });

  const deleteMenuMutation = useMutation({
    mutationFn: menus.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus', restaurantId] });
      setSelectedMenuId(null);
    },
  });

  if (isLoading) return <div className="animate-pulse h-48 rounded-lg bg-gray-200" />;

  const activeMenu = menuList.find((m) => m.id === selectedMenuId) ?? menuList[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Menus</h1>
        <button
          onClick={() => setShowCreateMenu(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New Menu
        </button>
      </div>

      {menuList.length === 0 ? (
        <EmptyState
          title="No menus yet"
          description="Create your first menu to start adding categories and items."
          action={
            <button
              onClick={() => setShowCreateMenu(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Create Menu
            </button>
          }
        />
      ) : (
        <>
          {/* Menu tabs */}
          <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-2">
            {menuList.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMenuId(m.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-medium ${
                  activeMenu?.id === m.id
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {m.name}
                {!m.active && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                    Inactive
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeMenu && (
            <MenuDetail
              menu={activeMenu}
              restaurantId={restaurantId!}
              onDelete={() => {
                if (confirm(`Delete menu "${activeMenu.name}"?`))
                  deleteMenuMutation.mutate(activeMenu.id);
              }}
            />
          )}
        </>
      )}

      <Modal open={showCreateMenu} onClose={() => setShowCreateMenu(false)} title="New Menu">
        <SimpleForm
          fields={[
            { name: 'name', label: 'Menu Name', required: true },
            { name: 'description', label: 'Description' },
          ]}
          onSubmit={(data) =>
            createMenuMutation.mutate({
              ...data,
              restaurantId: restaurantId!,
            } as CreateMenu)
          }
          loading={createMenuMutation.isPending}
          error={createMenuMutation.error?.message}
          submitLabel="Create Menu"
        />
      </Modal>
    </div>
  );
}

// ── Menu detail with categories ─────────────────────────────────────────────

function MenuDetail({
  menu,
  restaurantId,
  onDelete,
}: {
  menu: Menu;
  restaurantId: string;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const [showAddCategory, setShowAddCategory] = useState(false);

  const { data: categoryList = [] } = useQuery({
    queryKey: ['categories', menu.id],
    queryFn: () => categories.listForMenu(menu.id),
  });

  const createCategoryMutation = useMutation({
    mutationFn: categories.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', menu.id] });
      setShowAddCategory(false);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg bg-white border border-gray-200 p-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{menu.name}</h2>
          {menu.description && <p className="text-sm text-gray-500">{menu.description}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddCategory(true)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Add Category
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            Delete Menu
          </button>
        </div>
      </div>

      {categoryList.length === 0 ? (
        <EmptyState
          title="No categories"
          description="Add categories to organize your menu items."
          action={
            <button
              onClick={() => setShowAddCategory(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add Category
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {categoryList.map((cat) => (
            <CategorySection key={cat.id} category={cat} menuId={menu.id} />
          ))}
        </div>
      )}

      <Modal open={showAddCategory} onClose={() => setShowAddCategory(false)} title="Add Category">
        <SimpleForm
          fields={[
            { name: 'name', label: 'Category Name', required: true },
            { name: 'description', label: 'Description' },
            { name: 'sortOrder', label: 'Sort Order', type: 'number' },
          ]}
          onSubmit={(data) =>
            createCategoryMutation.mutate({
              ...data,
              menuId: menu.id,
              sortOrder: data.sortOrder ? Number(data.sortOrder) : 0,
            } as CreateCategory)
          }
          loading={createCategoryMutation.isPending}
          error={createCategoryMutation.error?.message}
          submitLabel="Add Category"
        />
      </Modal>
    </div>
  );
}

// ── Category section with items ─────────────────────────────────────────────

function CategorySection({ category, menuId }: { category: Category; menuId: string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);

  const { data: itemList = [] } = useQuery({
    queryKey: ['items', category.id],
    queryFn: () => items.listForCategory(category.id),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: categories.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', menuId] }),
  });

  const createItemMutation = useMutation({
    mutationFn: items.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', category.id] });
      setShowAddItem(false);
    },
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div
        className="flex cursor-pointer items-center justify-between px-5 py-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
          </svg>
          <h3 className="font-medium text-gray-900">{category.name}</h3>
          <span className="text-sm text-gray-400">({itemList.length} items)</span>
          {!category.active && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">Inactive</span>
          )}
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowAddItem(true)}
            className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            + Item
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${category.name}" and all its items?`))
                deleteCategoryMutation.mutate(category.id);
            }}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          {itemList.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">
              No items yet.{' '}
              <button onClick={() => setShowAddItem(true)} className="text-indigo-600 hover:underline">
                Add one
              </button>
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {itemList.map((item) => (
                <ItemRow key={item.id} item={item} categoryId={category.id} />
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={showAddItem} onClose={() => setShowAddItem(false)} title="Add Item">
        <SimpleForm
          fields={[
            { name: 'name', label: 'Item Name', required: true },
            { name: 'description', label: 'Description' },
            { name: 'basePrice', label: 'Price (cents)', type: 'number', required: true },
            { name: 'imageUrl', label: 'Image URL' },
          ]}
          onSubmit={(data) =>
            createItemMutation.mutate({
              ...data,
              categoryId: category.id,
              basePrice: Number(data.basePrice),
            } as CreateItem)
          }
          loading={createItemMutation.isPending}
          error={createItemMutation.error?.message}
          submitLabel="Add Item"
        />
      </Modal>
    </div>
  );
}

// ── Item row with inline editing and modifiers ──────────────────────────────

function ItemRow({ item, categoryId }: { item: Item; categoryId: string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAddModGroup, setShowAddModGroup] = useState(false);

  const deleteItemMutation = useMutation({
    mutationFn: items.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items', categoryId] }),
  });

  const updateItemMutation = useMutation({
    mutationFn: (data: Partial<CreateItem>) => items.update(item.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', categoryId] });
      setEditing(false);
    },
  });

  const { data: modGroupList = [] } = useQuery({
    queryKey: ['modifier-groups', item.id],
    queryFn: () => modifierGroups.listForItem(item.id),
    enabled: expanded,
  });

  const createModGroupMutation = useMutation({
    mutationFn: modifierGroups.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', item.id] });
      setShowAddModGroup(false);
    },
  });

  if (editing) {
    return (
      <div className="px-5 py-4">
        <SimpleForm
          fields={[
            { name: 'name', label: 'Name', required: true, defaultValue: item.name },
            { name: 'description', label: 'Description', defaultValue: item.description || '' },
            {
              name: 'basePrice',
              label: 'Price (cents)',
              type: 'number',
              required: true,
              defaultValue: String(item.basePrice),
            },
            { name: 'imageUrl', label: 'Image URL', defaultValue: item.imageUrl || '' },
          ]}
          onSubmit={(data) =>
            updateItemMutation.mutate({
              name: data.name,
              description: data.description || null,
              basePrice: Number(data.basePrice),
              imageUrl: data.imageUrl || null,
            })
          }
          loading={updateItemMutation.isPending}
          error={updateItemMutation.error?.message}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-4 min-w-0">
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="h-10 w-10 rounded-md object-cover"
            />
          )}
          <div className="min-w-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-indigo-600"
            >
              {item.name}
              {!item.active && (
                <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                  Inactive
                </span>
              )}
            </button>
            {item.description && (
              <p className="truncate text-xs text-gray-500">{item.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-900">
            ${(item.basePrice / 100).toFixed(2)}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${item.name}"?`)) deleteItemMutation.mutate(item.id);
            }}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-50 bg-gray-50 px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase text-gray-500">Modifier Groups</h4>
            <button
              onClick={() => setShowAddModGroup(true)}
              className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            >
              + Modifier Group
            </button>
          </div>
          {modGroupList.length === 0 ? (
            <p className="text-xs text-gray-400">No modifier groups.</p>
          ) : (
            <div className="space-y-2">
              {modGroupList.map((mg) => (
                <ModifierGroupSection key={mg.id} group={mg} itemId={item.id} />
              ))}
            </div>
          )}

          <Modal
            open={showAddModGroup}
            onClose={() => setShowAddModGroup(false)}
            title="Add Modifier Group"
          >
            <SimpleForm
              fields={[
                { name: 'name', label: 'Group Name', required: true },
                { name: 'description', label: 'Description' },
                { name: 'minSelections', label: 'Min Selections', type: 'number' },
                { name: 'maxSelections', label: 'Max Selections', type: 'number' },
              ]}
              checkboxes={[{ name: 'required', label: 'Required' }]}
              onSubmit={(data) =>
                createModGroupMutation.mutate({
                  ...data,
                  itemId: item.id,
                  required: data.required === 'true',
                  minSelections: data.minSelections ? Number(data.minSelections) : 0,
                  maxSelections: data.maxSelections ? Number(data.maxSelections) : null,
                } as CreateModifierGroup)
              }
              loading={createModGroupMutation.isPending}
              error={createModGroupMutation.error?.message}
              submitLabel="Add Group"
            />
          </Modal>
        </div>
      )}
    </>
  );
}

// ── Modifier group with modifiers ───────────────────────────────────────────

function ModifierGroupSection({ group, itemId }: { group: ModifierGroup; itemId: string }) {
  const queryClient = useQueryClient();
  const [showAddMod, setShowAddMod] = useState(false);

  const deleteGroupMutation = useMutation({
    mutationFn: modifierGroups.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modifier-groups', itemId] }),
  });

  const createModMutation = useMutation({
    mutationFn: modifiers.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', itemId] });
      setShowAddMod(false);
    },
  });

  const deleteModMutation = useMutation({
    mutationFn: modifiers.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modifier-groups', itemId] }),
  });

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-800">{group.name}</span>
          <span className="ml-2 text-xs text-gray-400">
            {group.required ? 'Required' : 'Optional'}
            {group.minSelections > 0 && ` · Min ${group.minSelections}`}
            {group.maxSelections && ` · Max ${group.maxSelections}`}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setShowAddMod(true)}
            className="rounded px-2 py-0.5 text-xs text-indigo-600 hover:bg-indigo-50"
          >
            + Modifier
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete group "${group.name}"?`))
                deleteGroupMutation.mutate(group.id);
            }}
            className="rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {group.modifiers && group.modifiers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {group.modifiers.map((mod) => (
            <span
              key={mod.id}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs"
            >
              {mod.name}
              {mod.priceAdjustment > 0 && (
                <span className="text-gray-500">+${(mod.priceAdjustment / 100).toFixed(2)}</span>
              )}
              <button
                onClick={() => deleteModMutation.mutate(mod.id)}
                className="ml-0.5 text-gray-400 hover:text-red-500"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <Modal open={showAddMod} onClose={() => setShowAddMod(false)} title="Add Modifier">
        <SimpleForm
          fields={[
            { name: 'name', label: 'Modifier Name', required: true },
            { name: 'priceAdjustment', label: 'Price Adjustment (cents)', type: 'number' },
          ]}
          onSubmit={(data) =>
            createModMutation.mutate({
              modifierGroupId: group.id,
              name: data.name,
              priceAdjustment: data.priceAdjustment ? Number(data.priceAdjustment) : 0,
            } as CreateModifier)
          }
          loading={createModMutation.isPending}
          error={createModMutation.error?.message}
          submitLabel="Add Modifier"
        />
      </Modal>
    </div>
  );
}

// ── Reusable simple form ────────────────────────────────────────────────────

interface FieldDef {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}

function SimpleForm({
  fields,
  checkboxes,
  onSubmit,
  loading,
  error,
  submitLabel,
  onCancel,
}: {
  fields: FieldDef[];
  checkboxes?: Array<{ name: string; label: string }>;
  onSubmit: (data: Record<string, string>) => void;
  loading: boolean;
  error?: string;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    for (const f of fields) data[f.name] = fd.get(f.name) as string;
    for (const c of checkboxes ?? []) data[c.name] = fd.get(c.name) ? 'true' : 'false';
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {fields.map((f) => (
        <div key={f.name}>
          <label className="block text-sm font-medium text-gray-700">
            {f.label} {f.required && '*'}
          </label>
          <input
            name={f.name}
            type={f.type || 'text'}
            required={f.required}
            defaultValue={f.defaultValue}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      ))}
      {checkboxes?.map((c) => (
        <label key={c.name} className="flex items-center gap-2 text-sm text-gray-700">
          <input name={c.name} type="checkbox" className="rounded border-gray-300 text-indigo-600" />
          {c.label}
        </label>
      ))}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
