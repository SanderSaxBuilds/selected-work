#!/usr/bin/env bash
# Local control for the sample instance: start, stop, deploy.
# deploy = stop n8n, import the generated workflows, publish them, start n8n.
B="$(cd "$(dirname "$0")/.." && pwd)"
cd "$B" || exit 1
export B
. ./n8n-env.sh
N="node node_modules/n8n/bin/n8n"

pid_on() { netstat -ano | grep -E "127\.0\.0\.1:$1 .*LISTENING" | awk '{print $NF}' | head -1; }

stop_n8n() {
  p=$(pid_on 5678)
  if [ -n "$p" ]; then
    taskkill //PID "$p" //T //F >/dev/null 2>&1
    for i in 1 2 3 4 5 6 7 8; do [ -z "$(pid_on 5678)" ] && break; ping -n 2 127.0.0.1 >/dev/null; done
  fi
  echo "n8n stopped"
}

start_n8n() {
  nohup $N start > n8n.log 2>&1 &
  for i in $(seq 1 40); do
    curl -s -m 2 http://127.0.0.1:5678/healthz/readiness 2>/dev/null | grep -q ok && { echo "n8n ready"; return 0; }
    ping -n 2 127.0.0.1 >/dev/null
  done
  echo "n8n NOT ready"; tail -20 n8n.log; return 1
}

start_mock() {
  [ -n "$(pid_on 4010)" ] && { echo "mock already up"; return 0; }
  nohup node mock/server.mjs > mock.log 2>&1 &
  ping -n 2 127.0.0.1 >/dev/null
  echo "mock started"
}

stop_mock() {
  p=$(pid_on 4010)
  [ -n "$p" ] && taskkill //PID "$p" //T //F >/dev/null 2>&1
  echo "mock stopped"
}

case "$1" in
  start) start_mock; start_n8n ;;
  stop) stop_n8n; stop_mock ;;
  restart-n8n) stop_n8n; start_n8n ;;
  restart-mock) stop_mock; start_mock ;;
  deploy)
    node scripts/build-workflows.mjs >/dev/null || exit 1
    stop_n8n
    for f in deadLetter error replay main; do
      $N import:workflow --input="workflows/source/$f.json" 2>&1 | grep -E -i 'imported|error' | tail -1
    done
    for id in leadIntakeDLQ001 leadIntakeErr001 leadIntakeRpl001 leadIntakeMain01; do
      $N publish:workflow --id="$id" 2>&1 | grep -E -i 'published|error|note' | tail -1
    done
    start_n8n
    ;;
esac
