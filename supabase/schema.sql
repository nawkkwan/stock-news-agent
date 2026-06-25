create extension if not exists pgcrypto;

do $$
begin
  create type watchlist_status as enum (
    'not_started',
    'reading',
    'thesis_drafted',
    'ready_to_buy',
    'rejected'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type journal_action as enum (
    'buy',
    'sell',
    'hold',
    'trim',
    'add',
    'research'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type news_impact as enum (
    'positive',
    'neutral',
    'negative'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type news_timeframe as enum (
    'short_term',
    'long_term'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type portfolio_transaction_type as enum (
    'deposit',
    'withdrawal',
    'buy',
    'sell',
    'dividend',
    'fee'
  );
exception
  when duplicate_object then null;
end;
$$;

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

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  name text,
  sector text,
  industry text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete cascade
);

create table if not exists holdings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references companies(id) on delete set null,
  portfolio_id uuid null references portfolios(id) on delete cascade,
  ticker text not null,
  shares numeric,
  avg_cost numeric,
  current_value numeric,
  latest_price numeric,
  target_weight numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete cascade
);

create table if not exists portfolio_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references companies(id) on delete set null,
  portfolio_id uuid null references portfolios(id) on delete cascade,
  ticker text,
  transaction_type portfolio_transaction_type not null,
  quantity numeric,
  price_per_share numeric,
  fee numeric not null default 0,
  currency text not null default 'USD',
  transaction_date date not null default current_date,
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  check (quantity is null or quantity >= 0),
  check (price_per_share is null or price_per_share >= 0),
  check (fee >= 0),
  check (
    transaction_type not in ('buy', 'sell')
    or (ticker is not null and quantity > 0 and price_per_share is not null)
  )
);

create table if not exists watchlist (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references companies(id) on delete set null,
  ticker text not null,
  status watchlist_status not null default 'not_started',
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete cascade
);

create table if not exists thesis_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references companies(id) on delete set null,
  ticker text not null,
  business_overview text,
  bull_case text,
  bear_case text,
  moat text,
  key_risks text,
  growth_drivers text,
  sell_conditions text,
  confidence_score numeric check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete cascade
);

create table if not exists investment_journal (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references companies(id) on delete set null,
  portfolio_id uuid null references portfolios(id) on delete set null,
  date date not null default current_date,
  ticker text,
  action journal_action not null,
  amount numeric,
  reason text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 100)),
  risk text,
  what_would_make_this_wrong text,
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete cascade
);

create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references companies(id) on delete set null,
  ticker text not null,
  title text not null,
  url text,
  source text,
  published_at timestamptz,
  summary text,
  impact news_impact not null default 'neutral',
  timeframe news_timeframe not null default 'short_term',
  thesis_changed boolean not null default false,
  my_note text,
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete cascade
);

create index if not exists companies_ticker_idx on companies (ticker);
create index if not exists portfolios_user_created_idx on portfolios (user_id, created_at);
create index if not exists holdings_ticker_idx on holdings (ticker);
create index if not exists watchlist_ticker_idx on watchlist (ticker);
create index if not exists thesis_notes_ticker_idx on thesis_notes (ticker);
create index if not exists investment_journal_ticker_date_idx on investment_journal (ticker, date desc, created_at desc);
create index if not exists investment_journal_user_date_idx on investment_journal (user_id, date desc, created_at desc);
create index if not exists news_items_ticker_published_idx on news_items (ticker, published_at desc);
create index if not exists portfolio_transactions_user_date_idx
  on portfolio_transactions (user_id, transaction_date desc, created_at desc);
create index if not exists portfolio_transactions_user_ticker_idx
  on portfolio_transactions (user_id, ticker, transaction_date desc);

create unique index if not exists companies_user_ticker_uidx on companies (user_id, ticker);
create unique index if not exists portfolios_user_name_uidx on portfolios (user_id, name);
create unique index if not exists holdings_user_portfolio_ticker_uidx on holdings (user_id, portfolio_id, ticker);
create unique index if not exists watchlist_user_ticker_uidx on watchlist (user_id, ticker);
create unique index if not exists thesis_notes_user_ticker_uidx on thesis_notes (user_id, ticker);
create index if not exists holdings_user_portfolio_idx on holdings (user_id, portfolio_id);
create index if not exists portfolio_transactions_user_portfolio_date_idx
  on portfolio_transactions (user_id, portfolio_id, transaction_date desc, created_at desc);
create index if not exists investment_journal_user_portfolio_date_idx
  on investment_journal (user_id, portfolio_id, date desc, created_at desc);

drop trigger if exists set_portfolios_updated_at on portfolios;
create trigger set_portfolios_updated_at
before update on portfolios
for each row execute function set_updated_at();

drop trigger if exists set_companies_updated_at on companies;
create trigger set_companies_updated_at
before update on companies
for each row execute function set_updated_at();

drop trigger if exists set_holdings_updated_at on holdings;
create trigger set_holdings_updated_at
before update on holdings
for each row execute function set_updated_at();

drop trigger if exists set_watchlist_updated_at on watchlist;
create trigger set_watchlist_updated_at
before update on watchlist
for each row execute function set_updated_at();

drop trigger if exists set_thesis_notes_updated_at on thesis_notes;
create trigger set_thesis_notes_updated_at
before update on thesis_notes
for each row execute function set_updated_at();

alter table portfolios enable row level security;
alter table companies enable row level security;
alter table holdings enable row level security;
alter table portfolio_transactions enable row level security;
alter table watchlist enable row level security;
alter table thesis_notes enable row level security;
alter table investment_journal enable row level security;
alter table news_items enable row level security;

drop policy if exists "users_manage_own_portfolios" on portfolios;
drop policy if exists "users_manage_own_companies" on companies;
drop policy if exists "users_manage_own_holdings" on holdings;
drop policy if exists "users_manage_own_portfolio_transactions" on portfolio_transactions;
drop policy if exists "users_manage_own_watchlist" on watchlist;
drop policy if exists "users_manage_own_thesis_notes" on thesis_notes;
drop policy if exists "users_manage_own_investment_journal" on investment_journal;
drop policy if exists "users_manage_own_news_items" on news_items;

create policy "users_manage_own_portfolios"
  on portfolios for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_manage_own_companies"
  on companies for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_manage_own_holdings"
  on holdings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_manage_own_portfolio_transactions"
  on portfolio_transactions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_manage_own_watchlist"
  on watchlist for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_manage_own_thesis_notes"
  on thesis_notes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_manage_own_investment_journal"
  on investment_journal for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_manage_own_news_items"
  on news_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on
  portfolios,
  companies,
  holdings,
  portfolio_transactions,
  watchlist,
  thesis_notes,
  investment_journal,
  news_items
to authenticated;
