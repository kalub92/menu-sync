import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { modifierGroups, modifiers } from '../db/schema.js';
import {
  createModifierGroupSchema,
  updateModifierGroupSchema,
  createModifierSchema,
  updateModifierSchema,
} from '../schemas.js';

export async function modifierRoutes(app: FastifyInstance) {
  // ── Modifier Groups ─────────────────────────────────────────────────────

  // List modifier groups for an item
  app.get<{ Params: { itemId: string } }>(
    '/api/items/:itemId/modifier-groups',
    async (request) => {
      const rows = await db.query.modifierGroups.findMany({
        where: eq(modifierGroups.itemId, request.params.itemId),
        orderBy: (mg, { asc }) => [asc(mg.sortOrder)],
        with: { modifiers: { orderBy: (m, { asc }) => [asc(m.sortOrder)] } },
      });
      return rows;
    },
  );

  // Get modifier group by ID
  app.get<{ Params: { id: string } }>('/api/modifier-groups/:id', async (request, reply) => {
    const row = await db.query.modifierGroups.findFirst({
      where: eq(modifierGroups.id, request.params.id),
      with: { modifiers: { orderBy: (m, { asc }) => [asc(m.sortOrder)] } },
    });
    if (!row) return reply.status(404).send({ error: 'Modifier group not found' });
    return row;
  });

  // Create modifier group
  app.post('/api/modifier-groups', async (request, reply) => {
    const body = createModifierGroupSchema.parse(request.body);
    const [row] = await db.insert(modifierGroups).values(body).returning();
    return reply.status(201).send(row);
  });

  // Update modifier group
  app.patch<{ Params: { id: string } }>(
    '/api/modifier-groups/:id',
    async (request, reply) => {
      const body = updateModifierGroupSchema.parse(request.body);
      const [row] = await db
        .update(modifierGroups)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(modifierGroups.id, request.params.id))
        .returning();
      if (!row) return reply.status(404).send({ error: 'Modifier group not found' });
      return row;
    },
  );

  // Delete modifier group
  app.delete<{ Params: { id: string } }>(
    '/api/modifier-groups/:id',
    async (request, reply) => {
      const [row] = await db
        .delete(modifierGroups)
        .where(eq(modifierGroups.id, request.params.id))
        .returning();
      if (!row) return reply.status(404).send({ error: 'Modifier group not found' });
      return reply.status(204).send();
    },
  );

  // ── Modifiers ───────────────────────────────────────────────────────────

  // Create modifier
  app.post('/api/modifiers', async (request, reply) => {
    const body = createModifierSchema.parse(request.body);
    const [row] = await db.insert(modifiers).values(body).returning();
    return reply.status(201).send(row);
  });

  // Update modifier
  app.patch<{ Params: { id: string } }>('/api/modifiers/:id', async (request, reply) => {
    const body = updateModifierSchema.parse(request.body);
    const [row] = await db
      .update(modifiers)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(modifiers.id, request.params.id))
      .returning();
    if (!row) return reply.status(404).send({ error: 'Modifier not found' });
    return row;
  });

  // Delete modifier
  app.delete<{ Params: { id: string } }>('/api/modifiers/:id', async (request, reply) => {
    const [row] = await db
      .delete(modifiers)
      .where(eq(modifiers.id, request.params.id))
      .returning();
    if (!row) return reply.status(404).send({ error: 'Modifier not found' });
    return reply.status(204).send();
  });
}
