#!/usr/bin/env node
/**
 * Download pinned BtbN LGPL-static ffmpeg into vendor/ffmpeg (gitignored).
 * dist scripts call this. npm run build does not.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  copyFile,
  chmod,
  writeFile
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VENDOR = join(ROOT, 'vendor', 'ffmpeg')
const TAG = 'autobuild-2026-09-22-13-18'
const VERSION = 'n9.0.2-3-ga5923073bf'

/** @type {Record<string, { id: string, binary: string, archive: string, sha256: string, pulse: boolean }>} */
const BUILDS = {
  linux: {
    id: 'linux-x64',
    binary: 'ffmpeg',
    archive: 'ffmpeg-n9.0.2-3-ga5923073bf-linux64-lgpl-9.0.tar.xz',
    sha256: '22ec6acfed2f1fcd5a7b911a2d4bf87f1f343e75ac1e1f26bfaa05667d4c4906',
    pulse: true
  },
  win: {
    id: 'win-x64',
    binary: 'ffmpeg.exe',
    archive: 'ffmpeg-n9.0.2-3-ga5923073bf-win64-lgpl-9.0.zip',
    sha256: 'cb3a7c1164079cd9e32493c3c4ca02093508dd491788a84db360c4b97fdd3820',
    pulse: false
  }
}

main().catch((error) => {
  console.error('[fetch:ffmpeg]', error instanceof Error ? error.message : error)
  process.exitCode = 1
})

async function main() {
  const platforms = selectedPlatforms(process.argv.slice(2))
  for (const platform of platforms) {
    await fetchPlatform(platform)
  }
}

/**
 * @param {string[]} argv
 * @returns {Array<'linux' | 'win'>}
 */
function selectedPlatforms(argv) {
  const flag = argv.indexOf('--platform')
  if (flag === -1) {
    if (argv.length > 0) throw new Error(`Unknown argument: ${argv[0]}`)
    return [hostPlatform()]
  }
  const value = argv[flag + 1]
  const rest = argv.filter((_, index) => index !== flag && index !== flag + 1)
  if (rest.length > 0) throw new Error(`Unknown argument: ${rest[0]}`)
  if (value === 'linux' || value === 'win') return [value]
  if (value === 'all') return ['linux', 'win']
  throw new Error('Use --platform linux, win, or all.')
}

/** @returns {'linux' | 'win'} */
function hostPlatform() {
  if (process.platform === 'linux') return 'linux'
  if (process.platform === 'win32') return 'win'
  throw new Error('Pass --platform linux, win, or all.')
}

/** @param {'linux' | 'win'} platform */
async function fetchPlatform(platform) {
  const build = BUILDS[platform]
  const outDir = join(VENDOR, build.id)
  if (await isCurrent(outDir, build)) {
    console.log(`[fetch:ffmpeg] ${build.id} already matches ${VERSION}`)
    return
  }

  const url = `https://github.com/BtbN/FFmpeg-Builds/releases/download/${TAG}/${build.archive}`
  const cacheDir = join(VENDOR, '.cache')
  const archivePath = join(cacheDir, build.archive)
  await mkdir(cacheDir, { recursive: true })
  if (!(await hashMatches(archivePath, build.sha256))) {
    console.log(`[fetch:ffmpeg] downloading ${url}`)
    await download(url, archivePath)
  }
  const actual = await sha256File(archivePath)
  if (actual !== build.sha256) {
    await rm(archivePath, { force: true })
    throw new Error(`SHA-256 mismatch for ${build.archive}: ${actual}`)
  }

  const extractDir = join(cacheDir, `extract-${build.id}`)
  await rm(extractDir, { recursive: true, force: true })
  await mkdir(extractDir, { recursive: true })
  await extract(archivePath, extractDir)

  const packed = await findPackedBinary(extractDir, build.binary)
  const staging = join(VENDOR, `.${build.id}.partial`)
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  const stagedBinary = join(staging, build.binary)
  await copyFile(packed.binary, stagedBinary)
  await chmod(stagedBinary, 0o755)
  const licenses = await copyLicenses(packed.root, staging)
  await assertBinary(stagedBinary, build)
  await writeFile(join(staging, 'SOURCE.txt'), sourceText(build, url), 'utf8')

  await rm(outDir, { recursive: true, force: true })
  await rename(staging, outDir)
  await rm(extractDir, { recursive: true, force: true })

  const info = await stat(join(outDir, build.binary))
  const mib = (info.size / (1024 * 1024)).toFixed(1)
  console.log(`[fetch:ffmpeg] ${build.id} ready (${mib} MiB, ${licenses.join(', ')})`)
}

/**
 * @param {string} outDir
 * @param {{ binary: string, sha256: string }} build
 */
async function isCurrent(outDir, build) {
  if (!(await isFile(join(outDir, build.binary)))) return false
  let text = ''
  try {
    text = await readFile(join(outDir, 'SOURCE.txt'), 'utf8')
  } catch {
    return false
  }
  if (!text.includes(`sha256: ${build.sha256}`)) return false
  const names = await readdir(outDir)
  return names.some((name) => /^(LICENSE|COPYING)/i.test(name))
}

/**
 * @param {{ archive: string, sha256: string }} build
 * @param {string} url
 */
function sourceText(build, url) {
  return [
    'project: BtbN/FFmpeg-Builds',
    'variant: lgpl-static',
    `version: ${VERSION}`,
    `tag: ${TAG}`,
    `archive: ${build.archive}`,
    `url: ${url}`,
    `sha256: ${build.sha256}`,
    'license: GNU LGPLv3 (FFmpeg COPYING.LGPLv3, shipped as LICENSE.txt)',
    ''
  ].join('\n')
}

/**
 * @param {string} path
 * @param {string} expected
 */
async function hashMatches(path, expected) {
  if (!(await isFile(path))) return false
  return (await sha256File(path)) === expected
}

/** @param {string} path */
function sha256File(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
  })
}

/**
 * @param {string} url
 * @param {string} dest
 */
async function download(url, dest) {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}) for ${url}`)
  }
  const partial = `${dest}.partial`
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial))
  await rename(partial, dest)
}

/**
 * @param {string} archive
 * @param {string} dest
 */
async function extract(archive, dest) {
  if (archive.endsWith('.zip') && process.platform !== 'win32') {
    await run('python3', [
      '-c',
      'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',
      archive,
      dest
    ])
    return
  }
  await run('tar', ['-xf', archive, '-C', dest])
}

/**
 * @param {string} root
 * @param {string} binaryName
 * @returns {Promise<{ root: string, binary: string }>}
 */
async function findPackedBinary(root, binaryName) {
  const direct = join(root, 'bin', binaryName)
  if (await isFile(direct)) return { root, binary: direct }
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const nestedRoot = join(root, entry.name)
    const nested = join(nestedRoot, 'bin', binaryName)
    if (await isFile(nested)) return { root: nestedRoot, binary: nested }
  }
  throw new Error(`Archive did not contain bin/${binaryName}`)
}

/**
 * @param {string} root
 * @param {string} dest
 * @returns {Promise<string[]>}
 */
async function copyLicenses(root, dest) {
  /** @type {string[]} */
  const copied = []
  for (const dir of [root, join(root, 'doc')]) {
    let names
    try {
      names = await readdir(dir)
    } catch {
      continue
    }
    for (const name of names) {
      if (!/^(LICENSE|COPYING)/i.test(name)) continue
      const from = join(dir, name)
      if (!(await isFile(from))) continue
      if (copied.includes(name)) continue
      await copyFile(from, join(dest, name))
      copied.push(name)
    }
  }
  if (copied.length === 0) {
    throw new Error('Archive did not include a LICENSE or COPYING file')
  }
  return copied
}

/**
 * @param {string} binary
 * @param {{ binary: string, pulse: boolean }} build
 */
async function assertBinary(binary, build) {
  const header = Buffer.alloc(4)
  const stream = createReadStream(binary, { start: 0, end: 3 })
  await new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => {
      Buffer.concat(chunks).copy(header)
      resolve()
    })
  })
  if (build.binary.endsWith('.exe')) {
    if (header.subarray(0, 2).toString('ascii') !== 'MZ') {
      throw new Error('ffmpeg.exe is not a Windows executable')
    }
    return
  }
  if (header.toString('ascii') !== '\u007fELF') {
    throw new Error('ffmpeg is not a Linux ELF executable')
  }
  if (!build.pulse || process.platform !== 'linux') return
  const listed = await commandText(binary, ['-hide_banner', '-demuxers'])
  if (!listsPulseInput(listed)) {
    throw new Error('This ffmpeg build has no pulse demuxer. Linux capture needs it.')
  }
}

/** @param {string} text */
function listsPulseInput(text) {
  return text.split(/\r?\n/).some((line) => {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 2 || !parts[0].startsWith('D')) return false
    const name = parts[1] === 'd' ? parts[2] : parts[1]
    return name === 'pulse'
  })
}

/** @param {string} path */
async function isFile(path) {
  try {
    const info = await stat(path)
    return info.isFile()
  } catch {
    return false
  }
}

/**
 * @param {string} cmd
 * @param {string[]} args
 */
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' })
    child.once('error', (error) => {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') {
        reject(new Error(`${cmd} is not installed.`))
        return
      }
      reject(error)
    })
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited ${code ?? 'unknown'}`))
    })
  })
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @returns {Promise<string>}
 */
function commandText(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    /** @type {Buffer[]} */
    const chunks = []
    child.stdout?.on('data', (chunk) => chunks.push(chunk))
    child.stderr?.on('data', (chunk) => chunks.push(chunk))
    child.once('error', reject)
    child.once('exit', (code) => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (code !== 0) {
        reject(new Error(text.trim() || `${cmd} exited ${code ?? 'unknown'}`))
        return
      }
      resolve(text)
    })
  })
}
