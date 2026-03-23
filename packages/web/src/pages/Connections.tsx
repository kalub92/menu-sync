import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { connections } from '../api/client';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { platformLabel, PlatformLogo } from './RestaurantDetail';
import type { Platform, CreatePlatformConnection } from '../api/types';

export function Connections() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['connections', restaurantId],
    queryFn: () => connections.listForRestaurant(restaurantId!),
    enabled: !!restaurantId,
  });

  const deleteMutation = useMutation({
    mutationFn: connections.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections', restaurantId] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      connections.update(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections', restaurantId] }),
  });

  const validateMutation = useMutation({
    mutationFn: connections.validate,
  });

  if (isLoading) return <div className="animate-pulse h-48 rounded-lg bg-gray-200" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Connections</h1>
          <p className="mt-1 text-sm text-gray-500">
            Connect to delivery platforms to sync your menus.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add Connection
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No connections"
          description="Connect a delivery platform to start syncing menus."
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add Connection
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {list.map((conn) => (
            <div key={conn.id} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <PlatformLogo platform={conn.platform} />
                  <div>
                    <h3 className="font-semibold text-gray-900">{platformLabel(conn.platform)}</h3>
                    <p className="text-sm text-gray-500">
                      Store ID: {conn.externalStoreId || 'Not set'}
                    </p>
                  </div>
                </div>
                <StatusBadge status={conn.enabled ? 'enabled' : 'disabled'} />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <span className="font-medium text-gray-500">Last Sync</span>
                  <p className="text-gray-900">
                    {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : 'Never'}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Status</span>
                  <p>
                    <StatusBadge status={conn.lastSyncStatus || 'never'} />
                  </p>
                </div>
                {conn.lastSyncError && (
                  <div>
                    <span className="font-medium text-gray-500">Last Error</span>
                    <p className="text-red-600 text-xs">{conn.lastSyncError}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
                <button
                  onClick={() =>
                    toggleMutation.mutate({ id: conn.id, enabled: !conn.enabled })
                  }
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {conn.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => validateMutation.mutate(conn.id)}
                  disabled={validateMutation.isPending}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {validateMutation.isPending
                    ? 'Validating...'
                    : validateMutation.data
                      ? validateMutation.data.valid
                        ? 'Valid'
                        : 'Invalid'
                      : 'Validate Credentials'}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${platformLabel(conn.platform)} connection?`))
                      deleteMutation.mutate(conn.id);
                  }}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Platform Connection">
        <CreateConnectionForm
          restaurantId={restaurantId!}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['connections', restaurantId] });
            setShowCreate(false);
          }}
        />
      </Modal>
    </div>
  );
}

function CreateConnectionForm({
  restaurantId,
  onSuccess,
}: {
  restaurantId: string;
  onSuccess: () => void;
}) {
  const [platform, setPlatform] = useState<Platform>('doordash');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: connections.create,
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const creds: Record<string, string> = {};

    if (platform === 'doordash') {
      creds.developerId = fd.get('developerId') as string;
      creds.keyId = fd.get('keyId') as string;
      creds.signingSecret = fd.get('signingSecret') as string;
    } else {
      creds.clientId = fd.get('clientId') as string;
      creds.clientSecret = fd.get('clientSecret') as string;
    }

    createMutation.mutate({
      restaurantId,
      platform,
      externalStoreId: (fd.get('externalStoreId') as string) || null,
      credentials: creds,
    } as CreatePlatformConnection);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <label className="block text-sm font-medium text-gray-700">Platform *</label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="doordash">DoorDash</option>
          <option value="uber_eats">Uber Eats</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">External Store ID</label>
        <input
          name="externalStoreId"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      {platform === 'doordash' ? (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">Developer ID *</label>
            <input name="developerId" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Key ID *</label>
            <input name="keyId" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Signing Secret *</label>
            <input name="signingSecret" required type="password" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">Client ID *</label>
            <input name="clientId" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Client Secret *</label>
            <input name="clientSecret" required type="password" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Creating...' : 'Add Connection'}
        </button>
      </div>
    </form>
  );
}
