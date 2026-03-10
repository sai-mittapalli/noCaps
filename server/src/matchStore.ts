import pool from './db';
import type { Camera, MatchDTO, CameraDTO } from './types';

// ---------------------------------------------------------------------------
// In-memory camera sessions (ephemeral — tied to socket connections)
// Match metadata lives in the DB; cameras live here.
// ---------------------------------------------------------------------------

interface MatchSession {
  code: string;
  cameras: Map<number, Camera>; // camera number → camera
}

const sessions = new Map<string, MatchSession>();

function getOrCreateSession(code: string): MatchSession {
  const key = code.toUpperCase();
  if (!sessions.has(key)) sessions.set(key, { code: key, cameras: new Map() });
  return sessions.get(key)!;
}

// ---------------------------------------------------------------------------
// DB row type
// ---------------------------------------------------------------------------

interface MatchRow {
  id: string;
  code: string;
  title: string;
  team_a: string;
  team_b: string;
  sport: string;
  venue: string;
  host_id: string | null;
  is_live: boolean;
  score_a: number;
  score_b: number;
  ended_at: string | null;
  created_at: string;
}

function toDTO(row: MatchRow, cameras: Camera[]): MatchDTO {
  const cameraDTOs: CameraDTO[] = cameras.map((c) => ({
    number: c.number,
    role: c.role,
    isStreaming: c.isStreaming,
  }));
  return {
    code: row.code,
    title: row.title,
    teamA: row.team_a,
    teamB: row.team_b,
    sport: row.sport,
    venue: row.venue,
    createdAt: row.created_at,
    isLive: cameras.some((c) => c.isStreaming),
    scoreA: row.score_a ?? 0,
    scoreB: row.score_b ?? 0,
    hostId: row.host_id,
    endedAt: row.ended_at,
    cameras: cameraDTOs,
  };
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

async function generateCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  const { rows } = await pool.query('SELECT 1 FROM matches WHERE code = $1', [code]);
  if (rows.length > 0) return generateCode(); // collision — try again
  return code;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createMatch(data: {
  title: string;
  teamA: string;
  teamB: string;
  sport?: string;
  venue?: string;
  hostId?: string;
}): Promise<MatchDTO> {
  const code = await generateCode();
  const { rows } = await pool.query<MatchRow>(
    `INSERT INTO matches (code, title, team_a, team_b, sport, venue, host_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [code, data.title, data.teamA, data.teamB, data.sport ?? '', data.venue ?? '', data.hostId ?? null]
  );
  getOrCreateSession(code); // seed empty session
  return toDTO(rows[0], []);
}

export async function getMatch(code: string): Promise<MatchDTO | null> {
  const { rows } = await pool.query<MatchRow>(
    'SELECT * FROM matches WHERE code = $1',
    [code.toUpperCase()]
  );
  if (rows.length === 0) return null;
  const session = getOrCreateSession(code);
  return toDTO(rows[0], Array.from(session.cameras.values()));
}

/** Public match list — excludes ended matches */
export async function listMatches(): Promise<MatchDTO[]> {
  const { rows } = await pool.query<MatchRow>(
    'SELECT * FROM matches WHERE ended_at IS NULL ORDER BY created_at DESC'
  );
  return rows.map((row) => {
    const session = sessions.get(row.code);
    const cameras = session ? Array.from(session.cameras.values()) : [];
    return toDTO(row, cameras);
  });
}

/** Host dashboard — all matches created by a specific host (including ended) */
export async function listMatchesByHost(hostId: string): Promise<MatchDTO[]> {
  const { rows } = await pool.query<MatchRow>(
    'SELECT * FROM matches WHERE host_id = $1 ORDER BY created_at DESC',
    [hostId]
  );
  return rows.map((row) => {
    const session = sessions.get(row.code);
    const cameras = session ? Array.from(session.cameras.values()) : [];
    return toDTO(row, cameras);
  });
}

/** Update score for a match. Returns updated DTO or null if not found. */
export async function updateScore(code: string, scoreA: number, scoreB: number): Promise<MatchDTO | null> {
  const key = code.toUpperCase();
  const { rows } = await pool.query<MatchRow>(
    'UPDATE matches SET score_a = $1, score_b = $2 WHERE code = $3 RETURNING *',
    [scoreA, scoreB, key]
  );
  if (rows.length === 0) return null;
  const session = sessions.get(key);
  const cameras = session ? Array.from(session.cameras.values()) : [];
  return toDTO(rows[0], cameras);
}

/** End a match — sets ended_at to now. Returns updated DTO or null. */
export async function endMatch(code: string): Promise<MatchDTO | null> {
  const key = code.toUpperCase();
  const { rows } = await pool.query<MatchRow>(
    'UPDATE matches SET ended_at = NOW(), is_live = FALSE WHERE code = $1 RETURNING *',
    [key]
  );
  if (rows.length === 0) return null;
  // Clear in-memory session
  sessions.delete(key);
  return toDTO(rows[0], []);
}

/**
 * Returns the raw session for socket handlers. Checks memory first,
 * then falls back to DB to confirm the match exists before creating a session.
 */
export async function getRawMatch(code: string): Promise<MatchSession | null> {
  const key = code.toUpperCase();
  if (sessions.has(key)) return sessions.get(key)!;

  // Match may exist in DB but not have an active session yet
  const { rows } = await pool.query('SELECT code FROM matches WHERE code = $1', [key]);
  if (rows.length === 0) return null;

  return getOrCreateSession(key);
}

/**
 * Sync the live status of a match back to the DB.
 * Called when cameras toggle streaming or disconnect.
 */
export async function syncLiveStatus(code: string): Promise<MatchDTO | null> {
  const key = code.toUpperCase();
  const session = sessions.get(key);
  const isLive = session
    ? Array.from(session.cameras.values()).some((c) => c.isStreaming)
    : false;

  const { rows } = await pool.query<MatchRow>(
    'UPDATE matches SET is_live = $1 WHERE code = $2 RETURNING *',
    [isLive, key]
  );
  if (rows.length === 0) return null;
  const cameras = session ? Array.from(session.cameras.values()) : [];
  return toDTO(rows[0], cameras);
}

/**
 * Find which match a socket belongs to and remove it.
 * Returns the match code + camera number so callers can broadcast the update.
 */
export function removeSocketFromAllMatches(socketId: string): { code: string; cameraNumber: number } | null {
  for (const [code, session] of sessions) {
    for (const [num, cam] of session.cameras) {
      if (cam.socketId === socketId) {
        session.cameras.delete(num);
        return { code, cameraNumber: num };
      }
    }
  }
  return null;
}

/**
 * Called on server startup — resets is_live for all matches since all
 * socket sessions are gone after a restart.
 */
export async function resetAllLiveStatus(): Promise<void> {
  await pool.query('UPDATE matches SET is_live = FALSE');
  sessions.clear();
  console.log('[db] reset is_live for all matches');
}
