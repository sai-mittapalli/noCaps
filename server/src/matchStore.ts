import pool from './db';
import type { Camera, Match, MatchDTO, CameraDTO } from './types';

// ---------------------------------------------------------------------------
// In-memory demo matches (never persisted to DB)
// ---------------------------------------------------------------------------

const DEMO_CODES = new Set(['DEMO01', 'GAME02']);

const demoMatches = new Map<string, Match>([
  ['DEMO01', {
    code: 'DEMO01',
    title: 'Billiards – Real Game 2',
    teamA: 'Stripes',
    teamB: 'Solids',
    sport: 'Billiards',
    venue: 'CMU Game Room',
    createdAt: new Date('2026-04-19T00:00:00Z'),
    isLive: true,
    isDemo: true,
    cameras: new Map([
      [1, { socketId: 'demo-1', number: 1, role: 'Lateral',  isStreaming: true, videoSrc: '/demo/lateral.mp4'  }],
      [2, { socketId: 'demo-2', number: 2, role: 'Frontal',  isStreaming: true, videoSrc: '/demo/frontal.mp4'  }],
      [3, { socketId: 'demo-3', number: 3, role: 'Diagonal', isStreaming: true, videoSrc: '/demo/diagonal.mp4' }],
    ]),
  }],
  ['GAME02', {
    code: 'GAME02',
    title: 'Billiards – Real Game 2',
    teamA: 'Stripes',
    teamB: 'Solids',
    sport: 'Billiards',
    venue: 'CMU Game Room',
    createdAt: new Date('2026-04-20T00:00:00Z'),
    isLive: false,
    isDemo: true,
    isFullGame: true,
    cameras: new Map([
      [1, { socketId: 'full-1', number: 1, role: 'Lateral',  isStreaming: true, videoSrc: '/game/lateral'  }],
      [2, { socketId: 'full-2', number: 2, role: 'Frontal',  isStreaming: true, videoSrc: '/game/frontal'  }],
      [3, { socketId: 'full-3', number: 3, role: 'Diagonal', isStreaming: true, videoSrc: '/game/diagonal' }],
    ]),
  }],
]);

// ---------------------------------------------------------------------------
// In-memory camera sessions (for all matches — demo + real)
// ---------------------------------------------------------------------------

interface MatchSession {
  code: string;
  cameras: Map<number, Camera>;
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

function demoToDTO(match: Match): MatchDTO {
  const cameras: CameraDTO[] = [];
  match.cameras.forEach((cam) => {
    cameras.push({ number: cam.number, role: cam.role, isStreaming: cam.isStreaming, ...(cam.videoSrc ? { videoSrc: cam.videoSrc } : {}) });
  });
  return {
    code: match.code,
    title: match.title,
    teamA: match.teamA,
    teamB: match.teamB,
    sport: match.sport,
    venue: match.venue,
    createdAt: match.createdAt.toISOString(),
    isLive: match.isLive,
    scoreA: 0,
    scoreB: 0,
    hostId: null,
    endedAt: null,
    cameras,
    ...(match.isDemo     ? { isDemo: true }    : {}),
    ...(match.isFullGame ? { isFullGame: true } : {}),
  };
}

function dbToDTO(row: MatchRow, cameras: Camera[]): MatchDTO {
  const cameraDTOs: CameraDTO[] = cameras.map((c) => ({
    number: c.number,
    role: c.role,
    isStreaming: c.isStreaming,
    ...(c.videoSrc ? { videoSrc: c.videoSrc } : {}),
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
  if (DEMO_CODES.has(code)) return generateCode();
  const { rows } = await pool.query('SELECT 1 FROM matches WHERE code = $1', [code]);
  if (rows.length > 0) return generateCode();
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
  getOrCreateSession(code);
  return dbToDTO(rows[0], []);
}

export async function getMatch(code: string): Promise<MatchDTO | null> {
  const key = code.toUpperCase();
  if (DEMO_CODES.has(key)) {
    const demo = demoMatches.get(key);
    return demo ? demoToDTO(demo) : null;
  }
  const { rows } = await pool.query<MatchRow>('SELECT * FROM matches WHERE code = $1', [key]);
  if (rows.length === 0) return null;
  const session = getOrCreateSession(key);
  return dbToDTO(rows[0], Array.from(session.cameras.values()));
}

export async function listMatches(): Promise<MatchDTO[]> {
  const { rows } = await pool.query<MatchRow>(
    'SELECT * FROM matches WHERE ended_at IS NULL ORDER BY created_at DESC'
  );
  const dbMatches = rows.map((row) => {
    const session = sessions.get(row.code);
    const cameras = session ? Array.from(session.cameras.values()) : [];
    return dbToDTO(row, cameras);
  });
  const demos = Array.from(demoMatches.values()).map(demoToDTO);
  return [...demos, ...dbMatches];
}

export async function listMatchesByHost(hostId: string): Promise<MatchDTO[]> {
  const { rows } = await pool.query<MatchRow>(
    'SELECT * FROM matches WHERE host_id = $1 ORDER BY created_at DESC',
    [hostId]
  );
  return rows.map((row) => {
    const session = sessions.get(row.code);
    const cameras = session ? Array.from(session.cameras.values()) : [];
    return dbToDTO(row, cameras);
  });
}

export async function updateScore(code: string, scoreA: number, scoreB: number): Promise<MatchDTO | null> {
  const key = code.toUpperCase();
  const { rows } = await pool.query<MatchRow>(
    'UPDATE matches SET score_a = $1, score_b = $2 WHERE code = $3 RETURNING *',
    [scoreA, scoreB, key]
  );
  if (rows.length === 0) return null;
  const session = sessions.get(key);
  const cameras = session ? Array.from(session.cameras.values()) : [];
  return dbToDTO(rows[0], cameras);
}

export async function endMatch(code: string): Promise<MatchDTO | null> {
  const key = code.toUpperCase();
  const { rows } = await pool.query<MatchRow>(
    'UPDATE matches SET ended_at = NOW(), is_live = FALSE WHERE code = $1 RETURNING *',
    [key]
  );
  if (rows.length === 0) return null;
  sessions.delete(key);
  return dbToDTO(rows[0], []);
}

export async function getRawMatch(code: string): Promise<MatchSession | { code: string; cameras: Map<number, Camera>; isDemo: true } | null> {
  const key = code.toUpperCase();
  if (DEMO_CODES.has(key)) {
    const demo = demoMatches.get(key);
    return demo ? { code: key, cameras: demo.cameras, isDemo: true as const } : null;
  }
  if (sessions.has(key)) return sessions.get(key)!;
  const { rows } = await pool.query('SELECT code FROM matches WHERE code = $1', [key]);
  if (rows.length === 0) return null;
  return getOrCreateSession(key);
}

export async function syncLiveStatus(code: string): Promise<MatchDTO | null> {
  const key = code.toUpperCase();
  if (DEMO_CODES.has(key)) return null;
  const session = sessions.get(key);
  const isLive = session ? Array.from(session.cameras.values()).some((c) => c.isStreaming) : false;
  const { rows } = await pool.query<MatchRow>(
    'UPDATE matches SET is_live = $1 WHERE code = $2 RETURNING *',
    [isLive, key]
  );
  if (rows.length === 0) return null;
  const cameras = session ? Array.from(session.cameras.values()) : [];
  return dbToDTO(rows[0], cameras);
}

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

export async function resetAllLiveStatus(): Promise<void> {
  await pool.query('UPDATE matches SET is_live = FALSE');
  sessions.clear();
  console.log('[db] reset is_live for all matches');
}
