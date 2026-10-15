import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' lets the same build work on GitHub Pages (/repo-name/) or any other host.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/messaging'],
          xlsx: ['xlsx'],
        },
      },
    },
  },
});
