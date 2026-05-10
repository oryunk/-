"""OpenAI 호출 및 GPT 산문 정리."""

import re

import requests

from app_state import (
    DEFAULT_GPT_MODEL,
    GPT_AVAILABLE,
    OPENAI_API_KEY,
    OPENAI_API_URL,
)


def clean_gpt_prose(text: str) -> str:
    """모델이 삼중따옴표·펜스·프롬프트 꼬리표를 그대로 내보낼 때 제거(용어 설명·뉴스 쉬운 설명 등 산문용)."""
    if not text or not str(text).strip():
        return str(text or "").strip()
    s = str(text).strip()
    for _ in range(6):
        t = s.strip()
        if len(t) >= 6 and t.startswith('"""') and t.endswith('"""'):
            s = t[3:-3].strip()
            continue
        if len(t) >= 6 and t.startswith("'''") and t.endswith("'''"):
            s = t[3:-3].strip()
            continue
        break
    m = re.match(r"^```(?:[a-zA-Z0-9_-]*)?\s*\r?\n([\s\S]*?)\r?\n```\s*$", s)
    if m:
        s = m.group(1).strip()
    lines = s.split("\n")

    def _is_fence_line(ln: str) -> bool:
        x = ln.strip()
        return x in ('"""', "'''", '"', "'", '```', "''", '""') or re.fullmatch(r"`{3,}", x) is not None

    while lines and _is_fence_line(lines[0]):
        lines.pop(0)
    while lines and _is_fence_line(lines[-1]):
        lines.pop()
    s = "\n".join(lines).strip()
    for marker in (
        "\n[작성 규칙]",
        "\n[사용자 질문]",
        "\n[제목]",
        "\n[요약]",
        "\n---\n[작성",
    ):
        idx = s.find(marker)
        if idx != -1:
            s = s[:idx].strip()
            break
    return s.strip()


def call_gpt(prompt_text, model=DEFAULT_GPT_MODEL):
    """OpenAI GPT API 호출 (용어 설명용)."""
    if not GPT_AVAILABLE:
        return {
            "success": False,
            "status_code": 500,
            "message": "GPT API가 설정되지 않았습니다. OPENAI_API_KEY 또는 GPT_API_KEY를 확인해주세요.",
        }

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "content-type": "application/json",
    }
    payload = {
        "model": model,
        "max_completion_tokens": 4000,
        "messages": [{"role": "user", "content": prompt_text}],
    }

    try:
        response = requests.post(OPENAI_API_URL, headers=headers, json=payload, timeout=40)
    except Exception as err:
        return {"success": False, "status_code": 503, "message": f"GPT 호출 실패: {err}"}

    if not response.ok:
        message = f"GPT API 호출 실패({response.status_code})"
        try:
            error_payload = response.json()
            api_msg = (((error_payload or {}).get("error") or {}).get("message") or "").strip()
            if api_msg:
                message = api_msg
        except Exception:
            pass
        upper_msg = message.upper()
        if ("CREDIT BALANCE IS TOO LOW" in upper_msg) or (
            "INSUFFICIENT" in upper_msg and "CREDIT" in upper_msg
        ) or ("INSUFFICIENT_QUOTA" in upper_msg):
            return {"success": False, "status_code": 429, "message": message}
        return {"success": False, "status_code": response.status_code, "message": message}

    try:
        data = response.json()
    except Exception:
        return {"success": False, "status_code": 500, "message": "GPT 응답 JSON 파싱에 실패했습니다."}

    choices = data.get("choices") or []
    first_choice = choices[0] if choices else {}
    message_obj = first_choice.get("message") if isinstance(first_choice, dict) else {}
    final_text = ((message_obj or {}).get("content") or "").strip()
    if not final_text:
        return {"success": False, "status_code": 500, "message": "GPT 응답 텍스트가 비어 있습니다."}

    return {"success": True, "text": final_text}


# 호환 별칭 (app.py 등 기존 이름)
_clean_gpt_prose = clean_gpt_prose
