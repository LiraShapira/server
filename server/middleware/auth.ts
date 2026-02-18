import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include adminId
declare global {
  namespace Express {
    interface Request {
      adminId?: string;
    }
  }
}

export interface AuthRequest extends Request {
  adminId?: string;
}

/**
 * Authentication middleware
 * Expects admin ID in Authorization header: "Bearer <adminId>"
 * In production, you'd verify a JWT token instead
 */
export const authenticateAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const adminId = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!adminId) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Attach adminId to request for use in controllers
    (req as AuthRequest).adminId = adminId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};
