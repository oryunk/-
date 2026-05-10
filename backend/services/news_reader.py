"""뉴스 독자용 GPT 해설."""

from app_state import DEFAULT_GPT_MODEL
from services.gpt_client import call_gpt


def explain_news_reader_text(title: str, summary: str):
    """주린이 독자용 짧은 뉴스 해설 (GPT)."""
    body = (summary or "").strip()
    if len(body) > 3500:
        body = body[:3500] + "…"
    prompt = (
        "주린이 투자자에게 아래 경제·증시 뉴스를 쉽게 풀어서 설명하라.\n\n"
        f"[제목]\n{title}\n\n[요약]\n{body}\n\n"
        "[작성 규칙]\n"
        "- 한국어, 4~7문장.\n"
        "- 핵심 사실과 시장에서 왜 주목되는지(맥락)를 포함한다.\n"
        "- 특정 종목의 매수·매도를 직접 권유하지 않는다.\n"
        "- 확인되지 않은 추측은 완곡하게 표현한다.\n"
    )
    return call_gpt(prompt, model=DEFAULT_GPT_MODEL)
