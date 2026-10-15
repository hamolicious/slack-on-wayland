// Give the huddle panel a fixed title, so the compositor can keep it above the drawing overlay.
//
// The huddle mini panel holds the button that turns drawing off. On macOS it floats above the
// drawing overlay; Slack's other way out, holding Ctrl to click through the overlay, has no
// listener in the shipped webapp. On Wayland the overlay is raised above the panel as soon as
// you click it to draw, so you can't stop drawing. The panel is titled "Slack huddle" (and keeps
// that title), so a compositor rule can float it and raise it whenever the overlay takes focus.

export const PANEL_TITLE = 'Slack huddle'

export const edits = [
  {
    file: 'dist/main.bundle.cjs',
    find: 'return E0({frame:!0,titleBarStyle:"default",...r,',
    replace: `return E0({frame:!0,titleBarStyle:"default",...r,...t.windowId==="huddles-mini-panel"?{title:${JSON.stringify(PANEL_TITLE)}}:{},`,
  },
  {
    file: 'dist/main.bundle.cjs',
    find: 'T.on("did-create-window",(L,{frameName:P,url:Y,options:k})=>{const $=xy(P);',
    replace:
      'T.on("did-create-window",(L,{frameName:P,url:Y,options:k})=>{const $=xy(P);$.windowId==="huddles-mini-panel"&&L.on("page-title-updated",e=>e.preventDefault());',
  },
]
