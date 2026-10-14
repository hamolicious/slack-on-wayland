import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hook } from '../patches/0001-linux-enable-drawing.mjs'
import { addModulePatch } from '../lib/main-world.mjs'
import { bootRuntime, resetGlobals } from './runtime.mjs'

// Module bodies copied from the cached app.slack.com gantry bundles (RV46 + a stub of 9ZZn on Linux).
const chunkA = [['a'], { '9ZZn'(e, t, a) { a.d(t, { j9: () => () => true, y3: () => () => true }) } }]
const chunkB = [['b'], {
  RV46(e, t, a) {"use strict";var n=a("9ZZn");function isDrawSupported(){return!(0,n.j9)()&&(0,n.y3)()}a.d(t,{A:()=>isDrawSupported})},
  other(e, t, a) { a.d(t, { A: () => function isDrawSupported() { return 'untouched' } }) },
}]

test('isDrawSupported is forced true; isLinux and look-alikes are untouched', () => {
  resetGlobals()
  hook(addModulePatch)
  globalThis.rspackChunkGantryV2.push(chunkA)
  const { req, chunks } = bootRuntime('rspackChunkGantryV2')
  chunks.push(chunkB)
  assert.equal(req('RV46').A(), true)
  assert.equal(req('9ZZn').j9(), true, 'isLinux itself is not touched')
  assert.equal(req('other').A(), 'untouched', 'modules without the source marker are not wrapped')
})
