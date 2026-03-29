/**
 * Supabase Admin API client
 *
 * Uses the service role key to manage users via the Supabase Admin API.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function adminHeaders() {
  return {
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    apikey: SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  };
}

/** Check whether the admin API is configured */
export function isAdminApiConfigured(): boolean {
  const configured = !!(SUPABASE_URL && SERVICE_ROLE_KEY);
  if (!configured) {
    console.warn('Supabase Admin API not configured:', {
      hasUrl: !!SUPABASE_URL,
      urlPrefix: SUPABASE_URL?.slice(0, 30),
      hasKey: !!SERVICE_ROLE_KEY,
      keyPrefix: SERVICE_ROLE_KEY?.slice(0, 20),
    });
  }
  return configured;
}

/** List all auth users (paginated) */
export async function listAuthUsers(page = 1, perPage = 50): Promise<{ users: any[]; total: number }> {
  const url = `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`;
  console.log('listAuthUsers →', url.replace(/\/\/.*@/, '//***@'));
  const res = await fetch(url, { headers: adminHeaders() });
  if (!res.ok) {
    const body = await res.text();
    console.error('listAuthUsers failed:', res.status, body);
    throw new Error(`List users failed: ${res.status}`);
  }
  return res.json() as Promise<{ users: any[]; total: number }>;
}

/** Get a single auth user by ID */
export async function getAuthUser(userId: string) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
    { headers: adminHeaders() },
  );
  if (!res.ok) throw new Error(`Get user failed: ${res.status}`);
  return res.json();
}

/** Create a new auth user */
export async function createAuthUser(opts: {
  email: string;
  password?: string;
  role_type?: string;
  email_confirm?: boolean;
}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({
      email: opts.email,
      password: opts.password,
      email_confirm: opts.email_confirm ?? false,
      app_metadata: { role_type: opts.role_type || 'registered' },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Create user failed: ${res.status} ${body}`);
  }
  return res.json();
}

/** Update a user's app_metadata (roles, etc.) */
export async function updateAppMetadata(
  userId: string,
  metadata: Record<string, unknown>,
) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({ app_metadata: metadata }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Update app_metadata failed: ${res.status} ${body}`);
  }
  return res.json();
}

/** Send a password reset email to a user (Supabase sends the email) */
export async function sendPasswordResetEmail(email: string, redirectTo?: string) {
  const body: Record<string, unknown> = { email };
  if (redirectTo) body.redirect_to = redirectTo;

  // POST /auth/v1/recover triggers Supabase to send the reset email
  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Password reset email failed: ${res.status} ${text}`);
  }
  return res.json();
}

/** Manually confirm a user's email */
export async function confirmUserEmail(userId: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({ email_confirm: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Confirm email failed: ${res.status} ${body}`);
  }
  return res.json();
}

/** Delete an auth user */
export async function deleteAuthUser(userId: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Delete user failed: ${res.status} ${body}`);
  }
  return res.json();
}

/** Fetch audit log entries from auth.audit_log_entries (via PostgREST on the management API) */
export async function fetchAuditLog(opts?: {
  userId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}) {
  // The audit log is in the auth schema — we query it via the Supabase REST API
  // with the service role key which bypasses RLS
  const params = new URLSearchParams();
  params.set('select', 'id,payload,created_at,ip_address');
  params.set('order', 'created_at.desc');
  params.set('limit', String(opts?.limit || 50));
  if (opts?.offset) params.set('offset', String(opts.offset));

  // Filter by actor_id (Supabase stores the user id in payload->actor_id)
  // We'll do server-side filtering since the audit_log_entries schema varies
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/audit_log_entries?${params.toString()}`,
    {
      headers: {
        ...adminHeaders(),
        Prefer: 'count=exact',
      },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fetch audit log failed: ${res.status} ${body}`);
  }

  const total = parseInt(res.headers.get('content-range')?.split('/')[1] || '0');
  const entries = (await res.json()) as any[];

  // Server-side filter by userId if provided
  let filtered: any[] = entries;
  if (opts?.userId) {
    filtered = entries.filter(
      (e: any) => e.payload?.actor_id === opts.userId,
    );
  }
  if (opts?.action) {
    filtered = filtered.filter(
      (e: any) => e.payload?.action === opts.action,
    );
  }

  return { entries: filtered, total };
}
