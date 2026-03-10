import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import { AccessToken } from 'livekit-server-sdk';
import { createMatch, getMatch, listMatches, listMatchesByHost, updateScore, endMatch } from './matchStore';
import { registerUser, loginUser, getUserById } from './userStore';
import { signToken, requireAuth, requireRole } from './auth';
import pool from './db';

export default function createRouter(io: Server) {
  const router = Router();

  // --- Auth Routes ---

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
      const message = err instanceof Error ? err.message : 'registration failed';
      res.status(409).json({ error: message });
    }
  });

  router.post('/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }
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

  // --- Match Routes ---

  // Create — host only
  router.post('/matches', requireAuth, requireRole('host'), async (req: Request, res: Response) => {
    const { title, teamA, teamB, sport, venue } = req.body;
    if (!title || !teamA || !teamB) {
      res.status(400).json({ error: 'title, teamA, and teamB are required' });
      return;
    }
    try {
      const match = await createMatch({ title, teamA, teamB, sport, venue, hostId: req.user!.userId });
      res.status(201).json(match);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'failed to create match';
      res.status(500).json({ error: message });
    }
  });

  // List host's own matches — must come before /:code
  router.get('/matches/mine', requireAuth, requireRole('host'), async (req: Request, res: Response) => {
    try {
      res.json(await listMatchesByHost(req.user!.userId));
    } catch {
      res.status(500).json({ error: 'failed to list matches' });
    }
  });

  // List all active matches — public
  router.get('/matches', async (_req: Request, res: Response) => {
    try {
      res.json(await listMatches());
    } catch {
      res.status(500).json({ error: 'failed to list matches' });
    }
  });

  // Get match by code — public
  router.get('/matches/:code', async (req: Request<{ code: string }>, res: Response) => {
    try {
      const match = await getMatch(req.params.code);
      if (!match) { res.status(404).json({ error: 'match not found' }); return; }
      res.json(match);
    } catch {
      res.status(500).json({ error: 'failed to get match' });
    }
  });

  // Update score — host only, must own match
  router.patch('/matches/:code/score', requireAuth, requireRole('host'), async (req: Request<{ code: string }>, res: Response) => {
    const { scoreA, scoreB } = req.body;
    if (typeof scoreA !== 'number' || typeof scoreB !== 'number') {
      res.status(400).json({ error: 'scoreA and scoreB must be numbers' });
      return;
    }
    if (scoreA < 0 || scoreB < 0) {
      res.status(400).json({ error: 'scores cannot be negative' });
      return;
    }
    try {
      // Verify ownership
      const { rows } = await pool.query(
        'SELECT host_id FROM matches WHERE code = $1',
        [req.params.code.toUpperCase()]
      );
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

  // End match — host only, must own match
  router.patch('/matches/:code/end', requireAuth, requireRole('host'), async (req: Request<{ code: string }>, res: Response) => {
    try {
      const { rows } = await pool.query(
        'SELECT host_id, ended_at FROM matches WHERE code = $1',
        [req.params.code.toUpperCase()]
      );
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

  // --- LiveKit Token ---

  // Public endpoint — camera operators don't need accounts, just a valid match code
  router.get('/livekit/token', async (req: Request, res: Response) => {
    const { matchCode, identity, role } = req.query as Record<string, string>;
    if (!matchCode || !identity || !role) {
      res.status(400).json({ error: 'matchCode, identity, and role are required' });
      return;
    }
    if (role !== 'camera' && role !== 'viewer') {
      res.status(400).json({ error: 'role must be camera or viewer' });
      return;
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      res.status(503).json({ error: 'LiveKit is not configured on this server' });
      return;
    }

    const match = await getMatch(matchCode);
    if (!match) { res.status(404).json({ error: 'match not found' }); return; }

    try {
      const at = new AccessToken(apiKey, apiSecret, {
        identity,
        ttl: 3600, // 1 hour
      });
      at.addGrant({
        room: matchCode.toUpperCase(),
        roomJoin: true,
        canPublish: role === 'camera',
        canSubscribe: true,
      });
      const token = await at.toJwt();
      res.json({ token });
    } catch {
      res.status(500).json({ error: 'failed to generate token' });
    }
  });

  return router;
}
