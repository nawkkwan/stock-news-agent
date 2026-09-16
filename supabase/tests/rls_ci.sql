\set ON_ERROR_STOP on
begin;

do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'portfolios_one_per_user_uidx') then
    raise exception 'one-portfolio unique index is missing';
  end if;
  if has_table_privilege('anon', 'public.holdings', 'select') then
    raise exception 'anon can read holdings';
  end if;
  if has_table_privilege('authenticated', 'public.agent_runs', 'insert') then
    raise exception 'authenticated clients can write agent runs';
  end if;
  if has_table_privilege('authenticated', 'public.hermes_thesis_notes', 'insert') then
    raise exception 'authenticated clients can write Hermes thesis notes';
  end if;
end;
$$;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ci-owner-one@example.test', now(), now()),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'ci-owner-two@example.test', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
do $$ begin
  if (select count(*) from public.portfolios) <> 1 then
    raise exception 'owner one RLS isolation failed';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
do $$ begin
  if (select count(*) from public.portfolios) <> 1 then
    raise exception 'owner two RLS isolation failed';
  end if;
end $$;

reset role;
rollback;
