/**
 * Supabase Auth Middleware
 *
 * Verifies Supabase JWTs using JWKS (new signing keys) with HS256 fallback.
 * Permissive by default: sets req.user when token present, doesn't block without one.
 * Use requireAuth() and requireRole() for route-level enforcement.
 *
 * Env: SUPABASE_JWT_SECRET (HS256 fallback), VITE_SUPABASE_URL or SUPABASE_URL (for JWKS)
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';

// JWKS client for Supabase's new JWT signing keys
const jwksClient = SUPABASE_URL
  ? jwksRsa({
      jwksUri: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600000, // 10 min
      rateLimit: true,
    })
  : null;

export interface SupabaseUser {
  id: string;
  email: string;
  role_type?: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: SupabaseUser;
    }
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return null;
}

/**
 * Verify JWT — tries JWKS first (new Supabase signing keys), falls back to HS256 secret
 */
async function verifyToken(token: string): Promise<jwt.JwtPayload | null> {
  // Decode header to check algorithm
  const header = jwt.decode(token, { complete: true })?.header;
  if (!header) return null;

  // If RS256/EdDSA and we have a JWKS client, use it
  if (header.alg !== 'HS256' && header.kid && jwksClient) {
    try {
      const key = await jwksClient.getSigningKey(header.kid);
      const publicKey = key.getPublicKey();
      return jwt.verify(token, publicKey) as jwt.JwtPayload;
    } catch (err: any) {
      console.error('JWKS verification failed:', err.message);
      return null;
    }
  }

  // Fallback: HS256 with legacy secret
  if (SUPABASE_JWT_SECRET) {
    try {
      return jwt.verify(token, SUPABASE_JWT_SECRET) as jwt.JwtPayload;
    } catch (err: any) {
      console.error('HS256 verification failed:', err.message);
      return null;
    }
  }

  return null;
}

function extractUser(decoded: jwt.JwtPayload): SupabaseUser {
  return {
    id: decoded.sub || '',
    email: decoded.email || '',
    role_type: decoded.role_type || decoded.user_metadata?.role_type || 'registered',
  };
}

/**
 * Global middleware — permissive. Sets req.user when valid Supabase JWT present.
 * Does NOT block requests without a token.
 */
export function supabaseAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!SUPABASE_JWT_SECRET && !jwksClient) {
    next();
    return;
  }

  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }

  verifyToken(token)
    .then((decoded) => {
      if (decoded) {
        req.user = extractUser(decoded);
        // role_type comes from JWT claims (set by Custom Access Token Hook in Supabase)
      }
    })
    .catch((err) => {
      console.error('JWT verification error:', err.message);
    })
    .finally(() => {
      next();
    });
}

/**
 * Route guard — requires authenticated user.
 * Returns 401 if no valid user on request.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!SUPABASE_JWT_SECRET && !jwksClient) {
    // Dev mode — no secret configured, allow all
    next();
    return;
  }

  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required. Please sign in.' });
    return;
  }

  next();
}

/**
 * Route guard — requires a specific role (or higher).
 * Role hierarchy: admin > team > registered
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!SUPABASE_JWT_SECRET && !jwksClient) {
      next();
      return;
    }

    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required. Please sign in.' });
      return;
    }

    const userRole = req.user.role_type || 'registered';

    // Role hierarchy: admin > team > active > registered
    const ROLE_LEVEL: Record<string, number> = {
      admin: 4,
      team: 3,
      active: 2,
      registered: 1,
    };

    const userLevel = ROLE_LEVEL[userRole] || 0;
    const requiredLevel = Math.min(...allowedRoles.map(r => ROLE_LEVEL[r] || 0));

    if (userLevel >= requiredLevel) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: 'Insufficient permissions. Contact Homium for access.',
    });
  };
}
