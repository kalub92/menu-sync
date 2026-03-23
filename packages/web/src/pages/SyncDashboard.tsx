import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sync, menus, connections } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { platformLabel, PlatformLogo } from './RestaurantDetail';
import { EmptyState } from '../components/EmptyState';
import type { SyncHistoryEntry } from '../api/types';

export function SyncDashboard() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const queryClient = useQueryClient();

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status', restaurantId],
    queryFn: () => sync.restaurantStatus(restaurantId!),
    enabled: !!restaurantId,
    refetchInterval: 10000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['sync-history', restaurantId],
    queryFn: () => sync.restaurantHistory(restaurantId!),
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

  const [selectedMenuId, setSelectedMenuId] = useState<string>('');

  const syncMutation = useMutation({
    mutationFn: () =>
      sync.syncRestaurant(restaurantId!, {
        menuId: selectedMenuId || menuList[0]?.id,
        trigger: 'manual',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['sync-history', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['connections', restaurantId] });
    },
  });

  const activeMenuId = selectedMenuId || menuList[0]?.id;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sync Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor and trigger menu synchronization across platforms.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {menuList.length > 1 && (
            <select
              value={activeMenuId}
              onChange={(e) => setSelectedMenuId(e.target.value)}
              className="rounded-md border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              {menuList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !activeMenuId || connectionList.length === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {syncMutation.isPending ? 'Syncing...' : 'Sync All Platforms'}
          </button>
        </div>
      </div>

      {syncMutation.data && (
        <SyncResultBanner result={syncMutation.data} />
      )}

      {syncMutation.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Sync failed: {syncMutation.error.message}
        </div>
      )}

      {/* Platform status cards */}
      {connectionList.length === 0 ? (
        <EmptyState
          title="No platform connections"
          description="Add platform connections to start syncing."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(syncStatus?.connections ?? connectionList).map((conn) => {
            const connDetail = connectionList.find((c) => c.id === conn.id);
            return (
              <div key={conn.id} className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PlatformLogo platform={conn.platform} />
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {platformLabel(conn.platform)}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {connDetail?.externalStoreId || 'No store ID'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    status={
                      conn.enabled
                        ? conn.lastSyncStatus || 'never'
                        : 'disabled'
                    }
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Last sync</span>
                    <p className="font-medium text-gray-900">
                      {conn.lastSyncAt
                        ? new Date(conn.lastSyncAt).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Status</span>
                    <p className="font-medium text-gray-900">
                      {conn.lastSyncStatus || 'N/A'}
                    </p>
                  </div>
                </div>
                {conn.lastSyncError && (
                  <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600">
                    {conn.lastSyncError}
                  </div>
                )}

                {/* Per-connection sync */}
                {activeMenuId && conn.enabled && (
                  <DiffPreview connectionId={conn.id} menuId={activeMenuId} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sync history */}
      {history.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Sync History</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Platform</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Trigger</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Changes</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Duration</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((entry: SyncHistoryEntry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <PlatformLogo platform={entry.platform} />
                        {platformLabel(entry.platform)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{entry.trigger}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {entry.changesSummary ? (
                        <span>
                          +{entry.changesSummary.added} ~{entry.changesSummary.modified} -{entry.changesSummary.removed}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {entry.durationMs ? `${entry.durationMs}ms` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {entry.completedAt
                        ? new Date(entry.completedAt).toLocaleString()
                        : entry.startedAt
                          ? new Date(entry.startedAt).toLocaleString()
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DiffPreview({ connectionId, menuId }: { connectionId: string; menuId: string }) {
  const { data: diff } = useQuery({
    queryKey: ['sync-diff', connectionId, menuId],
    queryFn: () => sync.diff(connectionId, menuId),
  });

  if (!diff) return null;

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {diff.wouldSync ? (
        <div className="text-xs">
          <span className="font-medium text-amber-600">Changes pending:</span>{' '}
          +{diff.diff?.summary.added} ~{diff.diff?.summary.modified} -{diff.diff?.summary.removed}
        </div>
      ) : (
        <div className="text-xs text-green-600">Up to date</div>
      )}
    </div>
  );
}

function SyncResultBanner({
  result,
}: {
  result: { synced: number; skipped: number; failed: number; totalConnections: number };
}) {
  const isSuccess = result.failed === 0;
  return (
    <div
      className={`rounded-lg border p-4 text-sm ${
        isSuccess ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      Sync complete: {result.synced} synced, {result.skipped} skipped, {result.failed} failed
      (of {result.totalConnections} connections)
    </div>
  );
}
