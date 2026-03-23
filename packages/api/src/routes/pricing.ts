import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { platformPricing } from '../db/schema.js';
import { createPlatformPricingSchema, updatePlatformPricingSchema } from '../schemas.js';

export async function pricingRoutes(app: FastifyInstance) {
  // List platform pricing for an item
  app.get<{ Params: { itemId: string } }>(
    '/api/items/:itemId/pricing',
    async (request) => {
      const rows = await db.query.platformPricing.findMany({
        where: eq(platformPricing.itemId, request.params.itemId),
      });
      return rows;
    },
  );

  // Create platform pricing
  app.post('/api/platform-pricing', async (request, reply) => {
    const body = createPlatformPricingSchema.parse(request.body);
    const [row] = await db.insert(platformPricing).values(body).returning();
    return reply.status(201).send(row);
  });

  // Update platform pricing
  app.patch<{ Params: { id: string } }>(
    '/api/platform-pricing/:id',
    async (request, reply) => {
      const body = updatePlatformPricingSchema.parse(request.body);
      const [row] = await db
        .update(platformPricing)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(platformPricing.id, request.params.id))
        .returning();
      if (!row) return reply.status(404).send({ error: 'Platform pricing not found' });
      return row;
    },
  );

  // Delete platform pricing
  app.delete<{ Params: { id: string } }>(
    '/api/platform-pricing/:id',
    async (request, reply) => {
      const [row] = await db
        .delete(platformPricing)
        .where(eq(platformPricing.id, request.params.id))
        .returning();
      if (!row) return reply.status(404).send({ error: 'Platform pricing not found' });
      return reply.status(204).send();
    },
  );
}
