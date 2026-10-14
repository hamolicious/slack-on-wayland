// Shared by patches that rewrite the webapp's code. Runs in the page's main world (each patch
// embeds its own copy, so patches stay independent); the chunk hook is installed once per page
// and runs every registered module patch.

// Wrap the factory of every rspack module whose source contains `match` with `wrap(factory)`.
// Call it at document-start, before any chunk loads.
export function addModulePatch(match, wrap) {
  const patches = (globalThis.__slackPatchModulePatches ||= [])
  patches.push({ match, wrap })
  if (patches.length > 1) return
  const patchChunk = (c) => {
    const mods = c && c[1]
    if (!mods) return
    for (const id in mods) {
      if (typeof mods[id] !== 'function') continue
      const src = Function.prototype.toString.call(mods[id])
      for (const p of patches) if (src.includes(p.match)) mods[id] = p.wrap(mods[id])
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

// Preload source that runs `fn(addModulePatch)` in the page's main world at document-start.
export const runInMainWorld = (fn, tag) =>
  `try{P.contextBridge.executeInMainWorld({func:function(){(${fn.toString()})(${addModulePatch.toString()})}})}catch(e){console.error(${JSON.stringify(`slack-patch ${tag}:`)},e)}`
