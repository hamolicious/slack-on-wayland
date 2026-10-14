#!/usr/bin/env bash
# xdph custom picker: run the stock picker, but
# - answer repeat requests from the same share with the same choice: Chromium (Slack, etc.)
#   opens several portal sessions for one screen share, so the picker would pop up 3 times;
# - remember which output was picked, so tools/slack-draw-window-hook.sh can put Slack's
#   drawing overlay on that monitor.
# shortcut: a new share started within 2s of the last pick reuses it without asking.
set -uo pipefail
state=${XDG_RUNTIME_DIR:-/tmp}/share-picker-output
last=${XDG_RUNTIME_DIR:-/tmp}/share-picker-last
log() { echo "$(date +%T) $*" >>"${XDG_RUNTIME_DIR:-/tmp}/share-picker.log"; }

if [ -s "$last" ] && [ $(($(date +%s) - $(stat -c %Y "$last"))) -le 2 ]; then
	touch "$last"
	log "repeat request, answered with $(cat "$last")"
	cat "$last"
	exit 0
fi

out=$(hyprland-share-picker "$@")
rc=$?
printf '%s\n' "$out"
sel=$(grep -m1 '^\[SELECTION\]' <<<"$out")
log "picked rc=$rc $sel"
if [ "$rc" = 0 ] && [ -n "$sel" ]; then printf '%s\n' "$sel" >"$last"; else rm -f "$last"; fi
sel=${sel#*/}
case $sel in
screen:*)
	printf '%s\n' "${sel#screen:}" >"$state"
	# Slack shows the overlay before you pick, so move it to the screen you just picked.
	hook=${SLACK_DRAW_WINDOW_HOOK:-$HOME/.config/slack-patch/draw-window-hook}
	[ -x "$hook" ] && SLACK_DRAW_TITLE="Slack huddle drawing" setsid "$hook" picked </dev/null >/dev/null 2>&1 &
	;;
*) rm -f "$state" ;;
esac
exit $rc
