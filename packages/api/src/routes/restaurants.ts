import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { restaurants } from '../db/schema.js';
import { createRestaurantSchema, updateRestaurantSchema } from '../schemas.js';

export async function restaurantRoutes(app: FastifyInstance) {
  // List restaurants
  app.get('/api/restaurants', async (request) => {
    const rows = await db.query.restaurants.findMany({
      orderBy: (r, { asc }) => [asc(r.name)],
    });
    return rows;
  });

  // Get restaurant by ID
  app.get<{ Params: { id: string } }>('/api/restaurants/:id', async (request, reply) => {
    const row = await db.query.restaurants.findFirst({
      where: eq(restaurants.id, request.params.id),
      with: { menus: true },
    });
    if (!row) return reply.status(404).send({ error: 'Restaurant not found' });
    return row;
  });

  // Create restaurant
  app.post('/api/restaurants', async (request, reply) => {
    const body = createRestaurantSchema.parse(request.body);
    const [row] = await db.insert(restaurants).values(body).returning();
    return reply.status(201).send(row);
  });

  // Update restaurant
  app.patch<{ Params: { id: string } }>('/api/restaurants/:id', async (request, reply) => {
    const body = updateRestaurantSchema.parse(request.body);
    const [row] = await db
      .update(restaurants)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(restaurants.id, request.params.id))
      .returning();
    if (!row) return reply.status(404).send({ error: 'Restaurant not found' });
    return row;
  });

  // Delete restaurant
  app.delete<{ Params: { id: string } }>('/api/restaurants/:id', async (request, reply) => {
    const [row] = await db
      .delete(restaurants)
      .where(eq(restaurants.id, request.params.id))
      .returning();
    if (!row) return reply.status(404).send({ error: 'Restaurant not found' });
    return reply.status(204).send();
  });
}
