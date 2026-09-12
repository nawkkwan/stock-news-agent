from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException

from apps.api.app.config import get_settings
from apps.api.app.schemas import AgentResponse, DigestRequest, DiscoveryRequest, LeadDispatchRequest, ResearchRequest, RoomChatRequest, WatchlistCreate
from apps.api.app.security import require_hermes_owner, require_internal_token, require_supabase_user
from apps.api.app.services import GeminiAgentTeam, ServiceError, SupabasePortfolioStore


settings = get_settings()

app = FastAPI(
    title="Investment Research API",
    description="Owner-only portfolio research API for Hermes and the four-agent team.",
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
        "hermes_configured": settings.hermes_configured,
        "gemini_model": settings.gemini_model,
    }


def store() -> SupabasePortfolioStore:
    try:
        return SupabasePortfolioStore(settings)
    except ServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def team(portfolio_store: SupabasePortfolioStore = Depends(store)) -> GeminiAgentTeam:
    try:
        return GeminiAgentTeam(settings, portfolio_store)
    except ServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


HermesOwner = Annotated[None, Depends(require_hermes_owner)]
InternalCaller = Annotated[None, Depends(require_internal_token)]
SupabaseUser = Annotated[str, Depends(require_supabase_user)]


def user_store(user_id: SupabaseUser) -> SupabasePortfolioStore:
    try:
        return SupabasePortfolioStore(settings, user_id=user_id)
    except ServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def user_team(portfolio_store: SupabasePortfolioStore = Depends(user_store)) -> GeminiAgentTeam:
    try:
        return GeminiAgentTeam(settings, portfolio_store)
    except ServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/v1/portfolio/context")
def portfolio_context(_: HermesOwner, portfolio_store: SupabasePortfolioStore = Depends(store)) -> dict[str, object]:
    try:
        return portfolio_store.context()
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/v1/research", response_model=AgentResponse)
def research(payload: ResearchRequest, _: HermesOwner, agents: GeminiAgentTeam = Depends(team)) -> AgentResponse:
    try:
        return AgentResponse(agent="research", result=agents.research(payload.ticker, payload.question))
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/v1/agent/dispatch", response_model=AgentResponse)
def dispatch(payload: LeadDispatchRequest, _: HermesOwner, agents: GeminiAgentTeam = Depends(team)) -> AgentResponse:
    try:
        return AgentResponse(agent="lead", result=agents.lead(payload.command))
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/v1/agent/chat", response_model=AgentResponse)
def room_chat(payload: RoomChatRequest, _: HermesOwner, agents: GeminiAgentTeam = Depends(team)) -> AgentResponse:
    try:
        role, result = agents.room_chat(payload.agent, payload.question)
        return AgentResponse(agent=role, result=result)
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/v1/user/agent/chat", response_model=AgentResponse)
def user_room_chat(payload: RoomChatRequest, agents: GeminiAgentTeam = Depends(user_team)) -> AgentResponse:
    try:
        role, result = agents.room_chat(payload.agent, payload.question)
        return AgentResponse(agent=role, result=result)
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/v1/discover", response_model=AgentResponse)
def discover(payload: DiscoveryRequest, _: HermesOwner, agents: GeminiAgentTeam = Depends(team)) -> AgentResponse:
    try:
        return AgentResponse(agent="discovery", result=agents.discover(payload.criteria, payload.limit))
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/v1/watchlist")
def add_watchlist(payload: WatchlistCreate, _: HermesOwner, portfolio_store: SupabasePortfolioStore = Depends(store)) -> dict[str, object]:
    try:
        return portfolio_store.upsert_watchlist(payload.ticker, payload.reason, payload.status)
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.delete("/v1/watchlist/{ticker}")
def remove_watchlist(ticker: str, _: HermesOwner, portfolio_store: SupabasePortfolioStore = Depends(store)) -> dict[str, bool]:
    try:
        portfolio_store.remove_watchlist(ticker)
        return {"removed": True}
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/v1/briefings/latest")
def latest_briefing(_: HermesOwner, portfolio_store: SupabasePortfolioStore = Depends(store)) -> dict[str, object]:
    try:
        return {"briefing": portfolio_store.latest_briefing()}
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/v1/alerts/status")
def alert_status(_: HermesOwner, portfolio_store: SupabasePortfolioStore = Depends(store)) -> dict[str, object]:
    try:
        return {"alert": portfolio_store.alert_status()}
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/v1/digest/run", response_model=AgentResponse)
def run_digest(payload: DigestRequest, _: InternalCaller, agents: GeminiAgentTeam = Depends(team)) -> AgentResponse:
    try:
        return AgentResponse(agent="secretary", result=agents.digest(payload.report_date))
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
