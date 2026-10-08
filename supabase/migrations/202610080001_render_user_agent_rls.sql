begin;

drop policy if exists agent_runs_insert_own on public.agent_runs;
create policy agent_runs_insert_own
  on public.agent_runs for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert on public.agent_runs to authenticated;

drop policy if exists stock_research_snapshots_insert_own on public.stock_research_snapshots;
create policy stock_research_snapshots_insert_own
  on public.stock_research_snapshots for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists stock_research_snapshots_update_own on public.stock_research_snapshots;
create policy stock_research_snapshots_update_own
  on public.stock_research_snapshots for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update on public.stock_research_snapshots to authenticated;

alter table public.hermes_thesis_notes
  drop constraint if exists hermes_thesis_notes_source_kind_check;
alter table public.hermes_thesis_notes
  add constraint hermes_thesis_notes_source_kind_check
  check (source_kind in ('research', 'pixel_agent_append', 'gemini_agent', 'gemini_research'));

drop policy if exists hermes_thesis_notes_insert_own on public.hermes_thesis_notes;
create policy hermes_thesis_notes_insert_own
  on public.hermes_thesis_notes for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists hermes_thesis_notes_update_own on public.hermes_thesis_notes;
create policy hermes_thesis_notes_update_own
  on public.hermes_thesis_notes for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update on public.hermes_thesis_notes to authenticated;

commit;
