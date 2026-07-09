#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -e .
cp -n .env.example .env || true
echo "安装完成。请编辑 .env 后运行：telecom-radar run-once --print"
