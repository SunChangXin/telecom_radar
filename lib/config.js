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

function githubProjectPurpose(item) {
  const text = `${item.title || ""} ${item.summary || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
  const has = (pattern) => pattern.test(text);
  const purposes = [];

  // 这些规则只把仓库已公开的名称、简介和标签组织成中文导读；不臆测论文或代码未说明的能力。
  if (has(/ns-?3/)) purposes.push("基于 ns-3 的网络仿真与实验工具包");
  if (has(/o-ran|open ran/)) purposes.push("O-RAN 开放无线接入网架构的原型、编排或验证");
  if (has(/ris|reconfigurable intelligent surface|intelligent reflecting surface/)) {
    purposes.push("RIS 可重构智能表面辅助无线链路的建模、算法或仿真");
  }
  if (has(/mimo|massive mimo|xl-mimo/)) purposes.push("MIMO 多天线通信的性能评估或实现");
  if (has(/ntn|non-terrestrial|satellite/)) purposes.push("NTN 非地面网络与卫星通信场景");
  if (has(/srsran|openairinterface|\b5g\b|\b6g\b|\bnr\b/)) {
    purposes.push("5G/6G NR 无线接入网协议栈、实验或仿真");
  }
  if (has(/sdr|software defined radio|usrp|gnuradio/)) purposes.push("软件定义无线电（SDR）实验与实测");
  if (has(/isac|integrated sensing|joint communication/)) purposes.push("通信感知一体化（ISAC）技术验证");
  if (has(/digital twin/)) purposes.push("通信网络数字孪生建模与验证");

  const unique = [...new Set(purposes)];
  if (!unique.length) {
    const domain = item.primary_domain || item.primaryDomain || UNCLASSIFIED;
    return `该仓库围绕${domain}提供代码、配置或实验材料。建议先查看 README、示例脚本和最近提交，以确认其可复现的具体流程与适用环境。`;
  }

  return `该仓库主要用于${unique.slice(0, 2).join("，并覆盖")}。可用于复现实验、搭建仿真场景或验证相关算法；使用前应查看 README、依赖环境、许可证和示例脚本。`;
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
    return githubProjectPurpose(item);
  }
  if (type === "标准组织") {
    return `该动态来自${source}，与${domain}相关，可能反映标准化、产业联盟或技术路线的近期变化。建议关注发布时间、涉及组织和是否指向具体规范/白皮书。`;
  }
  return `该产业资讯与${domain}相关，可用于观察通信产业、设备商和生态组织的技术动向。建议结合论文和标准动态交叉判断其研究价值。`;
}

export function stableId(url) {
  return Buffer.from(String(url || "").trim().toLowerCase()).toString("base64url").slice(0, 64);
}
