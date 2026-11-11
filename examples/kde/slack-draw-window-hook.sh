#!/usr/bin/env bash
# Hook for slack-patch's huddle drawing overlay on KDE Plasma 6 (KWin): Wayland ignores Slack's
# own setBounds, so load kwin-slack-huddle.js (next to this file) into KWin to place the overlay
# over the shared monitor and keep the huddle panel above it.
#
# Which monitor is shared: KWin names each screen-cast PipeWire stream "kwin-screencast-<output>",
# so the newest such stream is the screen you picked in the portal. Slack shows the overlay before
# you pick, so until a stream shows up the overlay goes to Slack's bounds (the primary display)
# and a background poll moves it once the stream appears.
# shortcut: the newest kwin-screencast stream is assumed to be Slack's; another app casting a
# screen at the same time (OBS, KRDP) can win instead.
set -uo pipefail
run=${XDG_RUNTIME_DIR:-/tmp}/slack-draw-hook
mkdir -p "$run"
log() { echo "$(date +%T) $*" >>"$run/log"; }
here=$(dirname "$(readlink -f "$0")")
qdbus=$(command -v qdbus6 || command -v qdbus) || { log "qdbus6 not found"; exit 0; }
log "$* slack: x=${SLACK_DRAW_X:-} y=${SLACK_DRAW_Y:-} w=${SLACK_DRAW_WIDTH:-} h=${SLACK_DRAW_HEIGHT:-}"

shared_output() {
	pw-dump 2>/dev/null | jq -r '
		[.[] | select(.type == "PipeWire:Interface:Node")
		 | {id, name: (.info.props["node.name"] // "")}
		 | select(.name | startswith("kwin-screencast-"))]
		| max_by(.id) | .name // empty | ltrimstr("kwin-screencast-")'
}

# (Re)load the KWin script with the overlay's target: an output name, or "" for Slack's bounds.
load() {
	local js=$run/kwin-slack-huddle.js id
	jq -nr --arg output "$1" \
		--argjson x "${SLACK_DRAW_X:-0}" --argjson y "${SLACK_DRAW_Y:-0}" \
		--argjson width "${SLACK_DRAW_WIDTH:-0}" --argjson height "${SLACK_DRAW_HEIGHT:-0}" \
		'"const TARGET = \({$output, $x, $y, $width, $height} | tojson)"' >"$js"
	cat "$here/kwin-slack-huddle.js" >>"$js"
	"$qdbus" org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript slack-huddle >/dev/null
	id=$("$qdbus" org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript "$js" slack-huddle) &&
		"$qdbus" org.kde.KWin "/Scripting/Script$id" org.kde.kwin.Script.run
	log "  loaded KWin script $id, output='${1}'"
}

exec 9>"$run/lock"
case ${1:-} in
close)
	flock 9
	rm -f "$run/poller"
	"$qdbus" org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript slack-huddle >/dev/null
	log "  unloaded KWin script"
	;;
create | bounds | show | picked)
	flock 9
	out=$(shared_output)
	load "$out"
	[ -n "$out" ] && exit 0
	# No share yet: wait up to 60s for one. Only the newest poller keeps going.
	echo $$ >"$run/poller"
	flock -u 9
	for _ in $(seq 60); do
		sleep 1
		[ "$(cat "$run/poller" 2>/dev/null)" = $$ ] || exit 0
		out=$(shared_output)
		[ -n "$out" ] || continue
		flock 9
		[ "$(cat "$run/poller" 2>/dev/null)" = $$ ] && load "$out" && rm -f "$run/poller"
		exit 0
	done
	;;
esac
exit 0
