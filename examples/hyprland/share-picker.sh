#!/usr/bin/env bash
# xdph custom picker: run the stock picker unchanged, but remember which output was picked
# so tools/slack-draw-window-hook.sh can put Slack's drawing overlay on that monitor.
set -uo pipefail
state=${XDG_RUNTIME_DIR:-/tmp}/share-picker-output
out=$(hyprland-share-picker "$@")
rc=$?
printf '%s\n' "$out"
sel=$(grep -m1 '^\[SELECTION\]' <<<"$out")
sel=${sel#*/}
case $sel in
screen:*) printf '%s\n' "${sel#screen:}" >"$state" ;;
*) rm -f "$state" ;;
esac
exit $rc
