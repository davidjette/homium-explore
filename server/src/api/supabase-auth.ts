/**
 * Supabase Auth Middleware
 *
 * Verifies Supabase JWTs using the project's JWT secret.
 * Permissive by default: sets req.user when token present, doesn't block without one.
 * Use requireAuth() and requireRole() for route-level enforcement.
 *
 * Env: SUPABASE_JWT_SECRET (required in production)
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

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
 * Global middleware — permissive. Sets req.user when valid Supabase JWT present.
 * Does NOT block requests without a token.
 */
export function supabaseAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!SUPABASE_JWT_SECRET) {
    next();
    return;
  }

  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET) as jwt.JwtPayload;
    req.user = {
      id: decoded.sub || '',
      email: decoded.email || '',
      role_type: decoded.role_type || decoded.user_metadata?.role_type || 'registered',
    };
  } catch {
    // Invalid token — treat as anonymous, don't block
  }

  next();
}

/**
 * Route guard — requires authenticated user.
 * Returns 401 if no valid user on request.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!SUPABASE_JWT_SECRET) {
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
    if (!SUPABASE_JWT_SECRET) {
      next();
      return;
    }

    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required. Please sign in.' });
      return;
    }

    const userRole = req.user.role_type || 'registered';

    // Admin can do everything
    if (userRole === 'admin') {
      next();
      return;
    }

    // Team can access team + registered resources
    if (userRole === 'team' && allowedRoles.some(r => r === 'team' || r === 'registered')) {
      next();
      return;
    }

    // Registered can only access registered resources
    if (userRole === 'registered' && allowedRoles.includes('registered')) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: 'Insufficient permissions. Contact Homium for access.',
    });
  };
}
