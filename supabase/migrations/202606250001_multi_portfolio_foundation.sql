create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists portfolios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  base_currency text not null default 'USD',
  target_weight numeric check (target_weight is null or (target_weight >= 0 and target_weight <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade
);

create index if not exists portfolios_user_created_idx
  on portfolios (user_id, created_at);

create unique index if not exists portfolios_user_name_uidx
  on portfolios (user_id, name);

drop trigger if exists set_portfolios_updated_at on portfolios;
create trigger set_portfolios_updated_at
before update on portfolios
for each row execute function set_updated_at();

alter table holdings add column if not exists portfolio_id uuid null references portfolios(id) on delete cascade;
alter table portfolio_transactions add column if not exists portfolio_id uuid null references portfolios(id) on delete cascade;
alter table investment_journal add column if not exists portfolio_id uuid null references portfolios(id) on delete set null;

insert into portfolios (name, description, base_currency, target_weight, user_id)
select
  'Main Portfolio',
  'Default portfolio for existing holdings and transactions.',
  'USD',
  100,
  users.user_id
from (
  select user_id from holdings where user_id is not null
  union
  select user_id from portfolio_transactions where user_id is not null
  union
  select user_id from investment_journal where user_id is not null
) users
where not exists (
  select 1 from portfolios
  where portfolios.user_id = users.user_id
    and portfolios.name = 'Main Portfolio'
);

update holdings
set portfolio_id = portfolios.id
from portfolios
where holdings.portfolio_id is null
  and holdings.user_id = portfolios.user_id
  and portfolios.name = 'Main Portfolio';

update portfolio_transactions
set portfolio_id = portfolios.id
from portfolios
where portfolio_transactions.portfolio_id is null
  and portfolio_transactions.user_id = portfolios.user_id
  and portfolios.name = 'Main Portfolio';

update investment_journal
set portfolio_id = portfolios.id
from portfolios
where investment_journal.portfolio_id is null
  and investment_journal.user_id = portfolios.user_id
  and portfolios.name = 'Main Portfolio';

drop index if exists holdings_user_ticker_uidx;
create unique index if not exists holdings_user_portfolio_ticker_uidx
  on holdings (user_id, portfolio_id, ticker);

create index if not exists holdings_user_portfolio_idx
  on holdings (user_id, portfolio_id);

create index if not exists portfolio_transactions_user_portfolio_date_idx
  on portfolio_transactions (user_id, portfolio_id, transaction_date desc, created_at desc);

create index if not exists investment_journal_user_portfolio_date_idx
  on investment_journal (user_id, portfolio_id, date desc, created_at desc);

alter table portfolios enable row level security;

drop policy if exists "users_manage_own_portfolios" on portfolios;

create policy "users_manage_own_portfolios"
  on portfolios for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on portfolios to authenticated;

grant select, insert, update, delete on
  companies,
  holdings,
  portfolio_transactions,
  watchlist,
  thesis_notes,
  investment_journal,
  news_items
to authenticated;
