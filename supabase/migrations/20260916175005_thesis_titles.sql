-- Keep the owner's and Hermes's thesis titles independent. Existing rows remain valid.
alter table public.thesis_notes add column if not exists title text;
alter table public.hermes_thesis_notes add column if not exists title text;
