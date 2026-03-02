/** Run database migrations */
import fs from 'fs';
import path from 'path';
import { pool } from './pool';

async function migrate() {
  const migrationDir = path.join(__dirname, '../../db/migrations');
  const files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
    await pool.query(sql);
    console.log(`  ✅ ${file} complete`);
  }

  console.log('All migrations complete.');
  await pool.end();
}

migrate().catch(e => { console.error('Migration failed:', e); process.exit(1); });
