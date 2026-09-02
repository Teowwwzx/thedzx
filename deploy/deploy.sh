#!/usr/bin/env bash
#
# Build and publish to the droplet.
#
#   ./deploy/deploy.sh
#
# Atomic: rsync into a timestamped release directory, then flip a symlink.
# A half-finished upload is never the live site, and rolling back is one
# `ln -sfn` away.
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

# --delete keeps a release directory an exact mirror of dist/, so a file you
# removed locally does not linger on the server.
rsync -az --delete \
  --chmod=D755,F644 \
  dist/ "$HOST:$BASE/releases/$RELEASE/"

echo "==> activate"
ssh "$HOST" "
  set -e
  ln -sfn '$BASE/releases/$RELEASE' '$BASE/current.tmp'
  mv -T '$BASE/current.tmp' '$BASE/current'
  chown -R www-data:www-data '$BASE/releases/$RELEASE'
  ls -1dt '$BASE'/releases/*/ | tail -n +\$(( $KEEP + 1 )) | xargs -r rm -rf
  nginx -t && systemctl reload nginx
"

echo "==> live: https://thedzx.site/"
echo "    Cloudflare sits in front — purge its cache if HTML looks stale."
