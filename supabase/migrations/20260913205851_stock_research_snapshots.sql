create table if not exists public.stock_research_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null,
  ticker text not null,
  source text not null check (source in ('daily', 'hermes', 'gemini')),
  as_of timestamptz not null default now(),
  market_snapshot jsonb not null default '{}'::jsonb,
  decision_summary jsonb not null default '{}'::jsonb,
  news_count integer not null default 0 check (news_count >= 0),
  status text not null default 'ready' check (status in ('ready', 'partial', 'failed')),
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  foreign key (portfolio_id, user_id)
    references public.portfolios(id, user_id) on delete cascade,
  unique (user_id, dedupe_key)
);

create index if not exists stock_research_user_ticker_as_of_idx
  on public.stock_research_snapshots (user_id, ticker, as_of desc);
create index if not exists stock_research_user_portfolio_as_of_idx
  on public.stock_research_snapshots (user_id, portfolio_id, as_of desc);

alter table public.stock_research_snapshots enable row level security;

drop policy if exists stock_research_snapshots_select_own on public.stock_research_snapshots;
create policy stock_research_snapshots_select_own
  on public.stock_research_snapshots for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on public.stock_research_snapshots from anon, authenticated;
grant select on public.stock_research_snapshots to authenticated;

alter table public.news_items add column if not exists external_key text;
create unique index if not exists news_items_user_portfolio_ticker_external_uidx
  on public.news_items (user_id, portfolio_id, ticker, external_key);
