import type { Request, Response } from 'express';
import * as saasService from '../services/saas.service';

export async function getTenants(_req: Request, res: Response) {
  const tenants = await saasService.getTenants();
  res.json({ ok: true, data: { tenants } });
}

export async function getTenantById(req: Request, res: Response) {
  const id = req.params.id as string;
  const tenant = await saasService.getTenantById(id);
  res.json({ ok: true, data: { tenant } });
}

export async function getPlans(_req: Request, res: Response) {
  const plans = await saasService.getPlans();
  res.json({ ok: true, data: { plans } });
}

export async function createPlan(req: Request, res: Response) {
  const plan = await saasService.createPlan(req.body);
  res.status(201).json({ ok: true, data: { plan } });
}

export async function updatePlan(req: Request, res: Response) {
  const id = req.params.id as string;
  const plan = await saasService.updatePlan(id, req.body);
  res.json({ ok: true, data: { plan } });
}

export async function getSubscriptions(_req: Request, res: Response) {
  const subscriptions = await saasService.getSubscriptions();
  res.json({ ok: true, data: { subscriptions } });
}

export async function updateSubscription(req: Request, res: Response) {
  const id = req.params.id as string;
  const { status } = req.body;
  const subscription = await saasService.updateSubscription(id, status);
  res.json({ ok: true, data: { subscription } });
}

export async function getBilling(_req: Request, res: Response) {
  const invoices = await saasService.getBilling();
  res.json({ ok: true, data: { invoices } });
}

export async function getCosts(_req: Request, res: Response) {
  const costs = await saasService.getCosts();
  res.json({ ok: true, data: { costs } });
}

export async function createCost(req: Request, res: Response) {
  const cost = await saasService.createCost(req.body);
  res.status(201).json({ ok: true, data: { cost } });
}

export async function getAnalytics(_req: Request, res: Response) {
  const analytics = await saasService.getAnalytics();
  res.json({ ok: true, data: { analytics } });
}
