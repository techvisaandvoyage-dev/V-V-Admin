import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Serve admin at root in local dev, but keep /admin/ asset paths for production builds.
  base: command === "serve" ? "/" : "/admin/",
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: "dist",
  },
}))
