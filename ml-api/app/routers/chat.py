from fastapi import APIRouter
from app.llm.client import run_analyst_chat
from app.schemas import ChatRequest, ChatResponse

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def post_chat(payload: ChatRequest):
    history_dicts = [h.model_dump() for h in payload.history]
    result = run_analyst_chat(
        message=payload.message,
        municipality=payload.municipality,
        history=history_dicts,
        base_url=payload.llm_base_url,
        model_name=payload.llm_model,
    )
    return ChatResponse(**result)
