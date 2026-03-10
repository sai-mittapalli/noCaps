import 'dotenv/config'; // must be first — loads .env before any other imports

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
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

// Health check — must be before static so Railway can reach it
app.get('/health', (_req, res) => {
  res.json({ status: 'nocaps server running' });
});

// Serve the built React app (only present after `npm run build`)
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// SPA fallback — any route not matched above serves index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
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
    console.error('Make sure DATABASE_URL is set correctly in server/.env');
    process.exit(1);
  });
