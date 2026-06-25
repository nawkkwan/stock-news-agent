do $$
begin
  if to_regclass('public.decision_journal') is not null
     and to_regclass('public.investment_journal') is null then
    alter table public.decision_journal rename to investment_journal;
  end if;
end;
$$;

alter table if exists public.investment_journal
  add column if not exists date date;

do $$
begin
  if to_regclass('public.investment_journal') is not null then
    update public.investment_journal
    set date = created_at::date
    where date is null;
  end if;
end;
$$;

alter table if exists public.investment_journal
  alter column date set default current_date;

alter table if exists public.investment_journal
  alter column date set not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'investment_journal'
      and column_name = 'confidence_score'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'investment_journal'
      and column_name = 'confidence'
  ) then
    alter table public.investment_journal rename column confidence_score to confidence;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'investment_journal'
      and column_name = 'confidence_score'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'investment_journal'
      and column_name = 'confidence'
  ) then
    update public.investment_journal
    set confidence = coalesce(confidence, confidence_score);
    alter table public.investment_journal drop column confidence_score;
  end if;
end;
$$;

alter table if exists public.investment_journal
  add column if not exists risk text;

do $$
begin
  if to_regclass('public.investment_journal') is not null
     and not exists (
    select 1
    from pg_constraint
    where conname = 'investment_journal_confidence_check'
      and conrelid = 'public.investment_journal'::regclass
  ) then
    alter table public.investment_journal
      add constraint investment_journal_confidence_check
      check (confidence is null or (confidence >= 0 and confidence <= 100));
  end if;
end;
$$;

alter table if exists public.investment_journal enable row level security;

drop index if exists public.decision_journal_ticker_created_idx;
create index if not exists investment_journal_ticker_date_idx
  on public.investment_journal (ticker, date desc, created_at desc);
create index if not exists investment_journal_user_date_idx
  on public.investment_journal (user_id, date desc, created_at desc);

drop policy if exists "users_manage_own_decision_journal" on public.investment_journal;
drop policy if exists "users_manage_own_investment_journal" on public.investment_journal;

create policy "users_manage_own_investment_journal"
  on public.investment_journal for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.investment_journal to authenticated;
