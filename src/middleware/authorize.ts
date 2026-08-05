import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError';
import type { Role } from '../types/auth.types';

// Require the caller be staff with one of these roles.
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    const a = req.auth;
    if (!a || a.kind !== 'staff') {
      throw new AppError(403, 'INSUFFICIENT_ROLE', 'Staff access required');
    }
    if (!a.role || !roles.includes(a.role)) {
      throw new AppError(
        403,
        'INSUFFICIENT_ROLE',
        `Requires role: ${roles.join('/')}`,
      );
    }
    next();
  };

export const requireStaff: RequestHandler = (req, _res, next) => {
  if (!req.auth || req.auth.kind !== 'staff') {
    throw new AppError(403, 'INSUFFICIENT_ROLE', 'Staff access required');
  }
  next();
};

export const requireDiner: RequestHandler = (req, _res, next) => {
  if (!req.auth || req.auth.kind !== 'diner') {
    throw new AppError(403, 'INSUFFICIENT_ROLE', 'Diner access required');
  }
  next();
};

// Ownership/branch guard — defense in depth on top of RLS.
// Confirms the target row's restaurant_id === req.auth.restaurantId
// and, for branch-scoped roles, branch_id === req.auth.branchId.
export const requireBranchScope: RequestHandler = (req, _res, next) => {
  const a = req.auth;
  if (!a) {
    throw new AppError(403, 'INSUFFICIENT_ROLE', 'Authentication required');
  }

  const targetBranchId = req.params.branchId;

  // Branch-scoped staff roles must match their assigned branch
  if (
    a.kind === 'staff' &&
    a.role !== 'owner' &&
    targetBranchId &&
    a.branchId &&
    a.branchId !== targetBranchId
  ) {
    throw new AppError(
      403,
      'INSUFFICIENT_ROLE',
      'You do not have access to this branch',
    );
  }

  next();
};
