// Huddle screen-share drawing is disabled on every Linux build.
//
// The webapp (served from app.slack.com, not in the asar) gates drawing on
// `isDrawSupported(){return!isLinux()&&isDesktopApp()}`, so a Linux sharer always advertises
// isDrawEnabled:false and never gets the "allow drawing" toggle. The preload hooks the rspack
// chunk loader in the page's main world and swaps that export for `() => true`.
import { runInMainWorld } from '../lib/main-world.mjs'

// Runs in the page's main world, so it must be self-contained apart from addModulePatch.
export function hook(addModulePatch) {
  addModulePatch('function isDrawSupported(){return!(0,', (f) =>
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
    },
  )
}

export const edits = [
  {
    file: 'dist/preload.bundle.js',
    find: 'process.on("document-start",()=>{',
    replace: `process.on("document-start",()=>{${runInMainWorld(hook, '0001')}`,
  },
]
