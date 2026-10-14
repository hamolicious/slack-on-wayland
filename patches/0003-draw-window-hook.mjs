// Let the compositor place the huddle drawing overlay.
//
// On Wayland Slack can't position the overlay or keep it on top (setBounds positioning and
// alwaysOnTop are ignored), so it gets a fixed title and every create/show/hide/setBounds/close
// on it runs a user hook. With a hook installed Slack no longer applies setBounds itself, so it
// can't undo the hook's sizing, and the overlay is made resizable (Slack opens it non-resizable,
// which pins its size on Wayland). See README for the hook contract.

export const DRAW_WINDOW_TITLE = 'Slack huddle drawing'

// Main process (stringified into main.bundle.cjs), so it must be self-contained.
// Returns whether a hook ran.
export function drawWindowHook(win, method, args) {
  const ev = { create: 'create', show: 'show', showInactive: 'show', hide: 'hide', setBounds: 'bounds', setContentBounds: 'bounds', close: 'close' }[method]
  if (!ev) return false
  try {
    if (ev === 'bounds' && args[0]) win.__spBounds = args[0]
    if (ev === 'create') win.__spTitle = win.getTitle()
    const file = process.env.SLACK_DRAW_WINDOW_HOOK || require('path').join(require('os').homedir(), '.config/slack-patch/draw-window-hook')
    if (!require('fs').existsSync(file)) return false
    const b = win.__spBounds || {}
    const env = { ...process.env, SLACK_DRAW_EVENT: ev, SLACK_DRAW_TITLE: win.__spTitle || '', SLACK_DRAW_PID: String(process.pid) }
    for (const k of ['x', 'y', 'width', 'height']) if (b[k] !== undefined) env['SLACK_DRAW_' + k.toUpperCase()] = String(b[k])
    require('child_process')
      .spawn(file, [ev], { env, detached: true, stdio: 'ignore' })
      .on('error', (e) => console.error('slack-patch draw hook:', e))
      .unref()
    return true
  } catch (e) {
    console.error('slack-patch draw hook:', e)
    return false
  }
}

export const edits = [
  {
    file: 'dist/main.bundle.cjs',
    find: 'return E0({frame:!0,titleBarStyle:"default",...r,',
    replace: `return E0({frame:!0,titleBarStyle:"default",...r,...t.windowId==="huddles-host-draw-window"?{title:${JSON.stringify(DRAW_WINDOW_TITLE)},resizable:!0}:{},`,
  },
  {
    file: 'dist/main.bundle.cjs',
    find: 'T.on("did-create-window",(L,{frameName:P,url:Y,options:k})=>{const $=xy(P);',
    replace: `T.on("did-create-window",(L,{frameName:P,url:Y,options:k})=>{const $=xy(P);$.windowId==="huddles-host-draw-window"&&(globalThis.__spDrawHook||=${drawWindowHook.toString()},L.__spDraw=!0,L.on("page-title-updated",e=>e.preventDefault()),L.once("closed",()=>globalThis.__spDrawHook(L,"close",[])),globalThis.__spDrawHook(L,"create",[]));`,
  },
  {
    // EXEC_BROWSERWINDOW_METHOD: the webapp drives the overlay's show/hide/setBounds through here.
    file: 'dist/main.bundle.cjs',
    find: 'else if(!(0,Sb.A)(P[L]))j.vF.error(`${String(L)} is not a method on the BrowserWindow`);else return P[L](...A)',
    replace:
      'else if(!(0,Sb.A)(P[L]))j.vF.error(`${String(L)} is not a method on the BrowserWindow`);else{const B=L==="setBounds"||L==="setContentBounds";if(P.__spDraw&&B&&globalThis.__spDrawHook(P,L,A))return;const r=P[L](...A);return P.__spDraw&&!B&&globalThis.__spDrawHook(P,L,A),r}',
  },
]
