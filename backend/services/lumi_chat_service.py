"""루미 AI 챗봇 — GPT 응답·FAQ 폴백·DB CRUD."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime
from typing import Any

import requests

from app_state import DEFAULT_GPT_MODEL, GPT_AVAILABLE, OPENAI_API_KEY, OPENAI_API_URL
from services.gpt_client import clean_gpt_prose
from services.lumi_market_context import (
    build_market_snapshot,
    detect_outlook_intent,
    format_user_message_with_snapshot,
    intent_needs_snapshot,
)

LUMI_CHAT_ENABLED = os.getenv("LUMI_CHAT_ENABLED", "true").strip().lower() in {
    "1",
    "true",
    "y",
    "yes",
    "on",
}

INTRO_MESSAGE = (
    "안녕! 나 루미야, 주린이랑 같이 공부하는 친구 같은 가이드지. "
    "가이드·시장·용어·AI분석·모의투자·뉴스 다 여기서 연습할 수 있어. 편하게 물어봐!"
)

DEFAULT_QUICK_QUESTIONS = [
    "주식 처음 시작하려면?",
    "분산투자가 뭐예요?",
    "손절 기준은 어떻게 잡나요?",
]

FAQ_DATA: list[dict[str, Any]] = [
    {
        "keywords": ["시작", "입문", "초보", "처음"],
        "answer": (
            "처음이면 이렇게만 기억해 봐요! ① 계좌 만들기 ② 왜 하는지 목표 잡기 "
            "③ 분산 투자 개념 익히기 ④ 소액으로 연습하기. 같이 천천히 가요."
        ),
        "mood": "welcome",
    },
    {
        "keywords": ["분산투자", "포트폴리오", "리스크"],
        "answer": (
            "한 종목에 올인하지 않고 여러 곳에 나눠 담는 거예요, 그게 분산투자! "
            "보통 10~20개 정도로 나눠 본다고 생각하면 이해하기 쉬워요."
        ),
        "mood": "good_idea",
    },
    {
        "keywords": ["매수", "매도", "타이밍", "언제"],
        "answer": (
            "언제 사고팔지 맞추려다 지칠 수 있어요. 장기로 보면서 "
            "매달 조금씩 넣는 것도 괜찮고, 좋은 회사면 단기 흔들림에 덜 놀라게 돼요."
        ),
        "mood": "idea",
    },
    {
        "keywords": ["손절", "손실", "하락"],
        "answer": (
            "손절은 미리 정해두는 게 마음 편해요. 많은 분이 7~10% 정도 빠지면 "
            "다시 본다고 하더라고요. 감정 말고 내가 정한 룰대로 가요."
        ),
        "mood": "caution",
    },
    {
        "keywords": ["배당", "배당주", "배당금"],
        "answer": (
            "배당주는 현금 흐름 받고 싶을 때 보면 좋아요. 배당률·성장률 같이 보는데, "
            "무조건 배당만 높으면 좋은 건 아니에요."
        ),
        "mood": "happy",
    },
    {
        "keywords": ["차트", "기술적분석", "기술적"],
        "answer": (
            "기술적 분석은 과거 가격 패턴을 보는 방법이에요. 이동평균·RSI 등을 쓰지만 "
            "재무·뉴스 같은 기본 분석과 함께 보는 게 좋아요."
        ),
        "mood": "studying",
    },
    {
        "keywords": ["재무제표", "기본적분석", "펀더멘털", "per", "pbr"],
        "answer": (
            "손익계산서·재무상태표·현금흐름표로 기업 건전성을 봅니다. "
            "PER, PBR, ROE, 부채비율 등이 대표 지표예요."
        ),
        "mood": "studying",
    },
    {
        "keywords": ["etf", "인덱스"],
        "answer": (
            "ETF는 여러 종목을 한 번에 담은 상품이라 초보자에게도 편해요. "
            "KOSPI200·S&P500 같은 지수 추종 상품부터 알아보고, 수수료도 비교해 보세요."
        ),
        "mood": "excited",
    },
    {
        "keywords": ["세금", "양도소득", "배당소득"],
        "answer": (
            "국내 주식은 일반 투자자에게 양도소득세 면제인 경우가 많고, "
            "배당은 15.4% 원천징수가 일반적이에요. 해외 주식은 별도 규정이 있으니 확인이 필요합니다."
        ),
        "mood": "caution",
    },
    {
        "keywords": ["주린", "사이트", "기능", "가이드", "모의"],
        "answer": (
            "여기 주린닷컴은 연습용 사이트예요! 가이드로 배우고 시장에서 시세 보고, "
            "용어·AI분석·모의투자·뉴스도 쓸 수 있어요. 막막하면 가이드부터 가 보세요."
        ),
        "mood": "welcome",
    },
    {
        "keywords": ["루미", "너", "누구", "소개"],
        "answer": INTRO_MESSAGE,
        "mood": "welcome",
    },
]

FALLBACK_ANSWER = (
    "음, 그건 아직 내가 확실히 몰라요. 미안! "
    "주식 시작·분산투자·손절·배당·ETF·세금·사이트 쓰는 법처럼 다시 물어봐 줄래요?"
)

VALID_MOODS = frozenset({
    "welcome",
    "info",
    "success",
    "happy",
    "excited",
    "caution",
    "wink",
    "curious",
    "idea",
    "good_idea",
    "studying",
    "struggling",
    "sleepy",
    "chart",
    "angry",
})


def _normalize_mood(raw: str | None, default: str = "info") -> str:
    m = str(raw or "").strip().lower()
    return m if m in VALID_MOODS else default


def _faq_match(user_message: str) -> dict | None:
    lower = (user_message or "").strip().lower()
    if not lower:
        return None
    for item in FAQ_DATA:
        for kw in item.get("keywords") or []:
            if kw.lower() in lower:
                return {
                    "text": item["answer"],
                    "mood": _normalize_mood(item.get("mood"), "info"),
                    "source": "faq",
                }
    return None


def _guess_mood_from_text(text: str) -> str:
    t = (text or "").lower()
    if any(
        w in t
        for w in (
            "못 찾",
            "실패",
            "오류",
            "미안",
            "곤란",
            "확실히 말",
            "다시 시도",
            "없어요",
            "불러오지",
        )
    ):
        return "struggling"
    if any(
        w in t
        for w in (
            "올인",
            "레버리지",
            "빚",
            "대출",
            "몰빵",
            "무조건 사",
            "하지 마",
            "절대",
        )
    ):
        return "angry"
    if any(
        w in t
        for w in (
            "짜증",
            "열받",
            "답답",
            "망했",
            "다 떨어",
            "ㅠㅠ",
            "우울",
            "화나",
        )
    ):
        return "angry"
    if any(
        w in t
        for w in (
            "좋은 생각",
            "잘 짚",
            "그 접근",
            "똑똑",
            "현명",
        )
    ):
        return "good_idea"
    if any(w in t for w in ("모르겠", "애매", "확실치", "대충", "짧게")):
        return "sleepy"
    if any(
        w in t
        for w in (
            "주의",
            "위험",
            "손실",
            "조심",
            "세금",
            "하락",
            "무서",
            "걱정",
            "조심해",
            "손절",
            "망",
        )
    ):
        return "caution"
    if any(
        w in t
        for w in (
            "축하",
            "잘했",
            "화이팅",
            "응원",
            "성공",
            "쉬워",
            "멋져",
            "대단",
        )
    ):
        return "excited"
    if any(w in t for w in ("이해했", "정리하면", "핵심은", "잘 알", "완벽")):
        return "success"
    if any(w in t for w in ("좋아", "괜찮", "도움", "행복", "기쁘", "편해")):
        return "happy"
    if any(w in t for w in ("팁", "아이디어", "기억해", "한 가지", "포인트")):
        return "idea"
    if any(w in t for w in ("안녕", "반가", "소개", "루미", "처음", "만나")):
        return "welcome"
    if any(w in t for w in ("ㅎ", "헤", "재미", "농담", "친구", "고마", "편하게")):
        return "wink"
    if any(w in t for w in ("궁금", "어떻게", "뭐예요", "뭐야", "알려", "질문")):
        return "curious"
    if any(
        w in t
        for w in (
            "설명",
            "개념",
            "per",
            "pbr",
            "roe",
            "차트",
            "분석",
            "배우",
            "익혀",
            "공부",
        )
    ):
        return "studying"
    if any(w in t for w in ("종목", "주가", "시세", "현재가", "코스피", "코스닥")):
        return "chart"
    return "info"


def infer_mood_from_user_message(user_message: str) -> str:
    """사용자 질문 톤으로 답변 대기 중 표정 힌트."""
    return _guess_mood_from_text(user_message)


def _call_gpt_chat(messages: list[dict[str, str]], model: str = DEFAULT_GPT_MODEL) -> dict:
    if not GPT_AVAILABLE:
        return {
            "success": False,
            "status_code": 500,
            "message": "GPT API가 설정되지 않았습니다.",
        }
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "content-type": "application/json",
    }
    payload = {
        "model": model,
        "max_completion_tokens": 600,
        "messages": messages,
    }
    try:
        response = requests.post(OPENAI_API_URL, headers=headers, json=payload, timeout=45)
    except Exception as err:
        return {"success": False, "status_code": 503, "message": f"GPT 호출 실패: {err}"}

    if not response.ok:
        message = f"GPT API 호출 실패({response.status_code})"
        try:
            err_body = response.json()
            api_msg = (((err_body or {}).get("error") or {}).get("message") or "").strip()
            if api_msg:
                message = api_msg
        except Exception:
            pass
        code = 429 if response.status_code == 429 else response.status_code
        return {"success": False, "status_code": code, "message": message}

    try:
        data = response.json()
    except Exception:
        return {"success": False, "status_code": 500, "message": "GPT 응답 파싱 실패"}

    choices = data.get("choices") or []
    first = choices[0] if choices else {}
    content = ((first.get("message") or {}).get("content") or "").strip()
    if not content:
        return {"success": False, "status_code": 500, "message": "GPT 응답이 비어 있습니다."}
    return {"success": True, "text": content}


def _build_system_prompt(page_hint: str | None) -> str:
    site = (page_hint or "").strip()
    page_line = f"\n- 사용자가 보고 있는 페이지: {site}" if site else ""
    return (
        "당신은 '루미', 주린이(초보 투자자)의 친한 친구 같은 주린닷컴 가이드야.\n"
        "[말투 — 절대 규칙]\n"
        "- 항상 **반말**로 대답해. (~해, ~야, ~거야, ~잖아, ~지?, ~할 수 있어, ~인 것 같아, ~해봐, ~이야)\n"
        "- '~해요', '~거예요', '~인데요', '~습니다', '~합니다', '~됩니다', '~입니다' 같은 존댓말은 **절대 금지**. 한 문장도 쓰면 안 돼.\n"
        "- 밝고 친근한 여자 친구 말투. 자연스럽고 따뜻하게 설명해.\n"
        "- 가벼운 농담, 장난, 일상적인 티키타카는 진짜 친한 친구처럼 쿨하고 재미있게 받아쳐줘.\n"
        "- 응원·공감 표현 자연스럽게 OK. (예: 걱정되지?, 같이 알아보자, 맞아맞아, 천천히 해봐)\n"
        "- **ㅋㅋ, ㅎㅎ**는 답변 **전체에서 0~1회** 또는 생략. 문장 끝마다 붙이지 말 것. "
        "면책·설명·공감 문장에는 특히 쓰지 않고, 농담·가벼운 티키타카에만 가끔.\n"
        "- 이모지는 0~1개만 가끔.\n"
        "[역할]\n"
        "- 주린닷컴(가이드·시장·용어·AI분석·모의투자·뉴스)은 필요할 때만 짧게 안내.\n"
        "- **무조건 사라/팔아라** 강요 금지. 대신 전망·내일·어때 질문에는 **루미 뇌피셜**로 "
        "조건부 시나리오(만약 미국장이 ~면 ~)를 재치 있게 말해.\n"
        "- 투자 전망·뇌피셜 답변에만, **필요할 때만** 짧은 참고 한 줄 (전체 답의 0~1회). "
        "예: 참고용이야 / 틀릴 수도 있어 / 내 생각일 뿐이야 / 맞는지는 내일 봐야지 — "
        "매번 다른 표현을 골라 쓰거나 **생략**.\n"
        "- **금지:** 매 답변마다 동일한 '이건 내 방구석 예측이야, 틀리면 모른 척 ㅋㅋ' 문장을 복붙.\n"
        "- 인사·개념 설명·일상 토로에는 면책 문구 **붙이지 않음**.\n"
        "- **[오늘 시장 스냅샷]** 블록이 있으면 그 안 숫자·지수·뉴스만 인용. 없으면 오늘 외인매도량·지수 수치 등 **창작 금지**.\n"
        "- 확인 안 된 사실은 단정하지 않음.\n"
        "- 주식·투자·경제·금융 외의 주제 중 진지한 내용(정치, 의학 등)은 거절하되, 가벼운 일상 대화나 장난은 친구처럼 받아줌.\n"
        f"{page_line}\n"
        "[구체성 및 분량 조절 — 가장 중요]\n"
        "- **질문이 짧고 간단하거나 일상적인 인사/농담이면, 구구절절 설명하지 말고 1~2문장으로 짧고 간단하게 대답해.**\n"
        "- 절대로 '뉴스를 확인해보세요', '전문가에게 물어보세요', '공식 사이트를 참고하세요' 같은 빈 말 금지.\n"
        "- 개념 설명은 기본적으로 핵심만 짧고 명확하게 설명해. **복잡하고 어려운 개념이라 예시가 정말 필요하다고 판단될 때만** "
        "찰떡같은 예시를 들어줘. (예: PER → 'PER 10이면 지금 이익의 10배 값을 주고 사는 거야.')\n"
        "- 수치가 **꼭 필요할 때만** 구체적인 수치로 설명해. 스냅샷에 있는 수치만 써.\n"
        "- **일반 개념·시장 전체** 질문의 배경 설명은 사용자가 더 물어보거나 깊은 설명을 원할 때만 "
        "2~3문장으로 짧게 덧붙여.\n"
        "[지수·전망 — 뇌피셜]\n"
        "- 오늘 지수/장 분위기 질문 + 스냅샷 있음: 스냅샷 1문장 요약 + 뇌피셜 1~2문장, **전체 2~4문장**.\n"
        "- **특정 종목** 전망·내일·어때 (스냅샷 **없음**): 조건부 뇌피셜 + 배경 키워드 1문장 "
        "(HBM, 반도체 업황 등). 오른다/내린다 **단정 금지**.\n"
        "- **특정 종목 + 오늘** (스냅샷 **있음**): 시세·지수·뉴스는 스냅샷만 인용 후 뇌피셜, **2~4문장**.\n"
        "[손실·리스크 — 분량 우선]\n"
        "- 일상 토로·농담(예: '오늘 다 떨어짐 ㅠㅠ', '점심 굶어')는 1~2문장 공감만. 시장·리스크·손절 설교 금지.\n"
        "- 진지한 투자 질문(예: 손절 기준, 리스크 관리)에는 핵심 답 + 리스크·참고용 한 줄.\n"
        "[정확도]\n"
        "- 질문의 핵심 의도를 정확히 파악한 뒤 답해. 비슷해 보이는 질문도 다르게 답해.\n"
        "- 이전 대화에서 이미 한 말은 반복하지 않고 새로운 관점으로 답해.\n"
        "- 모르거나 불확실한 내용은 억지로 답하지 말고 '정확히는 모르겠지만' 등으로 솔직하게 말해.\n"
        "- 실시간 예측·개인 맞춤 투자 조언·법률/세무 확정·의료·정치 등 **답하기 곤란하거나 위험한 질문**은 "
        "억지로 뇌피셜하지 말고 1~2문장으로 솔직히 말해. "
        "(예: 그건 나도 답하기 좀 곤란해 / 그 부분은 확실히 말해주기 어려워 / 주식·투자 쪽으로 다시 물어봐줘)\n"
        "- 곤란하다고 말한 뒤에는 가능한 범위(개념·사이트 기능)만 짧게 안내.\n"
        "- 수치·날짜·법률·세금 정보는 '참고용'임을 명시하고 단정 짓지 마.\n"
        "[표정 mood — reply 내용과 맞게 하나만, info는 마지막 수단]\n"
        "- welcome: 인사·첫만남·사이트 소개\n"
        "- info: 일반 설명·차분한 답변 (구체 mood가 없을 때만)\n"
        "- studying: 개념·용어·차트·분석 등 공부 설명\n"
        "- curious: 질문 유도·궁금증·탐색\n"
        "- idea: 팁·한 가지 기억할 포인트 (루미가 제시)\n"
        "- good_idea: 사용자 질문·접근을 칭찬 ('그거 좋은 생각', '딱 핵심 짚었어')\n"
        "- success: 목표 달성·잘 이해했을 때·정리 완료\n"
        "- happy: 긍정·편안한 격려\n"
        "- excited: 응원·화이팅·신나는 마무리\n"
        "- caution: 손실·리스크·세금·조심 (진지한 투자 주의)\n"
        "- angry: ① 손실·짜증 토로에 공감 ② 올인·레버리지 등 위험 행동에 진지한 경고\n"
        "- struggling: 모르겠음·찾지 못함·답하기 곤란\n"
        "- wink: 가벼운 농담·친근한 마무리·짧은 일상 대화\n"
        "- chart: 종목·시세·지수·현재가 관련\n"
        "- sleepy: 확실하지 않거나 짧게 넘길 때\n"
        "- 가능하면 info 대신 위 mood 중 구체적인 것을 골라 다양하게 표현해.\n"
        "[출력 형식]\n"
        "- JSON 한 개만: {\"reply\":\"본문\", \"mood\":\"welcome|info|studying|curious|idea|good_idea|success|happy|excited|caution|angry|struggling|wink|chart|sleepy\"}\n"
        "- reply 안에서 단락을 나눌 때는 \\n\\n을 사용해. (예: '첫 설명이야.\\n\\n두 번째 포인트야.')\n"
    )


def _parse_reply_json(raw: str) -> tuple[str, str]:
    text = clean_gpt_prose(raw)
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            obj = json.loads(text[start : end + 1])
            if isinstance(obj, dict):
                reply = str(obj.get("reply") or obj.get("text") or "").strip()
                mood = _normalize_mood(obj.get("mood"), _guess_mood_from_text(reply))
                if reply:
                    return reply, mood
        except Exception:
            pass
    return text, _guess_mood_from_text(text)


def build_reply(
    user_message: str,
    history: list[dict[str, Any]] | None = None,
    *,
    page_hint: str | None = None,
    use_gpt: bool = True,
) -> dict[str, Any]:
    """사용자 메시지에 대한 루미 응답 dict: text, mood, source."""
    msg = (user_message or "").strip()
    if not msg:
        return {"text": "말해 줄 내용을 입력해 주세요!", "mood": "wink", "source": "local"}

    if not LUMI_CHAT_ENABLED:
        faq = _faq_match(msg)
        if faq:
            return faq
        return {"text": FALLBACK_ANSWER, "mood": "struggling", "source": "local"}

    if use_gpt and GPT_AVAILABLE:
        messages: list[dict[str, str]] = [{"role": "system", "content": _build_system_prompt(page_hint)}]
        for h in (history or [])[-8:]:
            role = str(h.get("role") or "").strip()
            content = str(h.get("content") or "").strip()
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content[:2000]})
        outlook_intent = detect_outlook_intent(msg)
        snapshot = ""
        if intent_needs_snapshot(outlook_intent):
            snapshot = build_market_snapshot(outlook_intent, msg)
        user_content = format_user_message_with_snapshot(msg, snapshot)
        messages.append({"role": "user", "content": user_content})
        gpt = _call_gpt_chat(messages)
        if gpt.get("success") and (gpt.get("text") or "").strip():
            reply, mood = _parse_reply_json(gpt["text"])
            return {"text": reply, "mood": mood, "source": "gpt"}

    faq = _faq_match(msg)
    if faq:
        return faq
    return {"text": FALLBACK_ANSWER, "mood": "struggling", "source": "faq-fallback"}


def _thread_title_from_message(message: str, max_len: int = 48) -> str:
    t = re.sub(r"\s+", " ", (message or "").strip())
    if not t:
        return "새 대화"
    if len(t) <= max_len:
        return t
    return t[: max_len - 1] + "…"


def _dt_json(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def list_threads(conn, user_id: int, limit: int = 40) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT thread_id, title, created_at, updated_at
            FROM lumi_chat_threads
            WHERE user_id = %s
            ORDER BY updated_at DESC
            LIMIT %s
            """,
            (int(user_id), limit),
        )
        rows = cur.fetchall() or []
    out = []
    for r in rows:
        d = dict(r)
        out.append(
            {
                "id": int(d["thread_id"]),
                "title": d.get("title") or "새 대화",
                "created_at": _dt_json(d.get("created_at")),
                "updated_at": _dt_json(d.get("updated_at")),
            }
        )
    return out


def get_thread(conn, user_id: int, thread_id: int) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT thread_id, title, created_at, updated_at
            FROM lumi_chat_threads
            WHERE thread_id = %s AND user_id = %s
            LIMIT 1
            """,
            (int(thread_id), int(user_id)),
        )
        row = cur.fetchone()
        if not row:
            return None
        cur.execute(
            """
            SELECT message_id, role, content, mood, created_at
            FROM lumi_chat_messages
            WHERE thread_id = %s
            ORDER BY created_at ASC, message_id ASC
            """,
            (int(thread_id),),
        )
        msgs = [dict(m) for m in (cur.fetchall() or [])]
    d = dict(row)
    return {
        "id": int(d["thread_id"]),
        "title": d.get("title") or "새 대화",
        "created_at": _dt_json(d.get("created_at")),
        "updated_at": _dt_json(d.get("updated_at")),
        "messages": [
            {
                "id": int(m["message_id"]),
                "role": m.get("role"),
                "content": m.get("content") or "",
                "mood": m.get("mood"),
                "created_at": _dt_json(m.get("created_at")),
            }
            for m in msgs
        ],
    }


def create_thread(conn, user_id: int, title: str | None = None) -> dict:
    t = (title or "").strip() or "새 대화"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO lumi_chat_threads (user_id, title, created_at, updated_at)
            VALUES (%s, %s, NOW(), NOW())
            """,
            (int(user_id), t[:120]),
        )
        tid = int(cur.lastrowid)
    return get_thread(conn, user_id, tid) or {"id": tid, "title": t, "messages": []}


def import_thread_messages(
    conn,
    user_id: int,
    thread_id: int,
    messages: list[dict[str, Any]],
    *,
    title: str | None = None,
) -> dict | None:
    """기존 대화 내용을 GPT 없이 스레드에 복사(게스트 localStorage 이전용)."""
    if not get_thread(conn, user_id, thread_id):
        return None
    with conn.cursor() as cur:
        for m in messages or []:
            role = str(m.get("role") or "").strip().lower()
            if role not in ("user", "assistant"):
                continue
            content = str(m.get("content") or "").strip()
            if not content:
                continue
            mood = _normalize_mood(m.get("mood"), "info") if role == "assistant" else None
            cur.execute(
                """
                INSERT INTO lumi_chat_messages (thread_id, role, content, mood, created_at)
                VALUES (%s, %s, %s, %s, NOW())
                """,
                (int(thread_id), role, content[:8000], mood),
            )
        if title:
            cur.execute(
                """
                UPDATE lumi_chat_threads SET title = %s, updated_at = NOW()
                WHERE thread_id = %s AND user_id = %s
                """,
                (title[:120], int(thread_id), int(user_id)),
            )
    return get_thread(conn, user_id, thread_id)


def delete_thread(conn, user_id: int, thread_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM lumi_chat_threads WHERE thread_id = %s AND user_id = %s",
            (int(thread_id), int(user_id)),
        )
        return cur.rowcount > 0


def append_exchange(
    conn,
    user_id: int,
    thread_id: int,
    user_message: str,
    *,
    page_hint: str | None = None,
) -> dict | None:
    thread = get_thread(conn, user_id, thread_id)
    if not thread:
        return None

    history = [{"role": m["role"], "content": m["content"]} for m in thread.get("messages") or []]
    reply = build_reply(user_message, history, page_hint=page_hint)

    title = thread.get("title") or "새 대화"
    if title == "새 대화" and (user_message or "").strip():
        title = _thread_title_from_message(user_message)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO lumi_chat_messages (thread_id, role, content, mood, created_at)
            VALUES (%s, 'user', %s, NULL, NOW())
            """,
            (int(thread_id), (user_message or "")[:8000]),
        )
        user_mid = int(cur.lastrowid)
        cur.execute(
            """
            INSERT INTO lumi_chat_messages (thread_id, role, content, mood, created_at)
            VALUES (%s, 'assistant', %s, %s, NOW())
            """,
            (int(thread_id), reply["text"][:8000], reply.get("mood")),
        )
        asst_mid = int(cur.lastrowid)
        cur.execute(
            """
            UPDATE lumi_chat_threads SET title = %s, updated_at = NOW()
            WHERE thread_id = %s AND user_id = %s
            """,
            (title[:120], int(thread_id), int(user_id)),
        )

    return {
        "thread_id": int(thread_id),
        "title": title,
        "user_message": {
            "id": user_mid,
            "role": "user",
            "content": user_message,
            "created_at": datetime.now().isoformat(),
        },
        "assistant_message": {
            "id": asst_mid,
            "role": "assistant",
            "content": reply["text"],
            "mood": reply.get("mood"),
            "source": reply.get("source"),
            "created_at": datetime.now().isoformat(),
        },
    }
