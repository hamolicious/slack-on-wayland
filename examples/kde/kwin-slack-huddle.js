// KWin script for slack-patch's huddle windows. slack-draw-window-hook.sh loads it with a
// `const TARGET = {output, x, y, width, height}` line prepended: the output being shared, or
// empty, and Slack's requested bounds as the fallback. It stays loaded until the overlay closes.
//
// - Drawing overlay (0003): no border, kept above, off the taskbar and switcher, and placed over
//   TARGET's output (or Slack's bounds).
// - Huddle panel (0005): kept above, and raised again whenever the overlay takes focus, because
//   KWin raises the overlay over it when you click to draw, which hides "turn off drawing".
const OVERLAY = 'Slack huddle drawing'
const PANEL = 'Slack huddle'

function target() {
  for (const s of workspace.screens) if (TARGET.output && s.name === TARGET.output) return s.geometry
  return TARGET.width > 0 ? TARGET : null
}

function setup(w) {
  if (!w) return
  if (w.caption === OVERLAY) {
    w.noBorder = true
    w.keepAbove = true
    w.skipTaskbar = true
    w.skipPager = true
    w.skipSwitcher = true
    const g = target()
    if (g) w.frameGeometry = { x: g.x, y: g.y, width: g.width, height: g.height }
  } else if (w.caption === PANEL) {
    w.keepAbove = true
  }
}

workspace.windowList().forEach(setup)
// Slack maps the overlay again on every show, as a new window.
workspace.windowAdded.connect(setup)
workspace.windowActivated.connect((w) => {
  if (!w || w.caption !== OVERLAY) return
  for (const p of workspace.windowList()) if (p.caption === PANEL) workspace.raiseWindow(p)
})
