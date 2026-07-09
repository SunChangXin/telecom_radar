import { NextResponse } from "next/server";

import { crawlRadarItems } from "@/lib/crawler";
import { getExistingIds, markNotified, upsertRadarItems } from "@/lib/supabase";
import { notifyNewItems } from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { items, errors } = await crawlRadarItems();
    const existing = await getExistingIds(items.map((item) => item.id));
    const newItems = items.filter((item) => !existing.has(item.id));
    const rows = items.map((item) => ({
      id: item.id,
      source: item.source,
      title: item.title,
      url: item.url,
      summary: item.summary || "",
      zh_summary: item.zh_summary || "",
      content_type: item.content_type,
      primary_domain: item.primary_domain,
      domains: item.domains || [],
      authors: item.authors || [],
      tags: item.tags || [],
      score: item.score || 0,
      published_at: item.published_at || null,
      first_seen_at: existing.has(item.id) ? undefined : item.first_seen_at,
      last_seen_at: item.last_seen_at
    }));
    await upsertRadarItems(rows);
    const notifyResult = await notifyNewItems(newItems);
    if (notifyResult.ids?.length) await markNotified(notifyResult.ids);

    return NextResponse.json({
      ok: true,
      fetched: items.length,
      inserted: newItems.length,
      notified: notifyResult,
      warnings: errors
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
