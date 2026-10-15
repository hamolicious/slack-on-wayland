#!/usr/bin/env bash
# slack-patch 0006 hook: print how far (clockwise) to rotate the captured frames of the screen
# just picked in share-picker.sh. Hyprland's portal sends rotated monitors unrotated.
set -uo pipefail
picked=${XDG_RUNTIME_DIR:-/tmp}/share-picker-output
[ -s "$picked" ] || { echo 0; exit 0; }
t=$(hyprctl monitors -j | jq -r --arg n "$(cat "$picked")" '.[] | select(.name == $n) | .transform')
# Wayland transforms 1-3 are 90/180/270 degrees; 4-7 are flipped variants, not handled.
case $t in 1) echo 90 ;; 2) echo 180 ;; 3) echo 270 ;; *) echo 0 ;; esac
