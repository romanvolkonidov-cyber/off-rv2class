import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';

export function requireRole(...roles: Array<'ADMIN' | 'TEACHER' | 'STUDENT'>) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    // ADMIN is a super-user and can access anything
    if (req.user.role === 'ADMIN') {
      next();
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Недостаточно прав доступа' });
      return;
    }

    next();
  };
}
