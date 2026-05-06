import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
// @ts-ignore — schema module created in a later task
import * as schema from './schema/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
