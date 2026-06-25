# Docker

Local Docker foundation for the Investment Research Engine.

Run the API:

```powershell
docker compose -f docker/docker-compose.dev.yml up api
```

Then open:

```text
http://localhost:8000/health
http://localhost:8000/version
```

Run the worker profile:

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker run --rm worker
```

Notes:

- The API and worker read local environment values from `.env`.
- Keep real secrets out of git.
- DigitalOcean deployment is intentionally out of scope for this phase.

Reserved for future web, worker, and bot Dockerfiles.

Docker is not active in v0.1.
