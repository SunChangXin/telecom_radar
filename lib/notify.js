function utf8Header(value) {
  return `=?UTF-8?B?${Buffer.from(String(value), "utf8").toString("base64")}?=`;
}

function truncateForNtfy(value, maxBytes = 3600) {
  const text = String(value || "");
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  let result = "";
  for (const char of text) {
    const next = result + char;
    if (Buffer.byteLength(next, "utf8") > maxBytes) break;
    result = next;
  }
  return `${result}\n\n……内容较多，打开网页查看完整列表。`;
}

function markdownForItems(items) {
  return items
    .slice(0, Number(process.env.MAX_ITEMS_PER_RUN || 12))
    .map((item, index) => `${index + 1}. [${item.title}](${item.url})\n   ${item.zh_summary || ""}`)
    .join("\n\n");
}

export async function notifyNewItems(items) {
  const selected = items
    .filter((item) => Number(item.score || 0) >= Number(process.env.MIN_SCORE_TO_NOTIFY || 2))
    .slice(0, Number(process.env.MAX_ITEMS_PER_RUN || 12));
  if (!selected.length) return { sent: false, count: 0 };

  const title = `通信前沿雷达：${selected.length} 条新动态`;
  const text = markdownForItems(selected);

  if (process.env.NTFY_TOPIC) {
    const server = (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, "");
    const response = await fetch(`${server}/${process.env.NTFY_TOPIC}`, {
      method: "POST",
      headers: {
        Title: utf8Header(title),
        Tags: "satellite,radio",
        Markdown: "yes"
      },
      body: truncateForNtfy(text)
    });
    if (!response.ok) throw new Error(`ntfy ${response.status}: ${await response.text()}`);
    return { sent: true, count: selected.length, channel: "ntfy", ids: selected.map((item) => item.id) };
  }

  const serverchanUrl = process.env.SERVERCHAN_URL || (
    process.env.SCT_SENDKEY ? `https://sctapi.ftqq.com/${process.env.SCT_SENDKEY}.send` : ""
  );
  if (serverchanUrl) {
    const body = new URLSearchParams({ title, desp: text });
    const response = await fetch(serverchanUrl, { method: "POST", body });
    if (!response.ok) throw new Error(`ServerChan ${response.status}: ${await response.text()}`);
    return { sent: true, count: selected.length, channel: "serverchan", ids: selected.map((item) => item.id) };
  }

  if (process.env.WEBHOOK_URL) {
    const response = await fetch(process.env.WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, text, items: selected })
    });
    if (!response.ok) throw new Error(`Webhook ${response.status}: ${await response.text()}`);
    return { sent: true, count: selected.length, channel: "webhook", ids: selected.map((item) => item.id) };
  }

  return { sent: false, count: selected.length, reason: "no notifier configured" };
}
