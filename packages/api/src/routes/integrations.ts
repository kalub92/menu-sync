import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  platformConnections,
  menus,
  categories,
  items,
  modifierGroups,
  modifiers,
  platformPricing,
} from '../db/schema.js';
import {
  createPlatformConnectionSchema,
  updatePlatformConnectionSchema,
  menuSyncSchema,
} from '../schemas.js';
import { getPlatformClient, getSupportedPlatforms } from '../integrations/registry.js';
import type {
  PlatformCategory,
  PlatformCredentials,
  PlatformKey,
  PlatformMenuPayload,
} from '../integrations/types.js';

export async function integrationRoutes(app: FastifyInstance) {
  // List supported platforms
  app.get('/api/platforms', async () => {
    return { platforms: getSupportedPlatforms() };
  });

  // List connections for a restaurant
  app.get<{ Params: { restaurantId: string } }>(
    '/api/restaurants/:restaurantId/connections',
    async (request) => {
      const rows = await db.query.platformConnections.findMany({
        where: eq(platformConnections.restaurantId, request.params.restaurantId),
      });
      // Strip credential secrets from response
      return rows.map((r) => ({
        ...r,
        credentials: '***',
      }));
    },
  );

  // Get a single connection
  app.get<{ Params: { id: string } }>(
    '/api/connections/:id',
    async (request, reply) => {
      const row = await db.query.platformConnections.findFirst({
        where: eq(platformConnections.id, request.params.id),
      });
      if (!row) return reply.status(404).send({ error: 'Connection not found' });
      return { ...row, credentials: '***' };
    },
  );

  // Create a connection
  app.post('/api/connections', async (request, reply) => {
    const body = createPlatformConnectionSchema.parse(request.body);
    const [row] = await db
      .insert(platformConnections)
      .values({
        restaurantId: body.restaurantId,
        platform: body.platform,
        externalStoreId: body.externalStoreId ?? null,
        credentials: body.credentials,
        enabled: body.enabled,
      })
      .returning();
    return reply.status(201).send({ ...row, credentials: '***' });
  });

  // Update a connection
  app.patch<{ Params: { id: string } }>(
    '/api/connections/:id',
    async (request, reply) => {
      const body = updatePlatformConnectionSchema.parse(request.body);
      const values: Record<string, unknown> = { updatedAt: new Date() };
      if (body.externalStoreId !== undefined) values.externalStoreId = body.externalStoreId;
      if (body.credentials !== undefined) values.credentials = body.credentials;
      if (body.enabled !== undefined) values.enabled = body.enabled;

      const [row] = await db
        .update(platformConnections)
        .set(values)
        .where(eq(platformConnections.id, request.params.id))
        .returning();
      if (!row) return reply.status(404).send({ error: 'Connection not found' });
      return { ...row, credentials: '***' };
    },
  );

  // Delete a connection
  app.delete<{ Params: { id: string } }>(
    '/api/connections/:id',
    async (request, reply) => {
      const [row] = await db
        .delete(platformConnections)
        .where(eq(platformConnections.id, request.params.id))
        .returning();
      if (!row) return reply.status(404).send({ error: 'Connection not found' });
      return reply.status(204).send();
    },
  );

  // Validate credentials for a connection
  app.post<{ Params: { id: string } }>(
    '/api/connections/:id/validate',
    async (request, reply) => {
      const conn = await db.query.platformConnections.findFirst({
        where: eq(platformConnections.id, request.params.id),
      });
      if (!conn) return reply.status(404).send({ error: 'Connection not found' });
      if (!conn.externalStoreId) {
        return reply.status(400).send({ error: 'externalStoreId is required to validate' });
      }

      const client = getPlatformClient(conn.platform as PlatformKey);
      const result = await client.validateCredentials(
        conn.credentials as PlatformCredentials,
        conn.externalStoreId,
      );
      return result;
    },
  );

  // Sync (push) a menu to a specific platform connection
  app.post<{ Params: { id: string } }>(
    '/api/connections/:id/sync',
    async (request, reply) => {
      const body = menuSyncSchema.parse(request.body);

      const conn = await db.query.platformConnections.findFirst({
        where: eq(platformConnections.id, request.params.id),
      });
      if (!conn) return reply.status(404).send({ error: 'Connection not found' });
      if (!conn.enabled) return reply.status(400).send({ error: 'Connection is disabled' });
      if (!conn.externalStoreId) {
        return reply.status(400).send({ error: 'externalStoreId is required to sync' });
      }

      // Build the full menu payload
      const menu = await db.query.menus.findFirst({
        where: and(
          eq(menus.id, body.menuId),
          eq(menus.restaurantId, conn.restaurantId),
        ),
      });
      if (!menu) return reply.status(404).send({ error: 'Menu not found for this restaurant' });

      const menuCategories = await db.query.categories.findMany({
        where: eq(categories.menuId, menu.id),
        orderBy: (c, { asc }) => [asc(c.sortOrder)],
      });

      const platformCategories: PlatformCategory[] = await Promise.all(
        menuCategories
          .filter((c) => c.active)
          .map(async (cat) => {
            const catItems = await db.query.items.findMany({
              where: eq(items.categoryId, cat.id),
              orderBy: (i, { asc }) => [asc(i.sortOrder)],
            });

            const platformItems = await Promise.all(
              catItems.filter((i) => i.active).map(async (item) => {
                const groups = await db.query.modifierGroups.findMany({
                  where: eq(modifierGroups.itemId, item.id),
                  orderBy: (mg, { asc }) => [asc(mg.sortOrder)],
                });

                const groupsWithMods = await Promise.all(
                  groups.map(async (g) => {
                    const mods = await db.query.modifiers.findMany({
                      where: eq(modifiers.modifierGroupId, g.id),
                      orderBy: (m, { asc }) => [asc(m.sortOrder)],
                    });
                    return {
                      name: g.name,
                      required: g.required,
                      minSelections: g.minSelections,
                      maxSelections: g.maxSelections,
                      modifiers: mods.map((m) => ({
                        name: m.name,
                        priceAdjustment: m.priceAdjustment,
                        active: m.active,
                      })),
                    };
                  }),
                );

                // Check for platform-specific pricing
                const pricing = await db.query.platformPricing.findFirst({
                  where: and(
                    eq(platformPricing.itemId, item.id),
                    eq(platformPricing.platform, conn.platform),
                  ),
                });

                return {
                  name: item.name,
                  description: item.description,
                  price: pricing?.price ?? item.basePrice,
                  imageUrl: item.imageUrl,
                  active: item.active,
                  categoryName: cat.name,
                  modifierGroups: groupsWithMods,
                };
              }),
            );

            return {
              name: cat.name,
              sortOrder: cat.sortOrder,
              items: platformItems,
            };
          }),
      );

      const payload: PlatformMenuPayload = {
        storeId: conn.externalStoreId,
        menuName: menu.name,
        categories: platformCategories,
      };

      const client = getPlatformClient(conn.platform as PlatformKey);
      const result = await client.pushMenu(payload, conn.credentials as PlatformCredentials);

      // Update sync status on the connection
      await db
        .update(platformConnections)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: result.success ? 'success' : 'error',
          lastSyncError: result.error ?? null,
          updatedAt: new Date(),
        })
        .where(eq(platformConnections.id, conn.id));

      return result;
    },
  );

  // Check status of a previous sync job
  app.get<{ Params: { id: string }; Querystring: { jobId: string } }>(
    '/api/connections/:id/sync-status',
    async (request, reply) => {
      const { jobId } = request.query;
      if (!jobId) return reply.status(400).send({ error: 'jobId query parameter is required' });

      const conn = await db.query.platformConnections.findFirst({
        where: eq(platformConnections.id, request.params.id),
      });
      if (!conn) return reply.status(404).send({ error: 'Connection not found' });

      const client = getPlatformClient(conn.platform as PlatformKey);
      const status = await client.getMenuStatus(
        jobId,
        conn.credentials as PlatformCredentials,
      );
      return status;
    },
  );
}
