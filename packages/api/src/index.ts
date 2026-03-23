import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { restaurantRoutes } from './routes/restaurants.js';
import { menuRoutes } from './routes/menus.js';
import { categoryRoutes } from './routes/categories.js';
import { itemRoutes } from './routes/items.js';
import { modifierRoutes } from './routes/modifiers.js';
import { pricingRoutes } from './routes/pricing.js';
import { integrationRoutes } from './routes/integrations.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(restaurantRoutes);
await app.register(menuRoutes);
await app.register(categoryRoutes);
await app.register(itemRoutes);
await app.register(modifierRoutes);
await app.register(pricingRoutes);
await app.register(integrationRoutes);

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`API server running on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
