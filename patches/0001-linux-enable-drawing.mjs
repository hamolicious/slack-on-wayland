// Huddle screen-share drawing is disabled on every Linux build.
//
// The webapp (served from app.slack.com, not in the asar) gates drawing on
// `isDrawSupported(){return!isLinux()&&isDesktopApp()}`, so a Linux sharer always advertises
// isDrawEnabled:false and never gets the "allow drawing" toggle. The preload hooks the rspack
// chunk queue in the page's main world and swaps that export for `() => true`.

// Runs in the page's main world via contextBridge.executeInMainWorld, so it must be self-contained.
export function hook() {
  const patchFactory = (f) =>
    function (module, exports, req) {
      const r = new Proxy(req, {
        get: (o, k) =>
          k !== 'd'
            ? o[k]
            : (x, defs) => {
                for (const key in defs) {
                  try {
                    if (defs[key]().name === 'isDrawSupported')
                      defs[key] = () =>
                        function isDrawSupported() {
                          return true
                        }
                  } catch {}
                }
                return o.d(x, defs)
              },
      })
      return f.call(this, module, exports, r)
    }
  const patchChunk = (c) => {
    const mods = c && c[1]
    if (!mods) return
    for (const id in mods) {
      const f = mods[id]
      if (typeof f === 'function' && Function.prototype.toString.call(f).includes('function isDrawSupported(){return!(0,'))
        mods[id] = patchFactory(f)
    }
  }
  // Sign-in pages use rspackChunkwebapp, the logged-in client uses rspackChunkGantryV2.
  // shortcut: fixed list of chunk globals; add any new rspackChunk* name Slack starts using.
  for (const name of ['rspackChunkwebapp', 'rspackChunkGantryV2']) {
    const arr = (globalThis[name] ||= [])
    arr.forEach(patchChunk)
    // The rspack runtime reassigns arr.push to its own loader; wrap whatever push is current.
    let current = arr.push
    Object.defineProperty(arr, 'push', {
      configurable: true,
      get() {
        const p = current
        return function (...chunks) {
          chunks.forEach(patchChunk)
          return p.apply(this, chunks)
        }
      },
      set(v) {
        current = v
      },
    })
  }
}

export const edits = [
  {
    file: 'dist/preload.bundle.js',
    find: 'process.on("document-start",()=>{',
    replace: `process.on("document-start",()=>{try{P.contextBridge.executeInMainWorld({func:${hook.toString()}})}catch(e){console.error("slack-patch 0001:",e)}`,
  },
]
