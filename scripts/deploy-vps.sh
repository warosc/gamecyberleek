#!/bin/sh
# Uploads a packed release to the VPS and installs it.
#
#   scripts/deploy-vps.sh user@host [release/leek-ops-<sha>.tgz]
#
# Needs SSH access (key or password prompt) and Docker on the server. Each release lands in
# /opt/leek-ops/releases/<name>/ and /opt/leek-ops/current points at the live one; older
# releases stay on disk for rollback (ssh in and run their vps-install.sh).
set -eu
target=${1:?usage: scripts/deploy-vps.sh user@host [archive]}
archive=${2:-$(ls -t release/leek-ops-*.tgz 2>/dev/null | head -n 1)}
[ -f "$archive" ] || { echo "No release archive; run: node scripts/release.mjs" >&2; exit 1; }
name=$(basename "$archive" .tgz)
remote=/opt/leek-ops

echo "Uploading $archive to $target"
ssh "$target" "mkdir -p $remote/releases/$name"
scp "$archive" "$target:$remote/releases/$name.tgz"
ssh "$target" "set -e
  tar -xzf $remote/releases/$name.tgz -C $remote/releases/$name
  rm $remote/releases/$name.tgz
  sh $remote/releases/$name/vps-install.sh
  ls -1dt $remote/releases/*/ | tail -n +6 | xargs -r rm -rf"
echo "Deployed $name to $target"
