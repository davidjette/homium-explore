import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.NEON_UDF_DATABASE_URL
    || process.env.DATABASE_URL
    || 'postgresql://neondb_owner:npg_gNhrxuR1Uv8S@ep-bold-star-aeeibsjz-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});
