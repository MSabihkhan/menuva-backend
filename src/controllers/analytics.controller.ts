import { Request, Response } from 'express';
import * as analyticsService from '../services/analytics.service';

export const getSales = async (req: Request, res: Response) => {
  const db = req.db!;
  let { from, to, branchId } = req.query as unknown as { from: string; to: string; branchId?: string };
  if (!branchId && req.auth?.role === 'branch_manager' && req.auth.branchId) {
    branchId = req.auth.branchId;
  }
  const data = await analyticsService.getSales(db, from, to, branchId);
  res.json({ ok: true, data });
};

export const getMenuPerformance = async (req: Request, res: Response) => {
  const db = req.db!;
  const data = await analyticsService.getMenuPerformance(db);
  res.json({ ok: true, data });
};

export const getKitchenTiming = async (req: Request, res: Response) => {
  const db = req.db!;
  const data = await analyticsService.getKitchenTiming(db);
  res.json({ ok: true, data });
};

export const getUpsell = async (req: Request, res: Response) => {
  const db = req.db!;
  const data = await analyticsService.getUpsell(db);
  res.json({ ok: true, data });
};

export const getBranchAnalytics = async (req: Request, res: Response) => {
  const db = req.db!;
  const branchId = req.params.branchId as string;
  
  // Per spec: joins the above for one branch
  // The service already handles branch scopes where relevant. 
  // We can just call getSales for the branch. 
  // Let's just return what getSales does plus getKitchenTiming for the branch.
  const sales = await analyticsService.getSales(db, new Date(Date.now() - 30*24*60*60*1000).toISOString(), new Date().toISOString(), branchId);
  const kitchen = await analyticsService.getKitchenTiming(db);
  
  res.json({ ok: true, data: { sales, kitchen } });
};
