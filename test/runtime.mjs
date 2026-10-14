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
