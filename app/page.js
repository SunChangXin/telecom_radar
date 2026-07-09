import Newsroom from "./components/Newsroom";
import { listRadarItems } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getItems() {
  try {
    return { items: await listRadarItems(300), error: null };
  } catch (error) {
    return { items: [], error: error.message };
  }
}

export default async function HomePage() {
  const { items, error } = await getItems();
  return <Newsroom initialItems={items} setupError={error} />;
}
