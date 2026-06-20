import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

// Vite build: output to dist/ (git-ignored). Cloudflare Workers builds and
// serves it as static assets (see wrangler.jsonc). Runtime data lives in
// public/ and is copied into the build as-is. base is relative so the same
// build works whether served at the root domain or a sub-path.
export default defineConfig({
  plugins: [react(), cloudflare()],
  base: './',
})
