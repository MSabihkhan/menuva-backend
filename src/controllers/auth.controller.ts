import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';

const COOKIE_OPTIONS = {
  httpOnly: true,
  // Secure cookies require HTTPS, which localhost dev is not. Enable only in
  // production so staff auth cookies are actually stored during local dev.
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api',
};

export async function ownerSignup(req: Request, res: Response) {
  const result = await authService.ownerSignup(req.body);
  res.status(200).json({ ok: true, data: result });
}

export async function staffLogin(req: Request, res: Response) {
  const result = await authService.staffLogin(req.body);

  res.cookie('mv_access', result.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: result.expiresIn * 1000,
  });

  // Assume refresh token is long lived, so 30 days
  res.cookie('mv_refresh', result.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    ok: true,
    data: {
      role: result.role,
      restaurantId: result.restaurantId,
      branchId: result.branchId,
    },
  });
}

export async function staffRefresh(req: Request, res: Response) {
  const refreshToken = req.cookies?.mv_refresh;
  if (!refreshToken) {
    throw new AppError(401, 'TOKEN_EXPIRED', 'Missing refresh token');
  }

  const result = await authService.staffRefresh(refreshToken);

  res.cookie('mv_access', result.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: result.expiresIn * 1000,
  });

  res.cookie('mv_refresh', result.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({ ok: true, data: {} });
}

export async function staffLogout(req: Request, res: Response) {
  const accessToken = req.cookies?.mv_access;
  if (accessToken) {
    await authService.staffLogout(accessToken);
  }

  res.clearCookie('mv_access', COOKIE_OPTIONS);
  res.clearCookie('mv_refresh', COOKIE_OPTIONS);

  res.status(200).json({ ok: true });
}

export async function dinerJoin(req: Request, res: Response) {
  const result = await authService.dinerJoin(req.body);
  res.status(200).json({ ok: true, data: result });
}

export async function staffInvite(req: Request, res: Response) {
  if (!req.db || !req.auth) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Database client missing');
  }

  // Defensively check branch_manager scope since branchId is in the body
  if (req.auth.role === 'branch_manager' && req.auth.branchId !== req.body.branchId) {
    throw new AppError(403, 'INSUFFICIENT_ROLE', 'Branch managers can only invite to their own branch');
  }

  const result = await authService.staffInvite(req.db, {
    ...req.body,
    restaurantId: req.auth.restaurantId,
  });
  res.status(201).json({ ok: true, data: result });
}
