-- Run after site/supabase/investment_os.sql.
-- Create the first Supabase Auth user before running this file if you want
-- existing single-user rows to be assigned to that account automatically.

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

alter table holdings add column if not exists latest_price numeric;

create table if not exists portfolio_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references companies(id) on delete set null,
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

create index if not exists portfolio_transactions_user_date_idx
  on portfolio_transactions (user_id, transaction_date desc, created_at desc);

create index if not exists portfolio_transactions_user_ticker_idx
  on portfolio_transactions (user_id, ticker, transaction_date desc);

-- Safe convenience migration for the current private single-user setup.
do $$
declare
  first_user_id uuid;
begin
  if (select count(*) from auth.users) = 1 then
    select id into first_user_id from auth.users limit 1;
    update companies set user_id = first_user_id where user_id is null;
    update holdings set user_id = first_user_id where user_id is null;
    update watchlist set user_id = first_user_id where user_id is null;
    update thesis_notes set user_id = first_user_id where user_id is null;
    update decision_journal set user_id = first_user_id where user_id is null;
    update news_items set user_id = first_user_id where user_id is null;
  end if;
end;
$$;

drop index if exists companies_single_user_ticker_uidx;
drop index if exists holdings_single_user_ticker_uidx;
drop index if exists watchlist_single_user_ticker_uidx;
drop index if exists thesis_notes_single_user_ticker_uidx;

create unique index if not exists companies_user_ticker_uidx on companies (user_id, ticker);
create unique index if not exists holdings_user_ticker_uidx on holdings (user_id, ticker);
create unique index if not exists watchlist_user_ticker_uidx on watchlist (user_id, ticker);
create unique index if not exists thesis_notes_user_ticker_uidx on thesis_notes (user_id, ticker);

alter table portfolio_transactions enable row level security;

drop policy if exists "users_manage_own_companies" on companies;
drop policy if exists "users_manage_own_holdings" on holdings;
drop policy if exists "users_manage_own_watchlist" on watchlist;
drop policy if exists "users_manage_own_thesis_notes" on thesis_notes;
drop policy if exists "users_manage_own_decision_journal" on decision_journal;
drop policy if exists "users_manage_own_news_items" on news_items;
drop policy if exists "users_manage_own_portfolio_transactions" on portfolio_transactions;

create policy "users_manage_own_companies"
  on companies for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_manage_own_holdings"
  on holdings for all to authenticated
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

create policy "users_manage_own_decision_journal"
  on decision_journal for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_manage_own_news_items"
  on news_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_manage_own_portfolio_transactions"
  on portfolio_transactions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on
  companies,
  holdings,
  watchlist,
  thesis_notes,
  decision_journal,
  news_items,
  portfolio_transactions
to authenticated;
