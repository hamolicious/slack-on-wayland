import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hook } from '../patches/0001-linux-enable-drawing.mjs'

// Module bodies copied from the cached app.slack.com gantry bundles (RV46 + a stub of 9ZZn on Linux).
const chunkA = [['a'], { '9ZZn'(e, t, a) { a.d(t, { j9: () => () => true, y3: () => () => true }) } }]
const chunkB = [['b'], {
  RV46(e, t, a) {"use strict";var n=a("9ZZn");function isDrawSupported(){return!(0,n.j9)()&&(0,n.y3)()}a.d(t,{A:()=>isDrawSupported})},
  other(e, t, a) { a.d(t, { A: () => function isDrawSupported() { return 'untouched' } }) },
}]

for (const name of ['rspackChunkwebapp', 'rspackChunkGantryV2'])
test(`${name}: isDrawSupported is forced true for chunks pushed before and after the rspack runtime boots`, () => {
  delete globalThis.rspackChunkwebapp
  delete globalThis.rspackChunkGantryV2
  hook()
  globalThis[name].push(chunkA)

  // Minimal rspack JSONP runtime.
  const modules = {}, cache = {}
  const req = (id) => {
    if (cache[id]) return cache[id].exports
    const m = (cache[id] = { exports: {} })
    modules[id](m, m.exports, req)
    return m.exports
  }
  req.d = (exp, defs) => { for (const k in defs) Object.defineProperty(exp, k, { enumerable: true, get: defs[k] }) }
  const cb = (parent, data) => { Object.assign(modules, data[1]); parent?.(data) }
  const g = globalThis[name]
  g.forEach((d) => cb(null, d))
  g.push = cb.bind(null, g.push.bind(g))

  g.push(chunkB)
  assert.equal(req('RV46').A(), true)
  assert.equal(req('9ZZn').j9(), true, 'isLinux itself is not touched')
  assert.equal(req('other').A(), 'untouched', 'modules without the source marker are not wrapped')
  assert.equal(g.length, 2)
})
