import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addModulePatch } from '../lib/main-world.mjs'
import { bootRuntime, resetGlobals } from './runtime.mjs'

const mods = {
  early(e, t, a) { a.d(t, { v: () => 'orig early' }) },
  late(e, t, a) { a.d(t, { v: () => 'orig late' }) },
  other(e, t, a) { a.d(t, { v: () => 'orig other' }) },
}
const wrapTo = (tag) => (f) => function (m, e, r) { f.call(this, m, e, r); e.patchedBy = tag }

for (const name of ['rspackChunkwebapp', 'rspackChunkGantryV2'])
  test(`${name}: every registered module patch applies, before and after the runtime boots`, () => {
    resetGlobals()
    addModulePatch('orig early', wrapTo('early'))
    addModulePatch('orig late', wrapTo('late'))
    globalThis[name].push([['a'], { early: mods.early }])
    const { req, chunks } = bootRuntime(name)
    chunks.push([['b'], { late: mods.late, other: mods.other }])
    assert.equal(req('early').patchedBy, 'early')
    assert.equal(req('late').patchedBy, 'late', 'a second patch still applies to chunks loaded after boot')
    assert.equal(req('other').patchedBy, undefined)
    assert.equal(chunks.length, 2)
  })

test('rspackChunkGantryV2 with ReleaseModuleFactoriesPlugin: the runtime boots cleanly and patches still apply', async () => {
  const { bootReleaseRuntime } = await import('./runtime.mjs')
  resetGlobals()
  addModulePatch('orig early', wrapTo('early'))
  addModulePatch('orig late', wrapTo('late'))
  const q = globalThis.rspackChunkGantryV2
  assert.ok(Array.isArray(q))
  assert.equal(q.push, Array.prototype.push, 'the queue still has the native push before the runtime boots')
  assert.equal(Object.getOwnPropertyDescriptor(q, 'push'), undefined, 'and no push of its own')
  q.push([['a'], { early: mods.early }])
  const { req, warnings } = bootReleaseRuntime('rspackChunkGantryV2')
  assert.deepEqual(warnings, [], 'no "another runtime is attached" warning')
  // Chunk files push through the global, as the webapp's chunks do.
  ;(globalThis.rspackChunkGantryV2 ||= []).push([['b'], { late: mods.late, other: mods.other }])
  assert.equal(req('early').patchedBy, 'early')
  assert.equal(req('late').patchedBy, 'late')
  assert.equal(req('other').patchedBy, undefined)
  assert.equal(globalThis.rspackChunkGantryV2.length, 0, "the runtime's queue release still works")
})

test('a module is wrapped once even though its chunk passes through several pushes', async () => {
  const { bootReleaseRuntime } = await import('./runtime.mjs')
  resetGlobals()
  let wraps = 0
  addModulePatch('orig late', (f) => (wraps++, f))
  bootReleaseRuntime('rspackChunkGantryV2')
  globalThis.rspackChunkGantryV2.push([['b'], { late: mods.late }])
  assert.equal(wraps, 1)
})
