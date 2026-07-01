// Generates the PWA icons procedurally (no image deps): a dark navy seal with
// an amber ring and centre dot. Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pub = join(__dirname, '..', 'public')
mkdirSync(pub, { recursive: true })

const BG = [11, 15, 23, 255] // #0b0f17
const AMBER = [217, 164, 65, 255] // #d9a441

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function png(size) {
  const cx = size / 2
  const cy = size / 2
  const rOuter = size * 0.44
  const rRingIn = size * 0.30
  const rDot = size * 0.13
  const raw = Buffer.alloc((size * 4 + 1) * size)
  let p = 0
  for (let y = 0; y < size; y++) {
    raw[p++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      let col = BG
      if (d <= rDot) col = AMBER
      else if (d >= rRingIn && d <= rOuter) col = AMBER
      raw[p++] = col[0]
      raw[p++] = col[1]
      raw[p++] = col[2]
      raw[p++] = col[3]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

writeFileSync(join(pub, 'icon-192.png'), png(192))
writeFileSync(join(pub, 'icon-512.png'), png(512))

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0b0f17"/>
  <circle cx="32" cy="32" r="20" fill="none" stroke="#d9a441" stroke-width="6"/>
  <circle cx="32" cy="32" r="8" fill="#d9a441"/>
</svg>`
writeFileSync(join(pub, 'favicon.svg'), favicon)

console.log('Generated public/icon-192.png, public/icon-512.png, public/favicon.svg')
