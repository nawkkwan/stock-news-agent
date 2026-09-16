create table if not exists public.hermes_thesis_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null,
  ticker text not null,
  business_overview text,
  growth_drivers text,
  bull_case text,
  bear_case text,
  moat text,
  key_risks text,
  sell_conditions text,
  confidence_score numeric check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100)),
  evidence_summary jsonb not null default '{}'::jsonb,
  source_run_id uuid references public.agent_runs(id) on delete set null,
  source_kind text not null default 'research' check (source_kind in ('research', 'pixel_agent_append')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (portfolio_id, user_id)
    references public.portfolios(id, user_id) on delete cascade,
  unique (user_id, ticker)
);

create index if not exists hermes_thesis_user_portfolio_idx
  on public.hermes_thesis_notes (user_id, portfolio_id, updated_at desc);

drop trigger if exists set_hermes_thesis_notes_updated_at on public.hermes_thesis_notes;
create trigger set_hermes_thesis_notes_updated_at
before update on public.hermes_thesis_notes
for each row execute function public.set_updated_at();

alter table public.hermes_thesis_notes enable row level security;

drop policy if exists hermes_thesis_notes_select_own on public.hermes_thesis_notes;
create policy hermes_thesis_notes_select_own
  on public.hermes_thesis_notes for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on public.hermes_thesis_notes from anon, authenticated;
grant select on public.hermes_thesis_notes to authenticated;
