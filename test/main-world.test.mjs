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
