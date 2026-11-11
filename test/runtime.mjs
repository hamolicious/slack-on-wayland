// A minimal rspack JSONP runtime, enough to load chunks the way the webapp does.
export function resetGlobals() {
  delete globalThis.rspackChunkwebapp
  delete globalThis.rspackChunkGantryV2
  delete globalThis.__slackPatchModulePatches
}

export function bootRuntime(name) {
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
  return { req, chunks: g }
}

// The Gantry runtime with Slack's ReleaseModuleFactoriesPlugin (app.slack.com, November 2026):
// it refuses a queue whose push is an accessor, warns and discards history when push isn't the
// native one, and then locks push behind a non-configurable getter and empties the queue after
// every chunk. Reduced from the inline runtime in app.slack.com/client.
export function bootReleaseRuntime(name) {
  const modules = {}, cache = {}, warnings = []
  const req = (id) => {
    if (cache[id]) return cache[id].exports
    const m = (cache[id] = { exports: {} })
    modules[id](m, m.exports, req)
    return m.exports
  }
  // d(exports, getters, values): newer modules export plain values through the third argument.
  req.d = (exp, getters, values) => {
    for (const k in getters) Object.defineProperty(exp, k, { enumerable: true, get: getters[k] })
    for (const k in values || {}) Object.defineProperty(exp, k, { enumerable: true, value: values[k] })
  }
  const W = (globalThis[name] = globalThis[name] || [])
  if (!Array.isArray(W)) throw Error('ReleaseModuleFactoriesPlugin: the Gantry chunk queue is not an array. Load one runtime per document.')
  const G = Object.getOwnPropertyDescriptor(W, 'push')
  if (G && G.get) throw Error('ReleaseModuleFactoriesPlugin: the Gantry chunk queue already has a runtime. Load one runtime per document.')
  if (W.push !== Array.prototype.push) warnings.push('another runtime is attached to the Gantry chunk queue; its replayed history will be discarded.')
  const x = (parent, data) => { Object.assign(modules, data[1]); parent && parent(data) }
  const z = globalThis[name]
  z.forEach(x.bind(null, 0))
  z.push = x.bind(null, z.push.bind(z))
  const R = globalThis[name], E = R.push
  R.length = 0
  const T = function (e) { const n = E(e); R.length = 0; return n }
  Object.defineProperty(R, 'push', {
    configurable: false,
    get: () => T,
    set: () => { throw Error('ReleaseModuleFactoriesPlugin: cannot attach another runtime to the Gantry chunk queue.') },
  })
  return { req, chunks: R, warnings }
}
