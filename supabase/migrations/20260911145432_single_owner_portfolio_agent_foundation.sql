begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.portfolio_archives (
  id uuid primary key default gen_random_uuid(),
  original_user_id uuid,
  archived_at timestamptz not null default now(),
  reason text not null default 'single-owner portfolio reset',
  snapshot jsonb not null
);

revoke all on private.portfolio_archives from public, anon, authenticated;

with owners as (
  select user_id from public.portfolios
  union select user_id from public.companies
  union select user_id from public.holdings
  union select user_id from public.portfolio_transactions
  union select user_id from public.watchlist
  union select user_id from public.thesis_notes
  union select user_id from public.investment_journal
  union select user_id from public.news_items
)
insert into private.portfolio_archives (original_user_id, snapshot)
select
  owners.user_id,
  jsonb_build_object(
    'source_counts', jsonb_build_object(
      'portfolios', (select count(*) from public.portfolios row_data where row_data.user_id is not distinct from owners.user_id),
      'companies', (select count(*) from public.companies row_data where row_data.user_id is not distinct from owners.user_id),
      'holdings', (select count(*) from public.holdings row_data where row_data.user_id is not distinct from owners.user_id),
      'portfolio_transactions', (select count(*) from public.portfolio_transactions row_data where row_data.user_id is not distinct from owners.user_id),
      'watchlist', (select count(*) from public.watchlist row_data where row_data.user_id is not distinct from owners.user_id),
      'thesis_notes', (select count(*) from public.thesis_notes row_data where row_data.user_id is not distinct from owners.user_id),
      'investment_journal', (select count(*) from public.investment_journal row_data where row_data.user_id is not distinct from owners.user_id),
      'news_items', (select count(*) from public.news_items row_data where row_data.user_id is not distinct from owners.user_id)
    ),
    'portfolios', coalesce((select jsonb_agg(to_jsonb(row_data)) from public.portfolios row_data where row_data.user_id is not distinct from owners.user_id), '[]'::jsonb),
    'companies', coalesce((select jsonb_agg(to_jsonb(row_data)) from public.companies row_data where row_data.user_id is not distinct from owners.user_id), '[]'::jsonb),
    'holdings', coalesce((select jsonb_agg(to_jsonb(row_data)) from public.holdings row_data where row_data.user_id is not distinct from owners.user_id), '[]'::jsonb),
    'portfolio_transactions', coalesce((select jsonb_agg(to_jsonb(row_data)) from public.portfolio_transactions row_data where row_data.user_id is not distinct from owners.user_id), '[]'::jsonb),
    'watchlist', coalesce((select jsonb_agg(to_jsonb(row_data)) from public.watchlist row_data where row_data.user_id is not distinct from owners.user_id), '[]'::jsonb),
    'thesis_notes', coalesce((select jsonb_agg(to_jsonb(row_data)) from public.thesis_notes row_data where row_data.user_id is not distinct from owners.user_id), '[]'::jsonb),
    'investment_journal', coalesce((select jsonb_agg(to_jsonb(row_data)) from public.investment_journal row_data where row_data.user_id is not distinct from owners.user_id), '[]'::jsonb),
    'news_items', coalesce((select jsonb_agg(to_jsonb(row_data)) from public.news_items row_data where row_data.user_id is not distinct from owners.user_id), '[]'::jsonb)
  )
from owners;

do $$
declare
  archive_row record;
  table_name text;
begin
  for archive_row in
    select snapshot from private.portfolio_archives where reason = 'single-owner portfolio reset'
  loop
    foreach table_name in array array[
      'portfolios', 'companies', 'holdings', 'portfolio_transactions',
      'watchlist', 'thesis_notes', 'investment_journal', 'news_items'
    ]
    loop
      if (archive_row.snapshot -> 'source_counts' ->> table_name)::integer
         <> jsonb_array_length(archive_row.snapshot -> table_name) then
        raise exception 'Archive verification failed for table %', table_name;
      end if;
    end loop;
  end loop;
end;
$$;

delete from public.news_items;
delete from public.investment_journal;
delete from public.thesis_notes;
delete from public.watchlist;
delete from public.portfolio_transactions;
delete from public.holdings;
delete from public.companies;
delete from public.portfolios;

alter table public.watchlist add column if not exists portfolio_id uuid references public.portfolios(id) on delete cascade;
alter table public.thesis_notes add column if not exists portfolio_id uuid references public.portfolios(id) on delete cascade;
alter table public.news_items add column if not exists portfolio_id uuid references public.portfolios(id) on delete cascade;

alter table public.companies alter column user_id set not null;
alter table public.holdings alter column user_id set not null;
alter table public.holdings alter column portfolio_id set not null;
alter table public.portfolio_transactions alter column user_id set not null;
alter table public.portfolio_transactions alter column portfolio_id set not null;
alter table public.watchlist alter column user_id set not null;
alter table public.watchlist alter column portfolio_id set not null;
alter table public.thesis_notes alter column user_id set not null;
alter table public.thesis_notes alter column portfolio_id set not null;
alter table public.investment_journal alter column user_id set not null;
alter table public.investment_journal alter column portfolio_id set not null;
alter table public.news_items alter column user_id set not null;
alter table public.news_items alter column portfolio_id set not null;

drop index if exists public.portfolios_user_name_uidx;
create unique index if not exists portfolios_one_per_user_uidx on public.portfolios (user_id);
create unique index if not exists portfolios_id_user_uidx on public.portfolios (id, user_id);
create index if not exists watchlist_user_portfolio_idx on public.watchlist (user_id, portfolio_id);
create index if not exists thesis_notes_user_portfolio_idx on public.thesis_notes (user_id, portfolio_id);
create index if not exists news_items_user_portfolio_idx on public.news_items (user_id, portfolio_id);

alter table public.investment_journal drop constraint if exists investment_journal_portfolio_id_fkey;
alter table public.holdings add constraint holdings_portfolio_owner_fk foreign key (portfolio_id, user_id) references public.portfolios(id, user_id) on delete cascade;
alter table public.portfolio_transactions add constraint portfolio_transactions_portfolio_owner_fk foreign key (portfolio_id, user_id) references public.portfolios(id, user_id) on delete cascade;
alter table public.watchlist add constraint watchlist_portfolio_owner_fk foreign key (portfolio_id, user_id) references public.portfolios(id, user_id) on delete cascade;
alter table public.thesis_notes add constraint thesis_notes_portfolio_owner_fk foreign key (portfolio_id, user_id) references public.portfolios(id, user_id) on delete cascade;
alter table public.investment_journal add constraint investment_journal_portfolio_owner_fk foreign key (portfolio_id, user_id) references public.portfolios(id, user_id) on delete cascade;
alter table public.news_items add constraint news_items_portfolio_owner_fk foreign key (portfolio_id, user_id) references public.portfolios(id, user_id) on delete cascade;

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null,
  agent_role text not null check (agent_role in ('lead', 'research', 'secretary', 'discovery')),
  request jsonb not null default '{}'::jsonb,
  response jsonb,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (portfolio_id, user_id) references public.portfolios(id, user_id) on delete cascade
);

create table if not exists public.daily_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null,
  report_date date not null,
  payload jsonb not null,
  digest_text text not null,
  status text not null default 'ready' check (status in ('ready', 'sent', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  foreign key (portfolio_id, user_id) references public.portfolios(id, user_id) on delete cascade,
  unique (user_id, report_date)
);

create table if not exists public.alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null,
  briefing_id uuid references public.daily_briefings(id) on delete set null,
  channel text not null default 'discord',
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (portfolio_id, user_id) references public.portfolios(id, user_id) on delete cascade
);

create index if not exists agent_runs_user_created_idx on public.agent_runs (user_id, created_at desc);
create index if not exists daily_briefings_user_date_idx on public.daily_briefings (user_id, report_date desc);
create index if not exists alert_deliveries_user_created_idx on public.alert_deliveries (user_id, created_at desc);

create or replace function private.create_default_portfolio_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.portfolios (name, description, base_currency, target_weight, user_id)
  values ('Main Portfolio', 'Primary portfolio for this account.', 'USD', 100, new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_default_portfolio_for_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_create_portfolio on auth.users;
create trigger on_auth_user_created_create_portfolio
after insert on auth.users
for each row execute function private.create_default_portfolio_for_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'portfolios', 'companies', 'holdings', 'portfolio_transactions',
    'watchlist', 'thesis_notes', 'investment_journal', 'news_items',
    'agent_runs', 'daily_briefings', 'alert_deliveries'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', 'users_manage_own_' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id)', table_name || '_select_own', table_name);
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'companies', 'holdings', 'portfolio_transactions', 'watchlist',
    'thesis_notes', 'investment_journal', 'news_items'
  ]
  loop
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id) with check ((select auth.uid()) is not null and (select auth.uid()) = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
  end loop;
end;
$$;

drop policy if exists portfolios_update_own on public.portfolios;
create policy portfolios_update_own on public.portfolios
for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on all tables in schema public from anon;
revoke all on public.portfolios, public.companies, public.holdings, public.portfolio_transactions, public.watchlist, public.thesis_notes, public.investment_journal, public.news_items, public.agent_runs, public.daily_briefings, public.alert_deliveries from authenticated;
grant select, update on public.portfolios to authenticated;
grant select, insert, update, delete on public.companies, public.holdings, public.portfolio_transactions, public.watchlist, public.thesis_notes, public.investment_journal, public.news_items to authenticated;
grant select on public.agent_runs, public.daily_briefings, public.alert_deliveries to authenticated;

commit;
