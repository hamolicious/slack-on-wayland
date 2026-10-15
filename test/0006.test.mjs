import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { shareRotation, rotateShares } from '../patches/0006-rotate-shared-screen.mjs'

test('shareRotation runs the hook and only accepts 90, 180 or 270', async () => {
  globalThis.require = createRequire(import.meta.url) // main.bundle.cjs provides require
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-rot-'))
  const hook = path.join(dir, 'hook')
  const run = async (body) => {
    fs.writeFileSync(hook, `#!/bin/sh\n${body}\n`, { mode: 0o755 })
    return shareRotation()
  }
  process.env.SLACK_SHARE_ROTATION_HOOK = hook
  assert.equal(await run('echo 90'), 90)
  assert.equal(await run('echo 270'), 270)
  assert.equal(await run('echo 45'), 0)
  assert.equal(await run('echo nope'), 0)
  assert.equal(await run('exit 1'), 0)
  process.env.SLACK_SHARE_ROTATION_HOOK = path.join(dir, 'missing')
  assert.equal(await shareRotation(), 0)
  delete process.env.SLACK_SHARE_ROTATION_HOOK
})

test('screen captures are rotated when the hook says so; everything else is untouched', async () => {
  const written = []
  const fakeTrack = () => ({ stopped: false, stop() { this.stopped = true }, getSettings: () => ({ width: 1920, height: 1080, frameRate: 15 }), addEventListener() {} })
  globalThis.MediaStreamTrackProcessor = class {
    constructor() { this.readable = new ReadableStream({ start(c) { c.enqueue({ displayWidth: 1920, displayHeight: 1080, timestamp: 7, closed: false, close() { this.closed = true } }); c.close() } }) }
  }
  globalThis.MediaStreamTrackGenerator = class {
    constructor() { this.writable = new WritableStream({ write: (f) => written.push(f) }) }
    stop() { this.stopped = true }
  }
  globalThis.VideoFrame = class {
    constructor(src, init) { const swap = init.rotation % 180 !== 0; this.rotation = init.rotation; this.displayWidth = swap ? src.displayHeight : src.displayWidth; this.displayHeight = swap ? src.displayWidth : src.displayHeight; this.timestamp = src.timestamp }
  }
  globalThis.VideoFrame.prototype.rotation = 0
  globalThis.MediaStream = class { constructor(tracks) { this.tracks = tracks } getVideoTracks() { return this.tracks.filter((t) => !t.audio) } getAudioTracks() { return this.tracks.filter((t) => t.audio) } }
  let rotation = 90
  const source = fakeTrack()
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => new MediaStream([source]) } } })
  globalThis.window = { __slackPatchShareRotation: async () => rotation }

  rotateShares()
  const screen = (id) => ({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: id } } })

  const out = await navigator.mediaDevices.getUserMedia(screen('screen:0:0'))
  const gen = out.getVideoTracks()[0]
  assert.ok(gen instanceof MediaStreamTrackGenerator, 'Slack gets the rotated track')
  await new Promise((r) => setTimeout(r, 20))
  assert.deepEqual(written.map((f) => [f.displayWidth, f.displayHeight, f.rotation, f.timestamp]), [[1080, 1920, 90, 7]], 'a landscape frame comes out portrait, rotated by metadata')
  assert.equal(gen.getSettings().width, 1080)
  await gen.applyConstraints({ width: 1920 })
  gen.stop()
  assert.ok(gen.stopped && source.stopped, 'stopping the share stops the capture')

  assert.equal((await navigator.mediaDevices.getUserMedia({ audio: true })).getVideoTracks()[0], source, 'non-screen captures untouched')
  rotation = 0
  assert.equal((await navigator.mediaDevices.getUserMedia(screen('screen:0:0'))).getVideoTracks()[0], source, 'unrotated screens untouched')

  for (const k of ['MediaStreamTrackProcessor', 'MediaStreamTrackGenerator', 'VideoFrame', 'MediaStream', 'navigator', 'window']) delete globalThis[k]
})
