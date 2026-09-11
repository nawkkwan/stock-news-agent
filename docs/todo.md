# Todo

- Apply Supabase migration `202606170002_rename_decision_journal_to_investment_journal.sql`.
- Back up Supabase and apply `20260911145432_single_owner_portfolio_agent_foundation.sql`.
- Create the new Supabase Auth user and set `OWNER_SUPABASE_USER_ID`.
- Configure the Discord owner ID, webhook, Gemini, EODHD, and internal API secrets.
- Publish the existing Hermes image and map its commands using `docs/hermes-api.md`.
- Bootstrap Azure with `infra/azure/deploy.ps1` and verify the 18:00 Asia/Bangkok job.
- Confirm Vercel project root points to `apps/web`.
- Add the Azure deployment secrets and run the GitLab manual production deploy.
- Run the Supabase pgTAP tests after Docker Desktop or a linked staging project is available.
- Add real TiDB connection and migrations when research ingestion starts.
- Add dedicated prices table ingestion.
- Add journal prompts for post-investment review.
- Add sector and thesis templates to the knowledge base.
