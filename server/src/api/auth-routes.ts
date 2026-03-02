/**
 * Authentication Routes
 * 
 * Simple shared-password auth with JWT sessions.
 * Set env vars:
 *   FUND_AUTH_PASSWORD - login password (required to enable auth)
 *   FUND_JWT_SECRET    - JWT signing secret (defaults to AUTH_PASSWORD + salt)
 *   FUND_JWT_EXPIRY    - token expiry (default: '7d')
 */
import { Router, Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';

const AUTH_PASSWORD = process.env.FUND_AUTH_PASSWORD;
const JWT_SECRET = process.env.FUND_JWT_SECRET || (AUTH_PASSWORD ? AUTH_PASSWORD + '-homium-fund-model-jwt' : 'dev-secret');
const JWT_EXPIRY = (process.env.FUND_JWT_EXPIRY || '7d') as string;
const signOpts: SignOptions = { expiresIn: 604800 }; // 7 days in seconds

export const authRouter = Router();

/** POST /api/auth/login — returns JWT */
authRouter.post('/login', (req: Request, res: Response) => {
  // Auth not configured → always succeed (dev mode)
  if (!AUTH_PASSWORD) {
    const token = jwt.sign({ role: 'admin', mode: 'dev' }, JWT_SECRET, signOpts);
    res.json({ success: true, token, expiresIn: JWT_EXPIRY, mode: 'dev' });
    return;
  }

  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    res.status(400).json({ success: false, error: 'Password required.' });
    return;
  }

  // Constant-time comparison
  if (password.length !== AUTH_PASSWORD.length || !timingSafeEqual(password, AUTH_PASSWORD)) {
    res.status(401).json({ success: false, error: 'Invalid password.' });
    return;
  }

  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, signOpts);
  res.json({ success: true, token, expiresIn: JWT_EXPIRY });
});

/** GET /api/auth/verify — check if token is valid */
authRouter.get('/verify', (req: Request, res: Response) => {
  if (!AUTH_PASSWORD) {
    res.json({ success: true, authenticated: true, mode: 'dev' });
    return;
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ success: false, authenticated: false });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, authenticated: true, decoded });
  } catch {
    res.status(401).json({ success: false, authenticated: false, error: 'Token expired or invalid.' });
  }
});

/**
 * JWT auth middleware for protecting routes.
 * When FUND_AUTH_PASSWORD is not set, all requests pass through (dev mode).
 */
export function jwtAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  // No auth configured → dev mode
  if (!AUTH_PASSWORD) {
    next();
    return;
  }

  // Health check always open
  if (req.path === '/health') {
    next();
    return;
  }

  // GET requests to public endpoints remain open
  if (req.method === 'GET' && isPublicPath(req.path)) {
    next();
    return;
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
  }
}

/** Public GET paths that don't require auth */
function isPublicPath(path: string): boolean {
  const publicPaths = ['/health', '/api/auth/login', '/api/auth/verify'];
  return publicPaths.some(p => path.startsWith(p));
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
  const cookie = req.headers.cookie;
  if (cookie) {
    const match = cookie.match(/fund_token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

