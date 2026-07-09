# 给 Codex 的部署提示词

请你在当前机器上部署这个项目 `telecom-radar`。目标是让它每天自动抓取通信工程前沿动态，并推送到我的手机。

## 你需要完成

1. 检查系统是否有 Python 3.10+ 和 Docker。
2. 优先使用 Docker Compose 部署；如果 Docker 不可用，就使用 Python venv + cron / Windows 任务计划程序。
3. 根据 `.env.example` 创建 `.env`，不要把我的 key 打印到日志里。
4. 至少配置一种推送方式：
   - 安卓推荐 ntfy：让我提供 `NTFY_TOPIC`，或生成一个随机 topic 并提示我在手机 ntfy App 中订阅。
   - 微信推荐 Server酱：让我提供 `SCT_SENDKEY` 或 `SERVERCHAN_URL`。
5. 先执行：`telecom-radar run-once --print`，确认能抓取、生成报告。
6. 再启动常驻服务：`docker compose up -d --build`，或者配置定时任务。
7. 最后告诉我：
   - 如何查看日志；
   - 如何手动运行一次；
   - 如何修改关键词；
   - 如何关闭服务。

## 重要要求

- 不要提交 `.env`。
- 不要删除 `data/` 里的 sqlite 数据库，否则会重复推送旧消息。
- 如果 GitHub API 403，提示我配置 `GITHUB_TOKEN`。
- 如果 OpenAI API 不可用，不要中断系统，保留规则摘要 fallback。
