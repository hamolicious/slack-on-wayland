import { test } from 'node:test'
import assert from 'node:assert/strict'

test('waylandSources skips the portal on Wayland and falls through elsewhere', async () => {
  const { waylandSources } = await import('../patches/0002-wayland-screen-sources.mjs')
  const { createRequire } = await import('node:module')
  const realRequire = createRequire(import.meta.url)
  let ozone = ''
  const electron = { app: { commandLine: { getSwitchValue: () => ozone } }, nativeImage: { createEmpty: () => 'empty' } }
  globalThis.require = (m) => (m === 'electron' ? electron : realRequire(m))
  const saved = process.env.WAYLAND_DISPLAY
  let calls = 0
  const get = () => (calls++, ['real'])
  process.env.WAYLAND_DISPLAY = 'wayland-1'
  assert.deepEqual(waylandSources(get), [{ id: 'screen:0:0', name: 'Entire screen', display_id: '', thumbnail: 'empty' }])
  ozone = 'x11'
  assert.deepEqual(waylandSources(get), ['real'])
  ozone = ''
  delete process.env.WAYLAND_DISPLAY
  assert.deepEqual(waylandSources(get), ['real'])
  assert.equal(calls, 2)
  if (saved !== undefined) process.env.WAYLAND_DISPLAY = saved
  globalThis.require = realRequire
})
