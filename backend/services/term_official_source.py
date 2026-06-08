"""용어 정의 — 위키백과·로컬 프리셋 조회."""

from __future__ import annotations

import re
import time
from html import unescape
from typing import Any
from urllib.parse import quote

import requests

_WIKI_TIMEOUT = 7
_CACHE_TTL = 3600
_CACHE: dict[str, tuple[float, dict[str, Any] | None]] = {}

_USER_AGENT = (
    'JurinDotCom/1.0 (term glossary; +https://jurin.com) '
    'requests/2.31'
)

_OFFICIAL_PRESETS: dict[str, dict[str, str]] = {
    '채권': {
        'summary': (
            '채권은 중앙정부·지방정부·공기업·금융기관·기타 법인 등이 자금 조달을 위해 발행하며, '
            '정해진 기한 후 투자자에게 원금과 함께 이자를 상환하는 채무증서로 증권화된 금융상품입니다.'
        ),
        'source_label': '공공·거래소 계열 용어 정의(요약)',
    },
    'elw': {
        'summary': (
            'ELW(주식워런트증권)는 개별 주식 또는 주가지수를 기초자산으로 하며, '
            '기초자산 가격 변동에 따라 투자수익이 결정되는 권리증서(파생결합증권)입니다. '
            '만기에 정해진 행사가로 기초자산을 매수(콜)하거나 매도(풋)할 수 있는 권리를 부여합니다.'
        ),
        'source_label': '공공·거래소 계열 용어 정의(요약)',
    },
    'per': {
        'summary': (
            'PER(주가수익비율)은 주가를 주당순이익(EPS)으로 나눈 값으로, '
            '주가가 이익 대비 얼마나 비싼지/싼지를 나타냅니다. '
            '투자에서는 성장성·업종·이익의 질과 함께 비교해 해석합니다.'
        ),
        'source_label': '투자지표 표준 정의(요약)',
    },
    'pbr': {
        'summary': (
            'PBR(주가순자산비율)은 주가를 주당순자산(BPS)으로 나눈 값입니다. '
            '자산 대비 주가 수준을 비교할 때 사용합니다.'
        ),
        'source_label': '투자지표 표준 정의(요약)',
    },
    'roe': {
        'summary': (
            'ROE(자기자본이익률)는 당기순이익을 자기자본으로 나눈 값으로, '
            '자본을 얼마나 효율적으로 운용했는지 보여줍니다. '
            '부채 구조 등과 함께 봐야 왜곡 해석을 줄일 수 있습니다.'
        ),
        'source_label': '투자지표 표준 정의(요약)',
    },
    '시가총액': {
        'summary': (
            '시가총액은 현재 주가에 발행주식 수를 곱한 기업의 규모(가치)입니다. '
            '시장에서 기업 크기를 비교하는 대표 지표로 활용됩니다.'
        ),
        'source_label': '시장 대표 지표 정의(요약)',
    },
    '배당수익률': {
        'summary': (
            '배당수익률은 연간 배당금을 현재 주가로 나눈 값(%)입니다. '
            '주가 대비 현금 수익의 크기를 비교하는 데 사용합니다.'
        ),
        'source_label': '배당 지표 표준 정의(요약)',
    },
    'ytm': {
        'summary': (
            'YTM(만기수익률)은 채권을 만기까지 보유했을 때 기대되는 연환산 수익률입니다. '
            '시장가격과 수익·상환 구조를 반영해 실제 기대수익을 보여줍니다.'
        ),
        'source_label': '채권 지표 표준 정의(요약)',
    },
    '듀레이션': {
        'summary': (
            '듀레이션은 금리 변화에 따른 채권 가격의 변동 민감도를 나타내는 지표입니다. '
            '기간이 길수록 금리 영향이 커지는 경향이 있습니다.'
        ),
        'source_label': '채권 지표 표준 정의(요약)',
    },
    '신용등급': {
        'summary': (
            '신용등급은 채권 발행자의 원리금 상환 능력을 평가해 부여하는 등급입니다. '
            '등급이 높을수록 상대적으로 상환 위험이 낮다고 봅니다.'
        ),
        'source_label': '신용평가 지표 정의(요약)',
    },
}


def _normalize_key(term_name: str) -> str:
    return re.sub(r'\s+', '', str(term_name or '').strip().lower())


_TERM_WIKI_ALIASES: dict[str, list[str]] = {
    'per': ['주가수익비율', '주가수익률'],
    'pbr': ['주가순자산비율'],
    'roe': ['자기자본이익률'],
    'eps': ['주당순이익'],
    'elw': ['주식워런트증권', '주식워런트'],
    'ytm': ['만기수익률'],
    'bps': ['주당순자산'],
    '채권': ['채권 (유가증권)'],
}


def _search_candidates(term: str) -> list[str]:
    key = _normalize_key(term)
    seen: set[str] = set()
    out: list[str] = []

    def add(value: str) -> None:
        v = str(value or '').strip()
        if not v:
            return
        nk = _normalize_key(v)
        if nk in seen:
            return
        seen.add(nk)
        out.append(v)

    add(term)
    for alias in _TERM_WIKI_ALIASES.get(key, []):
        add(alias)
    if key in _TERM_WIKI_ALIASES:
        # 약어는 한글 별칭을 먼저 조회해 동음이의어 문서를 피한다.
        alias_first = []
        term_last = []
        for item in out:
            if _normalize_key(item) == key:
                term_last.append(item)
            else:
                alias_first.append(item)
        out = alias_first + term_last
    return out


def _is_low_quality_extract(text: str) -> bool:
    s = str(text or '')
    noise = (
        '최근 변경',
        '최근 토론',
        '최근 수정',
        '나무위키',
        '특수 기능',
        '편집 토론',
    )
    return any(n in s for n in noise) or len(s.strip()) < 20


def _is_disambiguation(text: str) -> bool:
    s = str(text or '')
    markers = (
        '다음과 같은 뜻',
        '의 다른 뜻',
        '다음 뜻',
        'may refer to',
    )
    return any(m in s for m in markers)


def _wiki_session() -> requests.Session:
    sess = requests.Session()
    sess.headers.update({'User-Agent': _USER_AGENT})
    return sess


def _strip_wiki_markup(text: str) -> str:
    s = unescape(str(text or ''))
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'\[\d+\]', '', s)
    s = re.sub(r'\[.*?]\(.*?\)', '', s)
    s = re.sub(r'={2,}\s*([^=]+?)\s*={2,}', r'\1 ', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()


def _split_sentences(text: str) -> list[str]:
    raw = str(text or '').strip()
    if not raw:
        return []
    parts = re.findall(r'[^.!?\n]+(?:[.!?…]+|$)', raw)
    out = [p.strip() for p in parts if p and p.strip()]
    if out:
        return out
    return [raw]


def summarize_to_lines(text: str, max_sentences: int = 4, max_chars: int = 420) -> str:
    cleaned = _strip_wiki_markup(text)
    if not cleaned:
        return ''
    sentences = _split_sentences(cleaned)
    picked = sentences[: max(1, max_sentences)]
    summary = ' '.join(picked).strip()
    if len(summary) <= max_chars:
        return summary
    truncated = summary[:max_chars].rstrip()
    cut = max(truncated.rfind('.'), truncated.rfind('!'), truncated.rfind('?'), truncated.rfind('…'))
    if cut >= int(max_chars * 0.45):
        return truncated[: cut + 1].strip()
    return truncated.rstrip('.,; ') + '…'


def _result(summary: str, source_label: str, source_url: str = '') -> dict[str, str]:
    text = summarize_to_lines(summary)
    if not text:
        return {}
    out: dict[str, str] = {
        'summary': text,
        'source_label': source_label,
    }
    if source_url:
        out['source_url'] = source_url
    return out


def _fetch_wikipedia_official(term: str) -> dict[str, str]:
    term = str(term or '').strip()
    if not term:
        return {}

    sess = _wiki_session()
    for query in _search_candidates(term):
        try:
            search_res = sess.get(
                'https://ko.wikipedia.org/w/api.php',
                params={
                    'action': 'opensearch',
                    'search': query,
                    'limit': 1,
                    'namespace': 0,
                    'format': 'json',
                },
                timeout=_WIKI_TIMEOUT,
            )
            search_res.raise_for_status()
            payload = search_res.json()
            titles = payload[1] if isinstance(payload, list) and len(payload) > 1 else []
            if not titles:
                continue
            title = str(titles[0]).strip()
            if not title:
                continue

            summary_res = sess.get(
                f'https://ko.wikipedia.org/api/rest_v1/page/summary/{quote(title, safe="")}',
                timeout=_WIKI_TIMEOUT,
            )
            extract = ''
            page_url = f'https://ko.wikipedia.org/wiki/{quote(title.replace(" ", "_"), safe="")}'
            if summary_res.status_code == 404:
                extract_res = sess.get(
                    'https://ko.wikipedia.org/w/api.php',
                    params={
                        'action': 'query',
                        'prop': 'extracts',
                        'exintro': 1,
                        'explaintext': 1,
                        'redirects': 1,
                        'titles': title,
                        'format': 'json',
                    },
                    timeout=_WIKI_TIMEOUT,
                )
                extract_res.raise_for_status()
                pages = (extract_res.json().get('query') or {}).get('pages') or {}
                for page in pages.values():
                    extract = str(page.get('extract') or '').strip()
                    if extract:
                        break
            else:
                summary_res.raise_for_status()
                data = summary_res.json()
                extract = str(data.get('extract') or data.get('description') or '').strip()
                page_url = str(data.get('content_urls', {}).get('desktop', {}).get('page') or '').strip() or page_url

            if not extract:
                continue
            if _is_disambiguation(extract):
                continue
            hit = _result(extract, '위키백과', page_url)
            if hit.get('summary') and not _is_low_quality_extract(hit['summary']):
                return hit
        except Exception as exc:
            print(f'[term-official] wikipedia fetch failed ({query}): {exc}')
            continue
    return {}


def _fetch_namuwiki_official(term: str) -> dict[str, str]:
    term = str(term or '').strip()
    if not term:
        return {}

    url = f'https://namu.wiki/w/{quote(term, safe="")}'
    try:
        res = _wiki_session().get(url, timeout=_WIKI_TIMEOUT)
        if res.status_code != 200:
            return {}
        html = res.text or ''
        if '문서가 존재하지 않' in html or 'does not exist' in html.lower():
            return {}

        # 나무위키 본문 첫 단락(태그 제거 후 텍스트)
        body_match = re.search(
            r'<div[^>]*class="[^"]*wiki-parser[^"]*"[^>]*>([\s\S]*?)</div>\s*<div',
            html,
            re.I,
        )
        chunk = body_match.group(1) if body_match else html
        chunk = re.sub(r'<script[\s\S]*?</script>', ' ', chunk, flags=re.I)
        chunk = re.sub(r'<style[\s\S]*?</style>', ' ', chunk, flags=re.I)
        chunk = re.sub(r'<(h[1-6]|table|ul|ol|figure)[^>]*>[\s\S]*?</\1>', ' ', chunk, flags=re.I)
        chunk = re.sub(r'<br\s*/?>', '\n', chunk, flags=re.I)
        chunk = re.sub(r'</p>', '\n', chunk, flags=re.I)
        plain = _strip_wiki_markup(chunk)
        paragraphs = [p.strip() for p in re.split(r'\n+', plain) if len(p.strip()) >= 20]
        if not paragraphs:
            paragraphs = [plain] if len(plain) >= 20 else []
        if not paragraphs:
            return {}
        hit = _result(paragraphs[0], '나무위키', url)
        if hit.get('summary') and not _is_low_quality_extract(hit['summary']):
            return hit
        return {}
    except Exception as exc:
        print(f'[term-official] namuwiki fetch failed ({term}): {exc}')
        return {}


def _fetch_preset_official(term: str) -> dict[str, str]:
    key = _normalize_key(term)
    preset = _OFFICIAL_PRESETS.get(key)
    if not preset:
        return {}
    return _result(
        preset.get('summary', ''),
        preset.get('source_label', '공공·거래소 계열 용어 정의(요약)'),
        '',
    )


def resolve_official_term_explanation(term: str) -> dict[str, str] | None:
    """위키백과 → 로컬 프리셋 순으로 공식 정의를 조회한다."""
    term = str(term or '').strip()
    if not term:
        return None

    cache_key = _normalize_key(term)
    now = time.time()
    cached = _CACHE.get(cache_key)
    if cached and (now - cached[0]) < _CACHE_TTL:
        return cached[1]

    result: dict[str, str] | None = None
    for fetcher in (_fetch_wikipedia_official, _fetch_preset_official):
        hit = fetcher(term)
        if hit and hit.get('summary'):
            result = hit
            break

    _CACHE[cache_key] = (now, result)
    return result
