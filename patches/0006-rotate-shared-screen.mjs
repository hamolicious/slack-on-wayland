// Rotate shared screens that are rotated on the desktop (portrait monitors).
//
// On Wayland the portal delivers a rotated monitor's frames unrotated and puts the rotation in
// PipeWire metadata, which Chromium ignores, so a portrait screen is shared sideways. Slack can't
// tell which monitor was shared, so when a screen capture starts it asks a user hook for the
// rotation and, if it isn't 0, marks every frame with that rotation before Slack sends it.
//
// Hook: $SLACK_SHARE_ROTATION_HOOK or ~/.config/slack-patch/share-rotation prints 0, 90, 180 or
// 270: the clockwise rotation to apply to the captured frames. Missing hook, errors and anything
// else mean 0.
import { runInMainWorld } from '../lib/main-world.mjs'

// Main process (stringified into main.bundle.cjs), so it must be self-contained.
export function shareRotation() {
  const file = process.env.SLACK_SHARE_ROTATION_HOOK || require('path').join(require('os').homedir(), '.config/slack-patch/share-rotation')
  if (!require('fs').existsSync(file)) return Promise.resolve(0)
  return new Promise((resolve) =>
    require('child_process').execFile(file, { timeout: 2000 }, (err, out) => {
      const deg = parseInt(String(out).trim(), 10)
      resolve(!err && [90, 180, 270].includes(deg) ? deg : 0)
    }),
  )
}

// Runs in the page's main world, so it must be self-contained.
export function rotateShares() {
  const md = navigator.mediaDevices
  if (!md || !md.getUserMedia || typeof MediaStreamTrackProcessor !== 'function' || typeof MediaStreamTrackGenerator !== 'function' || !('rotation' in VideoFrame.prototype)) return

  // Tag each frame with the rotation instead of redrawing it: no pixels move, and WebRTC carries
  // the rotation to viewers. (Redrawing via a canvas gave black frames for GPU-backed captures.)
  const rotate = (track, deg) => {
    const gen = new MediaStreamTrackGenerator({ kind: 'video' })
    let size = { width: 0, height: 0 }
    new MediaStreamTrackProcessor({ track }).readable
      .pipeThrough(
        new TransformStream({
          transform(frame, out) {
            const rotated = new VideoFrame(frame, { rotation: deg })
            size = { width: rotated.displayWidth, height: rotated.displayHeight }
            frame.close()
            out.enqueue(rotated)
          },
        }),
      )
      .pipeTo(gen.writable)
      .catch(() => {})
    // Slack treats the result as a normal capture track: keep stop/settings/constraints working.
    const stop = gen.stop.bind(gen)
    gen.stop = () => {
      stop()
      track.stop()
    }
    track.addEventListener('ended', () => stop())
    gen.getSettings = () => ({ ...track.getSettings(), ...size, aspectRatio: size.height ? size.width / size.height : undefined })
    gen.applyConstraints = async () => {}
    return gen
  }

  const gum = md.getUserMedia.bind(md)
  md.getUserMedia = async (c) => {
    const stream = await gum(c)
    const m = c && c.video && c.video.mandatory
    if (!m || m.chromeMediaSource !== 'desktop' || !String(m.chromeMediaSourceId).startsWith('screen:')) return stream
    const track = stream.getVideoTracks()[0]
    const deg = track && window.__slackPatchShareRotation ? await window.__slackPatchShareRotation().catch(() => 0) : 0
    if (!deg) return stream
    return new MediaStream([rotate(track, deg), ...stream.getAudioTracks()])
  }
}

export const edits = [
  {
    file: 'dist/main.bundle.cjs',
    find: 'e3=(e,t=$D)=>{',
    replace: `e3=(e,t=$D)=>{ce.ipcMain.removeHandler("slack-patch:share-rotation"),ce.ipcMain.handle("slack-patch:share-rotation",()=>(${shareRotation.toString()})());`,
  },
  {
    file: 'dist/preload.bundle.js',
    find: 'process.on("document-start",()=>{',
    replace: `process.on("document-start",()=>{try{P.contextBridge.exposeInMainWorld("__slackPatchShareRotation",()=>P.ipcRenderer.invoke("slack-patch:share-rotation"))}catch(e){console.error("slack-patch 0006:",e)}${runInMainWorld(rotateShares, '0006')}`,
  },
]
