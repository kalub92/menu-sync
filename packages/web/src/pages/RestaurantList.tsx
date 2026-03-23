import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurants } from '../api/client';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import type { CreateRestaurant } from '../api/types';

export function RestaurantList() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['restaurants'],
    queryFn: restaurants.list,
  });

  const createMutation = useMutation({
    mutationFn: restaurants.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      setShowCreate(false);
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Restaurants</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your restaurants and their menus.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add Restaurant
        </button>
      </div>

      {list.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No restaurants"
            description="Get started by adding your first restaurant."
            action={
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Add Restaurant
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <Link
              key={r.id}
              to={`/restaurants/${r.id}`}
              className="group rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600">
                  {r.name}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {r.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {r.city && r.state && (
                <p className="mt-1 text-sm text-gray-500">
                  {r.city}, {r.state}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">{r.slug}</p>
            </Link>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Restaurant">
        <CreateRestaurantForm
          onSubmit={(data) => createMutation.mutate(data)}
          loading={createMutation.isPending}
          error={createMutation.error?.message}
        />
      </Modal>
    </div>
  );
}

function CreateRestaurantForm({
  onSubmit,
  loading,
  error,
}: {
  onSubmit: (data: CreateRestaurant) => void;
  loading: boolean;
  error?: string;
}) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      name: fd.get('name') as string,
      slug: fd.get('slug') as string,
      contactEmail: (fd.get('contactEmail') as string) || null,
      contactPhone: (fd.get('contactPhone') as string) || null,
      address: (fd.get('address') as string) || null,
      city: (fd.get('city') as string) || null,
      state: (fd.get('state') as string) || null,
      postalCode: (fd.get('postalCode') as string) || null,
      timezone: (fd.get('timezone') as string) || 'UTC',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name *</label>
          <input name="name" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Slug *</label>
          <input name="slug" required pattern="[a-z0-9-]+" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input name="contactEmail" type="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Phone</label>
          <input name="contactPhone" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Address</label>
        <input name="address" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input name="city" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">State</label>
          <input name="state" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">ZIP</label>
          <input name="postalCode" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Creating...' : 'Create Restaurant'}
        </button>
      </div>
    </form>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded bg-gray-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-lg bg-gray-200" />
        ))}
      </div>
    </div>
  );
}
