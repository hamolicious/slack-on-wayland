import { test } from 'node:test'
import assert from 'node:assert/strict'
import { redrawOnResize } from '../patches/0004-draw-window-redraw-on-resize.mjs'

test('the drawing overlay re-renders HostDrawWindow on resize, other windows are left alone', () => {
  const fakeWindow = (el) => {
    const listeners = {}
    return {
      listeners,
      addEventListener: (ev, fn) => (listeners[ev] = fn),
      document: { querySelector: (sel) => (sel === '.p-calls__host_draw_window' ? el : null) },
    }
  }
  let updates = 0
  // DOM node -> host fiber -> class component fiber, the shape React leaves on rendered nodes.
  const el = {}
  el['__reactFiber$abc'] = { stateNode: el, return: { stateNode: { forceUpdate: () => updates++ }, return: null } }
  const overlay = fakeWindow(el)
  const other = fakeWindow(el)
  const opened = []
  globalThis.window = { open: (url, name) => (opened.push(name), name.includes('huddles-host-draw-window') ? overlay : other) }

  redrawOnResize()
  assert.equal(window.open('', 'frameId=1,idRequestChannel=x,disposition=desktop-window,windowId=huddles-host-draw-window'), overlay)
  window.open('', 'frameId=2,windowId=huddles-mini-panel')
  assert.deepEqual(opened.length, 2, 'window.open still opens every window')
  assert.equal(typeof overlay.listeners.resize, 'function')
  assert.equal(other.listeners.resize, undefined)
  overlay.listeners.resize()
  assert.equal(updates, 1)
  delete globalThis.window
})
