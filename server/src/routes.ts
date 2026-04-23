import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import { createMatch, getMatch, listMatches, listMatchesByHost, updateScore, endMatch } from './matchStore';
import { registerUser, loginUser, getUserById } from './userStore';
import { signToken, requireAuth, requireRole } from './auth';
import pool from './db';

export default function createRouter(io: Server) {
  const router = Router();

  // --- Auth ---

  router.post('/auth/register', async (req: Request, res: Response) => {
    const { email, password, role, displayName } = req.body;
    if (!email || !password || !role || !displayName) {
      res.status(400).json({ error: 'email, password, role, and displayName are required' });
      return;
    }
    if (role !== 'host' && role !== 'viewer') {
      res.status(400).json({ error: 'role must be "host" or "viewer"' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'password must be at least 6 characters' });
      return;
    }
    try {
      const user = await registerUser({ email, password, role, displayName });
      const token = signToken({ userId: user.id, email: user.email, role: user.role, displayName: user.displayName });
      res.status(201).json({ token, user });
    } catch (err: unknown) {
      res.status(409).json({ error: err instanceof Error ? err.message : 'registration failed' });
    }
  });

  router.post('/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: 'email and password are required' }); return; }
    try {
      const user = await loginUser(email, password);
      const token = signToken({ userId: user.id, email: user.email, role: user.role, displayName: user.displayName });
      res.json({ token, user });
    } catch {
      res.status(401).json({ error: 'invalid credentials' });
    }
  });

  router.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
    const user = await getUserById(req.user!.userId);
    if (!user) { res.status(404).json({ error: 'user not found' }); return; }
    res.json(user);
  });

  // --- Matches ---

  router.post('/matches', async (req: Request, res: Response) => {
    const { title, teamA, teamB, sport, venue } = req.body;
    if (!title || !teamA || !teamB) {
      res.status(400).json({ error: 'title, teamA, and teamB are required' });
      return;
    }
    try {
      const hostId = req.user?.userId;
      const match = await createMatch({ title, teamA, teamB, sport, venue, hostId });
      res.status(201).json(match);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed to create match' });
    }
  });

  router.get('/matches/mine', requireAuth, requireRole('host'), async (req: Request, res: Response) => {
    try {
      res.json(await listMatchesByHost(req.user!.userId));
    } catch {
      res.status(500).json({ error: 'failed to list matches' });
    }
  });

  router.get('/matches', async (_req: Request, res: Response) => {
    try {
      res.json(await listMatches());
    } catch {
      res.status(500).json({ error: 'failed to list matches' });
    }
  });

  router.get('/matches/:code', async (req: Request<{ code: string }>, res: Response) => {
    try {
      const match = await getMatch(req.params.code);
      if (!match) { res.status(404).json({ error: 'match not found' }); return; }
      res.json(match);
    } catch {
      res.status(500).json({ error: 'failed to get match' });
    }
  });

  router.patch('/matches/:code/score', requireAuth, requireRole('host'), async (req: Request<{ code: string }>, res: Response) => {
    const { scoreA, scoreB } = req.body;
    if (typeof scoreA !== 'number' || typeof scoreB !== 'number') {
      res.status(400).json({ error: 'scoreA and scoreB must be numbers' }); return;
    }
    try {
      const { rows } = await pool.query('SELECT host_id FROM matches WHERE code = $1', [req.params.code.toUpperCase()]);
      if (rows.length === 0) { res.status(404).json({ error: 'match not found' }); return; }
      if (rows[0].host_id !== req.user!.userId) { res.status(403).json({ error: 'not your match' }); return; }
      const updated = await updateScore(req.params.code, scoreA, scoreB);
      if (!updated) { res.status(404).json({ error: 'match not found' }); return; }
      io.to(req.params.code.toUpperCase()).emit('match-updated', updated);
      res.json(updated);
    } catch {
      res.status(500).json({ error: 'failed to update score' });
    }
  });

  router.patch('/matches/:code/end', requireAuth, requireRole('host'), async (req: Request<{ code: string }>, res: Response) => {
    try {
      const { rows } = await pool.query('SELECT host_id, ended_at FROM matches WHERE code = $1', [req.params.code.toUpperCase()]);
      if (rows.length === 0) { res.status(404).json({ error: 'match not found' }); return; }
      if (rows[0].host_id !== req.user!.userId) { res.status(403).json({ error: 'not your match' }); return; }
      if (rows[0].ended_at) { res.status(400).json({ error: 'match already ended' }); return; }
      const updated = await endMatch(req.params.code);
      if (!updated) { res.status(404).json({ error: 'match not found' }); return; }
      io.to(req.params.code.toUpperCase()).emit('match-updated', updated);
      res.json(updated);
    } catch {
      res.status(500).json({ error: 'failed to end match' });
    }
  });

  return router;
}
