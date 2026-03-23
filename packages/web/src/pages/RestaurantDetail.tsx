import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurants, menus, connections, sync } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Link } from 'react-router-dom';

export function RestaurantDetail() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ['restaurants', restaurantId],
    queryFn: () => restaurants.get(restaurantId!),
    enabled: !!restaurantId,
  });

  const { data: menuList = [] } = useQuery({
    queryKey: ['menus', restaurantId],
    queryFn: () => menus.listForRestaurant(restaurantId!),
    enabled: !!restaurantId,
  });

  const { data: connectionList = [] } = useQuery({
    queryKey: ['connections', restaurantId],
    queryFn: () => connections.listForRestaurant(restaurantId!),
    enabled: !!restaurantId,
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status', restaurantId],
    queryFn: () => sync.restaurantStatus(restaurantId!),
    enabled: !!restaurantId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => restaurants.delete(restaurantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      navigate('/');
    },
  });

  if (isLoading || !restaurant) {
    return <div className="animate-pulse h-48 rounded-lg bg-gray-200" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {[restaurant.address, restaurant.city, restaurant.state, restaurant.postalCode]
              .filter(Boolean)
              .join(', ') || 'No address set'}
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={restaurant.active ? 'active' : 'disabled'} />
          <button
            onClick={() => {
              if (confirm('Delete this restaurant? This cannot be undone.'))
                deleteMutation.mutate();
            }}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Menus" value={menuList.length} linkTo={`/restaurants/${restaurantId}/menus`} />
        <StatCard label="Platform Connections" value={connectionList.length} linkTo={`/restaurants/${restaurantId}/connections`} />
        <StatCard
          label="Sync Status"
          value={
            syncStatus?.connections.every((c) => c.lastSyncStatus === 'success')
              ? 'Healthy'
              : syncStatus?.connections.some((c) => c.lastSyncStatus === 'error')
                ? 'Errors'
                : connectionList.length === 0
                  ? 'No connections'
                  : 'Unknown'
          }
          linkTo={`/restaurants/${restaurantId}/sync`}
        />
      </div>

      {/* Contact info */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Contact Information</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="text-sm text-gray-900">{restaurant.contactEmail || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Phone</dt>
            <dd className="text-sm text-gray-900">{restaurant.contactPhone || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Timezone</dt>
            <dd className="text-sm text-gray-900">{restaurant.timezone}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Slug</dt>
            <dd className="text-sm text-gray-900">{restaurant.slug}</dd>
          </div>
        </dl>
      </div>

      {/* Recent connections status */}
      {connectionList.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Platform Status</h2>
          <div className="mt-4 space-y-3">
            {connectionList.map((conn) => (
              <div key={conn.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <PlatformLogo platform={conn.platform} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{platformLabel(conn.platform)}</p>
                    <p className="text-xs text-gray-500">Store: {conn.externalStoreId || 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={conn.enabled ? (conn.lastSyncStatus || 'never') : 'disabled'} />
                  {conn.lastSyncAt && (
                    <span className="text-xs text-gray-400">
                      {new Date(conn.lastSyncAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, linkTo }: { label: string; value: string | number; linkTo: string }) {
  return (
    <Link to={linkTo} className="rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </Link>
  );
}

export function platformLabel(platform: string) {
  const labels: Record<string, string> = {
    doordash: 'DoorDash',
    uber_eats: 'Uber Eats',
  };
  return labels[platform] || platform;
}

export function PlatformLogo({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    doordash: 'bg-red-100 text-red-700',
    uber_eats: 'bg-green-100 text-green-700',
  };
  const initials: Record<string, string> = {
    doordash: 'DD',
    uber_eats: 'UE',
  };
  return (
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold ${colors[platform] || 'bg-gray-100 text-gray-700'}`}>
      {initials[platform] || '??'}
    </span>
  );
}
