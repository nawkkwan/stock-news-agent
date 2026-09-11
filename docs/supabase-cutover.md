# Supabase cutover

The final migration archives every legacy owner snapshot and then clears the active portfolio tables. Do not run it against production until a Supabase backup has completed.

1. Create or verify a Supabase backup in the dashboard.
2. Apply all pending migrations to a staging project first.
3. Run `supabase/tests/rls_ci.sql` against staging and verify that it rolls back successfully.
4. Link the CLI to production and inspect the pending SQL with `npx supabase db push --dry-run`.
5. Apply with `npx supabase db push`.
6. In SQL Editor, verify `private.portfolio_archives`. Each snapshot contains `source_counts`; every count must equal the length of the matching JSON array.
7. Create the new user in Supabase Auth. The trigger creates `Main Portfolio` automatically.
8. Copy the new Auth UUID to `OWNER_SUPABASE_USER_ID`. Do not copy legacy archived data into the new account.
9. Put only the publishable key in the web deployment. Keep the service-role key in Azure secrets for API and worker only.

If a row had already been deleted before this migration, it is not included in the archive and can be recovered only from a Supabase backup that still contains it.
