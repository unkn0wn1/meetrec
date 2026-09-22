#!/usr/bin/env node
/**
 * Fail when a source file exceeds the line budget.
 * Split by behavior. Do not raise the limit to silence this script.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const LIMIT = 400
const ROOTS = ['electron', 'src', 'scripts']
const EXTENSIONS = new Set(['.ts', '.vue', '.mjs', '.js'])

const offenders = []

for (const dir of ROOTS) {
  walk(join(ROOT, dir))
}

if (offenders.length > 0) {
  console.error(`[guard:file-size] Files over ${LIMIT} lines:`)
  for (const item of offenders) {
    console.error(`  ${item.lines}\t${item.path}`)
  }
  process.exit(1)
}

console.log(`[guard:file-size] OK (limit ${LIMIT})`)

function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'out' || name === 'dist') continue
    const full = join(dir, name)
    const info = statSync(full)
    if (info.isDirectory()) {
      walk(full)
      continue
    }
    const ext = name.slice(name.lastIndexOf('.'))
    if (!EXTENSIONS.has(ext)) continue
    if (name.endsWith('.d.ts')) continue
    const lines = readFileSync(full, 'utf8').split(/\r?\n/).length
    if (lines > LIMIT) {
      offenders.push({ lines, path: relative(ROOT, full) })
    }
  }
}
