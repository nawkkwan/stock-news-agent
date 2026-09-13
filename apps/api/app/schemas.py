from typing import Any, Literal

from pydantic import BaseModel, Field


class ResearchRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9.\-]+$")
    question: str = Field(default="", max_length=1200)


class DiscoveryRequest(BaseModel):
    criteria: str = Field(min_length=3, max_length=1200)
    limit: int = Field(default=5, ge=1, le=10)


class WatchlistCreate(BaseModel):
    ticker: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9.\-]+$")
    reason: str = Field(default="", max_length=1200)
    status: Literal["not_started", "reading", "thesis_drafted", "ready_to_buy", "rejected"] = "not_started"


class DigestRequest(BaseModel):
    report_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class LeadDispatchRequest(BaseModel):
    command: str = Field(min_length=1, max_length=1600)


class RoomChatRequest(BaseModel):
    agent: Literal["scout", "analyst", "ranger"]
    question: str = Field(min_length=1, max_length=1200)


class AgentResponse(BaseModel):
    agent: Literal["lead", "research", "secretary", "discovery"]
    result: dict[str, Any]


class GeminiChatResponse(BaseModel):
    mode: Literal["gemini"] = "gemini"
    status: Literal["completed"] = "completed"
    agent: Literal["lead", "research", "secretary", "discovery"]
    result: dict[str, Any]


class HermesRunCreatedResponse(BaseModel):
    mode: Literal["hermes"] = "hermes"
    status: Literal["running"] = "running"
    run_id: str


class HermesRunStatusResponse(BaseModel):
    mode: Literal["hermes"] = "hermes"
    status: Literal["running", "succeeded", "failed"]
    result: dict[str, Any] | None = None
    error: str | None = None
