const items = JSON.parse(document.getElementById("radarData").textContent);
const itemMap = new Map(items.map((item) => [item.id, item]));
const signals = [...document.querySelectorAll(".signal")];
const searchInput = document.getElementById("searchInput");
const scoreInput = document.getElementById("scoreInput");
const scoreOutput = document.getElementById("scoreOutput");
const unnotifiedOnly = document.getElementById("unnotifiedOnly");
const sourceInput = document.getElementById("sourceInput");
const resultCount = document.getElementById("resultCount");
const emptyState = document.getElementById("emptyState");
const detailContent = document.getElementById("detailContent");
let activeDomain = "all";
let activeType = "all";

function escapeHtml(value = "") {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

function displayDate(value) {
  if (!value) return "日期未知";
  return value.slice(0, 10);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function renderDetail(id) {
  const item = itemMap.get(id);
  if (!item) {
    detailContent.innerHTML = "<p class='detail-summary'>选择一条动态查看完整摘要。</p>";
    return;
  }
  const authors = item.authors.length ? item.authors.slice(0, 3).join("、") : "来源未注明";
  detailContent.innerHTML = `
    <div class="detail-source">${escapeHtml(item.primary_domain)} / ${escapeHtml(item.content_type)} / ${escapeHtml(item.source)}</div>
    <h2 class="detail-title">${escapeHtml(item.title)}</h2>
    <p class="detail-summary">${escapeHtml(item.zh_summary)}</p>
    <div class="detail-grid">
      <div><span>相关度评分</span><strong>${item.score}</strong></div>
      <div><span>发布日期</span><strong>${displayDate(item.published_at)}</strong></div>
      <div><span>推送状态</span><strong>${item.notified_at ? "已推送" : "待推送"}</strong></div>
      <div><span>作者</span><strong>${escapeHtml(authors)}</strong></div>
    </div>
    <div class="tags">${item.domains.map((domain) => `<span>${escapeHtml(domain)}</span>`).join("")}</div>
    <a class="detail-link" href="${escapeHtml(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">打开原始来源</a>`;
}

function selectSignal(signal) {
  signals.forEach((node) => node.classList.toggle("selected", node === signal));
  renderDetail(signal.dataset.id);
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const minScore = Number(scoreInput.value);
  let visible = 0;
  signals.forEach((signal) => {
    const domains = signal.dataset.domain.split("|");
    const matches = (activeDomain === "all" || domains.includes(activeDomain))
      && (activeType === "all" || signal.dataset.type === activeType)
      && (sourceInput.value === "all" || signal.dataset.source === sourceInput.value)
      && Number(signal.dataset.score) >= minScore
      && (!unnotifiedOnly.checked || signal.dataset.notified === "false")
      && (!query || signal.dataset.search.includes(query));
    signal.hidden = !matches;
    if (matches) visible += 1;
  });
  scoreOutput.value = minScore;
  resultCount.textContent = `${visible} 条结果`;
  emptyState.hidden = visible !== 0;
  const selected = signals.find((signal) => signal.classList.contains("selected") && !signal.hidden);
  const firstVisible = signals.find((signal) => !signal.hidden);
  if (!selected && firstVisible) selectSignal(firstVisible);
  if (!firstVisible) renderDetail(null);
}

signals.forEach((signal) => {
  signal.addEventListener("click", () => selectSignal(signal));
  signal.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectSignal(signal);
    }
  });
});

document.querySelectorAll(".domain-filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".domain-filter").forEach((node) => node.classList.remove("active"));
    button.classList.add("active");
    activeDomain = button.dataset.domain;
    applyFilters();
  });
});

document.querySelectorAll(".type-filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".type-filter").forEach((node) => node.classList.remove("active"));
    button.classList.add("active");
    activeType = button.dataset.type;
    applyFilters();
  });
});

[searchInput, scoreInput, sourceInput, unnotifiedOnly].forEach((control) => control.addEventListener("input", applyFilters));

const themeToggle = document.getElementById("themeToggle");
const storedTheme = localStorage.getItem("radar-theme");
if (storedTheme) document.documentElement.dataset.theme = storedTheme;
themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("radar-theme", next);
});

if (signals[0]) selectSignal(signals[0]);
applyFilters();
