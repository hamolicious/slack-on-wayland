// Wayland screen sharing: one portal prompt per share, and a screen the drawing overlay can use.
//
// With the PipeWire portal, every desktopCapturer.getSources call is its own portal prompt with
// new ids and no display_id. Slack calls it several times per share and re-fetches at share
// start, misses the id that was picked, and treats the share as a window share with no bounds,
// so the drawing overlay gets no draw surface. The capture (getUserMedia) prompts again anyway,
// so on Wayland offer one stable placeholder source and give screen sources a placeholder
// display_id. Electron can't tell which monitor the portal shared; 0003's hook places the overlay.

// Main process (stringified into main.bundle.cjs), so it must be self-contained.
// shortcut: assumes Electron runs on native Wayland whenever WAYLAND_DISPLAY is set, unless forced to x11.
export function waylandSources(get) {
  const { app, nativeImage } = require('electron')
  if (!process.env.WAYLAND_DISPLAY || app.commandLine.getSwitchValue('ozone-platform') === 'x11') return get()
  return [{ id: 'screen:0:0', name: 'Entire screen', display_id: '', thumbnail: nativeImage.createEmpty() }]
}

export const edits = [
  {
    file: 'dist/main.bundle.cjs',
    find: 'const d=await ce.desktopCapturer.getSources({types:r||["screen"],thumbnailSize:t})',
    replace: `const d=await (globalThis.__spWaylandSources||=${waylandSources.toString()})(()=>ce.desktopCapturer.getSources({types:r||["screen"],thumbnailSize:t}))`,
  },
  {
    file: 'dist/main.bundle.cjs',
    find: 'return d.map(A=>({...(0,Fi.A)(A,"display_id","id","name"),',
    replace:
      'return d.map(A=>({...(0,Fi.A)(A,"display_id","id","name"),display_id:A.display_id||(A.id.startsWith("screen:")?String(ce.screen.getPrimaryDisplay().id):""),',
  },
]
