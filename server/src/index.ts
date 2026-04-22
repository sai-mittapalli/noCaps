import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import { setupSocket } from './socket';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());
app.use('/api', routes);

// Serve web app
app.use(express.static(path.join(__dirname, '..', 'public')));

// Billiards highlight video
app.get('/highlights/billiards', (_req, res) => {
  res.sendFile(
    path.resolve(__dirname, '..', '..', 'billiards_dataset',
      'realgame-1', 'events', 'IMG_5253', 'highlights.mp4'),
    { headers: { 'Content-Type': 'video/mp4' } }
  );
});

// Legacy test pages
app.get('/test-viewer', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'test-viewer.html'));
});
app.get('/test-camera', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'test-camera.html'));
});

// SPA catch-all — serve index.html for any non-API route
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

setupSocket(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`[nocaps] server running on http://localhost:${PORT}`);
});
