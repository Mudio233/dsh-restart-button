/**
 * Host half of the restart button.
 *
 * Two routes on the composition's `webServer`, both behind the connection
 * trust fence (`connection.requestRejection`) when that service exists:
 *
 * - `GET /dsh-restart/info`    identity of the running host: version, pid.
 * - `POST /dsh-restart/restart` confirmed restart request.
 *
 * The restart never kills this process from inside itself. It starts a small
 * launcher detached, so the launcher survives the process it is about to
 * terminate: it waits, kills this application, waits again, starts it again,
 * and starts it a second time if the first attempt did not survive.
 */
import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/** Cordis function-plugin name. */
export const name = 'restart-button'
/** The route carrier; the trust fence is resolved optionally below. */
export const inject = ['webServer']

const INFO_PATH = '/dsh-restart/info'
const RESTART_PATH = '/dsh-restart/restart'
/** Request bodies here are one tiny JSON object; anything larger is hostile. */
const MAX_BODY_BYTES = 8 * 1024
const STARTED_AT = Date.now()
/** Seconds to wait before killing this process, so the response flushes first. */
const DEFAULT_DELAY_MS = 2500

/** REST response with no caching: identity is a live fact. */
function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/** 405 with the route's one supported method. */
function sendMethodNotAllowed(res, allow) {
  res.statusCode = 405
  res.setHeader('allow', allow)
  res.end()
}

/** Collect a bounded request body as UTF-8 text; null past the ceiling. */
async function readBoundedBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.byteLength
    if (size > MAX_BODY_BYTES) {
      req.resume()
      return null
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size).toString('utf8')
}

/** A restart body is exactly `{ "confirm": true }`. */
function parseRestartBody(text) {
  let body
  try {
    body = JSON.parse(text)
  } catch {
    return false
  }
  return typeof body === 'object' && body !== null && body.confirm === true
}

/** Read the running DSH version without a dependency on the Host composition. */
async function readVersion() {
  const candidates = []
  if (typeof process.resourcesPath === 'string') {
    candidates.push(join(process.resourcesPath, 'app.asar', 'dsh', 'package.json'))
    candidates.push(join(process.resourcesPath, 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'))
  }
  try {
    const require = createRequire(import.meta.url)
    candidates.push(require.resolve('@deepseek-ai/dsh/package.json'))
  } catch {
    // A profile bundle without a dsh dependency simply has no resolved path.
  }
  for (const file of candidates) {
    try {
      const parsed = JSON.parse(await readFile(file, 'utf8'))
      if (typeof parsed.version === 'string' && parsed.version !== '') return parsed.version
    } catch {
      // Missing, unreadable, or not JSON: try the next candidate.
    }
  }
  return undefined
}

/** Milliseconds to wait before the kill, from the row config when it is sane. */
function delayOf(config) {
  const value = config !== null && typeof config === 'object' ? config.delayMs : undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_DELAY_MS
  return Math.min(30000, Math.max(500, Math.round(value)))
}

/**
 * Build the launcher and how to start it.
 *
 * Windows runs PowerShell through one `cmd` hop, with the payload as base64 of
 * UTF-16: a `.cmd` file is read through a console codepage that mangles the
 * non-ASCII characters an installed path usually contains, and a direct
 * PowerShell child can be reaped together with its parent's process group,
 * while the hop survives that termination. The hop also keeps the launcher out
 * of the parent's console and needs no quoting of its own, because base64
 * carries no spaces or quotes.
 *
 * @param delayMs - milliseconds between launcher start and the kill.
 * @returns the command, arguments, spawn options, and the script path on POSIX.
 */
async function planLauncher(delayMs) {
  const exe = process.execPath
  if (process.platform === 'win32') {
    // Single-quoted PowerShell literals: a quote inside a path is doubled.
    const literal = exe.replace(/'/g, "''")
    const script = [
      "$ErrorActionPreference = 'SilentlyContinue'",
      `Start-Sleep -Milliseconds ${String(delayMs)}`,
      `Get-Process | Where-Object { $_.Path -eq '${literal}' } | Stop-Process -Force`,
      'Start-Sleep -Seconds 2',
      `Start-Process -FilePath '${literal}'`,
      'Start-Sleep -Seconds 8',
      `if (-not (Get-Process | Where-Object { $_.Path -eq '${literal}' })) { Start-Process -FilePath '${literal}' }`,
      '',
    ].join('\r\n')
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    return {
      command: process.env.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`],
      options: { stdio: 'ignore', windowsHide: true },
    }
  }
  const script = [
    '#!/bin/sh',
    `sleep ${(delayMs / 1000).toFixed(1)}`,
    `kill ${String(process.pid)} 2>/dev/null`,
    'sleep 2',
    `"${exe}" &`,
    '',
  ].join('\n')
  const scriptPath = join(tmpdir(), `dsh-restart-${String(Date.now())}-${String(process.pid)}.sh`)
  await writeFile(scriptPath, script, 'utf8')
  return {
    command: '/bin/sh',
    args: [scriptPath],
    options: { detached: true, stdio: 'ignore' },
    scriptPath,
  }
}

/**
 * Start the launcher and never wait for it.
 *
 * @param launcher - command, arguments, and spawn options from planLauncher.
 */
function startDetached(launcher) {
  const child = spawn(launcher.command, launcher.args, launcher.options ?? {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.on('error', () => {
    // A spawn failure must not crash the Host; the route reports planning errors.
  })
  child.unref()
}

/** Register the identity route and the confirmed restart route. */
export function apply(ctx, config) {
  const delayMs = delayOf(config)
  const versionPromise = readVersion()
  let version

  void versionPromise.then((value) => { version = value }).catch(() => {})

  /** The trust fence, when this composition publishes one. */
  const gate = () => {
    const value = ctx.get('connection')
    return value !== null && typeof value === 'object' && typeof value.requestRejection === 'function'
      ? value
      : undefined
  }

  /** Answer an untrusted request; true when it was rejected. */
  const rejected = (req, res) => {
    const connection = gate()
    if (connection === undefined) return false
    const rejection = connection.requestRejection(req)
    if (rejection === undefined) return false
    res.statusCode = rejection
    res.end()
    return true
  }

  const originOf = () => {
    try {
      return ctx.webServer.getOrigin()
    } catch {
      return undefined
    }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: INFO_PATH,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'GET') {
        sendMethodNotAllowed(res, 'GET')
        return
      }
      if (version === undefined) version = await versionPromise.catch(() => undefined)
      sendJson(res, 200, {
        version: version ?? null,
        pid: process.pid,
        platform: process.platform,
        startedAt: STARTED_AT,
        origin: originOf() ?? null,
        route: RESTART_PATH,
      })
    },
  }), `restart-button: GET ${INFO_PATH}`)

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: RESTART_PATH,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'POST') {
        sendMethodNotAllowed(res, 'POST')
        return
      }
      const essence = String(req.headers['content-type']).split(';', 1)[0]?.trim().toLowerCase()
      if (essence !== 'application/json') {
        sendJson(res, 415, { code: 'unsupported-media-type', message: 'content-type must be application/json' })
        return
      }
      let text
      try {
        text = await readBoundedBody(req)
      } catch {
        sendJson(res, 400, { code: 'bad-request', message: 'request body unreadable' })
        return
      }
      if (text === null) {
        sendJson(res, 413, { code: 'payload-too-large', message: 'request body is too large' })
        return
      }
      if (!parseRestartBody(text)) {
        sendJson(res, 400, { code: 'bad-request', message: 'body must be {"confirm":true}' })
        return
      }
      let launcher
      try {
        launcher = await planLauncher(delayMs)
        startDetached(launcher)
      } catch (error) {
        sendJson(res, 500, {
          code: 'restart-failed',
          message: error instanceof Error ? error.message : String(error),
        })
        return
      }
      // The response must leave before the launcher's delay expires.
      sendJson(res, 202, { ok: true, pid: process.pid, delayMs })
    },
  }), `restart-button: POST ${RESTART_PATH}`)
}
