#!/usr/bin/env bash
# Apply patches/*.mjs (all, or --only a selection) to a pinned Slack install's app.asar.
# Always patches from app.asar.orig, so re-running is idempotent; --restore puts the original back.
set -euo pipefail

PINNED_VERSION=41.2.2
PINNED_SHA256=e48160665ddf4ecde093ea0185e9e62ca7675dddb6b4e923308c5d376441423c
ASAR_VERSION=4.3.1
HERE=$(cd "$(dirname "$0")" && pwd)

log() { printf '==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<EOF
usage: $0 [--only LIST] [--restore] [--list] [SLACK_DIR]
  SLACK_DIR    Slack install dir (default /usr/lib/slack). Needs write access (sudo for /usr/lib).
  --only LIST  apply only these patches, comma-separated by number or name (e.g. 0001,0003).
               Default: every patch in patches/.
  --list       list the patches and exit
  --restore    put the original app.asar back
EOF
}

list() {
  for f in "$HERE"/patches/*.mjs; do
    printf '%-40s %s\n' "$(basename "$f" .mjs)" "$(sed -n '1s#^// ##p' "$f")"
  done
}

restore=0 only=""
while (( $# )); do
  case $1 in
    -h|--help) usage; exit 0 ;;
    --list) list; exit 0 ;;
    --restore) restore=1 ;;
    --only) [[ -n ${2:-} ]] || die "--only needs a list, e.g. --only 0001,0003"; only=$2; shift ;;
    -*) usage >&2; die "unknown option $1" ;;
    *) break ;;
  esac
  shift
done

patches=("$HERE"/patches/*.mjs)
if [[ -n $only ]]; then
  patches=()
  IFS=, read -ra wanted <<<"$only"
  for w in "${wanted[@]}"; do
    matches=("$HERE"/patches/"$w"*.mjs)
    [[ -f ${matches[0]} ]] || die "no patch matches '$w' (see --list)"
    (( ${#matches[@]} == 1 )) || die "'$w' matches more than one patch (see --list)"
    patches+=("${matches[0]}")
  done
  # Apply in numeric order whatever order LIST is in.
  mapfile -t patches < <(printf '%s\n' "${patches[@]}" | sort -u)
fi

dir=${1:-/usr/lib/slack}
res=$dir/resources
[[ -f $res/app.asar ]] || die "no app.asar in $res"
[[ -w $res ]] || die "$res is not writable (try sudo)"

if (( restore )); then
  [[ -f $res/app.asar.orig ]] || die "no app.asar.orig to restore"
  log "restoring original app.asar"
  mv -f "$res/app.asar.orig" "$res/app.asar"
  exit 0
fi

version=$(cat "$dir/version")
[[ $version == "$PINNED_VERSION" ]] || die "Slack $version, patches are pinned to $PINNED_VERSION"
[[ -f $res/app.asar.orig ]] || { log "backing up app.asar -> app.asar.orig"; cp -a "$res/app.asar" "$res/app.asar.orig"; }
sha=$(sha256sum "$res/app.asar.orig" | cut -d' ' -f1)
[[ $sha == "$PINNED_SHA256" ]] || die "app.asar.orig sha256 $sha does not match pinned $PINNED_SHA256"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
# Not npx: npx mangles brace globs passed to --unpack.
log "installing @electron/asar@$ASAR_VERSION"
npm install --silent --no-audit --no-fund --prefix "$work/tools" "@electron/asar@$ASAR_VERSION" >/dev/null
ASAR=("$work/tools/node_modules/.bin/asar")
log "extracting app.asar"
# asar reads unpacked files from "<archive>.unpacked", so give the backup that name.
mkdir "$work/src"
ln -s "$res/app.asar.orig" "$work/src/app.asar"
ln -s "$res/app.asar.unpacked" "$work/src/app.asar.unpacked"
"${ASAR[@]}" extract "$work/src/app.asar" "$work/app"
"${ASAR[@]}" list --is-pack "$work/src/app.asar" | sed -n 's/^unpack : //p' | sort > "$work/unpack.orig"

log "applying patches"
node "$HERE/lib/edit.mjs" "$work/app" "${patches[@]}"
for f in "$work"/app/dist/{main.bundle.cjs,preload.bundle.js}; do node --check "$f" || die "patched $f does not parse"; done

log "repacking"
glob="{$(sed "s|^|$work/app|" "$work/unpack.orig" | paste -sd,)}"
"${ASAR[@]}" pack --unpack "$glob" "$work/app" "$work/app.asar"
"${ASAR[@]}" list --is-pack "$work/app.asar" | sed -n 's/^unpack : //p' | sort | cmp -s - "$work/unpack.orig" \
  || die "repacked asar's unpacked file set differs from the original"

# The unpacked files are unchanged, so only app.asar is swapped.
install -m 644 "$work/app.asar" "$res/app.asar.new"
mv -f "$res/app.asar.new" "$res/app.asar"
log "patched $res/app.asar (restart Slack)"
