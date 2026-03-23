import { eq, and, inArray, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  platformConnections,
  menus,
  categories,
  items,
  modifierGroups,
  modifiers,
  platformPricing,
  syncJobs,
  syncSnapshots,
  syncHistory,
} from '../db/schema.js';
import { getPlatformClient } from '../integrations/registry.js';
import type {
  PlatformCategory,
  PlatformCredentials,
  PlatformKey,
  PlatformMenuPayload,
} from '../integrations/types.js';
import { buildMenuSnapshot, computeChecksum, type MenuSnapshot } from './snapshot.js';
import { diffMenuSnapshots, type MenuDiff } from './diff.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type SyncTrigger = 'manual' | 'auto' | 'retry';

export interface SyncRequest {
  connectionId: string;
  menuId: string;
  trigger?: SyncTrigger;
  priority?: number;
}

export interface SyncResult {
  jobId: string;
  connectionId: string;
  platform: string;
  status: 'completed' | 'failed' | 'skipped';
  diff: MenuDiff | null;
  externalJobId?: string;
  error?: string;
  durationMs: number;
}

export interface BulkSyncResult {
  restaurantId: string;
  menuId: string;
  results: SyncResult[];
  totalConnections: number;
  synced: number;
  skipped: number;
  failed: number;
}

// ── Core orchestrator ───────────────────────────────────────────────────────

/**
 * Sync a single menu to a single platform connection.
 * This is the core sync operation. It:
 * 1. Builds a snapshot of the current menu state
 * 2. Compares against the last-synced snapshot (diff)
 * 3. If changes exist, pushes the menu to the platform
 * 4. Records the result in sync history
 */
export async function syncMenuToConnection(request: SyncRequest): Promise<SyncResult> {
  const startTime = Date.now();
  const trigger = request.trigger ?? 'manual';

  // Create sync job
  const [job] = await db
    .insert(syncJobs)
    .values({
      connectionId: request.connectionId,
      menuId: request.menuId,
      status: 'processing',
      trigger,
      priority: request.priority ?? 0,
      attempt: 1,
      startedAt: new Date(),
    })
    .returning();

  try {
    // Load connection
    const conn = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.id, request.connectionId),
    });
    if (!conn) throw new Error('Connection not found');
    if (!conn.enabled) throw new Error('Connection is disabled');
    if (!conn.externalStoreId) throw new Error('externalStoreId is required');

    // Build current snapshot
    const currentSnapshot = await buildMenuSnapshot(request.menuId, conn.platform);
    if (!currentSnapshot) throw new Error('Menu not found');

    const currentChecksum = computeChecksum(currentSnapshot);

    // Load last synced snapshot for this connection+menu
    const lastSnapshot = await db.query.syncSnapshots.findFirst({
      where: and(
        eq(syncSnapshots.connectionId, request.connectionId),
        eq(syncSnapshots.menuId, request.menuId),
      ),
    });

    // Fast path: if checksums match, nothing changed
    if (lastSnapshot && lastSnapshot.checksum === currentChecksum) {
      const durationMs = Date.now() - startTime;
      await markJobCompleted(job.id, 'completed');
      await recordHistory({
        connectionId: conn.id,
        menuId: request.menuId,
        syncJobId: job.id,
        status: 'success',
        trigger,
        platform: conn.platform,
        restaurantId: conn.restaurantId,
        changesSummary: { added: 0, modified: 0, removed: 0, noChanges: true },
        durationMs,
        startedAt: job.startedAt!,
      });
      return {
        jobId: job.id,
        connectionId: conn.id,
        platform: conn.platform,
        status: 'skipped',
        diff: { hasChanges: false, menuNameChanged: false, changes: [], summary: { added: 0, modified: 0, removed: 0 } },
        durationMs,
      };
    }

    // Compute diff for the audit log
    const diff = diffMenuSnapshots(
      lastSnapshot ? (lastSnapshot.snapshot as MenuSnapshot) : null,
      currentSnapshot,
    );

    // Build platform payload and push
    const payload = await buildPlatformPayload(conn, currentSnapshot);
    const client = getPlatformClient(conn.platform as PlatformKey);
    const pushResult = await client.pushMenu(payload, conn.credentials as PlatformCredentials);

    if (!pushResult.success) {
      throw new Error(pushResult.error ?? 'Platform push failed');
    }

    // Save new snapshot (upsert)
    if (lastSnapshot) {
      await db
        .update(syncSnapshots)
        .set({
          snapshot: currentSnapshot as unknown as Record<string, unknown>,
          checksum: currentChecksum,
          syncJobId: job.id,
          createdAt: new Date(),
        })
        .where(eq(syncSnapshots.id, lastSnapshot.id));
    } else {
      await db.insert(syncSnapshots).values({
        connectionId: conn.id,
        menuId: request.menuId,
        snapshot: currentSnapshot as unknown as Record<string, unknown>,
        checksum: currentChecksum,
        syncJobId: job.id,
      });
    }

    // Update connection sync status
    await db
      .update(platformConnections)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(platformConnections.id, conn.id));

    const durationMs = Date.now() - startTime;
    await markJobCompleted(job.id, 'completed', pushResult.jobId);

    await recordHistory({
      connectionId: conn.id,
      menuId: request.menuId,
      syncJobId: job.id,
      status: 'success',
      trigger,
      platform: conn.platform,
      restaurantId: conn.restaurantId,
      changesSummary: diff.summary,
      externalJobId: pushResult.jobId,
      durationMs,
      startedAt: job.startedAt!,
    });

    return {
      jobId: job.id,
      connectionId: conn.id,
      platform: conn.platform,
      status: 'completed',
      diff,
      externalJobId: pushResult.jobId,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    await markJobCompleted(job.id, 'failed', undefined, errorMessage);

    // Update connection with error
    await db
      .update(platformConnections)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: 'error',
        lastSyncError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(platformConnections.id, request.connectionId));

    // Load connection for history record
    const conn = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.id, request.connectionId),
    });

    if (conn) {
      await recordHistory({
        connectionId: conn.id,
        menuId: request.menuId,
        syncJobId: job.id,
        status: 'error',
        trigger,
        platform: conn.platform,
        restaurantId: conn.restaurantId,
        error: errorMessage,
        durationMs,
        startedAt: job.startedAt!,
      });
    }

    return {
      jobId: job.id,
      connectionId: request.connectionId,
      platform: conn?.platform ?? 'unknown',
      status: 'failed',
      diff: null,
      error: errorMessage,
      durationMs,
    };
  }
}

/**
 * Sync a menu to all enabled platform connections for a restaurant.
 * Canonical menu is source of truth — pushes to all connected platforms.
 */
export async function syncMenuToAllPlatforms(
  restaurantId: string,
  menuId: string,
  trigger: SyncTrigger = 'manual',
): Promise<BulkSyncResult> {
  // Verify the menu belongs to this restaurant
  const menu = await db.query.menus.findFirst({
    where: and(eq(menus.id, menuId), eq(menus.restaurantId, restaurantId)),
  });
  if (!menu) throw new Error('Menu not found for this restaurant');

  // Get all enabled connections with externalStoreId set
  const connections = await db.query.platformConnections.findMany({
    where: and(
      eq(platformConnections.restaurantId, restaurantId),
      eq(platformConnections.enabled, true),
    ),
  });

  const activeConnections = connections.filter((c) => c.externalStoreId);

  // Sync to each platform in parallel
  const results = await Promise.all(
    activeConnections.map((conn) =>
      syncMenuToConnection({
        connectionId: conn.id,
        menuId,
        trigger,
      }),
    ),
  );

  return {
    restaurantId,
    menuId,
    results,
    totalConnections: activeConnections.length,
    synced: results.filter((r) => r.status === 'completed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
  };
}

/**
 * Process pending sync jobs from the queue.
 * Called periodically or on-demand.
 */
export async function processJobQueue(limit = 10): Promise<SyncResult[]> {
  const now = new Date();

  // Get pending jobs, prioritized, and any retryable failed jobs
  const pendingJobs = await db.query.syncJobs.findMany({
    where: and(
      inArray(syncJobs.status, ['pending']),
    ),
    orderBy: (j, { desc, asc }) => [desc(j.priority), asc(j.createdAt)],
    limit,
  });

  // Also pick up retryable jobs
  const retryableJobs = await db.query.syncJobs.findMany({
    where: and(
      eq(syncJobs.status, 'failed'),
      lte(syncJobs.nextRetryAt, now),
    ),
    orderBy: (j, { desc, asc }) => [desc(j.priority), asc(j.createdAt)],
    limit: Math.max(0, limit - pendingJobs.length),
  });

  const allJobs = [...pendingJobs, ...retryableJobs];
  if (allJobs.length === 0) return [];

  const results: SyncResult[] = [];
  for (const job of allJobs) {
    // Update to processing
    await db
      .update(syncJobs)
      .set({
        status: 'processing',
        attempt: job.attempt + 1,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(syncJobs.id, job.id));

    const result = await syncMenuToConnection({
      connectionId: job.connectionId,
      menuId: job.menuId,
      trigger: job.attempt > 0 ? 'retry' : (job.trigger as SyncTrigger),
    });
    results.push(result);

    // If failed and retryable, schedule retry with exponential backoff
    if (result.status === 'failed' && job.attempt + 1 < job.maxAttempts) {
      const backoffMs = Math.min(1000 * Math.pow(2, job.attempt), 30000);
      await db
        .update(syncJobs)
        .set({
          status: 'failed',
          nextRetryAt: new Date(Date.now() + backoffMs),
          updatedAt: new Date(),
        })
        .where(eq(syncJobs.id, job.id));
    }
  }

  return results;
}

/**
 * Enqueue a sync job for later processing.
 */
export async function enqueueSyncJob(
  request: SyncRequest,
): Promise<{ jobId: string }> {
  const [job] = await db
    .insert(syncJobs)
    .values({
      connectionId: request.connectionId,
      menuId: request.menuId,
      status: 'pending',
      trigger: request.trigger ?? 'manual',
      priority: request.priority ?? 0,
    })
    .returning();

  return { jobId: job.id };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildPlatformPayload(
  conn: { externalStoreId: string | null; platform: string },
  snapshot: MenuSnapshot,
): PlatformMenuPayload {
  const platformCategories: PlatformCategory[] = snapshot.categories.map((cat) => ({
    name: cat.name,
    sortOrder: cat.sortOrder,
    items: cat.items.map((item) => ({
      name: item.name,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
      active: item.active,
      categoryName: cat.name,
      modifierGroups: item.modifierGroups.map((mg) => ({
        name: mg.name,
        required: mg.required,
        minSelections: mg.minSelections,
        maxSelections: mg.maxSelections,
        modifiers: mg.modifiers.map((m) => ({
          name: m.name,
          priceAdjustment: m.priceAdjustment,
          active: m.active,
        })),
      })),
    })),
  }));

  return {
    storeId: conn.externalStoreId!,
    menuName: snapshot.menuName,
    categories: platformCategories,
  };
}

async function markJobCompleted(
  jobId: string,
  status: 'completed' | 'failed',
  externalJobId?: string,
  error?: string,
) {
  await db
    .update(syncJobs)
    .set({
      status,
      externalJobId: externalJobId ?? null,
      error: error ?? null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(syncJobs.id, jobId));
}

async function recordHistory(params: {
  connectionId: string;
  menuId: string;
  syncJobId: string;
  status: string;
  trigger: string;
  platform: string;
  restaurantId: string;
  changesSummary?: unknown;
  externalJobId?: string;
  error?: string;
  durationMs: number;
  startedAt: Date;
}) {
  await db.insert(syncHistory).values({
    connectionId: params.connectionId,
    menuId: params.menuId,
    syncJobId: params.syncJobId,
    status: params.status,
    trigger: params.trigger,
    platform: params.platform,
    restaurantId: params.restaurantId,
    changesSummary: params.changesSummary as Record<string, unknown> | undefined,
    externalJobId: params.externalJobId,
    error: params.error,
    durationMs: params.durationMs,
    startedAt: params.startedAt,
    completedAt: new Date(),
  });
}
