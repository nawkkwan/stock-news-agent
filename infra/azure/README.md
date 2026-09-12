# Azure deployment

This repository deploys two images from one repository:

- `docker/Dockerfile.api` → Azure Container App
- `docker/Dockerfile.worker` → Azure Container Apps scheduled job

Hermes can remain in its existing repository. Pass its published image as `-HermesImage` to run it as an always-on Container App in the same environment.

Set the required environment variables from `.env.example`, authenticate with `az login`, then run from the repository root. The script defaults to using an image already built by GitLab CI because Azure for Students blocks ACR Tasks:

Required runtime secrets are the Supabase URL/service-role key and owner UUID, internal API token, Gemini key, EODHD key, Discord owner ID, and Discord webhook. `DISCORD_BOT_TOKEN` is additionally required when deploying a Hermes image.

```powershell
.\infra\azure\deploy.ps1 -ResourceGroup investment-os-eastasia-rg -AcrName stockagentkwan2549 -Location eastasia -ImageTag latest
```

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

The `build_api` and `build_worker` GitLab jobs use Docker-in-Docker to build and push images to ACR. This avoids both Docker Desktop on the development computer and the ACR Tasks restriction on Azure for Students. The first successful pipeline publishes `investment-api:latest` and `investment-worker:latest`; run the PowerShell command above once to create the API and scheduled worker from those images.
