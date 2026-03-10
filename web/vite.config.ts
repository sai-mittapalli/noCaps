import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';
  return {
    plugins: [
      react(),
      ...(isDev ? [basicSsl()] : []),
    ],
    build: {
      outDir: '../server/public',
      emptyOutDir: true,
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:3000', changeOrigin: true },
        '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
      },
    },
  };
});
