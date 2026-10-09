#!/usr/bin/env bash
# 部署到 Oracle 主機(https://ickombat.zokiwang.cc):先 git push,主機再拉最新版並重啟
set -euo pipefail
git push origin main
ssh -i ~/.ssh/oracle_village ubuntu@161.33.37.161 \
  'cd ~/ickombat && git pull --ff-only && npm ci --omit=dev && sudo systemctl restart ickombat && systemctl is-active ickombat'
