import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { menus } from '../db/schema.js';
import { createMenuSchema, updateMenuSchema } from '../schemas.js';

export async function menuRoutes(app: FastifyInstance) {
  // List menus for a restaurant
  app.get<{ Params: { restaurantId: string } }>(
    '/api/restaurants/:restaurantId/menus',
    async (request) => {
      const rows = await db.query.menus.findMany({
        where: eq(menus.restaurantId, request.params.restaurantId),
        orderBy: (m, { asc }) => [asc(m.sortOrder)],
      });
      return rows;
    },
  );

  // Get menu by ID (with categories)
  app.get<{ Params: { id: string } }>('/api/menus/:id', async (request, reply) => {
    const row = await db.query.menus.findFirst({
      where: eq(menus.id, request.params.id),
      with: { categories: { orderBy: (c, { asc }) => [asc(c.sortOrder)] } },
    });
    if (!row) return reply.status(404).send({ error: 'Menu not found' });
    return row;
  });

  // Create menu
  app.post('/api/menus', async (request, reply) => {
    const body = createMenuSchema.parse(request.body);
    const [row] = await db.insert(menus).values(body).returning();
    return reply.status(201).send(row);
  });

  // Update menu
  app.patch<{ Params: { id: string } }>('/api/menus/:id', async (request, reply) => {
    const body = updateMenuSchema.parse(request.body);
    const [row] = await db
      .update(menus)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(menus.id, request.params.id))
      .returning();
    if (!row) return reply.status(404).send({ error: 'Menu not found' });
    return row;
  });

  // Delete menu
  app.delete<{ Params: { id: string } }>('/api/menus/:id', async (request, reply) => {
    const [row] = await db.delete(menus).where(eq(menus.id, request.params.id)).returning();
    if (!row) return reply.status(404).send({ error: 'Menu not found' });
    return reply.status(204).send();
  });
}
