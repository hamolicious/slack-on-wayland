// Redraw the huddle drawing overlay when it is resized.
//
// The webapp's HostDrawWindow reads the overlay's innerWidth/innerHeight only when it renders and
// doesn't listen for resize. When the compositor sizes the overlay after Slack has rendered it
// (0003's hook on Wayland), the drawing surface stays at the old size until something else makes
// it re-render, e.g. a click. This extends the component with a refresh signal: the module that
// defines HostDrawWindow gets a PureComponent that registers HostDrawWindow instances, and a
// resize of the overlay window (found via window.open) re-renders them with forceUpdate().
import { runInMainWorld } from '../lib/main-world.mjs'

// Runs in the page's main world, so it must be self-contained apart from addModulePatch.
export function redrawOnResize(addModulePatch) {
  const live = new Set()
  const refresh = () => {
    for (const ref of live) {
      const c = ref.deref()
      if (c) c.forceUpdate()
      else live.delete(ref)
    }
  }

  // Give the defining module a PureComponent that registers HostDrawWindow instances.
  const reacts = new WeakMap()
  const withRefreshable = (m) => {
    if (!m || typeof m.PureComponent !== 'function' || typeof m.Component !== 'function') return m
    const d = Object.getOwnPropertyDescriptor(m, 'PureComponent')
    if (d && !d.configurable && !d.writable && !d.get) return m // a Proxy can't change this property
    if (!reacts.has(m)) {
      const Refreshable = class extends m.PureComponent {
        constructor(...args) {
          super(...args)
          if (new.target.name === 'HostDrawWindow') live.add(new WeakRef(this))
        }
      }
      reacts.set(m, new Proxy(m, { get: (o, k) => (k === 'PureComponent' ? Refreshable : Reflect.get(o, k)) }))
    }
    return reacts.get(m)
  }
  addModulePatch('class HostDrawWindow extends', (f) =>
    function (module, exports, req) {
      const r = new Proxy(req, { apply: (t, self, args) => withRefreshable(Reflect.apply(t, self, args)) })
      return f.call(this, module, exports, r)
    },
  )

  // Signal: the overlay window resized.
  const open = window.open
  window.open = function (...args) {
    const win = open.apply(this, args)
    if (win && String(args[1] || '').includes('windowId=huddles-host-draw-window')) win.addEventListener('resize', refresh)
    return win
  }
}

export const edits = [
  {
    file: 'dist/preload.bundle.js',
    find: 'process.on("document-start",()=>{',
    replace: `process.on("document-start",()=>{${runInMainWorld(redrawOnResize, '0004')}`,
  },
]
