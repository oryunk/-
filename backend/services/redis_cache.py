"""Redis JSON cache with in-memory fallback for asking/live quotes."""
import json
import os
import threading
import time

try:
    import redis
except ImportError:
    redis = None

from app_state import (
    _ASKING_PRICE_CACHE,
    _ASKING_PRICE_CACHE_LOCK,
    _ASKING_PRICE_CACHE_TTL,
    _ASKING_STALE_FALLBACK_SEC,
    _LIVE_PRICE_CACHE,
    _LIVE_PRICE_LOCK,
)

_enabled = os.getenv('REDIS_CACHE_ENABLED', 'true').strip().lower() in {'1', 'true', 'y', 'yes', 'on'}
_url = (os.getenv('REDIS_URL') or 'redis://127.0.0.1:6379/0').strip()
_client = None
_redis_ok = False

_LIVE_TTL = float(os.getenv('LIVE_PRICE_REDIS_TTL_SEC', '300'))
_INDICES_TTL = float(os.getenv('MARKET_INDICES_REDIS_TTL_SEC', '60'))
_RANK_TTL = float(os.getenv('TRADED_VALUE_RANK_REDIS_TTL_SEC', '12'))
_LIVE_LIST_TTL = float(os.getenv('LIVE_PRICES_LIST_REDIS_TTL_SEC', '8'))
_STOCK_DETAIL_TTL = float(os.getenv('STOCK_DETAIL_REDIS_TTL_SEC', '900'))
_CHART_TTL_BY_RANGE = {
    '1d': float(os.getenv('CHART_REDIS_TTL_1D_SEC', '60')),
    '1w': float(os.getenv('CHART_REDIS_TTL_1W_SEC', '120')),
    '1m': float(os.getenv('CHART_REDIS_TTL_1M_SEC', '300')),
    '1y': float(os.getenv('CHART_REDIS_TTL_1Y_SEC', '900')),
}
_KIS_ASKING_GAP_SEC = float(os.getenv('KIS_ASKING_MIN_GAP_SEC', '1.0'))
_ASKING_FETCH_LOCK_TTL_SEC = float(os.getenv('MOCK_ASKING_FETCH_LOCK_SEC', '5'))
_MEM_KIS_ASKING_LAST_CALL = 0.0
_MEM_KIS_ASKING_GAP_LOCK = threading.Lock()


def init():
    """Connect to Redis once at app startup; fall back to memory on failure."""
    global _client, _redis_ok
    if not _enabled or redis is None:
        print('[redis_cache] disabled or redis package missing - using memory fallback')
        return
    try:
        _client = redis.from_url(
            _url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
            protocol=2,
        )
        _client.ping()
        _redis_ok = True
        print(f'[redis_cache] connected ({_url})')
    except Exception as exc:
        _client = None
        _redis_ok = False
        print(f'[redis_cache] connect failed ({exc}) - using memory fallback')


def _get_json(key):
    if _redis_ok and _client:
        try:
            raw = _client.get(key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    return None


def _set_json(key, value, ttl_sec):
    if _redis_ok and _client:
        try:
            _client.setex(key, max(1, int(ttl_sec)), json.dumps(value, ensure_ascii=False))
            return True
        except Exception:
            pass
    return False


def _redis_has(key):
    if _redis_ok and _client:
        try:
            return bool(_client.exists(key))
        except Exception:
            pass
    return False


def get_asking(code, max_age_sec=None):
    """Return (ts, data) if cached within max_age_sec, else None."""
    code = str(code or '').strip()
    if not code:
        return None
    max_age = float(max_age_sec if max_age_sec is not None else _ASKING_PRICE_CACHE_TTL)
    now = time.time()

    entry = _get_json(f'asking:{code}')
    if entry and isinstance(entry.get('data'), dict):
        ts = float(entry.get('ts') or 0)
        if ts and (now - ts) < max_age:
            return ts, entry['data']

    with _ASKING_PRICE_CACHE_LOCK:
        hit = _ASKING_PRICE_CACHE.get(code)
    if hit and (now - hit[0]) < max_age:
        return hit[0], hit[1]
    return None


def get_asking_stale(code, max_age_sec=None):
    """Return (ts, data) within stale fallback window."""
    code = str(code or '').strip()
    if not code:
        return None
    max_age = float(max_age_sec if max_age_sec is not None else _ASKING_STALE_FALLBACK_SEC)
    now = time.time()

    entry = _get_json(f'asking:{code}')
    if entry and isinstance(entry.get('data'), dict):
        ts = float(entry.get('ts') or 0)
        if ts and (now - ts) <= max_age:
            return ts, entry['data']

    with _ASKING_PRICE_CACHE_LOCK:
        hit = _ASKING_PRICE_CACHE.get(code)
    if hit and (now - hit[0]) <= max_age:
        return hit[0], hit[1]
    return None


def set_asking(code, data):
    """Store asking quote in Redis and in-memory cache."""
    code = str(code or '').strip()
    if not code or not isinstance(data, dict):
        return
    ts = time.time()
    payload = {'ts': ts, 'data': data}
    _set_json(f'asking:{code}', payload, _ASKING_STALE_FALLBACK_SEC)
    with _ASKING_PRICE_CACHE_LOCK:
        _ASKING_PRICE_CACHE[code] = (ts, data)


def throttle_kis_api_call(gap_sec=None):
    """Global minimum gap between all KIS quotation API calls (Redis-coordinated across workers)."""
    global _MEM_KIS_ASKING_LAST_CALL
    gap = float(gap_sec if gap_sec is not None else _KIS_ASKING_GAP_SEC)
    if gap <= 0:
        return
    if _redis_ok and _client:
        key = 'kis:api:last_call'
        try:
            while True:
                raw = _client.get(key)
                now = time.time()
                if raw:
                    wait = gap - (now - float(raw))
                    if wait > 0:
                        time.sleep(min(wait, gap))
                        continue
                _client.set(key, str(time.time()), ex=max(int(gap * 4), 4))
                return
        except Exception:
            pass
    with _MEM_KIS_ASKING_GAP_LOCK:
        now = time.time()
        elapsed = now - _MEM_KIS_ASKING_LAST_CALL
        if elapsed < gap:
            time.sleep(gap - elapsed)
        _MEM_KIS_ASKING_LAST_CALL = time.time()


def throttle_kis_asking_call(gap_sec=None):
    """Alias for throttle_kis_api_call (asking + live price share one gap)."""
    throttle_kis_api_call(gap_sec)


def acquire_asking_fetch_lock(code, ttl_sec=None):
    """Per-code single-flight lock; True if this caller should fetch from KIS."""
    code = str(code or '').strip()
    if not code:
        return True
    ttl = float(ttl_sec if ttl_sec is not None else _ASKING_FETCH_LOCK_TTL_SEC)
    if _redis_ok and _client:
        try:
            return bool(_client.set(f'asking:lock:{code}', '1', nx=True, ex=max(1, int(ttl))))
        except Exception:
            pass
    return True


def release_asking_fetch_lock(code):
    code = str(code or '').strip()
    if not code or not (_redis_ok and _client):
        return
    try:
        _client.delete(f'asking:lock:{code}')
    except Exception:
        pass


def wait_for_asking_cache(code, timeout_sec=5.0):
    """Wait for another worker to populate asking cache. Returns ('fresh'|'stale', (ts, data))."""
    code = str(code or '').strip()
    if not code:
        return None, None
    deadline = time.time() + max(0.2, float(timeout_sec))
    while time.time() < deadline:
        hit = get_asking(code)
        if hit:
            return 'fresh', hit
        stale = get_asking_stale(code)
        if stale:
            return 'stale', stale
        time.sleep(0.1)
    return None, None


def get_live(code):
    """Return live price payload dict or None."""
    code = str(code or '').strip()
    if not code:
        return None

    entry = _get_json(f'live:{code}')
    if entry and isinstance(entry, dict):
        return entry

    with _LIVE_PRICE_LOCK:
        return _LIVE_PRICE_CACHE.get(code)


def set_live(code, payload):
    """Store live price in Redis and in-memory cache."""
    code = str(code or '').strip()
    if not code or not isinstance(payload, dict):
        return
    _set_json(f'live:{code}', payload, _LIVE_TTL)
    with _LIVE_PRICE_LOCK:
        _LIVE_PRICE_CACHE[code] = payload


def get_market_indices(lite=False):
    """Cached /api/market-indices JSON body (without request-specific flags)."""
    key = 'market-indices:lite' if lite else 'market-indices:full'
    entry = _get_json(key)
    return entry if isinstance(entry, dict) else None


def set_market_indices(payload, lite=False):
    key = 'market-indices:lite' if lite else 'market-indices:full'
    if isinstance(payload, dict):
        _set_json(key, payload, _INDICES_TTL)


def get_traded_value_rank(limit, search_q=''):
    key = f'traded-rank:{int(limit)}:{str(search_q or "").strip()}'
    entry = _get_json(key)
    return entry if isinstance(entry, dict) else None


def set_traded_value_rank(limit, search_q, payload):
    key = f'traded-rank:{int(limit)}:{str(search_q or "").strip()}'
    if isinstance(payload, dict):
        _set_json(key, payload, _RANK_TTL)


def get_live_prices_list(cache_key):
    key = f'live-list:{str(cache_key or "").strip()}'
    entry = _get_json(key)
    return entry if isinstance(entry, dict) else None


def set_live_prices_list(cache_key, payload):
    key = f'live-list:{str(cache_key or "").strip()}'
    if isinstance(payload, dict):
        _set_json(key, payload, _LIVE_LIST_TTL)


def get_stock_detail(cache_key):
    """Return (detail_dict, clock_str) if cached within TTL, else (None, None)."""
    key = f'stock-detail:{str(cache_key or "").strip()[:384]}'
    entry = _get_json(key)
    if not entry or not isinstance(entry.get('data'), dict):
        return None, None
    ts = float(entry.get('ts') or 0)
    if not ts or (time.time() - ts) > _STOCK_DETAIL_TTL:
        return None, None
    return entry['data'], entry.get('clock')


def live_quote_usable(code):
    """True when live:{code} has a non-loading price (detail poll read-only path)."""
    code = str(code or '').strip()
    if not code:
        return False
    live = get_live(code)
    if not live or not isinstance(live, dict) or live.get('loading'):
        return False
    try:
        return int(live.get('price') or 0) > 0
    except (TypeError, ValueError):
        return False


def get_chart_data(code, range_param):
    """Return cached chart JSON body or None."""
    code = str(code or '').strip()
    rng = str(range_param or '1d').strip().lower()
    if not code:
        return None
    entry = _get_json(f'chart:{code}:{rng}')
    return entry if isinstance(entry, dict) and entry.get('success') else None


def set_chart_data(code, range_param, payload):
    code = str(code or '').strip()
    rng = str(range_param or '1d').strip().lower()
    if not code or not isinstance(payload, dict) or not payload.get('success'):
        return
    ttl = _CHART_TTL_BY_RANGE.get(rng, _CHART_TTL_BY_RANGE['1d'])
    _set_json(f'chart:{code}:{rng}', payload, ttl)


def set_stock_detail(cache_key, detail, clock=None):
    """Store full /api/stock-detail payload in Redis."""
    ck = str(cache_key or '').strip()[:384]
    if not ck or not isinstance(detail, dict):
        return
    payload = {
        'ts': time.time(),
        'clock': clock or time.strftime('%H:%M:%S'),
        'data': detail,
    }
    _set_json(f'stock-detail:{ck}', payload, _STOCK_DETAIL_TTL)


def has_live(code):
    """True if any live price entry exists (including loading placeholders).

    Memory dict is read without _LIVE_PRICE_LOCK so this stays safe when callers
    already hold that lock (e.g. _refresh_live_cache).
    """
    code = str(code or '').strip()
    if not code:
        return False
    if _redis_has(f'live:{code}'):
        return True
    return code in _LIVE_PRICE_CACHE
