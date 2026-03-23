import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { items } from '../db/schema.js';
import { createItemSchema, updateItemSchema } from '../schemas.js';

export async function itemRoutes(app: FastifyInstance) {
  // List items for a category
  app.get<{ Params: { categoryId: string } }>(
    '/api/categories/:categoryId/items',
    async (request) => {
      const rows = await db.query.items.findMany({
        where: eq(items.categoryId, request.params.categoryId),
        orderBy: (i, { asc }) => [asc(i.sortOrder)],
      });
      return rows;
    },
  );

  // Get item by ID (with modifier groups and platform pricing)
  app.get<{ Params: { id: string } }>('/api/items/:id', async (request, reply) => {
    const row = await db.query.items.findFirst({
      where: eq(items.id, request.params.id),
      with: {
        modifierGroups: {
          orderBy: (mg, { asc }) => [asc(mg.sortOrder)],
          with: { modifiers: { orderBy: (m, { asc }) => [asc(m.sortOrder)] } },
        },
        platformPricing: true,
      },
    });
    if (!row) return reply.status(404).send({ error: 'Item not found' });
    return row;
  });

  // Create item
  app.post('/api/items', async (request, reply) => {
    const body = createItemSchema.parse(request.body);
    const [row] = await db.insert(items).values(body).returning();
    return reply.status(201).send(row);
  });

  // Update item
  app.patch<{ Params: { id: string } }>('/api/items/:id', async (request, reply) => {
    const body = updateItemSchema.parse(request.body);
    const [row] = await db
      .update(items)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(items.id, request.params.id))
      .returning();
    if (!row) return reply.status(404).send({ error: 'Item not found' });
    return row;
  });

  // Delete item
  app.delete<{ Params: { id: string } }>('/api/items/:id', async (request, reply) => {
    const [row] = await db.delete(items).where(eq(items.id, request.params.id)).returning();
    if (!row) return reply.status(404).send({ error: 'Item not found' });
    return reply.status(204).send();
  });
}
