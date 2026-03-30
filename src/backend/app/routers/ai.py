from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import User
from ..schemas import AIChatRequest, AIChatResponse, AIContextResponse
from ..services.assistant import build_ai_context_response, build_quick_questions, chat_with_assistant

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/context", response_model=AIContextResponse)
def get_ai_context(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return build_ai_context_response(db, current_user)


@router.get("/quick-questions", response_model=list[str])
def get_quick_questions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return build_quick_questions(db, current_user)


@router.post("/chat", response_model=AIChatResponse)
def chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    history = [x.model_dump() for x in payload.history]
    result = chat_with_assistant(db, current_user, payload.message, history)
    return AIChatResponse(reply=result["reply"], citations=result.get("citations", []))
