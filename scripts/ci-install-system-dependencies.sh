#!/usr/bin/env bash
set -euo pipefail

packages=(
  libwebkit2gtk-4.1-dev
  libappindicator3-dev
  librsvg2-dev
  patchelf
  libspeechd-dev
  libasound2-dev
  libssl-dev
  pkg-config
  clang
  libclang-dev
  "$@"
)
missing=()

for package in "${packages[@]}"; do
  status="$(dpkg-query -W -f='${db:Status-Abbrev}' "$package" 2>/dev/null || true)"
  [[ "$status" == "ii " ]] || missing+=("$package")
done

if ((${#missing[@]} == 0)); then
  echo "System dependencies already installed; apt not invoked."
  exit 0
fi

# vm103 is a persistent host shared by 17 repository runners. An ordinary
# `apt-get install` upgrades already-installed packages; needrestart then
# daemon-reexecs systemd and kills unrelated active jobs (NixOS#2024).
sudo env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l \
  apt-get update
sudo env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l \
  apt-get install -y --no-install-recommends --no-upgrade "${missing[@]}"
