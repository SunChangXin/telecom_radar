import fs from "node:fs";
import path from "node:path";

export const UNCLASSIFIED = "未分类";

export function loadJsonConfig(relativePath) {
  const filePath = path.join(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadRadarConfig() {
  return loadJsonConfig("config/config.example.json");
}

export function loadDomainRules() {
  return loadJsonConfig("config/domains.json");
}

export function containsKeyword(text, keyword) {
  const haystack = String(text || "").toLowerCase();
  const needle = String(keyword || "").toLowerCase().trim();
  if (!needle) return false;
  if (/^[a-z0-9][a-z0-9.+-]*$/i.test(needle)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`, "i").test(haystack);
  }
  return haystack.includes(needle);
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function scoreItem(item, config = loadRadarConfig()) {
  const text = `${item.title || ""} ${item.summary || ""} ${(item.tags || []).join(" ")}`;
  let score = 0;
  for (const keyword of config.keywords || []) {
    if (containsKeyword(text, keyword)) score += keyword.length <= 3 ? 1 : 2;
  }
  for (const keyword of config.negative_keywords || []) {
    if (containsKeyword(text, keyword)) score -= 5;
  }
  if (item.source === "arXiv") score += 1;
  if (item.source === "GitHub") score += 1;
  return Math.max(score, 0);
}

export function classifyItem(item, rules = loadDomainRules()) {
  const text = `${item.title || ""} ${item.summary || ""} ${(item.tags || []).join(" ")} ${item.source || ""}`;
  const hits = rules
    .map((rule) => ({
      name: rule.name,
      count: (rule.keywords || []).filter((keyword) => containsKeyword(text, keyword)).length
    }))
    .filter((hit) => hit.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));

  if (!hits.length) return { primaryDomain: UNCLASSIFIED, domains: [UNCLASSIFIED] };
  return { primaryDomain: hits[0].name, domains: hits.map((hit) => hit.name) };
}

export function contentTypeFor(source, url = "") {
  const sourceText = String(source || "").toLowerCase();
  const urlText = String(url || "").toLowerCase();
  if (sourceText.includes("arxiv")) return "论文";
  if (sourceText.includes("ieee")) return "论文";
  if (sourceText.includes("springer")) return "论文";
  if (sourceText.includes("wiley")) return "论文";
  if (sourceText.includes("github")) return "开源项目";
  if (/(3gpp|itu|etsi|o-ran|6g-ia|next g alliance|gsma)/i.test(sourceText)) return "标准组织";
  if (/(github\.com)/i.test(urlText)) return "开源项目";
  return "产业资讯";
}

export function chineseDigest(item) {
  const type = item.content_type || item.contentType || contentTypeFor(item.source, item.url);
  const domain = item.primary_domain || item.primaryDomain || UNCLASSIFIED;
  const tags = (item.tags || []).filter(Boolean).slice(0, 4).join("、");
  const source = item.source || "未知来源";

  if (type === "论文") {
    return `该论文聚焦${domain}，可作为跟踪通信前沿算法、系统设计或实验复现的线索。重点关注${tags || "标题中的关键技术"}，建议进一步查看方法、实验设置和是否有开源实现。`;
  }
  if (type === "开源项目") {
    return `该开源项目与${domain}相关，适合评估工程复现、仿真平台或测试工具价值。建议优先查看代码活跃度、许可证、示例文档和最近提交。`;
  }
  if (type === "标准组织") {
    return `该动态来自${source}，与${domain}相关，可能反映标准化、产业联盟或技术路线的近期变化。建议关注发布时间、涉及组织和是否指向具体规范/白皮书。`;
  }
  return `该产业资讯与${domain}相关，可用于观察通信产业、设备商和生态组织的技术动向。建议结合论文和标准动态交叉判断其研究价值。`;
}

export function stableId(url) {
  return Buffer.from(String(url || "").trim().toLowerCase()).toString("base64url").slice(0, 64);
}
