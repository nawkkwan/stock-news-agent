# Azure deployment

This repository deploys three images from one repository:

- `docker/Dockerfile.api` → Azure Container App
- `docker/Dockerfile.worker` → Azure Container Apps scheduled job
- `docker/Dockerfile.hermes` → internal, always-on official Hermes Agent

The Hermes image derives from the official `nousresearch/hermes-agent` image pinned by digest. It seeds a secret-free config and the `portfolio-agent` skill, then persists `/opt/data` on an Azure Files share. Its API ingress is internal and FastAPI reaches it at `http://investment-hermes` inside the same Container Apps environment.

Set the required environment variables from `.env.example`, authenticate with `az login`, then run from the repository root. The script defaults to using an image already built by GitLab CI because Azure for Students blocks ACR Tasks:

Required runtime secrets are the Supabase URL/service-role key and owner UUID, internal API token, Gemini key, EODHD key, Discord owner ID, and Discord webhook. The script generates `HERMES_API_KEY` with the Windows-compatible RNG API when it is absent, then stores it in both Container Apps as an Azure secret.

```powershell
.\infra\azure\deploy.ps1 -ResourceGroup investment-os-eastasia-rg -AcrName stockagentkwan2549 -Location eastasia -ImageTag latest
```

This first run leaves Discord disabled so the local `nakin` gateway cannot fight the cloud instance for the same bot token. It creates:

- internal `investment-hermes` ingress on port `8642`
- one Hermes replica with 1 CPU / 2 GiB
- a Standard_LRS storage account and 5 GiB Azure Files share
- the API-to-Hermes secret and internal URL

Migrate the allowlisted local state once. This command never uploads `.env`, `auth.json`, sessions, logs, caches, or gateway state:

```powershell
.\infra\azure\migrate-hermes-state.ps1 -ResourceGroup investment-os-eastasia-rg -StorageAccountName stockagentkwan2549data
```

Test the owner web flow first. Only after it succeeds, stop the local gateway and rerun with Discord enabled:

```powershell
.\infra\azure\deploy.ps1 -ResourceGroup investment-os-eastasia-rg -AcrName stockagentkwan2549 -Location eastasia -ImageTag latest -EnableHermesDiscord
```

`DISCORD_BOT_TOKEN` is required only for that cutover command. Keep `apps/hermes` until the cutover is verified; it is the rollback bridge and can be removed in a later commit.

Only use `-BuildImagesWithAcr` on an Azure subscription that supports ACR Tasks.

The worker schedule is `0 11 * * *`, which is 18:00 in Asia/Bangkok. Secrets are stored as Container Apps secrets and are never included in an image.

For GitLab, configure protected CI/CD variables in **Settings → CI/CD → Variables**. Mark every secret as **Masked** and **Protected**:

- `AZURE_ACR_LOGIN_SERVER` — `stockagentkwan2549.azurecr.io`
- `AZURE_ACR_USERNAME` — Azure Portal → Container registries → stockagentkwan2549 → Access keys → Username
- `AZURE_ACR_PASSWORD` — the first password from the same Access keys page

- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_ACR_NAME`
- `AZURE_API_APP_NAME`
- `AZURE_WORKER_JOB_NAME`
- `SUPABASE_TEST_DATABASE_URL` (a dedicated staging Supabase direct Postgres URL used by the RLS gate)

Also set `AZURE_HERMES_APP_NAME=investment-hermes`. The `build_api`, `build_worker`, and `build_hermes` jobs use Docker-in-Docker to build and push images to ACR. Production deploy remains manual. Run the PowerShell command once to create storage, secrets, internal ingress, and mounts; later manual GitLab deploys update the three images.

Cloudflare needs the server-side `OWNER_SUPABASE_USER_ID` variable so the Pixel room can label the Owner experience. Authorization is still enforced by FastAPI using the verified Supabase UUID; changing this UI variable cannot grant Hermes access.
