import { Request, Response } from 'express';
import * as notificationModel from '../models/notification.model';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { channel, recipientType, eventType, limit, offset } = req.query;
  const entries = await notificationModel.listNotifications(req.db!, {
    channel: channel as string | undefined,
    recipientType: recipientType as string | undefined,
    eventType: eventType as string | undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
  });
  res.json({ ok: true, data: entries });
});
