import json
from typing import Any
import httpx
from openai import OpenAI
from app.config import settings
from app.llm.tools import TOOL_DEFINITIONS, execute_tool

SYSTEM_PROMPT = """Ти си StreetAware AI — експертен пътен анализатор за пътната безопасност в България.
Работиш стриктно със предоставените 4 инструмента за извличане на реални данни от базата данни и ML модела.
Правила:
1. НИКОГА не си измисляй числа, проценти или локации. Цитирай точно върнатите стойности от инструментите.
2. Отговаряй стегнато, ясно и структурирано на езика на потребителя (български или английски).
3. Посочвай конкретни мерки за безопасност на водачите и местните власти."""


def run_analyst_chat(
    message: str,
    municipality: str | None = None,
    history: list[dict] | None = None,
    base_url: str | None = None,
    model_name: str | None = None,
) -> dict:
    target_base_url = (base_url or settings.LLM_BASE_URL).rstrip("/")
    target_model = model_name or settings.LLM_MODEL

    try:
        health_check = httpx.get(f"{target_base_url}/models", timeout=1.5)
        if health_check.status_code >= 400:
            return {
                "llm_available": False,
                "answer": "Локалният LLM модел (Ollama / LM Studio) в момента не е достъпен на посочения адрес. Моля проверете дали сървърът работи на порт 11434 или 1234.",
                "tool_calls_used": [],
                "data_citations": [],
            }
    except Exception:
        return {
            "llm_available": False,
            "answer": "Локалният LLM модел (Ollama / LM Studio) в момента не е достъпен. Моля стартирайте Ollama или LM Studio с модел qwen3.5:9b.",
            "tool_calls_used": [],
            "data_citations": [],
        }

    client = OpenAI(
        base_url=target_base_url,
        api_key=settings.LLM_API_KEY,
        timeout=15.0,
    )

    messages: list[Any] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        for h in history[-6:]:
            messages.append({"role": h["role"], "content": h["content"]})

    user_content = message
    if municipality and municipality.lower() not in message.lower():
        user_content += f" (Фокус върху община: {municipality})"
    messages.append({"role": "user", "content": user_content})

    tool_calls_used: list[str] = []
    data_citations: list[dict[str, Any]] = []

    try:
        for _ in range(3):
            response = client.chat.completions.create(
                model=target_model,
                messages=messages,
                tools=TOOL_DEFINITIONS,  # type: ignore
                tool_choice="auto",
                temperature=0.2,
            )

            msg = response.choices[0].message
            if not msg.tool_calls:
                return {
                    "llm_available": True,
                    "answer": msg.content or "Няма отговор от модела.",
                    "tool_calls_used": tool_calls_used,
                    "data_citations": data_citations,
                }

            messages.append(msg)
            for tc in msg.tool_calls:
                if not hasattr(tc, "function"):
                    continue
                fn_name = tc.function.name
                fn_args = {}
                try:
                    fn_args = json.loads(tc.function.arguments)
                except Exception:
                    pass

                tool_calls_used.append(fn_name)
                tool_result = execute_tool(fn_name, fn_args)
                data_citations.append({"tool": fn_name, "data": tool_result})

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": fn_name,
                    "content": json.dumps(tool_result, ensure_ascii=False),
                })

        final_resp = client.chat.completions.create(
            model=target_model,
            messages=messages,
            temperature=0.2,
        )
        return {
            "llm_available": True,
            "answer": final_resp.choices[0].message.content or "Анализът приключи.",
            "tool_calls_used": tool_calls_used,
            "data_citations": data_citations,
        }
    except Exception as e:
        return {
            "llm_available": False,
            "answer": f"Възникна грешка при изпълнение на LLM заявката: {str(e)}",
            "tool_calls_used": tool_calls_used,
            "data_citations": data_citations,
        }
