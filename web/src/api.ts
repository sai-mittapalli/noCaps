import { io, Socket } from 'socket.io-client';

// In dev: empty string → Vite proxy handles routing to localhost:3000
// In production: set VITE_SERVER_URL to your deployed backend URL
export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

// --- Auth token ---

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) h['Authorization'] = `Bearer ${authToken}`;
  return h;
}

// --- Types ---

export type UserRole = 'host' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
}

export interface CameraDTO {
  number: number;
  role: string;
  isStreaming: boolean;
}

export interface MatchDTO {
  code: string;
  title: string;
  teamA: string;
  teamB: string;
  sport: string;
  venue: string;
  createdAt: string;
  isLive: boolean;
  scoreA: number;
  scoreB: number;
  hostId: string | null;
  endedAt: string | null;
  cameras: CameraDTO[];
}

// --- Auth API ---

interface AuthResponse { token: string; user: AuthUser; }

export async function registerApi(data: {
  email: string; password: string; role: UserRole; displayName: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${SERVER_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Registration failed');
  return body;
}

export async function loginApi(data: {
  email: string; password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Login failed');
  return body;
}

// --- Match REST API ---

export async function createMatch(data: {
  title: string; teamA: string; teamB: string; sport?: string; venue?: string;
}): Promise<MatchDTO> {
  const res = await fetch(`${SERVER_URL}/api/matches`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Failed to create match');
  return body;
}

export async function getMatch(code: string): Promise<MatchDTO | null> {
  const res = await fetch(`${SERVER_URL}/api/matches/${code}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to get match');
  return res.json();
}

export async function listMatches(): Promise<MatchDTO[]> {
  const res = await fetch(`${SERVER_URL}/api/matches`);
  if (!res.ok) throw new Error('Failed to list matches');
  return res.json();
}

export async function listMyMatches(): Promise<MatchDTO[]> {
  const res = await fetch(`${SERVER_URL}/api/matches/mine`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to list matches');
  return res.json();
}

export async function updateScore(code: string, scoreA: number, scoreB: number): Promise<MatchDTO> {
  const res = await fetch(`${SERVER_URL}/api/matches/${code}/score`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ scoreA, scoreB }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Failed to update score');
  return body;
}

export async function endMatch(code: string): Promise<MatchDTO> {
  const res = await fetch(`${SERVER_URL}/api/matches/${code}/end`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Failed to end match');
  return body;
}

// --- Socket.IO ---

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // Dev: no URL → Vite proxy. Production: connect directly to backend.
    socket = SERVER_URL
      ? io(SERVER_URL, { transports: ['websocket'] })
      : io({ transports: ['websocket'] });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function joinMatchAsCamera(
  code: string, cameraNumber: number, cameraRole: string
): Promise<{ ok?: boolean; error?: string }> {
  return new Promise((resolve) => {
    getSocket().emit('join-match', { code, cameraNumber, cameraRole }, resolve);
  });
}

export function toggleStream(code: string, cameraNumber: number, isStreaming: boolean) {
  getSocket().emit('stream-toggle', { code, cameraNumber, isStreaming });
}

export function watchMatch(code: string): Promise<{ match?: MatchDTO; error?: string }> {
  return new Promise((resolve) => {
    getSocket().emit('watch-match', { code }, resolve);
  });
}

export function onMatchUpdated(callback: (match: MatchDTO) => void) {
  getSocket().on('match-updated', callback);
  return () => { getSocket().off('match-updated', callback); };
}

// --- LiveKit ---

export async function getLiveKitToken(
  matchCode: string,
  identity: string,
  role: 'camera' | 'viewer'
): Promise<string> {
  const params = new URLSearchParams({ matchCode, identity, role });
  const res = await fetch(`${SERVER_URL}/api/livekit/token?${params}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Failed to get LiveKit token');
  return body.token;
}
