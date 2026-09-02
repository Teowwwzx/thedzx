#!/usr/bin/env bash
#
# Install the apex server block. Run this ONCE, and again only when
# deploy/nginx-thedzx.site.conf changes.
#
#   ./deploy/install-nginx.sh
#
# Kept out of deploy.sh on purpose: a content deploy is routine and safe, an
# nginx config change on a box running eleven other services is neither.
set -euo pipefail

HOST="${DEPLOY_HOST:-do-ghost-dev}"
cd "$(dirname "$0")/.."

echo "==> preflight"
ssh "$HOST" 'bash -seuo pipefail' <<'PRE'
# The config uses $from_cloudflare, which is declared in cf-allow.conf and
# included by comments.thedzx.site. If that site is ever disabled, nginx
# refuses to START — taking every site on this box down, not just this one.
if ! grep -rqls 'cf-allow.conf' /etc/nginx/sites-enabled/; then
  echo "REFUSING: nothing in sites-enabled includes cf-allow.conf, so"
  echo "\$from_cloudflare would be undefined and nginx would fail to start."
  exit 1
fi
grep -rls 'cf-allow.conf' /etc/nginx/sites-enabled/ | sed 's/^/    declared by: /'
test -f /etc/nginx/ssl/thedzx-origin.pem || { echo "REFUSING: origin cert missing"; exit 1; }
mkdir -p /var/www/thedzx.site
PRE

echo "==> back up the current block"
ssh "$HOST" "cp -a /etc/nginx/sites-available/thedzx.site \
  /root/thedzx.site.backup-\$(date -u +%Y%m%d-%H%M%S)"

echo "==> upload"
scp -q deploy/nginx-thedzx.site.conf "$HOST:/tmp/thedzx-candidate.conf"

echo "==> test, then reload only if the test passes"
ssh "$HOST" 'bash -seuo pipefail' <<'APPLY'
backup="$(ls -1t /root/thedzx.site.backup-* | head -1)"
cp /tmp/thedzx-candidate.conf /etc/nginx/sites-available/thedzx.site
if nginx -t; then
  systemctl reload nginx
  echo "    reloaded"
else
  echo "    nginx -t FAILED — restoring $backup, nothing was reloaded"
  cp "$backup" /etc/nginx/sites-available/thedzx.site
  exit 1
fi
rm -f /tmp/thedzx-candidate.conf
APPLY

echo "==> verify the security headers survived (the classic add_header trap)"
for p in / /room/ /world/ /world.json; do
  printf '    %-14s ' "$p"
  curl -sI "https://thedzx.site$p" \
    | grep -ciE 'x-content-type-options|referrer-policy|x-frame-options' \
    | xargs -I{} echo "{}/3 security headers"
done
