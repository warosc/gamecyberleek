#!/bin/sh
# Uploads a packed release to the VPS and installs it.
#
#   scripts/deploy-vps.sh user@host [release/leek-ops-<sha>.tgz]
#   SSH_KEY=~/.ssh/leek_ops_deploy scripts/deploy-vps.sh debian@66.70.188.137
#
# Needs SSH access and Docker for the remote user (no sudo). Each release lands in
# ~/leek-ops-releases/<name>/ and ~/leek-ops-releases/current points at the live one; the last
# five releases stay on disk for rollback (ssh in and run their vps-install.sh).
set -eu
target=${1:?usage: scripts/deploy-vps.sh user@host [archive]}
archive=${2:-$(ls -t release/leek-ops-*.tgz 2>/dev/null | head -n 1)}
[ -f "$archive" ] || { echo "No release archive; run: node scripts/release.mjs" >&2; exit 1; }
name=$(basename "$archive" .tgz)
remote=leek-ops-releases
ssh_opts=${SSH_KEY:+-i $SSH_KEY -o IdentitiesOnly=yes}

echo "Uploading $archive to $target"
ssh $ssh_opts "$target" "mkdir -p $remote/releases/$name"
scp $ssh_opts "$archive" "$target:$remote/releases/$name.tgz"
ssh $ssh_opts "$target" "set -e
  tar -xzf $remote/releases/$name.tgz -C $remote/releases/$name
  rm $remote/releases/$name.tgz
  sh $remote/releases/$name/vps-install.sh
  ls -1dt $remote/releases/*/ | tail -n +6 | xargs -r rm -rf"
echo "Deployed $name to $target"
