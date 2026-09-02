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
# This config uses $from_cloudflare, which is declared by a geo block in
# cf-allow.conf. If whatever includes that file is ever disabled, nginx
# refuses to START — taking every site on this box down, not just this one.
#
# Test the LOADED config, not the filesystem. Two earlier predicates were
# wrong in opposite directions:
#
#   grep -r  ... sites-enabled/   — false NEGATIVE. Everything in that
#     directory is a symlink, and grep -r does not follow symlinks while
#     recursing. Use -R, or do not grep at all.
#
#   grep for the string "cf-allow.conf" — false POSITIVE. Five site files
#     merely mention it in a comment, and this config is about to become a
#     sixth, so the check would eventually pass by matching itself.
#
# `nginx -T` dumps the fully assembled config, so the geo block either is
# there or it is not. That is the thing that actually has to be true.
if ! nginx -T 2>/dev/null | grep -qE 'geo[[:space:]].*\$from_cloudflare'; then
  echo "REFUSING: \$from_cloudflare is not declared in the assembled config."
  echo "Something must 'include /etc/nginx/cf-allow.conf;' before nginx will start."
  exit 1
fi

echo "    \$from_cloudflare is declared. Provided by:"
grep -RHn '^[[:space:]]*include[[:space:]].*cf-allow\.conf' /etc/nginx/sites-enabled/ \
  | sed 's/^/      /'
echo "    (disabling that site breaks every site that uses the variable)"

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
