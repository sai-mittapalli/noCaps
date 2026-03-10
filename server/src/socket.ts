import { Server } from 'socket.io';
import { getRawMatch, getMatch, removeSocketFromAllMatches, syncLiveStatus } from './matchStore';

export function setupSocket(io: Server) {
  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // Camera joins a match room
    socket.on('join-match', async (data: { code: string; cameraNumber: number; cameraRole: string }, callback) => {
      const match = await getRawMatch(data.code);
      if (!match) { callback?.({ error: 'match not found' }); return; }

      const existing = match.cameras.get(data.cameraNumber);
      if (existing && existing.socketId !== socket.id) {
        callback?.({ error: `camera ${data.cameraNumber} is already taken` });
        return;
      }

      match.cameras.set(data.cameraNumber, {
        socketId: socket.id,
        number: data.cameraNumber,
        role: data.cameraRole,
        isStreaming: false,
      });

      socket.join(data.code.toUpperCase());
      io.to(data.code.toUpperCase()).emit('match-updated', await getMatch(data.code));
      callback?.({ ok: true });

      console.log(`[socket] ${socket.id} joined match ${data.code} as CAM ${data.cameraNumber}`);
    });

    // Camera starts/stops streaming
    socket.on('stream-toggle', async (data: { code: string; cameraNumber: number; isStreaming: boolean }) => {
      const match = await getRawMatch(data.code);
      if (!match) return;

      const cam = match.cameras.get(data.cameraNumber);
      if (!cam || cam.socketId !== socket.id) return;

      cam.isStreaming = data.isStreaming;

      // Sync new live status to DB and broadcast
      const updated = await syncLiveStatus(data.code);
      if (updated) io.to(data.code.toUpperCase()).emit('match-updated', updated);

      console.log(`[socket] CAM ${data.cameraNumber} in ${data.code} streaming: ${data.isStreaming}`);
    });

    // Viewer joins to watch a match
    socket.on('watch-match', async (data: { code: string }, callback) => {
      const match = await getMatch(data.code);
      if (!match) { callback?.({ error: 'match not found' }); return; }
      socket.join(data.code.toUpperCase());
      callback?.({ match });
      console.log(`[socket] ${socket.id} watching match ${data.code}`);
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      const removed = removeSocketFromAllMatches(socket.id);
      if (removed) {
        const updated = await syncLiveStatus(removed.code);
        if (updated) io.to(removed.code).emit('match-updated', updated);
        console.log(`[socket] ${socket.id} disconnected, removed CAM ${removed.cameraNumber} from ${removed.code}`);
      } else {
        console.log(`[socket] disconnected: ${socket.id}`);
      }
    });
  });
}
