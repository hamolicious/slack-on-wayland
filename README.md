# slack-patch

Patches for the Slack desktop app's `app.asar`, pinned to **Slack 41.2.2** (`app.asar` sha256 `e4816066…423c`). Together they make huddle screen-share drawing work on Linux/Wayland: other people can draw on your shared screen, and you can draw on it too.

## Usage

Requirements: Slack 41.2.2 installed at `/usr/lib/slack` (Arch `slack-desktop`), plus `node` and `npm`. `apply.sh` fetches `@electron/asar` itself.

1. **Pin Slack** so an update doesn't replace the patched file. In `/etc/pacman.conf`, set `IgnorePkg = slack-desktop`.
2. **Check the patches:** `node --test test/*.test.mjs`.
3. **Optionally try it on a copy first** (see below).
4. **Patch Slack:** `sudo ./apply.sh`, then quit Slack completely (including the tray) and start it again.
5. **On Wayland, set up the overlay hook** for your compositor (see [Draw window hook](#draw-window-hook)). Without it, drawing works, but the overlay isn't placed over the shared screen. For Hyprland, copy the files in `examples/hyprland/`; see [Hyprland](#hyprland).
6. **Share in a huddle:** pick "Entire screen" in Slack, then choose the screen in the system picker. Turn drawing on from the huddle controls.

```sh
sudo ./apply.sh                    # apply every patch to /usr/lib/slack; keeps app.asar.orig; safe to re-run
sudo ./apply.sh --only 0001,0003   # apply only some patches (by number or name)
./apply.sh --list                  # list the patches
./apply.sh ~/slack-copy            # patch another install (no sudo for your own dirs)
sudo ./apply.sh --restore          # put the original app.asar back
```

Every patch is optional and can be applied on its own or with any of the others. `apply.sh` applies them in numeric order. Re-running with a different `--only` replaces the previous selection, because it always starts from the original.

`apply.sh` refuses to run on any other version or hash. It always patches from `app.asar.orig`, applies the selected `patches/*.mjs` in order, checks that the result parses and that the unpacked file set is unchanged, then swaps `app.asar`. After reinstalling Slack, run it again.

### Try it on a copy first

```sh
cp -a /usr/lib/slack ~/slack-test && ./apply.sh ~/slack-test
~/slack-test/slack --user-data-dir="$HOME/slack-test-profile"
```

Use the separate profile, or the copy just hands off to your running Slack. Sign-in comes back through a `slack://` link, so point that link at the copy until you're signed in: `xdg-mime default slack-test.desktop x-scheme-handler/slack`, with a `slack-test.desktop` whose `Exec=` runs the line above with `%U`. Switch back afterwards with `xdg-mime default slack.desktop x-scheme-handler/slack`.

## Patches

- **`0001-linux-enable-drawing`**: Slack's web client turns drawing off on every Linux build (`isDrawSupported()` returns false on Linux), so nobody can draw on a Linux user's shared screen. The patch hooks the web client's code loader and makes that check return true, so the "allow drawing" toggle appears and other people can draw on your screen.
- **`0002-wayland-screen-sources`**: On Wayland, every request for screen sources opens a new portal prompt with new IDs, so Slack loses track of the screen you picked and treats the share as a window share with no drawing surface. The patch gives Slack one stable "Entire screen" source and leaves the real choice to the capture's own system prompt, so the share is recognised as a screen share and the drawing overlay gets a surface.
- **`0003-draw-window-hook`**: Wayland ignores the drawing overlay's position and always-on-top, and Slack creates it non-resizable, so it opens as a small 800×600 window that the compositor tiles or blurs. The patch gives the overlay a fixed title, makes it resizable, and runs a user hook on each change to it, so your compositor can float it and place it over the shared screen.
- **`0004-draw-window-redraw-on-resize`**: Slack sizes the drawing surface only when it first renders the overlay, so when the compositor resizes the overlay afterwards, the surface stays small until you click it. The patch adds a refresh signal that re-renders the overlay whenever its window is resized, so the surface fills the screen straight away.
- **`0005-huddle-panel-title`**: The huddle panel holds the only button that turns drawing off (Slack's "hold Ctrl to click through" escape has no listener in the shipped app), and on Wayland the drawing overlay covers it as soon as you click to draw. The patch gives the panel a fixed title, `Slack huddle`, so a compositor rule can keep it above the overlay and you can always stop drawing.

You need `0001` for drawing at all. `0002`, `0003` and `0004` are for Wayland; `0004` matters when something other than Slack sizes the overlay, such as `0003`'s hook.

## Draw window hook

Slack runs `$SLACK_DRAW_WINDOW_HOOK`, or `~/.config/slack-patch/draw-window-hook` if that variable isn't set. It runs detached, and its output is discarded.

| `$1` / `SLACK_DRAW_EVENT` | when |
| --- | --- |
| `create` | the overlay window is created (hidden, no bounds yet) |
| `bounds` | Slack asked to move/resize it |
| `show` / `hide` | drawing overlay shown/hidden |
| `close` | the window is gone |
| `picked` | not sent by Slack; `examples/hyprland/share-picker.sh` sends it after you pick a screen, because Slack shows the overlay before the pick |

Environment: `SLACK_DRAW_TITLE`, `SLACK_DRAW_PID` (Slack's main process), and `SLACK_DRAW_X`, `SLACK_DRAW_Y`, `SLACK_DRAW_WIDTH`, `SLACK_DRAW_HEIGHT`. The bounds are Slack's request, set once Slack has made one, and are only a placeholder (the primary display): Electron can't tell which monitor the portal shared. If your compositor knows which output is being shared, use that instead.

The hook should float, pin and unblur the overlay, and move and resize it over the shared monitor. Slack handles click-through itself: clicks pass through until you turn drawing on.

### Hyprland

`examples/hyprland/` is a working setup for Hyprland 0.56 (Lua config) with xdg-desktop-portal-hyprland:

- `share-picker.sh` wraps `hyprland-share-picker`. It records the output you pick, and moves an open drawing overlay to that screen by running the draw hook with the event `picked`. It also answers repeat requests from the same share: Chromium opens three portal sessions for one screen share, so without it you'd pick three times. Set it as `custom_picker_binary` in `xdph.conf`, then restart the portal: `systemctl --user restart xdg-desktop-portal-hyprland`.
- `slack-draw-window-hook.sh` puts the overlay on the recorded output, and falls back to Slack's bounds otherwise. Link it in: `ln -s …/slack-draw-window-hook.sh ~/.config/slack-patch/draw-window-hook`.
- `window-rule.lua` floats, pins and unblurs the overlay. Don't add `no_focus`: it makes the overlay ignore clicks.

Don't enable `allow_token_by_default` in xdph. It doesn't stop the repeat prompts, because Chromium drops the first two sessions before they start, so they never get a token. And it can make the portal reuse your last screen without asking.
