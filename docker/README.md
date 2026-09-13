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

`Dockerfile.hermes` extends the official Hermes Agent image and starts `hermes gateway run`. The browser never calls port 8642 directly; Azure exposes it only through internal Container Apps ingress and FastAPI owns the bearer credential.
