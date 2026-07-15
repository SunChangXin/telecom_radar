# Telecom Radar：通信前沿自动情报系统

这是一个面向通信工程学生/研究者的小工具，用来自动抓取：

- arXiv 最新通信/信号处理/网络论文；
- 3GPP、ITU、IEEE ComSoc、Ericsson 等页面动态；
- GitHub 上与 5G/6G/O-RAN/SDR/RIS/NTN 相关的开源项目；
- 然后按关键词评分、SQLite 去重、生成中文 Markdown 摘要，并推送到手机。

默认不用任何 API key 也能运行；如果你配置了 OpenAI API key，会自动使用 LLM 生成更好的中文摘要。

---

## 1. 项目结构

```text
telecom-radar/
├─ telecom_radar/
│  ├─ cli.py              # 命令行入口
│  ├─ config.py           # 环境变量和配置读取
│  ├─ sources.py          # arXiv / GitHub / RSS / HTML 抓取
│  ├─ scoring.py          # 关键词评分
│  ├─ summarizer.py       # 规则摘要 + OpenAI Responses API 摘要
│  ├─ notifier.py         # ntfy / Server酱 / Webhook 推送
│  ├─ store.py            # SQLite 去重和推送状态
│  └─ models.py
├─ config/
│  └─ config.example.json # 关键词和数据源配置
├─ scripts/
│  ├─ install_linux.sh
│  ├─ run_once_windows.ps1
│  └─ telecom-radar.cron.example
├─ data/                  # 运行后生成数据库和报告
├─ .env.example
├─ Dockerfile
├─ docker-compose.yml
├─ requirements.txt
└─ PROMPT_FOR_CODEX.md    # 可以直接复制给 Codex 的部署任务
```

---

## 2. 最快运行：本地 Python

### Windows PowerShell

```powershell
cd telecom-radar
copy .env.example .env
notepad .env
powershell -ExecutionPolicy Bypass -File .\scripts\run_once_windows.ps1
```

### Linux / macOS

```bash
cd telecom-radar
bash scripts/install_linux.sh
nano .env
telecom-radar run-once --print
```

---

## 3. 推荐部署：Docker Compose

```bash
cd telecom-radar
cp .env.example .env
nano .env

docker compose up -d --build

docker logs -f telecom-radar
```

默认每 6 小时运行一次。想改频率，修改 `docker-compose.yml` 里的：

```yaml
command: ["telecom-radar", "daemon", "--interval", "21600"]
```

`21600` 秒 = 6 小时。程序内部限制最低 3600 秒，避免对公共接口请求太频繁。

---

## 4. 手机推送配置

至少选一种。

### 方案 A：ntfy，安卓推荐

1. 手机上安装 ntfy App。
2. 生成一个足够随机的 topic，例如：`telecom-radar-你的随机字符串`。
3. 在手机 App 中订阅这个 topic。
4. 在 `.env` 中填写：

```env
NTFY_SERVER=https://ntfy.sh
NTFY_TOPIC=telecom-radar-你的随机字符串
```

测试：

```bash
telecom-radar run-once --print
```

### 方案 B：Server酱 / ServerChan，微信推送推荐

如果你有 Server酱 SendKey：

```env
SCT_SENDKEY=你的SendKey
```

如果你用 Server酱3，并且后台给了完整 API URL：

```env
SERVERCHAN_URL=https://<uid>.push.ft07.com/send/<sendkey>.send
```

### 方案 C：通用 Webhook

如果你有自己的推送服务、飞书/企业微信机器人转发器等：

```env
WEBHOOK_URL=https://example.com/webhook
```

POST JSON 格式：

```json
{
  "title": "通信前沿雷达：N 条新动态",
  "text": "Markdown 摘要",
  "items": []
}
```

---

## 5. 可选：LLM 中文摘要

不配置也能跑；配置后摘要质量更高。

```env
OPENAI_API_KEY=你的key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

如果 API 调用失败，程序会自动降级为规则摘要，不会中断抓取和推送。

---

## 6. 可选：GitHub Token

不配置也能抓公开仓库，但容易遇到频率限制。建议创建 GitHub fine-grained token，只需要公开搜索读取权限即可。

```env
GITHUB_TOKEN=你的token
```

---

## 7. 修改关注方向

编辑：

```text
config/config.example.json
```

常改的地方：

### 关键词

```json
"keywords": [
  "6G",
  "NTN",
  "ISAC",
  "RIS",
  "O-RAN",
  "cell-free massive MIMO"
]
```

### arXiv 查询

```json
"arxiv": {
  "queries": [
    "cat:eess.SP OR cat:cs.IT OR cat:cs.NI",
    "all:6G OR all:IMT-2030 OR all:NTN OR all:ISAC OR all:RIS"
  ]
}
```

### GitHub 查询

```json
"github": {
  "queries": [
    "srsran OR openairinterface OR O-RAN OR OpenRAN language:Python",
    "6G OR 5G NR OR SDR language:C++"
  ]
}
```

---

## 8. 常用命令

### 本地网页

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run_web_windows.ps1
```

浏览器访问 `http://127.0.0.1:8765`。网页只读访问 `data/radar.sqlite3`，不会修改去重和推送状态。

网页按技术领域归档，同时保留来源筛选。领域规则位于 `config/domains.json`；每个领域包含名称和关键词列表。内容可命中多个关联领域，但只使用匹配度最高的主领域进行数量统计。

网页还按论文、标准组织、产业资讯和开源项目分区。英文论文摘要不会直接展示；未配置 OpenAI API 时显示基于领域和标签生成的中文导读，配置 API 后可进一步扩展为模型生成的逐篇中文摘要。网站来源包含 3GPP、ITU、ETSI、O-RAN Alliance、6G-IA、Next G Alliance、GSMA、IEEE ComSoc、Ericsson 和 Nokia Bell Labs 等官方入口。

### Vercel + Supabase 云端部署

当前项目已支持 Vercel + Supabase 云端部署：Vercel 展示网页并通过 Cron 每 6 小时调用 `/api/radar`，抓取结果写入 Supabase，网页再从 Supabase 读取最新数据。这样电脑关机也不影响网页访问和定时更新。

完整步骤见：

```text
docs/VERCEL_SUPABASE_DEPLOY.md
```

最短流程：

```powershell
Set-Location "F:\通信前沿自动情报系统\telecom_radar"
npm install
npm run build
```

然后把代码推送到 GitHub，并在 Vercel 导入该仓库。Vercel 环境变量至少需要：

```env
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role key
```

推送推荐配置：

```env
NTFY_SERVER=https://ntfy.sh
NTFY_TOPIC=你的 ntfy topic
```

GitHub 抓取如果遇到 403，配置：

```env
GITHUB_TOKEN=你的 GitHub token
```

IEEE Xplore API 申请通过后，配置：

```env
IEEE_API_KEY=你的 IEEE Xplore Metadata Search API Key
```

云端版只使用 IEEE Metadata Search API 抓取论文元数据、摘要和 IEEE Xplore 链接，不下载或分发全文。

手动运行一次并打印：

```bash
telecom-radar run-once --print
```

只生成报告，不推送：

```bash
telecom-radar run-once --print --no-notify
```

常驻运行，每 6 小时一次：

```bash
telecom-radar daemon --interval 21600
```

显示当前配置：

```bash
telecom-radar show-config
```

查看 Docker 日志：

```bash
docker logs -f telecom-radar
```

关闭 Docker 服务：

```bash
docker compose down
```

---

## 9. 数据和去重逻辑

- SQLite 数据库：`data/radar.sqlite3`
- Markdown 报告：`data/reports/`
- 每条内容用 URL 生成稳定 ID。
- 已经推送过的内容不会重复推送。
- 不要随便删除 SQLite 数据库，否则旧内容会被当成新内容重新推送。

---

## 10. 建议你每天怎么看

推送来了以后，不要所有都精读。建议按这个顺序：

1. 3GPP / ITU / 工业报告：判断方向是不是标准/产业真正在推进。
2. arXiv survey / tutorial：快速补理论。
3. arXiv 最新算法：找可以复现实验的点。
4. GitHub 项目：看有没有代码、数据集、SDR/OAI/srsRAN 工程价值。

---

## 11. 免责声明

这是个人技术情报工具，不是官方数据库。抓取页面的 HTML 结构可能变化；如果某个源失效，直接在 `config/config.example.json` 里关闭或替换即可。
