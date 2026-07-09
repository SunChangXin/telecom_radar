create table if not exists public.radar_items (
  id text primary key,
  source text not null,
  title text not null,
  url text not null unique,
  summary text default '',
  zh_summary text default '',
  content_type text default '产业资讯',
  primary_domain text default '未分类',
  domains jsonb default '[]'::jsonb,
  authors jsonb default '[]'::jsonb,
  tags jsonb default '[]'::jsonb,
  score integer default 0,
  published_at timestamptz,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  notified_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists radar_items_score_idx
  on public.radar_items (score desc, last_seen_at desc);

create index if not exists radar_items_source_idx
  on public.radar_items (source);

create index if not exists radar_items_content_type_idx
  on public.radar_items (content_type);

create index if not exists radar_items_primary_domain_idx
  on public.radar_items (primary_domain);

alter table public.radar_items enable row level security;

drop policy if exists "service role manages radar items" on public.radar_items;
create policy "service role manages radar items"
  on public.radar_items
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
