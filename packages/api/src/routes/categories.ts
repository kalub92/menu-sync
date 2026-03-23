import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories } from '../db/schema.js';
import { createCategorySchema, updateCategorySchema } from '../schemas.js';

export async function categoryRoutes(app: FastifyInstance) {
  // List categories for a menu
  app.get<{ Params: { menuId: string } }>(
    '/api/menus/:menuId/categories',
    async (request) => {
      const rows = await db.query.categories.findMany({
        where: eq(categories.menuId, request.params.menuId),
        orderBy: (c, { asc }) => [asc(c.sortOrder)],
      });
      return rows;
    },
  );

  // Get category by ID (with items)
  app.get<{ Params: { id: string } }>('/api/categories/:id', async (request, reply) => {
    const row = await db.query.categories.findFirst({
      where: eq(categories.id, request.params.id),
      with: { items: { orderBy: (i, { asc }) => [asc(i.sortOrder)] } },
    });
    if (!row) return reply.status(404).send({ error: 'Category not found' });
    return row;
  });

  // Create category
  app.post('/api/categories', async (request, reply) => {
    const body = createCategorySchema.parse(request.body);
    const [row] = await db.insert(categories).values(body).returning();
    return reply.status(201).send(row);
  });

  // Update category
  app.patch<{ Params: { id: string } }>('/api/categories/:id', async (request, reply) => {
    const body = updateCategorySchema.parse(request.body);
    const [row] = await db
      .update(categories)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(categories.id, request.params.id))
      .returning();
    if (!row) return reply.status(404).send({ error: 'Category not found' });
    return row;
  });

  // Delete category
  app.delete<{ Params: { id: string } }>('/api/categories/:id', async (request, reply) => {
    const [row] = await db
      .delete(categories)
      .where(eq(categories.id, request.params.id))
      .returning();
    if (!row) return reply.status(404).send({ error: 'Category not found' });
    return reply.status(204).send();
  });
}
