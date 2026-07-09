const TABLE = "radar_items";

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return { url: url.replace(/\/$/, ""), key };
}

async function supabaseFetch(path, options = {}) {
  const { url, key } = getSupabaseEnv();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function listRadarItems(limit = 300) {
  return supabaseFetch(
    `${TABLE}?select=*&order=score.desc,last_seen_at.desc&limit=${Number(limit) || 300}`
  );
}

export async function getExistingIds(ids) {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (!uniqueIds.length) return new Set();
  const quoted = uniqueIds.map((id) => `"${String(id).replaceAll('"', '\\"')}"`).join(",");
  const rows = await supabaseFetch(`${TABLE}?select=id&id=in.(${quoted})`);
  return new Set((rows || []).map((row) => row.id));
}

export async function upsertRadarItems(items) {
  if (!items.length) return [];
  return supabaseFetch(`${TABLE}?on_conflict=id`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(items)
  });
}

export async function markNotified(ids) {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (!uniqueIds.length) return null;
  const quoted = uniqueIds.map((id) => `"${String(id).replaceAll('"', '\\"')}"`).join(",");
  return supabaseFetch(`${TABLE}?id=in.(${quoted})`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ notified_at: new Date().toISOString() })
  });
}
