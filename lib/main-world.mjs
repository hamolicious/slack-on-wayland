// Shared by patches that rewrite the webapp's code. Runs in the page's main world (each patch
// embeds its own copy, so patches stay independent); the chunk hook is installed once per page
// and runs every registered module patch.

// Wrap the factory of every rspack module whose source contains `match` with `wrap(factory)`.
// Call it at document-start, before any chunk loads.
export function addModulePatch(match, wrap) {
  const patches = (globalThis.__slackPatchModulePatches ||= [])
  patches.push({ match, wrap })
  if (patches.length > 1) return
  // A chunk can pass through more than one push (the runtime's loader calls the native push
  // too), so patch each chunk once.
  const done = new WeakSet()
  const patchChunk = (c) => {
    const mods = c && c[1]
    if (!mods || typeof mods !== 'object' || done.has(c)) return
    done.add(c)
    for (const id in mods) {
      if (typeof mods[id] !== 'function') continue
      const src = Function.prototype.toString.call(mods[id])
      for (const p of patches) if (src.includes(p.match)) mods[id] = p.wrap(mods[id])
    }
  }
  const nativePush = Array.prototype.push
  // Sign-in pages use rspackChunkwebapp, the logged-in client uses rspackChunkGantryV2.
  // shortcut: fixed list of chunk globals; add any new rspackChunk* name Slack starts using.
  for (const name of ['rspackChunkwebapp', 'rspackChunkGantryV2']) {
    const arr = globalThis[name] || []
    if (!Array.isArray(arr)) continue
    arr.forEach(patchChunk)
    // The queue stays a plain array to the runtime: Slack's runtime (ReleaseModuleFactoriesPlugin)
    // refuses to boot when the queue's push is an accessor, and drops the queued chunks when it
    // isn't the native push. So a Proxy hands out the native push until a runtime installs its
    // own, patches chunks the native push stores, and wraps the runtime's push once there is one.
    const wrapped = new WeakMap()
    globalThis[name] = new Proxy(arr, {
      set(t, k, v, r) {
        if (typeof k === 'string' && /^\d+$/.test(k)) patchChunk(v)
        return Reflect.set(t, k, v, r)
      },
      get(t, k, r) {
        const v = Reflect.get(t, k, r)
        if (k !== 'push' || typeof v !== 'function' || v === nativePush) return v
        if (!wrapped.has(v))
          wrapped.set(v, function (...chunks) {
            chunks.forEach(patchChunk)
            return v.apply(this, chunks)
          })
        return wrapped.get(v)
      },
    })
  }
}

// Preload source that runs `fn(addModulePatch)` in the page's main world at document-start.
export const runInMainWorld = (fn, tag) =>
  `try{P.contextBridge.executeInMainWorld({func:function(){(${fn.toString()})(${addModulePatch.toString()})}})}catch(e){console.error(${JSON.stringify(`slack-patch ${tag}:`)},e)}`
