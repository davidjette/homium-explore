/**
 * Homium SSO: Backfill user app_metadata with role_type
 *
 * One-time migration script. Reads both apps' user tables, determines the
 * highest role for each user, and sets app_metadata.role_type via the
 * Supabase Admin API.
 *
 * Usage:
 *   SUPABASE_URL=https://jrkerateejyismexqove.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   EXPLORE_DATABASE_URL=<neon-url> \
 *   OPPORTUNITY_DATABASE_URL=<neon-url> \
 *   tsx scripts/backfill-user-roles.ts
 *
 * Or if you have .env with these vars:
 *   tsx --env-file=.env scripts/backfill-user-roles.ts
 */

import pg from 'pg';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXPLORE_DB = process.env.EXPLORE_DATABASE_URL || process.env.DATABASE_URL;
const OPPORTUNITY_DB = process.env.OPPORTUNITY_DATABASE_URL;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const ROLE_RANK: Record<string, number> = { admin: 3, team: 2, registered: 1 };

function higherRole(a: string, b: string): string {
  return (ROLE_RANK[a] || 0) >= (ROLE_RANK[b] || 0) ? a : b;
}

/** Determine role from email (fallback for users without a DB role) */
function roleFromEmail(email: string): string {
  const lower = email.toLowerCase();
  if (['djette@gmail.com', 'david@homium.io'].includes(lower)) return 'admin';
  if (lower.endsWith('@homium.io')) return 'team';
  return 'registered';
}

interface UserRecord {
  id: string;
  email: string;
  role_type: string;
}

async function fetchUsersFromDb(
  connString: string,
  table: string,
): Promise<UserRecord[]> {
  const client = new pg.Client({ connectionString: connString });
  try {
    await client.connect();
    const result = await client.query(
      `SELECT id, email, role_type FROM ${table}`,
    );
    return result.rows;
  } catch (err: any) {
    console.warn(`Could not read ${table}: ${err.message}`);
    return [];
  } finally {
    await client.end();
  }
}

async function updateAppMetadata(
  userId: string,
  roleType: string,
): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_metadata: { role_type: roleType },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`  Failed to update ${userId}: ${res.status} ${body}`);
    return false;
  }
  return true;
}

async function main() {
  console.log('=== Homium SSO: Backfill user roles ===\n');

  // Collect users from both app databases
  const merged = new Map<string, { email: string; role: string }>();

  if (EXPLORE_DB) {
    console.log('Reading explore users table...');
    const exploreUsers = await fetchUsersFromDb(EXPLORE_DB, 'users');
    console.log(`  Found ${exploreUsers.length} users`);
    for (const u of exploreUsers) {
      merged.set(u.id, { email: u.email, role: u.role_type || 'registered' });
    }
  }

  if (OPPORTUNITY_DB) {
    console.log('Reading opportunity user_profiles table...');
    const oppUsers = await fetchUsersFromDb(OPPORTUNITY_DB, 'user_profiles');
    console.log(`  Found ${oppUsers.length} users`);
    for (const u of oppUsers) {
      const existing = merged.get(u.id);
      const oppRole = u.role_type || 'registered';
      if (existing) {
        existing.role = higherRole(existing.role, oppRole);
      } else {
        merged.set(u.id, { email: u.email, role: oppRole });
      }
    }
  }

  // Also fetch all Supabase auth users to catch anyone not in either local table
  console.log('Fetching all Supabase auth users...');
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY!,
    },
  });

  if (authRes.ok) {
    const authData = await authRes.json();
    const authUsers = authData.users || authData;
    console.log(`  Found ${authUsers.length} auth users`);
    for (const u of authUsers) {
      if (!merged.has(u.id)) {
        merged.set(u.id, {
          email: u.email,
          role: roleFromEmail(u.email),
        });
      }
    }
  }

  console.log(`\nTotal unique users to backfill: ${merged.size}\n`);

  // Apply email-based role upgrades
  for (const [id, data] of merged) {
    const emailRole = roleFromEmail(data.email);
    data.role = higherRole(data.role, emailRole);
  }

  // Update each user's app_metadata
  let success = 0;
  let failed = 0;

  for (const [id, data] of merged) {
    const label = `${data.email} → ${data.role}`;
    const ok = await updateAppMetadata(id, data.role);
    if (ok) {
      console.log(`  OK: ${label}`);
      success++;
    } else {
      failed++;
    }
  }

  console.log(`\nDone. ${success} updated, ${failed} failed.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
