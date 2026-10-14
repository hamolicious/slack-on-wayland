import { test } from 'node:test'
import assert from 'node:assert/strict'

test('drawWindowHook runs the user hook with the event and last requested bounds', async () => {
  const { drawWindowHook } = await import('../patches/0003-draw-window-hook.mjs')
  const { createRequire } = await import('node:module')
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  globalThis.require = createRequire(import.meta.url) // main.bundle.cjs provides require
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-hook-'))
  const out = path.join(dir, 'out')
  const hookFile = path.join(dir, 'hook')
  fs.writeFileSync(hookFile, `#!/bin/sh\necho "$1 $SLACK_DRAW_EVENT $SLACK_DRAW_TITLE $SLACK_DRAW_X $SLACK_DRAW_Y $SLACK_DRAW_WIDTH $SLACK_DRAW_HEIGHT" >> ${out}\n`, { mode: 0o755 })
  process.env.SLACK_DRAW_WINDOW_HOOK = hookFile
  const win = { getTitle: () => 'Slack huddle drawing' }
  const wait = (n) => new Promise((r) => { const t = setInterval(() => { if (fs.existsSync(out) && fs.readFileSync(out, 'utf8').trim().split('\n').length >= n) { clearInterval(t); r() } }, 20) })
  assert.equal(drawWindowHook(win, 'create', []), true); await wait(1)
  drawWindowHook(win, 'setBounds', [{ x: 1920, y: 240, width: 2560, height: 1440 }]); await wait(2)
  drawWindowHook(win, 'focus', []) // ignored
  drawWindowHook(win, 'showInactive', []); await wait(3)
  assert.deepEqual(fs.readFileSync(out, 'utf8').trim().split('\n'), [
    'create create Slack huddle drawing    ',
    'bounds bounds Slack huddle drawing 1920 240 2560 1440',
    'show show Slack huddle drawing 1920 240 2560 1440',
  ])
  process.env.SLACK_DRAW_WINDOW_HOOK = path.join(dir, 'missing')
  assert.equal(drawWindowHook(win, 'setBounds', [{}]), false, 'no hook: Slack applies setBounds itself')
  delete process.env.SLACK_DRAW_WINDOW_HOOK
})
