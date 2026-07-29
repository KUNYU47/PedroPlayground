import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Bundle the Pyodide runtime locally so the app works fully offline
// (classroom-friendly) and never depends on a CDN.
export default defineConfig({
  // Relative base: the built app works when hosted under any sub-path
  // (e.g. GitHub Pages project sites), not just a domain root.
  base: './',
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pyodide/*.{js,wasm,zip,json,whl,map}',
          dest: 'pyodide',
        },
      ],
    }),
  ],
  optimizeDeps: {
    exclude: ['pyodide'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2021',
    chunkSizeWarningLimit: 5000,
  },
});
