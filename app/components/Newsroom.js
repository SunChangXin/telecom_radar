"use client";

import { useMemo, useState } from "react";

const CONTENT_TYPES = ["论文", "标准组织", "产业资讯", "开源项目"];
const ACADEMIC_PORTALS = [
  {
    name: "Google Scholar",
    note: "人工检索引用和相关工作",
    url: "https://scholar.google.com/scholar?q="
  },
  {
    name: "CNKI",
    note: "人工检索中文论文/硕博论文",
    url: "https://kns.cnki.net/kns8s/defaultresult/index?kw="
  },
  {
    name: "SpringerLink",
    note: "公开检索 Springer 论文",
    url: "https://link.springer.com/search?query="
  },
  {
    name: "Wiley Online Library",
    note: "公开检索 Wiley 论文",
    url: "https://onlinelibrary.wiley.com/action/doSearch?AllField="
  },
  {
    name: "IEEE Xplore",
    note: "人工检索 IEEE 论文库",
    url: "https://ieeexplore.ieee.org/search/searchresult.jsp?queryText="
  }
];

function uniqueCounts(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(item[key] || "未分类", (counts.get(item[key] || "未分类") || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function dateText(value) {
  if (!value) return "日期未知";
  return String(value).slice(0, 10);
}

function searchUrl(baseUrl, query) {
  const normalized = query?.trim() || "6G OR NTN OR ISAC OR RIS OR O-RAN";
  return `${baseUrl}${encodeURIComponent(normalized)}`;
}

export default function Newsroom({ initialItems, setupError }) {
  const [domain, setDomain] = useState("all");
  const [type, setType] = useState("all");
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id || null);

  const domains = useMemo(() => uniqueCounts(initialItems, "primary_domain"), [initialItems]);
  const sources = useMemo(() => uniqueCounts(initialItems, "source"), [initialItems]);
  const topScore = Math.max(20, ...initialItems.map((item) => item.score || 0));

  const filtered = initialItems.filter((item) => {
    const text = `${item.title} ${item.zh_summary} ${item.summary} ${(item.tags || []).join(" ")}`.toLowerCase();
    return (domain === "all" || (item.domains || []).includes(domain) || item.primary_domain === domain)
      && (type === "all" || item.content_type === type)
      && (source === "all" || item.source === source)
      && Number(item.score || 0) >= Number(minScore)
      && (!query || text.includes(query.toLowerCase()));
  });

  const selected = initialItems.find((item) => item.id === selectedId) || filtered[0] || null;

  return (
    <main className="shell">
      <aside className="rail">
        <div className="brand">
          <img src="/radar-icon.svg" alt="" />
          <div>
            <strong>通信前沿雷达</strong>
            <span>VERCEL CLOUD INTELLIGENCE</span>
          </div>
        </div>
        <div className="railLabel">技术领域</div>
        <button className={domain === "all" ? "active" : ""} onClick={() => setDomain("all")}>
          <span>全部动态</span><b>{initialItems.length}</b>
        </button>
        {domains.map(([name, count]) => (
          <button key={name} className={domain === name ? "active" : ""} onClick={() => setDomain(name)}>
            <span>{name}</span><b>{count}</b>
          </button>
        ))}
      </aside>

      <section className="workspace">
        <header className="hero">
          <p>云端研究情报工作台</p>
          <h1>让通信前沿动态<br />自动汇入同一个雷达屏</h1>
          <div className="metrics">
            <div><strong>{initialItems.length}</strong><span>收录动态</span></div>
            <div><strong>{Math.max(0, ...initialItems.map((item) => item.score || 0))}</strong><span>最高评分</span></div>
            <div><strong>{sources.length}</strong><span>来源数量</span></div>
          </div>
        </header>

        {setupError ? (
          <section className="setupCard">
            <strong>还没有连接 Supabase</strong>
            <p>请先在 Vercel 环境变量中配置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY，然后访问 /api/radar 触发首次抓取。</p>
            <code>{setupError}</code>
          </section>
        ) : null}

        <nav className="tabs">
          <button className={type === "all" ? "active" : ""} onClick={() => setType("all")}>全部内容</button>
          {CONTENT_TYPES.map((name) => (
            <button key={name} className={type === name ? "active" : ""} onClick={() => setType(name)}>{name}</button>
          ))}
        </nav>

        <section className="toolbar">
          <label>
            <span>搜索</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="NTN、ISAC、O-RAN、RIS..." />
          </label>
          <label>
            <span>来源</span>
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="all">全部来源</option>
              {sources.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}
            </select>
          </label>
          <label>
            <span>最低评分 {minScore}</span>
            <input type="range" min="0" max={topScore} value={minScore} onChange={(event) => setMinScore(event.target.value)} />
          </label>
          <a className="refreshLink" href="/api/radar" target="_blank" rel="noreferrer">手动刷新</a>
        </section>

        <section className="portalPanel" aria-label="学术数据库人工检索入口">
          <div>
            <span className="portalEyebrow">MANUAL ACADEMIC SEARCH</span>
            <h2>学术数据库入口</h2>
            <p>Google Scholar 和 CNKI 不做自动抓取；这里按当前搜索词生成跳转入口。Springer / Wiley 已额外接入公开 RSS，仍可在这里人工深挖。</p>
          </div>
          <div className="portalGrid">
            {ACADEMIC_PORTALS.map((portal) => (
              <a key={portal.name} href={searchUrl(portal.url, query)} target="_blank" rel="noreferrer">
                <strong>{portal.name}</strong>
                <span>{portal.note}</span>
              </a>
            ))}
          </div>
        </section>

        <div className="contentGrid">
          <section className="feed">
            <div className="feedHead"><span>{filtered.length} 条结果</span><span>按评分排序</span></div>
            {filtered.map((item) => (
              <article key={item.id} className={selected?.id === item.id ? "signal selected" : "signal"} onClick={() => setSelectedId(item.id)}>
                <div className="score"><strong>{item.score}</strong><span>SCORE</span></div>
                <div>
                  <div className="meta">
                    <span>{item.primary_domain}</span><span>{item.content_type}</span><span>{item.source}</span><time>{dateText(item.published_at || item.first_seen_at)}</time>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.zh_summary}</p>
                  <div className="tags">{(item.tags || []).slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}</div>
                </div>
              </article>
            ))}
            {!filtered.length ? <div className="empty">没有匹配的动态，换个筛选条件试试。</div> : null}
          </section>

          <aside className="inspector">
            {selected ? (
              <>
                <div className="detailSource">{selected.primary_domain} / {selected.content_type} / {selected.source}</div>
                <h2>{selected.title}</h2>
                <p>{selected.zh_summary}</p>
                <div className="detailGrid">
                  <div><span>评分</span><strong>{selected.score}</strong></div>
                  <div><span>发布时间</span><strong>{dateText(selected.published_at)}</strong></div>
                  <div><span>推送状态</span><strong>{selected.notified_at ? "已推送" : "待推送"}</strong></div>
                  <div><span>来源</span><strong>{selected.source}</strong></div>
                </div>
                <div className="tags">{(selected.domains || []).map((name) => <span key={name}>{name}</span>)}</div>
                <a className="openLink" href={selected.url} target="_blank" rel="noreferrer">打开原始来源</a>
              </>
            ) : <p>暂无数据。配置 Supabase 后访问 /api/radar 进行首次抓取。</p>}
          </aside>
        </div>
      </section>
    </main>
  );
}
