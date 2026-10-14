#!/usr/bin/env bash
# Hook for slack-patch's huddle drawing overlay: Wayland ignores Slack's own setBounds, so place
# the overlay over the shared monitor. tools/share-picker.sh records which output was picked;
# without that, fall back to the bounds Slack asked for (SLACK_DRAW_X/Y/WIDTH/HEIGHT).
set -euo pipefail
log() { echo "$(date +%T) $*" >>/tmp/slack-draw-hook.log; }
log "$* slack: x=${SLACK_DRAW_X:-} y=${SLACK_DRAW_Y:-} w=${SLACK_DRAW_WIDTH:-} h=${SLACK_DRAW_HEIGHT:-}"
case ${1:-} in bounds | show) ;; *) exit 0 ;; esac

x=${SLACK_DRAW_X:-} y=${SLACK_DRAW_Y:-} w=${SLACK_DRAW_WIDTH:-} h=${SLACK_DRAW_HEIGHT:-}
picked=${XDG_RUNTIME_DIR:-/tmp}/share-picker-output
if [ -s "$picked" ]; then
	# Logical size: divide by scale, swap for 90/270 degree transforms.
	read -r x y w h < <(hyprctl monitors -j | jq -r --arg n "$(cat "$picked")" '
		.[] | select(.name == $n)
		| [(.width / .scale | floor), (.height / .scale | floor)] as [$w, $h]
		| if (.transform % 2) == 1 then [.x, .y, $h, $w] else [.x, .y, $w, $h] end | @tsv') || true
	log "  picked output $(cat "$picked"): x=$x y=$y w=$w h=$h"
fi
[ -n "$w" ] || exit 0

address=
for _ in $(seq 20); do # on "show" the window may not be mapped yet
	address=$(hyprctl clients -j | jq -r --arg t "$SLACK_DRAW_TITLE" 'first(.[] | select(.title == $t) | .address) // empty')
	[ -n "$address" ] && break
	sleep 0.1
done
[ -n "$address" ] || { log "  no window titled '$SLACK_DRAW_TITLE'"; exit 0; }
win="address:$address"
log "  resize: $(hyprctl dispatch "hl.dsp.window.resize({ window = \"$win\", x = $w, y = $h })" 2>&1)"
log "  move: $(hyprctl dispatch "hl.dsp.window.move({ window = \"$win\", x = $x, y = $y })" 2>&1)"
log "  now: $(hyprctl clients -j | jq -c --arg a "$address" '.[] | select(.address == $a) | {at, size, monitor}')"
