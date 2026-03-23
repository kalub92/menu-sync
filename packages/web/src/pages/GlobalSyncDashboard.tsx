import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { restaurants, connections, sync } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { platformLabel, PlatformLogo } from './RestaurantDetail';
import { EmptyState } from '../components/EmptyState';

export function GlobalSyncDashboard() {
  const { data: restaurantList = [], isLoading } = useQuery({
    queryKey: ['restaurants'],
    queryFn: restaurants.list,
  });

  if (isLoading) return <div className="animate-pulse h-48 rounded-lg bg-gray-200" />;

  if (restaurantList.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sync Dashboard</h1>
        <div className="mt-8">
          <EmptyState
            title="No restaurants"
            description="Add a restaurant first to view sync status."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sync Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of sync status across all restaurants.
        </p>
      </div>

      <div className="space-y-4">
        {restaurantList.map((r) => (
          <RestaurantSyncRow key={r.id} restaurantId={r.id} name={r.name} />
        ))}
      </div>
    </div>
  );
}

function RestaurantSyncRow({
  restaurantId,
  name,
}: {
  restaurantId: string;
  name: string;
}) {
  const { data: connectionList = [] } = useQuery({
    queryKey: ['connections', restaurantId],
    queryFn: () => connections.listForRestaurant(restaurantId),
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <Link
          to={`/restaurants/${restaurantId}/sync`}
          className="text-lg font-semibold text-gray-900 hover:text-indigo-600"
        >
          {name}
        </Link>
        <span className="text-sm text-gray-400">
          {connectionList.length} connection{connectionList.length !== 1 ? 's' : ''}
        </span>
      </div>

      {connectionList.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">No platform connections configured.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">
          {connectionList.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2"
            >
              <PlatformLogo platform={conn.platform} />
              <div className="text-xs">
                <p className="font-medium text-gray-700">{platformLabel(conn.platform)}</p>
                <StatusBadge
                  status={
                    conn.enabled
                      ? conn.lastSyncStatus || 'never'
                      : 'disabled'
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
