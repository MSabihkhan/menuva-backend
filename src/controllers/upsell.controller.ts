import { Request, Response } from 'express';
import * as upsellService from '../services/upsell.service';

export async function getSuggestions(req: Request, res: Response) {
  const db = req.db!;
  const sessionId = req.auth!.sessionId as string;
  const { trigger, triggerItemId, cartItemIds, declinedItemIds, impressionsThisRound } = req.body;

  const data = await upsellService.getSuggestions(db, sessionId, trigger, triggerItemId, cartItemIds, declinedItemIds, impressionsThisRound);
  res.json({ ok: true, data });
}

export async function logEvent(req: Request, res: Response) {
  const db = req.db!;
  const sessionId = req.auth!.sessionId as string;
  const { eventType, payload } = req.body;

  await upsellService.logEvent(db, sessionId, eventType, payload);
  res.status(202).json({ ok: true, data: {} });
}

export async function getRules(req: Request, res: Response) {
  const db = req.db!;
  const rules = await upsellService.getRules(db);
  res.json({ ok: true, data: { rules } });
}

export async function patchRules(req: Request, res: Response) {
  const db = req.db!;
  const patch = {
    is_enabled: req.body.isEnabled,
    max_suggestions_add_cart: req.body.maxSuggestionsAddCart,
    max_suggestions_cart: req.body.maxSuggestionsCart,
    max_suggestions_checkout: req.body.maxSuggestionsCheckout,
    max_impressions_per_round: req.body.maxImpressionsPerRound,
    auto_dismiss_seconds: req.body.autoDismissSeconds,
    suppress_after_decline: req.body.suppressAfterDecline,
    minimum_support_bps: req.body.minimumSupportBps,
    minimum_lift_bps: req.body.minimumLiftBps
  };

  Object.keys(patch).forEach(key => (patch as any)[key] === undefined && delete (patch as any)[key]);

  const rules = await upsellService.updateRules(db, patch);
  res.json({ ok: true, data: { rules } });
}

export async function getPairings(req: Request, res: Response) {
  const db = req.db!;
  const pairings = await upsellService.listPairings(db);
  res.json({ ok: true, data: { pairings } });
}

export async function createPairings(req: Request, res: Response) {
  const db = req.db!;
  const restaurantId = req.auth!.restaurantId;
  const { sourceItemId, targetItemIds, sortOrder } = req.body;
  const pairings = await upsellService.createPairings(db, restaurantId, sourceItemId, targetItemIds, sortOrder);
  res.status(201).json({ ok: true, data: { pairings } });
}

export async function deletePairing(req: Request, res: Response) {
  const db = req.db!;
  const id = req.params.id as string;
  await upsellService.deletePairing(db, id);
  res.json({ ok: true, data: {} });
}

export async function getAffinity(req: Request, res: Response) {
  const db = req.db!;
  const affinity = await upsellService.listAffinity(db);
  res.json({ ok: true, data: { affinity } });
}

export async function createAffinity(req: Request, res: Response) {
  const db = req.db!;
  const restaurantId = req.auth!.restaurantId;
  const { sourceCategoryId, targetCategoryId, priority } = req.body;
  const affinity = await upsellService.createAffinity(db, restaurantId, sourceCategoryId, targetCategoryId, priority);
  res.status(201).json({ ok: true, data: { affinity } });
}

export async function deleteAffinity(req: Request, res: Response) {
  const db = req.db!;
  const id = req.params.id as string;
  await upsellService.deleteAffinity(db, id);
  res.json({ ok: true, data: {} });
}
