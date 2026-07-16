import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

async function loadDigest() {
  const source = fs.readFileSync(new URL("../lib/config.js", import.meta.url), "utf8")
    .replace(/^import fs.*\r?\nimport path.*\r?\n/, "");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

test("GitHub projects receive purpose-specific summaries", async () => {
  const { chineseDigest } = await loadDigest();
  const ntnToolkit = chineseDigest({
    source: "GitHub", title: "MuhammadUazir69/ns3-ntn-toolkit", content_type: "开源项目", tags: ["C++", "NTN"]
  });
  const risMimo = chineseDigest({
    source: "GitHub", title: "anshu20105/RIS-MIMO", content_type: "开源项目", tags: ["Python"]
  });
  assert.match(ntnToolkit, /ns-3/);
  assert.match(ntnToolkit, /NTN/);
  assert.match(risMimo, /RIS/);
  assert.match(risMimo, /MIMO/);
  assert.notEqual(ntnToolkit, risMimo);
});
