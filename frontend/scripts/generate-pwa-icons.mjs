/**
 * Regenerates PWA install icons from public/favicon.svg.
 * Requires: npm install -D sharp (not needed for Docker builds — PNGs are committed).
 *
 *   node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const svg = readFileSync(join(publicDir, 'favicon.svg'))
const bg = { r: 26, g: 32, b: 44, alpha: 1 }

async function writePng(size, name) {
  const inset = Math.round(size * 0.12)
  const inner = size - inset * 2
  const logo = await sharp(svg)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(join(publicDir, name))

  console.log('wrote', name)
}

await writePng(192, 'pwa-192x192.png')
await writePng(512, 'pwa-512x512.png')
await writePng(180, 'apple-touch-icon.png')
console.log('PWA icons generated.')
