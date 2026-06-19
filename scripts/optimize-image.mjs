// Resizes an image so its longest side is <= 1000px and re-encodes it as WebP
// (quality 80), keeping committed meal photos small (phone photos are multi-MB).
// EXIF orientation is honored. Usage:
//   node scripts/optimize-image.mjs <src> <dst.webp>
import sharp from 'sharp'
import { statSync } from 'node:fs'

const [src, dst] = process.argv.slice(2)
if (!src || !dst) {
  console.error('usage: node scripts/optimize-image.mjs <src> <dst.webp>')
  process.exit(1)
}

await sharp(src)
  .rotate() // auto-orient from EXIF before stripping metadata
  .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 80 })
  .toFile(dst)

const kb = (p) => (statSync(p).size / 1024).toFixed(0)
console.log(`optimized ${src} (${kb(src)}KB) -> ${dst} (${kb(dst)}KB)`)
