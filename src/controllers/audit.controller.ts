import { Request, Response } from 'express';
import * as auditModel from '../models/audit.model';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId, limit, offset } = req.query;
  const entries = await auditModel.listAuditEntries(req.db!, {
    entityType: entityType as string | undefined,
    entityId: entityId as string | undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
  });
  res.json({ ok: true, data: entries });
});
