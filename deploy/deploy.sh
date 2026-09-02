#!/usr/bin/env bash
#
# Build and publish to the droplet.
#
#   ./deploy/deploy.sh
#
# Atomic: rsync into a timestamped release directory, then flip a symlink. A
# half-finished upload is never the live site, and rolling back is one
# `ln -sfn` away.
#
# This script does NOT touch nginx. Installing the server block is a separate,
# rarer, riskier operation — see deploy/install-nginx.sh. A symlink flip needs
# no reload: nginx resolves `root` per request, so the new release is live the
# moment the symlink moves. Reloading here would also couple every deploy to
# the config state of the eleven other sites on this shared box.
set -euo pipefail

HOST="${DEPLOY_HOST:-do-ghost-dev}"
BASE="${DEPLOY_BASE:-/var/www/thedzx.site}"
KEEP="${DEPLOY_KEEP:-5}"

cd "$(dirname "$0")/.."

echo "==> build"
npm run build
npm run budget

RELEASE="$(date -u +%Y%m%d-%H%M%S)"
echo "==> upload release $RELEASE"

ssh "$HOST" "mkdir -p '$BASE/releases/$RELEASE'"

# --delete keeps the release an exact mirror of dist/, so a file removed
# locally cannot linger on the server.
rsync -az --delete \
  --chmod=D755,F644 \
  dist/ "$HOST:$BASE/releases/$RELEASE/"

echo "==> activate"

# The remote block is single-quoted so it is expanded ONLY on the server,
# except for the few values interpolated below via a heredoc-free assignment.
ssh "$HOST" \
  RELEASE="$RELEASE" BASE="$BASE" KEEP="$KEEP" \
  'bash -seuo pipefail' <<'REMOTE'
current="$BASE/current"

# First deploy: `current` may be a real directory (the server was set up
# before this script existed). rename(2) returns EISDIR when the destination
# is a directory and the source is not, so mv -T would fail and abort the
# deploy after the upload. Move it aside rather than delete it — it is not
# ours to throw away.
if [ -e "$current" ] && [ ! -L "$current" ]; then
  echo "    current is not a symlink; moving it aside"
  mv "$current" "$current.pre-deploy-$RELEASE"
fi

ln -sfn "$BASE/releases/$RELEASE" "$current.tmp"
mv -T "$current.tmp" "$current"

# nginx only ever reads these.
chmod -R a+rX "$BASE/releases/$RELEASE"

# Prune old releases, never the live one. Resolve the symlink first: sorting
# by mtime alone can put the active release in the tail and delete it, which
# leaves a dangling symlink and takes the whole site down.
live="$(readlink -f "$current")"
ls -1d "$BASE"/releases/*/ 2>/dev/null \
  | sed 's#/$##' \
  | while read -r dir; do printf '%s\t%s\n' "$(stat -c %Y "$dir")" "$dir"; done \
  | sort -rn | cut -f2 \
  | tail -n "+$((KEEP + 1))" \
  | while read -r old; do
      if [ "$(readlink -f "$old")" = "$live" ]; then
        echo "    skipping $old — it is the live release"
      else
        rm -rf "$old"
      fi
    done

echo "    live release: $(readlink "$current")"
REMOTE

echo "==> done: https://thedzx.site/"
echo "    Cloudflare sits in front — purge its cache if HTML looks stale."
