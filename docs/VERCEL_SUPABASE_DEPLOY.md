# 通信前沿雷达：Vercel + Supabase 云端部署

这个方案会让网页和定时抓取运行在云端：

```text
Vercel 网页
→ Vercel Cron 每 6 小时访问 /api/radar
→ 抓取 arXiv / GitHub / 标准组织和产业网站
→ 写入 Supabase
→ 页面从 Supabase 读取数据
→ ntfy / Server酱 / Webhook 推送手机
```

## 1. 创建 Supabase 数据库

1. 打开 https://supabase.com/
2. 创建一个新 Project。
3. 进入 `SQL Editor`。
4. 粘贴并运行项目里的 SQL：

```text
supabase/schema.sql
```

## 2. 准备环境变量

在 Supabase：

- `Project Settings` → `API`
- 复制 `Project URL`
- 复制 `service_role` key

在 Vercel 项目：

- `Settings` → `Environment Variables`

至少添加：

```env
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 service_role key
```

建议添加：

```env
GITHUB_TOKEN=你的 GitHub token，可选但推荐
NTFY_SERVER=https://ntfy.sh
NTFY_TOPIC=你的 ntfy topic
```

如果你用微信 Server酱，则改用：

```env
SCT_SENDKEY=你的 Server酱 SendKey
```

或：

```env
SERVERCHAN_URL=你的完整 Server酱 URL
```

## 3. 本地构建检查

```powershell
Set-Location "F:\通信前沿自动情报系统\telecom_radar"
npm install
npm run build
```

如果构建成功，就可以推送到 GitHub。

## 4. 推送到 GitHub

如果还没有初始化 Git：

```powershell
git init
git add .
git commit -m "Launch telecom radar cloud"
git branch -M main
git remote add origin 你的 GitHub 仓库地址
git push -u origin main
```

以后每次修改：

```powershell
git add .
git commit -m "Update telecom radar"
git push origin main
```

## 5. Vercel 导入项目

1. 登录 https://vercel.com/
2. `Add New` → `Project`
3. 选择你的 GitHub 仓库
4. Framework Preset 选择或保持 `Next.js`
5. Build Command 保持 `npm run build`
6. 点击 `Deploy`

## 6. 首次抓取

部署成功后，访问：

```text
https://你的域名.vercel.app/api/radar
```

如果你没有配置 `CRON_SECRET`，直接在浏览器打开即可。`CRON_SECRET` 只建议在你不用 Vercel Cron、改用自己的外部调度器时启用；启用后手动测试可以用 PowerShell：

```powershell
Invoke-RestMethod "https://你的域名.vercel.app/api/radar" -Headers @{ Authorization = "Bearer 你的CRON_SECRET" }
```

成功后再打开首页：

```text
https://你的域名.vercel.app/
```

## 7. 自动更新

项目根目录的 `vercel.json` 已配置：

```json
{
  "crons": [
    {
      "path": "/api/radar",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Vercel 会每 6 小时自动触发一次抓取。电脑关机也不影响。

Vercel Cron 的触发方式是对生产部署 URL 发起 HTTP GET 请求；官方说明请求会带 `vercel-cron/1.0` user-agent 和 `x-vercel-cron-schedule` 头，但不会要求你本地电脑在线。

## 8. 注意事项

- 不要把 `.env` 提交到 GitHub。
- `SUPABASE_SERVICE_ROLE_KEY` 只能放在 Vercel 环境变量里，不要写进前端代码。
- GitHub API 如果返回 403，在 Vercel 加 `GITHUB_TOKEN`。
- OpenAI API 不配置也没关系，当前云端版会使用规则中文导读。
- 如果想让摘要升级为模型生成中文摘要，后续可在 `/api/radar` 里增加 OpenAI 调用和缓存字段。
