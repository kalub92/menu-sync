import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  platformConnections,
  syncJobs,
  syncHistory,
  syncSnapshots,
} from '../db/schema.js';
import {
  syncMenuToConnection,
  syncMenuToAllPlatforms,
  enqueueSyncJob,
  processJobQueue,
} from '../sync/orchestrator.js';
import { buildMenuSnapshot, computeChecksum } from '../sync/snapshot.js';
import { diffMenuSnapshots } from '../sync/diff.js';
import type { MenuSnapshot } from '../sync/snapshot.js';

const syncRequestSchema = z.object({
  menuId: z.string().uuid(),
  trigger: z.enum(['manual', 'auto']).default('manual'),
  async: z.boolean().default(false),
});

const bulkSyncSchema = z.object({
  menuId: z.string().uuid(),
  trigger: z.enum(['manual', 'auto']).default('manual'),
});

export async function syncRoutes(app: FastifyInstance) {
  // ── Sync a menu to a specific connection ────────────────────────────────

  app.post<{ Params: { id: string } }>(
    '/api/sync/connections/:id',
    async (request, reply) => {
      const body = syncRequestSchema.parse(request.body);

      const conn = await db.query.platformConnections.findFirst({
        where: eq(platformConnections.id, request.params.id),
      });
      if (!conn) return reply.status(404).send({ error: 'Connection not found' });
      if (!conn.enabled) return reply.status(400).send({ error: 'Connection is disabled' });
      if (!conn.externalStoreId) {
        return reply.status(400).send({ error: 'externalStoreId is required' });
      }

      if (body.async) {
        const { jobId } = await enqueueSyncJob({
          connectionId: conn.id,
          menuId: body.menuId,
          trigger: body.trigger,
        });
        return reply.status(202).send({ jobId, status: 'queued' });
      }

      const result = await syncMenuToConnection({
        connectionId: conn.id,
        menuId: body.menuId,
        trigger: body.trigger,
      });

      return result;
    },
  );

  // ── Sync a menu to all platforms for a restaurant ───────────────────────

  app.post<{ Params: { restaurantId: string } }>(
    '/api/sync/restaurants/:restaurantId',
    async (request, reply) => {
      const body = bulkSyncSchema.parse(request.body);

      try {
        const result = await syncMenuToAllPlatforms(
          request.params.restaurantId,
          body.menuId,
          body.trigger,
        );
        return result;
      } catch (err) {
        if (err instanceof Error && err.message.includes('not found')) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // ── Preview diff (dry-run) ──────────────────────────────────────────────

  app.get<{ Params: { id: string }; Querystring: { menuId: string } }>(
    '/api/sync/connections/:id/diff',
    async (request, reply) => {
      const { menuId } = request.query;
      if (!menuId) {
        return reply.status(400).send({ error: 'menuId query parameter is required' });
      }

      const conn = await db.query.platformConnections.findFirst({
        where: eq(platformConnections.id, request.params.id),
      });
      if (!conn) return reply.status(404).send({ error: 'Connection not found' });

      const currentSnapshot = await buildMenuSnapshot(menuId, conn.platform);
      if (!currentSnapshot) return reply.status(404).send({ error: 'Menu not found' });

      const lastSnapshot = await db.query.syncSnapshots.findFirst({
        where: and(
          eq(syncSnapshots.connectionId, conn.id),
          eq(syncSnapshots.menuId, menuId),
        ),
      });

      const diff = diffMenuSnapshots(
        lastSnapshot ? (lastSnapshot.snapshot as MenuSnapshot) : null,
        currentSnapshot,
      );

      const currentChecksum = computeChecksum(currentSnapshot);
      const wouldSync = !lastSnapshot || lastSnapshot.checksum !== currentChecksum;

      return {
        connectionId: conn.id,
        platform: conn.platform,
        menuId,
        wouldSync,
        diff,
        lastSyncedAt: lastSnapshot?.createdAt ?? null,
      };
    },
  );

  // ── Get sync job status ─────────────────────────────────────────────────

  app.get<{ Params: { id: string } }>(
    '/api/sync/jobs/:id',
    async (request, reply) => {
      const job = await db.query.syncJobs.findFirst({
        where: eq(syncJobs.id, request.params.id),
      });
      if (!job) return reply.status(404).send({ error: 'Sync job not found' });
      return job;
    },
  );

  // ── Process job queue (trigger manually or via cron) ────────────────────

  app.post('/api/sync/process-queue', async (request) => {
    const body = z.object({ limit: z.number().int().min(1).max(50).default(10) })
      .parse(request.body ?? {});
    const results = await processJobQueue(body.limit);
    return {
      processed: results.length,
      results,
    };
  });

  // ── Sync history for a restaurant ───────────────────────────────────────

  app.get<{ Params: { restaurantId: string }; Querystring: { limit?: string; offset?: string } }>(
    '/api/sync/restaurants/:restaurantId/history',
    async (request) => {
      const limit = Math.min(Number(request.query.limit) || 50, 100);
      const offset = Number(request.query.offset) || 0;

      const rows = await db.query.syncHistory.findMany({
        where: eq(syncHistory.restaurantId, request.params.restaurantId),
        orderBy: (h, { desc }) => [desc(h.createdAt)],
        limit,
        offset,
      });

      return { history: rows, limit, offset };
    },
  );

  // ── Sync history for a specific connection ──────────────────────────────

  app.get<{ Params: { id: string }; Querystring: { limit?: string; offset?: string } }>(
    '/api/sync/connections/:id/history',
    async (request) => {
      const limit = Math.min(Number(request.query.limit) || 50, 100);
      const offset = Number(request.query.offset) || 0;

      const rows = await db.query.syncHistory.findMany({
        where: eq(syncHistory.connectionId, request.params.id),
        orderBy: (h, { desc }) => [desc(h.createdAt)],
        limit,
        offset,
      });

      return { history: rows, limit, offset };
    },
  );

  // ── Get sync status for all connections of a restaurant ─────────────────

  app.get<{ Params: { restaurantId: string } }>(
    '/api/sync/restaurants/:restaurantId/status',
    async (request) => {
      const connections = await db.query.platformConnections.findMany({
        where: eq(platformConnections.restaurantId, request.params.restaurantId),
      });

      const statuses = await Promise.all(
        connections.map(async (conn) => {
          const snapshot = await db.query.syncSnapshots.findFirst({
            where: eq(syncSnapshots.connectionId, conn.id),
          });

          const pendingJobs = await db.query.syncJobs.findMany({
            where: and(
              eq(syncJobs.connectionId, conn.id),
              eq(syncJobs.status, 'pending'),
            ),
          });

          return {
            connectionId: conn.id,
            platform: conn.platform,
            enabled: conn.enabled,
            externalStoreId: conn.externalStoreId,
            lastSyncAt: conn.lastSyncAt,
            lastSyncStatus: conn.lastSyncStatus,
            lastSyncError: conn.lastSyncError,
            hasSnapshot: !!snapshot,
            pendingJobCount: pendingJobs.length,
          };
        }),
      );

      return { restaurantId: request.params.restaurantId, connections: statuses };
    },
  );
}
