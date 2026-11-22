#!/bin/sh
# 로컬 프리뷰 서버를 띄우고, 실제 Chromium 으로 앱을 검증한 뒤 서버를 종료합니다.
set -e
cd "$(dirname "$0")/.."
export PATH=/workspace/work/node-v22.14.0-linux-x64/bin:$PATH
export LD_LIBRARY_PATH=/workspace/work/syslibs/root/usr/lib/x86_64-linux-gnu
export PLAYWRIGHT_BROWSERS_PATH=/workspace/work/pw-browsers

/workspace/work/node-v22.14.0-linux-x64/bin/node ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort > /tmp/preview.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT INT TERM

for i in $(seq 1 40); do
  if /workspace/work/node-v22.14.0-linux-x64/bin/node -e "fetch('http://127.0.0.1:4173/').then(r=>{if(r.ok)process.exit(0)}).catch(()=>process.exit(1))" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

node "$@"
