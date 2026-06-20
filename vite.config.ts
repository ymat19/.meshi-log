import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// Standard Vite build: output to dist/ (git-ignored). GitHub Actions builds
// and deploys it to Pages. Runtime data lives in public/ and is copied into
// the build as-is. base is relative so assets resolve under the project path
// (https://<user>.github.io/.meshi-log/).
export default defineConfig({
  plugins: [react(), cloudflare()],
  base: './',
})