// usage: node edit.mjs <extracted-app-dir> <patch.mjs>...
// Each patch exports `edits: [{file, find, replace}]`; every `find` must occur exactly once.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { pathToFileURL } from 'node:url'

const [appDir, ...patches] = process.argv.slice(2)
for (const patch of patches) {
  const { edits } = await import(pathToFileURL(patch))
  for (const { file, find, replace } of edits) {
    const path = join(appDir, file)
    const src = readFileSync(path, 'utf8')
    const n = src.split(find).length - 1
    if (n !== 1) throw new Error(`${basename(patch)}: expected 1 match in ${file}, found ${n}: ${find.slice(0, 80)}`)
    writeFileSync(path, src.replace(find, () => replace))
  }
  console.log(`  ${basename(patch)}: ${edits.length} edits`)
}
