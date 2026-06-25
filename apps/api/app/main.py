from fastapi import FastAPI

from apps.api.app.config import get_settings


settings = get_settings()

app = FastAPI(
    title="Investment Research API",
    description="Foundation API for portfolio research, data readiness, and future research workflows.",
    version=settings.service_version,
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.service_name}


@app.get("/version")
def version() -> dict[str, object]:
    return {
        "service": settings.service_name,
        "version": settings.service_version,
        "environment": settings.environment,
        "supabase_configured": settings.supabase_configured,
        "supabase_backend_configured": settings.supabase_backend_configured,
        "tidb_configured": settings.tidb_configured,
    }
