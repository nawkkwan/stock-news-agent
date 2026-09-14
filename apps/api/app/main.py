import re
from typing import Annotated, Any
from uuid import UUID
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse

from apps.api.app.config import get_settings
from apps.api.app.schemas import AgentResponse, DigestRequest, DiscoveryRequest, GeminiChatResponse, HermesRunCreatedResponse, HermesRunStatusResponse, LeadDispatchRequest, ResearchRequest, RoomChatRequest, StockResearchRequest, WatchlistCreate
from apps.api.app.security import require_hermes_owner, require_internal_token, require_supabase_user
from apps.api.app.services import GeminiAgentTeam, HermesAgentClient, ServiceError, SupabasePortfolioStore
from packages.shared.technical_levels import calculate_review_zones


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


def normalized_ticker(value: str) -> str:
    ticker = value.strip().upper()
    if not re.fullmatch(r"[A-Z0-9.\-]{1,20}", ticker):
        raise HTTPException(status_code=400, detail="Invalid ticker.")
    return ticker


def decision_with_watch_zone(result: dict[str, Any], market: dict[str, Any]) -> dict[str, Any]:
    decision = dict(result)
    zones = market.get("review_zones") if isinstance(market.get("review_zones"), list) else []
    supports = [zone.get("center") for zone in zones if isinstance(zone, dict) and isinstance(zone.get("center"), (int, float))]
    existing_zone = decision.get("watch_zone") if isinstance(decision.get("watch_zone"), dict) else {}
    decision["watch_zone"] = {
        **existing_zone,
        "zones": zones[:3],
        "levels": supports[:3],
        "lower": min(supports) if supports else None,
        "upper": max(supports) if supports else None,
        "rationale": "โซนทบทวนจาก Swing Low ที่ราคาเคยตอบสนองซ้ำ วัดความกว้างด้วย ATR และให้คะแนนจากจำนวนครั้งที่แตะ Volume ความสด และช่วงเวลา ไม่ใช่สัญญาณซื้อ",
        "conditions": existing_zone.get("conditions") or [
            "ตรวจว่าข่าวหรือสมมติฐานธุรกิจเปลี่ยนจริงหรือไม่",
            "ตรวจแนวโน้มราคาและปริมาณซื้อขายอีกครั้ง",
            "ทบทวนน้ำหนักและความเสี่ยงรวมของพอร์ต",
        ],
    }
    return decision


def market_from_snapshot(snapshot: dict[str, Any] | None) -> dict[str, Any] | None:
    if not snapshot or not isinstance(snapshot.get("market_snapshot"), dict):
        return None
    market = snapshot["market_snapshot"]
    raw_history = market.get("price_history")
    if not isinstance(raw_history, list) or len(raw_history) < 2:
        return None
    history = []
    for row in raw_history:
        if not isinstance(row, dict) or row.get("close") is None or not row.get("date"):
            continue
        close = float(row["close"])
        history.append({
            "date": str(row["date"]),
            "open": float(row.get("open") or close),
            "high": float(row.get("high") or close),
            "low": float(row.get("low") or close),
            "close": close,
            "volume": int(row.get("volume") or 0),
        })
    if len(history) < 2:
        return None
    previous = history[-2]["close"]
    current = history[-1]["close"]
    review_zones = market.get("review_zones") if isinstance(market.get("review_zones"), list) else calculate_review_zones(history)
    return {
        "ticker": snapshot.get("ticker"),
        "available": True,
        "provider": str(market.get("provider") or "Daily Worker"),
        "currency": "USD",
        "as_of": market.get("last_date") or history[-1]["date"],
        "price": current,
        "previous_close": previous,
        "change": round(current - previous, 4),
        "change_pct": round(((current - previous) / previous * 100) if previous else 0, 4),
        "day_low": current,
        "day_high": current,
        "support_zones": [zone["center"] for zone in review_zones if isinstance(zone, dict) and isinstance(zone.get("center"), (int, float))],
        "review_zones": review_zones,
        "resistance_zones": market.get("resistance_zones") or [],
        "history": history,
    }


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


@app.post("/v1/user/agent/chat", response_model=GeminiChatResponse | HermesRunCreatedResponse)
def user_room_chat(
    payload: RoomChatRequest,
    user_id: SupabaseUser,
    portfolio_store: SupabasePortfolioStore = Depends(user_store),
) -> JSONResponse:
    try:
        if user_id == settings.owner_supabase_user_id:
            role = HermesAgentClient.ROLE_MAP[payload.agent]
            run = portfolio_store.create_agent_run(
                role,
                {"mode": "hermes", "agent": payload.agent, "question": payload.question},
            )
            try:
                hermes_run_id = HermesAgentClient(settings).start_run(
                    agent=payload.agent,
                    question=payload.question,
                    context=portfolio_store.context(),
                    idempotency_key=str(run["id"]),
                )
            except ServiceError:
                portfolio_store.update_agent_run(
                    str(run["id"]),
                    "failed",
                    error="Hermes run could not be started.",
                )
                raise
            portfolio_store.update_agent_run(
                str(run["id"]),
                "running",
                response_data={"hermes_run_id": hermes_run_id},
            )
            return JSONResponse(
                status_code=202,
                content={"mode": "hermes", "status": "running", "run_id": str(run["id"])},
            )

        agents = GeminiAgentTeam(settings, portfolio_store)
        role, result = agents.room_chat(payload.agent, payload.question)
        return JSONResponse(
            status_code=200,
            content={"mode": "gemini", "status": "completed", "agent": role, "result": result},
        )
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/v1/user/agent/history")
def user_agent_history(
    user_id: SupabaseUser,
    portfolio_store: SupabasePortfolioStore = Depends(user_store),
) -> dict[str, object]:
    if user_id != settings.owner_supabase_user_id:
        raise HTTPException(status_code=403, detail="Hermes is only available to the owner account.")
    try:
        return {"runs": portfolio_store.list_hermes_agent_runs()}
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/v1/user/stocks/{ticker}")
def user_stock_overview(
    ticker: str,
    _user_id: SupabaseUser,
    portfolio_store: SupabasePortfolioStore = Depends(user_store),
) -> dict[str, object]:
    normalized = normalized_ticker(ticker)
    try:
        agents = GeminiAgentTeam(settings, portfolio_store)
        snapshots = portfolio_store.research_snapshots(normalized)
        return {
            "ticker": normalized,
            "context": portfolio_store.stock_context(normalized),
            "market": market_from_snapshot(snapshots[0] if snapshots else None) or agents.market_overview(normalized),
            "snapshots": snapshots,
        }
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/v1/user/stocks/{ticker}/research")
def user_stock_research(
    ticker: str,
    payload: StockResearchRequest,
    user_id: SupabaseUser,
    portfolio_store: SupabasePortfolioStore = Depends(user_store),
) -> JSONResponse:
    normalized = normalized_ticker(ticker)
    question = payload.question.strip() or (
        f"วิเคราะห์ {normalized} จากราคา ข่าว Thesis และน้ำหนักพอร์ต แยกข้อเท็จจริงกับข้อสรุป "
        "พร้อม Watch Zone ที่เป็นเพียงช่วงกลับมาทบทวน"
    )
    try:
        market = GeminiAgentTeam(settings, portfolio_store).market_overview(normalized)
        if user_id == settings.owner_supabase_user_id:
            run = portfolio_store.create_agent_run(
                "research",
                {"mode": "hermes", "kind": "stock_research", "agent": "analyst", "ticker": normalized, "question": question},
            )
            try:
                hermes_run_id = HermesAgentClient(settings).start_run(
                    agent="analyst",
                    question=question,
                    context={**portfolio_store.stock_context(normalized), "market": market},
                    idempotency_key=str(run["id"]),
                )
            except ServiceError:
                portfolio_store.update_agent_run(str(run["id"]), "failed", error="Hermes stock research could not be started.")
                raise
            portfolio_store.update_agent_run(str(run["id"]), "running", response_data={"hermes_run_id": hermes_run_id})
            return JSONResponse(status_code=202, content={"mode": "hermes", "status": "running", "run_id": str(run["id"])})

        result = GeminiAgentTeam(settings, portfolio_store).research(normalized, question)
        decision = decision_with_watch_zone(result, market)
        snapshot = portfolio_store.save_research_snapshot(
            ticker=normalized,
            source="gemini",
            market_snapshot=market,
            decision_summary=decision,
            news_count=len(portfolio_store.stock_context(normalized).get("news", [])),
            dedupe_key=f"gemini:{normalized}:{user_id}:{uuid4()}",
        )
        return JSONResponse(status_code=200, content={"mode": "gemini", "status": "completed", "result": decision, "snapshot_id": snapshot["id"]})
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/v1/user/agent/runs/{run_id}", response_model=HermesRunStatusResponse)
def user_agent_run_status(
    run_id: UUID,
    user_id: SupabaseUser,
    portfolio_store: SupabasePortfolioStore = Depends(user_store),
) -> dict[str, object | None]:
    if user_id != settings.owner_supabase_user_id:
        raise HTTPException(status_code=403, detail="Hermes is only available to the owner account.")

    try:
        local_run_id = str(run_id)
        run = portfolio_store.get_agent_run(local_run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Agent run was not found.")
        if run["status"] in {"succeeded", "failed"}:
            return {
                "mode": "hermes",
                "status": run["status"],
                "result": run.get("response") if run["status"] == "succeeded" else None,
                "error": run.get("error"),
            }

        stored_response = run.get("response") if isinstance(run.get("response"), dict) else {}
        hermes_run_id = str(stored_response.get("hermes_run_id") or "").strip()
        if not hermes_run_id:
            portfolio_store.update_agent_run(local_run_id, "failed", error="Hermes run reference is missing.")
            return {"mode": "hermes", "status": "failed", "result": None, "error": "Hermes run reference is missing."}

        hermes_run = HermesAgentClient(settings).get_run(hermes_run_id)
        hermes_status = str(hermes_run.get("status") or "running").lower()
        if hermes_status == "completed":
            output = hermes_run.get("output")
            result = output if isinstance(output, dict) else {"summary": str(output or "Hermes completed without text output.")}
            request_data = run.get("request") if isinstance(run.get("request"), dict) else {}
            if request_data.get("kind") == "stock_research" and request_data.get("ticker"):
                ticker = normalized_ticker(str(request_data["ticker"]))
                market = GeminiAgentTeam(settings, portfolio_store).market_overview(ticker)
                result = decision_with_watch_zone(result, market)
                snapshot = portfolio_store.save_research_snapshot(
                    ticker=ticker,
                    source="hermes",
                    market_snapshot=market,
                    decision_summary=result,
                    news_count=len(portfolio_store.stock_context(ticker).get("news", [])),
                    dedupe_key=f"agent:{local_run_id}",
                    agent_run_id=local_run_id,
                )
                result = {**result, "snapshot_id": snapshot["id"]}
            portfolio_store.update_agent_run(local_run_id, "succeeded", response_data=result)
            return {"mode": "hermes", "status": "succeeded", "result": result, "error": None}
        if hermes_status in {"failed", "cancelled"}:
            safe_error = "Hermes could not complete this run."
            portfolio_store.update_agent_run(local_run_id, "failed", error=safe_error)
            return {"mode": "hermes", "status": "failed", "result": None, "error": safe_error}
        return {"mode": "hermes", "status": "running", "result": None, "error": None}
    except HTTPException:
        raise
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
