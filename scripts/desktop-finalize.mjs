import { createHash } from 'node:crypto'
import { readFile, readdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const version = packageJson.version
const zipDir = path.join(root, 'out', 'make', 'zip', 'win32', 'x64')
const zips = (await readdir(zipDir)).filter((name) => name.endsWith('.zip'))

if (zips.length !== 1) {
  throw new Error(`Expected exactly one ZIP in ${zipDir}, found ${zips.length}`)
}

const targetName = `PixelEffectGenerator-${version}-win32-x64.zip`
const source = path.join(zipDir, zips[0])
const target = path.join(root, 'out', targetName)
await rename(source, target)

const bytes = await readFile(target)
const hash = createHash('sha256').update(bytes).digest('hex')
const checksumName = `${targetName}.sha256`
await writeFile(path.join(root, 'out', checksumName), `${hash}  ${targetName}\n`)

console.log(`Artifact: ${path.join('out', targetName)}`)
console.log(`Checksum: ${path.join('out', checksumName)}`)
