import Newsroom from "./components/Newsroom";
import { chineseDigest, contentTypeFor } from "@/lib/config";
import { listRadarItems } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getItems() {
  try {
    const items = await listRadarItems(300);
    // 历史 GitHub 数据的旧摘要也在页面读取时重新生成，无需等待仓库再次被搜索命中。
    return {
      items: items.map((item) => item.source === "GitHub"
        ? { ...item, zh_summary: chineseDigest({ ...item, content_type: item.content_type || contentTypeFor(item.source, item.url) }) }
        : item),
      error: null
    };
  } catch (error) {
    return { items: [], error: error.message };
  }
}

export default async function HomePage() {
  const { items, error } = await getItems();
  return <Newsroom initialItems={items} setupError={error} />;
}
