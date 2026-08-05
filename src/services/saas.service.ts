import { supabaseAdmin } from '../config/supabase';
import * as saasModel from '../models/saas.model';

export async function getTenants() {
  return saasModel.getTenants(supabaseAdmin);
}

export async function getTenantById(id: string) {
  return saasModel.getTenantById(supabaseAdmin, id);
}

export async function getPlans() {
  return saasModel.getPlans(supabaseAdmin);
}

export async function createPlan(data: { name: string; price: number; features?: any; isActive?: boolean }) {
  // Convert isActive to is_active for DB
  const payload: any = { name: data.name, price: data.price };
  if (data.features !== undefined) payload.features = data.features;
  if (data.isActive !== undefined) payload.is_active = data.isActive;

  return saasModel.createPlan(supabaseAdmin, payload);
}

export async function updatePlan(id: string, data: { name?: string; price?: number; features?: any; isActive?: boolean }) {
  const payload: any = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.price !== undefined) payload.price = data.price;
  if (data.features !== undefined) payload.features = data.features;
  if (data.isActive !== undefined) payload.is_active = data.isActive;

  return saasModel.updatePlan(supabaseAdmin, id, payload);
}

export async function getSubscriptions() {
  return saasModel.getSubscriptions(supabaseAdmin);
}

export async function updateSubscription(id: string, status: string) {
  return saasModel.updateSubscription(supabaseAdmin, id, { status });
}

export async function getBilling() {
  return saasModel.getBilling(supabaseAdmin);
}

export async function getCosts() {
  return saasModel.getCosts(supabaseAdmin);
}

export async function createCost(data: {
  costType: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  restaurantId?: string;
}) {
  const payload = {
    cost_type: data.costType,
    amount: data.amount,
    period_start: data.periodStart,
    period_end: data.periodEnd,
    restaurant_id: data.restaurantId,
  };

  return saasModel.createCost(supabaseAdmin, payload);
}

export async function getAnalytics() {
  return saasModel.getAnalytics(supabaseAdmin);
}
