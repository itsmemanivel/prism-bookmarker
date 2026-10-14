// Generates the extension PNG icons from a vector description (no image deps).
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const BG = [27, 27, 31]
const FG = [248, 248, 250]
const SAMPLES = 4

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

// Rounded-square tile with a bookmark glyph, sampled in normalised coordinates.
function coverage(x, y) {
  const radius = 0.22
  const inset = Math.min(
    Math.min(x, 1 - x) < radius && Math.min(y, 1 - y) < radius
      ? radius - Math.hypot(radius - Math.min(x, 1 - x), radius - Math.min(y, 1 - y))
      : 1,
    1,
  )
  if (inset <= 0) return null

  const inGlyph = x >= 0.34 && x <= 0.66 && y >= 0.24 && y <= 0.76
  if (!inGlyph) return BG

  const notchTop = 0.58
  const notchBottom = 0.76
  if (y >= notchTop) {
    const half = 0.16 * ((y - notchTop) / (notchBottom - notchTop))
    if (Math.abs(x - 0.5) <= half) return BG
  }
  return FG
}

function renderPng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let offset = 0
  for (let py = 0; py < size; py++) {
    raw[offset++] = 0
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) / size
          const y = (py + (sy + 0.5) / SAMPLES) / size
          const colour = coverage(x, y)
          if (colour) {
            r += colour[0]
            g += colour[1]
            b += colour[2]
            a += 255
          }
        }
      }
      const total = SAMPLES * SAMPLES
      const hits = a / 255 || 1
      raw[offset++] = Math.round(r / hits)
      raw[offset++] = Math.round(g / hits)
      raw[offset++] = Math.round(b / hits)
      raw[offset++] = Math.round(a / total)
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
for (const size of [16, 32, 48, 128]) {
  writeFileSync(`public/icons/icon-${size}.png`, renderPng(size))
  console.log(`public/icons/icon-${size}.png`)
}
