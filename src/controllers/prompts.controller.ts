import type { Request, Response } from 'express';
import { promptsService } from '../services/prompts.service';

export const promptsController = {
  async open(req: Request, res: Response) {
    const auth = req.auth!;
    const { kind, payload } = req.body;
    const prompt = await promptsService.open(
      req.db!, auth.sessionId!, auth.memberId!, kind, payload ?? {},
    );
    res.status(201).json({ ok: true, data: { prompt } });
  },

  async active(req: Request, res: Response) {
    const auth = req.auth!;
    const prompt = await promptsService.active(req.db!, auth.sessionId!);
    res.status(200).json({ ok: true, data: { prompt } });
  },

  async respond(req: Request, res: Response) {
    const auth = req.auth!;
    const prompt = await promptsService.respond(
      req.db!, auth.sessionId!, req.params.promptId as string, auth.memberId!, req.body.response,
    );
    res.status(200).json({ ok: true, data: { prompt } });
  },

  async cancel(req: Request, res: Response) {
    const auth = req.auth!;
    await promptsService.cancel(req.db!, auth.sessionId!, req.params.promptId as string);
    res.status(200).json({ ok: true, data: {} });
  },

  async resolve(req: Request, res: Response) {
    const auth = req.auth!;
    await promptsService.resolve(req.db!, auth.sessionId!, req.params.promptId as string);
    res.status(200).json({ ok: true, data: {} });
  },

  async endSession(req: Request, res: Response) {
    const auth = req.auth!;
    const result = await promptsService.endSession(req.db!, auth.sessionId!);
    res.status(200).json({ ok: true, data: result });
  },
};
