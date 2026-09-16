begin;
select plan(14);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-one@example.test', now(), now()),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'owner-two@example.test', now(), now());

select tests.rls_enabled('public', 'portfolios');
select tests.rls_enabled('public', 'holdings');
select tests.rls_enabled('public', 'watchlist');
select tests.rls_enabled('public', 'agent_runs');
select tests.rls_enabled('public', 'hermes_thesis_notes');

select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'portfolios_one_per_user_uidx'),
  'one portfolio per user index exists'
);

select ok(
  (select is_nullable = 'NO' from information_schema.columns where table_schema = 'public' and table_name = 'holdings' and column_name = 'portfolio_id'),
  'holdings portfolio_id is required'
);

select ok(
  (select is_nullable = 'NO' from information_schema.columns where table_schema = 'public' and table_name = 'watchlist' and column_name = 'portfolio_id'),
  'watchlist portfolio_id is required'
);

select ok(
  has_table_privilege('anon', 'public.holdings', 'select') = false,
  'anonymous users cannot select holdings'
);

select ok(
  has_table_privilege('authenticated', 'public.agent_runs', 'insert') = false,
  'authenticated clients cannot write agent runs'
);

select ok(
  has_table_privilege('authenticated', 'public.hermes_thesis_notes', 'insert') = false,
  'authenticated clients cannot write Hermes thesis notes'
);

select is(
  (select count(*)::integer from public.portfolios where user_id in (
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002'
  )),
  2,
  'the Auth trigger creates exactly one portfolio for each new user'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.portfolios), 1, 'owner one sees only owner one portfolio');
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.portfolios), 1, 'owner two sees only owner two portfolio');
reset role;

select * from finish();
rollback;
