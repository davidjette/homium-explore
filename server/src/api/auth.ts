/**
 * API Authentication Middleware
 * 
 * Simple API key auth. Set FUND_API_KEY env var to enable.
 * When not set, all routes are open (development mode).
 * 
 * Usage:
 *   Authorization: Bearer <api-key>
 *   or
 *   X-API-Key: <api-key>
 *   or
 *   ?api_key=<api-key>
 */
import { Request, Response, NextFunction } from 'express';

const API_KEY = process.env.FUND_API_KEY;

/**
 * Extract API key from request (header, query param)
 */
function extractKey(req: Request): string | null {
  // Authorization: Bearer <key>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // X-API-Key header
  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string') {
    return xApiKey.trim();
  }

  // Query parameter
  const queryKey = req.query.api_key;
  if (typeof queryKey === 'string') {
    return queryKey.trim();
  }

  return null;
}

/**
 * Auth middleware — protects write endpoints (POST, PUT, DELETE)
 * GET endpoints remain open for read access
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // No API key configured → development mode, allow all
  if (!API_KEY) {
    next();
    return;
  }

  // Health check is always open
  if (req.path === '/health') {
    next();
    return;
  }

  // GET requests are open (read access)
  if (req.method === 'GET') {
    next();
    return;
  }

  // Write operations require auth
  const provided = extractKey(req);
  if (!provided) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide API key via Authorization: Bearer <key>, X-API-Key header, or ?api_key= query parameter.',
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (provided.length !== API_KEY.length || !timingSafeEqual(provided, API_KEY)) {
    res.status(403).json({
      success: false,
      error: 'Invalid API key.',
    });
    return;
  }

  next();
}

/**
 * Strict auth — requires auth for ALL requests (including GET)
 */
export function strictAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    next();
    return;
  }

  if (req.path === '/health') {
    next();
    return;
  }

  const provided = extractKey(req);
  if (!provided || provided.length !== API_KEY.length || !timingSafeEqual(provided, API_KEY)) {
    res.status(401).json({
      success: false,
      error: 'Authentication required.',
    });
    return;
  }

  next();
}

/**
 * Constant-time string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
