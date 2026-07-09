import { chineseDigest, classifyItem, contentTypeFor, loadDomainRules, loadRadarConfig, scoreItem, stableId } from "./config";

function stripHtml(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function textBetween(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return stripHtml(match?.[1] || "");
}

function linksFromHtml(html, baseUrl) {
  const links = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    try {
      const url = new URL(match[1], baseUrl);
      links.push({ url: url.href, title: stripHtml(match[2]) || url.href });
    } catch {
      // ignore malformed links
    }
  }
  return links;
}

function isRecent(dateText, daysBack) {
  if (!dateText || !daysBack) return true;
  const time = new Date(dateText).getTime();
  if (Number.isNaN(time)) return true;
  return Date.now() - time <= daysBack * 24 * 60 * 60 * 1000;
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": "telecom-radar/0.2 cloud intelligence dashboard",
      Accept: "application/atom+xml,application/rss+xml,text/html,application/json;q=0.9,*/*;q=0.8",
      ...(options.headers || {})
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function fetchArxiv(config) {
  if (!config.arxiv?.enabled) return [];
  const max = config.arxiv.max_results_per_query || 20;
  const items = [];
  for (const query of config.arxiv.queries || []) {
    const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=${max}&sortBy=submittedDate&sortOrder=descending`;
    const xml = await fetchText(url);
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
    for (const entry of entries) {
      const title = textBetween(entry, "title");
      const summary = textBetween(entry, "summary");
      const published = textBetween(entry, "published") || textBetween(entry, "updated");
      if (!isRecent(published, config.arxiv.days_back || 10)) continue;
      const idUrl = textBetween(entry, "id");
      const tags = [...entry.matchAll(/<category[^>]+term=["']([^"']+)["']/gi)].map((match) => match[1]);
      const authors = [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi)].map((match) => stripHtml(match[1]));
      items.push({ source: "arXiv", title, url: idUrl, summary, published_at: published, authors, tags });
    }
  }
  return items;
}

async function fetchGithub(config) {
  if (!config.github?.enabled) return [];
  const items = [];
  const headers = {
    Accept: "application/vnd.github+json"
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const daysBack = config.github.days_back || 30;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  for (const query of config.github.queries || []) {
    const q = `${query} pushed:>=${since}`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=${config.github.max_results_per_query || 10}`;
    const response = await fetch(url, { headers, cache: "no-store" });
    if (response.status === 403) {
      throw new Error("GitHub API 403：请在 Vercel 环境变量中配置 GITHUB_TOKEN。");
    }
    if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
    const payload = await response.json();
    for (const repo of payload.items || []) {
      items.push({
        source: "GitHub",
        title: repo.full_name,
        url: repo.html_url,
        summary: repo.description || "",
        published_at: repo.pushed_at || repo.updated_at,
        authors: [repo.owner?.login].filter(Boolean),
        tags: [repo.language, "open source", `★ ${repo.stargazers_count || 0}`].filter(Boolean)
      });
    }
  }
  return items;
}

function linkAllowed(link, feed) {
  const text = `${link.title} ${link.url}`.toLowerCase();
  const path = (() => {
    try { return new URL(link.url).pathname.toLowerCase(); } catch { return ""; }
  })();
  const include = feed.include_keywords || [];
  const exclude = feed.exclude_keywords || [];
  const pathKeywords = feed.path_keywords || [];
  if (exclude.some((keyword) => text.includes(String(keyword).toLowerCase()))) return false;
  if (pathKeywords.length && !pathKeywords.some((keyword) => path.includes(String(keyword).toLowerCase()))) return false;
  return !include.length || include.some((keyword) => text.includes(String(keyword).toLowerCase()));
}

async function fetchWebFeeds(config) {
  if (!config.rss?.enabled) return [];
  const items = [];
  for (const feed of config.rss.feeds || []) {
    const html = await fetchText(feed.url);
    const links = linksFromHtml(html, feed.url)
      .filter((link) => link.title && linkAllowed(link, feed))
      .slice(0, 20);
    for (const link of links) {
      items.push({
        source: feed.name,
        title: link.title,
        url: link.url,
        summary: `${feed.name} 页面收录的相关动态。`,
        published_at: new Date().toISOString(),
        authors: [],
        tags: []
      });
    }
  }
  return items;
}

export async function crawlRadarItems() {
  const config = loadRadarConfig();
  const rules = loadDomainRules();
  const settled = await Promise.allSettled([
    fetchArxiv(config),
    fetchGithub(config),
    fetchWebFeeds(config)
  ]);
  const errors = settled.filter((result) => result.status === "rejected").map((result) => result.reason?.message || String(result.reason));
  const raw = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const seen = new Set();
  const now = new Date().toISOString();
  const items = [];

  for (const item of raw) {
    if (!item.url || !item.title) continue;
    const id = stableId(item.url);
    if (seen.has(id)) continue;
    seen.add(id);
    const contentType = contentTypeFor(item.source, item.url);
    const scored = { ...item, id, content_type: contentType };
    scored.score = scoreItem(scored, config);
    const { primaryDomain, domains } = classifyItem(scored, rules);
    scored.primary_domain = primaryDomain;
    scored.domains = domains;
    scored.zh_summary = chineseDigest(scored);
    scored.first_seen_at = now;
    scored.last_seen_at = now;
    items.push(scored);
  }

  items.sort((a, b) => b.score - a.score || String(b.published_at || "").localeCompare(String(a.published_at || "")));
  return { items, errors };
}
