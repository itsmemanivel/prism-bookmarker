// Mirrors the package.json version into manifest.json; run by the npm "version" lifecycle.
import { readFileSync, writeFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))

if (!/^\d+(\.\d+){0,3}$/.test(version)) {
  console.error(`Chrome requires 1-4 dot-separated integers, got "${version}".`)
  process.exit(1)
}

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
manifest.version = version
writeFileSync('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`manifest.json version -> ${version}`)
