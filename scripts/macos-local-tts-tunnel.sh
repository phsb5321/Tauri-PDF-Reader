#!/bin/bash
set -euo pipefail

label=com.lectrice.local-tts-tunnel
plist="$HOME/Library/LaunchAgents/$label.plist"
log_dir="$HOME/Library/Logs/Lectrice"
ssh_host="${LECTRICE_TTS_SSH_HOST:-desktop}"
domain="gui/$(id -u)"

status() {
  /bin/launchctl print "$domain/$label" >/dev/null
  curl --max-time 2 -fsS http://127.0.0.1:5301/health |
    jq -e '.ready == true and (.version | type == "string")'
}

install() {
  [ "$(uname -s)" = Darwin ]
  mkdir -p "$HOME/Library/LaunchAgents" "$log_dir"
  ssh -o BatchMode=yes -o PasswordAuthentication=no \
    -o KbdInteractiveAuthentication=no -o ConnectTimeout=5 "$ssh_host" true
  if [ -e "$plist" ]; then
    echo "Tunnel plist already exists: $plist" >&2
    exit 1
  fi
  if lsof -nP -iTCP:5301 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "127.0.0.1:5301 is already in use" >&2
    exit 1
  fi
  cat >"$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key><array>
    <string>/usr/bin/ssh</string><string>-N</string><string>-T</string>
    <string>-o</string><string>BatchMode=yes</string>
    <string>-o</string><string>PasswordAuthentication=no</string>
    <string>-o</string><string>KbdInteractiveAuthentication=no</string>
    <string>-o</string><string>ExitOnForwardFailure=yes</string>
    <string>-o</string><string>ServerAliveInterval=15</string>
    <string>-o</string><string>ServerAliveCountMax=3</string>
    <string>-L</string><string>127.0.0.1:5301:127.0.0.1:5301</string>
    <string>$ssh_host</string>
  </array>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>StandardOutPath</key><string>$log_dir/local-tts-tunnel.stdout.log</string>
  <key>StandardErrorPath</key><string>$log_dir/local-tts-tunnel.stderr.log</string>
</dict></plist>
PLIST
  /usr/bin/plutil -lint "$plist"
  /bin/launchctl bootstrap "$domain" "$plist"
  for _ in $(seq 1 40); do
    status >/dev/null 2>&1 && { status; return; }
    sleep 0.25
  done
  echo "Tunnel launched but health did not become ready" >&2
  exit 1
}

remove() {
  /bin/launchctl bootout "$domain/$label" 2>/dev/null || true
  rm -f "$plist"
}

case "${1:-status}" in
  install) install ;;
  status) status ;;
  remove) remove ;;
  *) echo "usage: $0 {install|status|remove}" >&2; exit 2 ;;
esac
