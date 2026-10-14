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
sudo ./apply.sh              # patch /usr/lib/slack; keeps app.asar.orig; safe to re-run
./apply.sh ~/slack-copy      # patch another install (no sudo for your own dirs)
sudo ./apply.sh --restore    # put the original app.asar back
```

`apply.sh` refuses to run on any other version or hash. It always patches from `app.asar.orig`, applies every `patches/*.mjs` in order, checks that the result parses and that the unpacked file set is unchanged, then swaps `app.asar`. After reinstalling Slack, run it again.

### Try it on a copy first

```sh
cp -a /usr/lib/slack ~/slack-test && ./apply.sh ~/slack-test
~/slack-test/slack --user-data-dir="$HOME/slack-test-profile"
```

Use the separate profile, or the copy just hands off to your running Slack. Sign-in comes back through a `slack://` link, so point that link at the copy until you're signed in: `xdg-mime default slack-test.desktop x-scheme-handler/slack`, with a `slack-test.desktop` whose `Exec=` runs the line above with `%U`. Switch back afterwards with `xdg-mime default slack.desktop x-scheme-handler/slack`.

## Patches

| Patch | Problem | Fix |
| --- | --- | --- |
| `0001-linux-enable-drawing` | The web client from app.slack.com disables drawing on every Linux build: `isDrawSupported(){return!isLinux()&&isDesktopApp()}`. | The preload hooks the web client's rspack chunk loader and forces this check to return true. |
| `0002-wayland-screen-sources` | On Wayland, every capture-source request is a separate portal prompt with new IDs and no `display_id`. Slack re-requests sources when the share starts, misses the one you picked, and treats the share as a window share, so the drawing overlay gets no bounds and no drawing surface. | On Wayland, Slack gets one stable placeholder source ("Entire screen"), and you choose the real screen or window in the capture's own prompt. Screen sources get a placeholder `display_id`. |
| `0003-draw-window-hook` | Wayland ignores the overlay's position and always-on-top, and Slack opens it non-resizable, which locks its size. | The overlay is titled `Slack huddle drawing`, made resizable, and a user hook runs on every change to it. When a hook is installed, Slack stops applying the overlay's bounds itself. |

You need `0001` for drawing at all. `0002` and `0003` are for Wayland.

## Draw window hook

Slack runs `$SLACK_DRAW_WINDOW_HOOK`, or `~/.config/slack-patch/draw-window-hook` if that variable isn't set. It runs detached, and its output is discarded.

| `$1` / `SLACK_DRAW_EVENT` | when |
| --- | --- |
| `create` | the overlay window is created (hidden, no bounds yet) |
| `bounds` | Slack asked to move/resize it |
| `show` / `hide` | drawing overlay shown/hidden |
| `close` | the window is gone |

Environment: `SLACK_DRAW_TITLE`, `SLACK_DRAW_PID` (Slack's main process), and `SLACK_DRAW_X`, `SLACK_DRAW_Y`, `SLACK_DRAW_WIDTH`, `SLACK_DRAW_HEIGHT`. The bounds are Slack's request, set once Slack has made one, and are only a placeholder (the primary display): Electron can't tell which monitor the portal shared. If your compositor knows which output is being shared, use that instead.

The hook should float, pin and unblur the overlay, and move and resize it over the shared monitor. Slack handles click-through itself: clicks pass through until you turn drawing on.

### Hyprland

`examples/hyprland/` is a working setup for Hyprland 0.56 (Lua config) with xdg-desktop-portal-hyprland:

- `share-picker.sh` wraps `hyprland-share-picker` and records the output you pick. Set it as `custom_picker_binary` in `xdph.conf`, then restart the portal: `systemctl --user restart xdg-desktop-portal-hyprland`.
- `slack-draw-window-hook.sh` puts the overlay on the recorded output, and falls back to Slack's bounds otherwise. Link it in: `ln -s …/slack-draw-window-hook.sh ~/.config/slack-patch/draw-window-hook`.
- `window-rule.lua` floats, pins and unblurs the overlay. Don't add `no_focus`: it makes the overlay ignore clicks.

Don't enable `allow_token_by_default` in xdph. With restore tokens, the portal silently reuses your last screen, so you can't switch monitors.
