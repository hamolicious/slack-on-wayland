// Redraw the huddle drawing overlay when it is resized.
//
// The webapp's HostDrawWindow reads the overlay's innerWidth/innerHeight only when it renders and
// doesn't listen for resize. When the compositor sizes the overlay after Slack has rendered it
// (0003's hook on Wayland), the drawing surface stays at the old size until something else makes
// it re-render, e.g. a click. The preload wraps window.open in the page's main world and
// re-renders HostDrawWindow whenever the overlay window is resized.

// Runs in the page's main world via contextBridge.executeInMainWorld, so it must be self-contained.
export function redrawOnResize() {
  const open = window.open
  window.open = function (...args) {
    const win = open.apply(this, args)
    if (win && String(args[1] || '').includes('windowId=huddles-host-draw-window'))
      win.addEventListener('resize', () => {
        const el = win.document.querySelector('.p-calls__host_draw_window')
        const key = el && Object.keys(el).find((k) => k.startsWith('__reactFiber$'))
        for (let f = key && el[key]; f; f = f.return)
          if (f.stateNode && typeof f.stateNode.forceUpdate === 'function') {
            f.stateNode.forceUpdate()
            break
          }
      })
    return win
  }
}

export const edits = [
  {
    file: 'dist/preload.bundle.js',
    find: 'process.on("document-start",()=>{',
    replace: `process.on("document-start",()=>{try{P.contextBridge.executeInMainWorld({func:${redrawOnResize.toString()}})}catch(e){console.error("slack-patch 0004:",e)}`,
  },
]
