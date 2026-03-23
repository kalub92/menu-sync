import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menus, categories, items } from '../api/client';
import type { CreateCategory, CreateItem } from '../api/types';

export function BulkOperations() {
  const { restaurantId } = useParams<{ restaurantId: string }>();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Operations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Import menus from files or update prices in bulk.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ImportSection restaurantId={restaurantId!} />
        <BulkPriceUpdate restaurantId={restaurantId!} />
      </div>
    </div>
  );
}

// ── Import from CSV/JSON ────────────────────────────────────────────────────

interface ImportedItem {
  category: string;
  name: string;
  description?: string;
  price: number;
}

function ImportSection({ restaurantId }: { restaurantId: string }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ImportedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const { data: menuList = [] } = useQuery({
    queryKey: ['menus', restaurantId],
    queryFn: () => menus.listForRestaurant(restaurantId),
  });

  const [targetMenuId, setTargetMenuId] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setParsed(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        let data: ImportedItem[];

        if (file.name.endsWith('.json')) {
          const json = JSON.parse(text);
          data = Array.isArray(json) ? json : json.items || json.data || [];
        } else {
          // CSV: category,name,description,price
          const lines = text.split('\n').filter((l) => l.trim());
          const header = lines[0].toLowerCase();
          const hasHeader =
            header.includes('category') || header.includes('name') || header.includes('price');
          const dataLines = hasHeader ? lines.slice(1) : lines;

          data = dataLines.map((line) => {
            const cols = parseCSVLine(line);
            return {
              category: cols[0]?.trim() || 'Uncategorized',
              name: cols[1]?.trim() || '',
              description: cols[2]?.trim() || undefined,
              price: Math.round(parseFloat(cols[3] || '0') * 100),
            };
          }).filter((item) => item.name);
        }

        setParsed(data);
      } catch (err) {
        setError(`Failed to parse file: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsed || !targetMenuId) return;
    setImporting(true);
    setError(null);

    try {
      // Group items by category
      const byCategory = new Map<string, ImportedItem[]>();
      for (const item of parsed) {
        const list = byCategory.get(item.category) || [];
        list.push(item);
        byCategory.set(item.category, list);
      }

      let createdCategories = 0;
      let createdItems = 0;

      for (const [categoryName, categoryItems] of byCategory) {
        const cat = await categories.create({
          menuId: targetMenuId,
          name: categoryName,
          sortOrder: createdCategories,
        } as CreateCategory);
        createdCategories++;

        for (let i = 0; i < categoryItems.length; i++) {
          const ci = categoryItems[i];
          await items.create({
            categoryId: cat.id,
            name: ci.name,
            description: ci.description || null,
            basePrice: ci.price,
            sortOrder: i,
          } as CreateItem);
          createdItems++;
        }
      }

      setResult(
        `Imported ${createdCategories} categories and ${createdItems} items.`,
      );
      setParsed(null);
      queryClient.invalidateQueries({ queryKey: ['menus', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (err) {
      setError(`Import failed: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Import Menu</h2>
      <p className="mt-1 text-sm text-gray-500">
        Upload a CSV or JSON file with menu items.
      </p>
      <p className="mt-2 text-xs text-gray-400">
        CSV format: category, name, description, price (in dollars)
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Target Menu *</label>
          <select
            value={targetMenuId}
            onChange={(e) => setTargetMenuId(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select a menu...</option>
            {menuList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && <p className="text-sm text-green-600">{result}</p>}

        {parsed && (
          <div>
            <p className="text-sm font-medium text-gray-700">
              Preview: {parsed.length} items in{' '}
              {new Set(parsed.map((p) => p.category)).size} categories
            </p>
            <div className="mt-2 max-h-48 overflow-auto rounded border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-gray-500">Category</th>
                    <th className="px-3 py-1.5 text-left text-gray-500">Name</th>
                    <th className="px-3 py-1.5 text-right text-gray-500">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsed.slice(0, 20).map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{item.category}</td>
                      <td className="px-3 py-1.5">{item.name}</td>
                      <td className="px-3 py-1.5 text-right">
                        ${(item.price / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {parsed.length > 20 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-1.5 text-center text-gray-400">
                        ...and {parsed.length - 20} more items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleImport}
              disabled={importing || !targetMenuId}
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${parsed.length} Items`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bulk price update ───────────────────────────────────────────────────────

function BulkPriceUpdate({ restaurantId }: { restaurantId: string }) {
  const queryClient = useQueryClient();
  const [adjustment, setAdjustment] = useState('');
  const [adjustType, setAdjustType] = useState<'percent' | 'fixed'>('percent');
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const { data: menuList = [] } = useQuery({
    queryKey: ['menus', restaurantId],
    queryFn: () => menus.listForRestaurant(restaurantId),
  });

  const handleBulkUpdate = async () => {
    if (!selectedMenuId || !adjustment) return;
    setUpdating(true);
    setResult(null);

    try {
      const catList = await categories.listForMenu(selectedMenuId);
      let updated = 0;

      for (const cat of catList) {
        const itemList = await items.listForCategory(cat.id);
        for (const item of itemList) {
          let newPrice: number;
          const adj = parseFloat(adjustment);

          if (adjustType === 'percent') {
            newPrice = Math.round(item.basePrice * (1 + adj / 100));
          } else {
            newPrice = item.basePrice + Math.round(adj * 100);
          }

          if (newPrice < 0) newPrice = 0;
          if (newPrice !== item.basePrice) {
            await items.update(item.id, { basePrice: newPrice });
            updated++;
          }
        }
      }

      setResult(`Updated ${updated} item prices.`);
      queryClient.invalidateQueries({ queryKey: ['items'] });
    } catch (err) {
      setResult(`Error: ${(err as Error).message}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Bulk Price Update</h2>
      <p className="mt-1 text-sm text-gray-500">
        Adjust all item prices in a menu by percentage or fixed amount.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Menu *</label>
          <select
            value={selectedMenuId}
            onChange={(e) => setSelectedMenuId(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select a menu...</option>
            {menuList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Adjustment Type</label>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="adjustType"
                value="percent"
                checked={adjustType === 'percent'}
                onChange={() => setAdjustType('percent')}
                className="border-gray-300 text-indigo-600"
              />
              Percentage (%)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="adjustType"
                value="fixed"
                checked={adjustType === 'fixed'}
                onChange={() => setAdjustType('fixed')}
                className="border-gray-300 text-indigo-600"
              />
              Fixed amount ($)
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {adjustType === 'percent' ? 'Percentage' : 'Amount ($)'}
          </label>
          <input
            type="number"
            step={adjustType === 'percent' ? '1' : '0.01'}
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            placeholder={adjustType === 'percent' ? 'e.g., 10 for +10%' : 'e.g., 1.50'}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-400">
            Use negative numbers to decrease prices.
          </p>
        </div>

        {result && (
          <p className={`text-sm ${result.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {result}
          </p>
        )}

        <button
          onClick={handleBulkUpdate}
          disabled={updating || !selectedMenuId || !adjustment}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {updating ? 'Updating...' : 'Apply Price Update'}
        </button>
      </div>
    </div>
  );
}

// ── CSV parser helper ───────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
