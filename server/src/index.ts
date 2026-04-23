import 'dotenv/config';

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import createRouter from './routes';
import { setupSocket } from './socket';
import { resetAllLiveStatus } from './matchStore';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());
app.use('/api', createRouter(io));

// Health check — must be before static middleware for Railway
app.get('/health', (_req, res) => {
  res.json({ status: 'nocaps server running' });
});

// Serve web app
app.use(express.static(path.join(__dirname, '..', 'public')));

// Full game video streaming — redirect to Supabase Storage
const GAME_VIDEOS: Record<string, string> = {
  lateral:  'https://hzhstyjvaojeooqqsoyg.supabase.co/storage/v1/object/public/videos/lateral_compressed.mp4',
  frontal:  'https://hzhstyjvaojeooqqsoyg.supabase.co/storage/v1/object/public/videos/frontal_compressed.mp4',
  diagonal: 'https://hzhstyjvaojeooqqsoyg.supabase.co/storage/v1/object/public/videos/diagonal_compressed.mp4',
};

app.get('/game/:camera', (req, res) => {
  const url = GAME_VIDEOS[req.params.camera];
  if (!url) { res.status(404).send('Video not found'); return; }
  res.redirect(url);
});

// Billiards highlight video
app.get('/highlights/billiards', (_req, res) => {
  const filePath = path.resolve(__dirname, '..', '..', 'billiards_dataset', 'realgame-1', 'events', 'IMG_5253', 'highlights.mp4');
  if (!fs.existsSync(filePath)) { res.status(404).send('Not found'); return; }
  res.sendFile(filePath, { headers: { 'Content-Type': 'video/mp4' } });
});

// Multi-angle highlight reel — redirect to Supabase Storage
app.get('/highlights/billiards-replay', (_req, res) => {
  res.redirect('https://hzhstyjvaojeooqqsoyg.supabase.co/storage/v1/object/public/videos/highlights_reel_compressed.mp4');
});

// Legacy test pages
app.get('/test-viewer', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'test-viewer.html'));
});
app.get('/test-camera', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'test-camera.html'));
});

// SPA catch-all
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

setupSocket(io);

const PORT = process.env.PORT || 3000;

resetAllLiveStatus()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`[nocaps] server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[nocaps] failed to connect to database:', err.message);
    process.exit(1);
  });
