import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Increase the warning limit to 1600kb (1.6MB) to silence the warning
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Split React core into its own chunk
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Split the AI SDK into its own chunk (it's usually large)
            if (id.includes('@google/genai')) {
              return 'genai';
            }
            // Split UI icons into their own chunk
            if (id.includes('lucide-react')) {
              return 'ui-icons';
            }
            // All other dependencies go to vendor
            return 'vendor';
          }
        },
      },
    },
  },
});