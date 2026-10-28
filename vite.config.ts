import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Keep the initial bundle lean: split heavy third-party code into
    // separate chunks so the browser parses less JS before first paint.
    // ChatPanel (ai SDK) and CalendarPage (framer-motion) load on demand.
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("framer-motion") || id.includes("motion-dom")) return "motion";
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("react-dom") || id.includes("scheduler")) return "react-dom";
            if (id.includes("react") || id.includes("wouter") || id.includes("use-sync-external-store"))
              return "vendor";
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("clsx") || id.includes("tailwind-merge") || id.includes("class-variance-authority"))
              return "utils";
            if (id.includes("@radix-ui")) return "radix";
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
