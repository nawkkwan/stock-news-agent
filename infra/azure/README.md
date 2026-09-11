# Azure deployment

This repository deploys two images from one repository:

- `docker/Dockerfile.api` → Azure Container App
- `docker/Dockerfile.worker` → Azure Container Apps scheduled job

Hermes can remain in its existing repository. Pass its published image as `-HermesImage` to run it as an always-on Container App in the same environment.

Set the required environment variables from `.env.example`, authenticate with `az login`, then run from the repository root:

```powershell
.\infra\azure\deploy.ps1 -ResourceGroup investment-os-rg -AcrName <globally-unique-acr-name> -HermesImage <optional-hermes-image>
```

The worker schedule is `0 11 * * *`, which is 18:00 in Asia/Bangkok. Secrets are stored as Container Apps secrets and are never included in an image.

For GitLab, configure protected CI/CD variables:

- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_ACR_NAME`
- `AZURE_API_APP_NAME`
- `AZURE_WORKER_JOB_NAME`
- `SUPABASE_TEST_DATABASE_URL` (a dedicated staging Supabase direct Postgres URL used by the RLS gate)
