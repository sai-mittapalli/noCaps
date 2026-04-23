import { Server } from 'socket.io';
import { getRawMatch, getMatch, syncLiveStatus, removeSocketFromAllMatches } from './matchStore';

export function setupSocket(io: Server) {
  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

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

      socket.join(data.code);
      io.to(data.code).emit('match-updated', await getMatch(data.code));
      callback?.({ ok: true });

      console.log(`[socket] ${socket.id} joined match ${data.code} as CAM ${data.cameraNumber}`);
    });

    socket.on('stream-toggle', async (data: { code: string; cameraNumber: number; isStreaming: boolean }) => {
      const match = await getRawMatch(data.code);
      if (!match) return;

      const cam = match.cameras.get(data.cameraNumber);
      if (!cam || cam.socketId !== socket.id) return;

      cam.isStreaming = data.isStreaming;
      await syncLiveStatus(data.code);

      io.to(data.code).emit('match-updated', await getMatch(data.code));
      console.log(`[socket] CAM ${data.cameraNumber} in ${data.code} streaming: ${data.isStreaming}`);
    });

    socket.on('watch-match', async (data: { code: string }, callback) => {
      const match = await getMatch(data.code);
      if (!match) { callback?.({ error: 'match not found' }); return; }
      socket.join(data.code);
      callback?.({ match });
      console.log(`[socket] ${socket.id} watching match ${data.code}`);
    });

    socket.on('director-cut', (data: { code: string; cameraNumber: number | null }) => {
      socket.to(data.code).emit('director-cut', { cameraNumber: data.cameraNumber });
      console.log(`[director] cut to CAM ${data.cameraNumber} in ${data.code}`);
    });

    // WebRTC signaling
    socket.on('webrtc-request-stream', async (data: { matchCode: string; cameraNumber: number }) => {
      const match = await getRawMatch(data.matchCode);
      if (!match) return;
      const cam = match.cameras.get(data.cameraNumber);
      if (!cam || !cam.isStreaming) return;
      io.to(cam.socketId).emit('webrtc-incoming-request', {
        viewerSocketId: socket.id,
        matchCode: data.matchCode,
        cameraNumber: data.cameraNumber,
      });
    });

    socket.on('webrtc-offer', (data: { viewerSocketId: string; cameraNumber: number; sdp: unknown }) => {
      io.to(data.viewerSocketId).emit('webrtc-offer', {
        cameraSocketId: socket.id,
        cameraNumber: data.cameraNumber,
        sdp: data.sdp,
      });
    });

    socket.on('webrtc-answer', (data: { cameraSocketId: string; sdp: unknown }) => {
      io.to(data.cameraSocketId).emit('webrtc-answer', { viewerSocketId: socket.id, sdp: data.sdp });
    });

    socket.on('webrtc-ice-candidate', (data: { targetSocketId: string; candidate: unknown }) => {
      io.to(data.targetSocketId).emit('webrtc-ice-candidate', { senderSocketId: socket.id, candidate: data.candidate });
    });

    socket.on('disconnect', async () => {
      const removed = removeSocketFromAllMatches(socket.id);
      if (removed) {
        await syncLiveStatus(removed.code);
        io.to(removed.code).emit('match-updated', await getMatch(removed.code));
        console.log(`[socket] ${socket.id} disconnected, removed CAM ${removed.cameraNumber} from ${removed.code}`);
      } else {
        console.log(`[socket] disconnected: ${socket.id}`);
      }
    });
  });
}
