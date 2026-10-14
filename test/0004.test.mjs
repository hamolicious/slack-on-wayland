import { test } from 'node:test'
import assert from 'node:assert/strict'
import { redrawOnResize } from '../patches/0004-draw-window-redraw-on-resize.mjs'
import { addModulePatch } from '../lib/main-world.mjs'
import { bootRuntime, resetGlobals } from './runtime.mjs'

test('a resize of the drawing overlay re-renders HostDrawWindow and nothing else', () => {
  resetGlobals()
  const fakeWindow = () => {
    const listeners = {}
    return { listeners, addEventListener: (ev, fn) => (listeners[ev] = fn) }
  }
  const overlay = fakeWindow(), other = fakeWindow()
  globalThis.window = { open: (url, name) => (name.includes('huddles-host-draw-window') ? overlay : other) }

  redrawOnResize(addModulePatch)
  const { req, chunks } = bootRuntime('rspackChunkGantryV2')
  chunks.push([['client-boot-render'], {
    q1tI(e, t) { class Component {}; class PureComponent extends Component { forceUpdate() { this.updates = (this.updates || 0) + 1 } }; t.Component = Component; t.PureComponent = PureComponent },
    // Same shape as the webapp's module xm69.
    xm69(e,t,a){"use strict";var eo=a("q1tI");let HostDrawWindow=class HostDrawWindow extends eo.PureComponent{static contextType=null};let Other=class Other extends eo.PureComponent{};a.d(t,{H:()=>HostDrawWindow,O:()=>Other})},
  }])
  const { H, O } = req('xm69')
  const host = new H(), unrelated = new O()
  assert.ok(host instanceof req('q1tI').PureComponent, 'still a real PureComponent')

  window.open('', 'frameId=1,idRequestChannel=x,disposition=desktop-window,windowId=huddles-host-draw-window')
  window.open('', 'frameId=2,windowId=huddles-mini-panel')
  assert.equal(other.listeners.resize, undefined)
  overlay.listeners.resize()
  assert.equal(host.updates, 1)
  assert.equal(unrelated.updates, undefined)
  delete globalThis.window
})
