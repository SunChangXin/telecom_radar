const TABLE = "radar_items";

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const normalizedUrl = url
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");
  return { url: normalizedUrl, key };
}

function supabaseRestUrl(path, params = {}) {
  const { url } = getSupabaseEnv();
  const restUrl = new URL(`${url}/rest/v1/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) restUrl.searchParams.set(key, String(value));
  }
  return restUrl;
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
  const endpoint = supabaseRestUrl(TABLE, {
    select: "*",
    order: "score.desc,last_seen_at.desc",
    limit: Number(limit) || 300
  });
  return supabaseFetch(endpoint.pathname.replace("/rest/v1/", "") + endpoint.search);
}

export async function getExistingIds(ids) {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (!uniqueIds.length) return new Set();
  const values = uniqueIds.map((id) => `"${String(id).replaceAll('"', '\\"')}"`).join(",");
  const endpoint = supabaseRestUrl(TABLE, {
    select: "id",
    id: `in.(${values})`
  });
  const rows = await supabaseFetch(endpoint.pathname.replace("/rest/v1/", "") + endpoint.search);
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
  const values = uniqueIds.map((id) => `"${String(id).replaceAll('"', '\\"')}"`).join(",");
  const endpoint = supabaseRestUrl(TABLE, {
    id: `in.(${values})`
  });
  return supabaseFetch(endpoint.pathname.replace("/rest/v1/", "") + endpoint.search, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ notified_at: new Date().toISOString() })
  });
}
