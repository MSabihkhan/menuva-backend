import { Request, Response } from 'express';
import * as staffService from '../services/staff.service';

export const list = async (req: Request, res: Response) => {
  const branchIdScope = req.auth?.role === 'branch_manager' ? req.auth.branchId : undefined;
  
  const data = await staffService.listStaff(req.db!, branchIdScope);
  res.status(200).json({ ok: true, data });
};

export const update = async (req: Request, res: Response) => {
  const employeeId = req.params.employeeId as string;
  const updates = req.body;
  const employee = await staffService.updateStaffMember(req.db!, employeeId, updates);
  res.status(200).json({ ok: true, data: { employee } });
};

export const remove = async (req: Request, res: Response) => {
  const employeeId = req.params.employeeId as string;
  await staffService.removeStaffMember(req.db!, employeeId);
  res.status(200).json({ ok: true });
};
