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

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
  ticker text not null,
  shares numeric,
  avg_cost numeric,
  current_value numeric,
  target_weight numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete cascade
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

create table if not exists decision_journal (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references companies(id) on delete set null,
  ticker text,
  action journal_action not null,
  amount numeric,
  reason text,
  confidence_score numeric check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100)),
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
create index if not exists holdings_ticker_idx on holdings (ticker);
create index if not exists watchlist_ticker_idx on watchlist (ticker);
create index if not exists thesis_notes_ticker_idx on thesis_notes (ticker);
create index if not exists decision_journal_ticker_created_idx on decision_journal (ticker, created_at desc);
create index if not exists news_items_ticker_published_idx on news_items (ticker, published_at desc);

create unique index if not exists companies_single_user_ticker_uidx
  on companies (ticker)
  where user_id is null;

create unique index if not exists holdings_single_user_ticker_uidx
  on holdings (ticker)
  where user_id is null;

create unique index if not exists watchlist_single_user_ticker_uidx
  on watchlist (ticker)
  where user_id is null;

create unique index if not exists thesis_notes_single_user_ticker_uidx
  on thesis_notes (ticker)
  where user_id is null;

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

alter table companies enable row level security;
alter table holdings enable row level security;
alter table watchlist enable row level security;
alter table thesis_notes enable row level security;
alter table decision_journal enable row level security;
alter table news_items enable row level security;

with seed(ticker) as (
  values
    ('VOO'),
    ('VXUS'),
    ('GOOGL'),
    ('MSFT'),
    ('PLTR'),
    ('CCJ'),
    ('CEG'),
    ('ETN'),
    ('GEV')
),
inserted_companies as (
  insert into companies (ticker, name)
  select seed.ticker, seed.ticker
  from seed
  where not exists (
    select 1 from companies
    where companies.ticker = seed.ticker
      and companies.user_id is null
  )
  returning id, ticker
)
insert into watchlist (company_id, ticker, status)
select companies.id, companies.ticker, 'not_started'
from companies
where companies.user_id is null
  and companies.ticker in ('VOO', 'VXUS', 'GOOGL', 'MSFT', 'PLTR', 'CCJ', 'CEG', 'ETN', 'GEV')
  and not exists (
    select 1 from watchlist
    where watchlist.ticker = companies.ticker
      and watchlist.user_id is null
  );
