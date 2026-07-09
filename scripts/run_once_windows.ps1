# 在项目根目录运行：powershell -ExecutionPolicy Bypass -File .\scripts\run_once_windows.ps1
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -e .
telecom-radar run-once --print
