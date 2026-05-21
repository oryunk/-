"""1회용 백필 스크립트: stock_price_daily 의 최근 거래일 OHLC + prev_close 채움.

언제 실행:
    - DB가 비어있거나 오래됐을 때 (예: 오늘 행만 있고 전일 종가가 없어서 등락률이 0% 로만 나오는 상황)
    - SQL/update.sql 의 prev_close 컬럼 마이그레이션을 적용한 직후 1회

실행:
    python backend/backfill_prev_close.py                # price.STOCKS + DB stocks 합집합 종목, 최근 15영업일
    python backend/backfill_prev_close.py --days 30      # 기간 변경
    python backend/backfill_prev_close.py --codes 005930,000660  # 특정 종목만
    python backend/backfill_prev_close.py --only-db      # DB stocks 테이블의 종목만

동작:
    1) yfinance 일봉(.KS/.KQ) 우선 시도. 실패 시 pykrx (표준출력 억제 — KRX JSON 오류 스팸 방지).
    2) 가장 오래된 행은 prev_close 가 비어 있으므로 None 으로 둔다.
    3) 그 다음 행부터는 직전 거래일 close 를 prev_close 로 채운다.
    4) stock_price_daily 에 UPSERT (날짜·종목 단위로 기존 행 갱신).
"""

from __future__ import annotations

import argparse
import contextlib
import io
import sys
import time
from datetime import datetime, timedelta

try:
    from pykrx import stock as pykrx_stock
except Exception as exc:
    print(f"[FATAL] pykrx 를 import 할 수 없습니다: {exc}")
    sys.exit(1)

try:
    import yfinance as yf
except Exception as exc:
    yf = None  # type: ignore
    print(f"[WARN] yfinance 를 import 할 수 없습니다. pykrx 만 사용합니다: {exc}")

from auth_api import get_connection

try:
    from price import STOCKS as PRICE_STOCKS
except Exception:
    PRICE_STOCKS = {}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="stock_price_daily 일봉/전일종가 백필")
    parser.add_argument("--days", type=int, default=15, help="조회할 달력 기준 일수 (기본 15)")
    parser.add_argument("--codes", type=str, default="", help="콤마구분 종목코드 (예: 005930,000660)")
    parser.add_argument(
        "--only-db",
        action="store_true",
        help="price.STOCKS 가 아닌, DB stocks 테이블의 종목만 백필",
    )
    parser.add_argument(
        "--gap",
        type=float,
        default=0.15,
        help="종목 사이 호출 간격 (초). pykrx/yfinance 부하 완화용. 기본 0.15",
    )
    return parser.parse_args()


def _resolve_targets(args: argparse.Namespace) -> dict[str, str]:
    """{종목코드: 종목명} 딕셔너리 반환."""
    if args.codes:
        codes = [c.strip() for c in args.codes.split(",") if c.strip()]
        return {c: PRICE_STOCKS.get(c, c) for c in codes}

    targets: dict[str, str] = {}
    if not args.only_db:
        targets.update({str(c).strip(): str(n).strip() for c, n in (PRICE_STOCKS or {}).items() if c})

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT symbol, name_ko FROM stocks WHERE is_active = 1 OR is_active IS NULL")
            for row in cur.fetchall() or []:
                sym = str(row.get("symbol") or "").strip()
                if not sym:
                    continue
                targets.setdefault(sym, str(row.get("name_ko") or sym).strip())
    except Exception as exc:
        print(f"[WARN] stocks 조회 실패: {exc}")
    finally:
        if conn:
            conn.close()
    return targets


def _ensure_stock_id(cur, code: str, name: str) -> int | None:
    cur.execute("SELECT stock_id FROM stocks WHERE symbol = %s", (code,))
    row = cur.fetchone()
    if row:
        return row["stock_id"]
    try:
        cur.execute(
            """
            INSERT INTO stocks (symbol, name_ko, created_at, updated_at)
            VALUES (%s, %s, NOW(), NOW())
            """,
            (code, name or code),
        )
        cur.execute("SELECT stock_id FROM stocks WHERE symbol = %s", (code,))
        row = cur.fetchone()
        return row["stock_id"] if row else None
    except Exception as exc:
        print(f"[WARN] stocks INSERT 실패 ({code}): {exc}")
        return None


def _fetch_ohlcv_yfinance(code: str, start: str, end: str):
    """yfinance 일봉 (.KS / .KQ). 성공 시 DataFrame, 아니면 None."""
    if yf is None:
        return None

    start_dt = datetime.strptime(start, "%Y%m%d")
    end_dt = datetime.strptime(end, "%Y%m%d")
    days = max(5, (end_dt - start_dt).days + 5)
    start_d = start_dt.date()
    end_d = end_dt.date()

    base = str(code or "").strip()
    if not base:
        return None
    if "." in base:
        candidates = [base]
    else:
        candidates = [f"{base}.KS", f"{base}.KQ"]

    for ticker in candidates:
        try:
            yf_df = yf.Ticker(ticker).history(
                period=f"{days}d", interval="1d", auto_adjust=False
            )
        except Exception as exc:
            print(f"[WARN] yfinance 조회 예외 ({ticker}): {exc}")
            continue
        if yf_df is None or getattr(yf_df, "empty", True):
            continue
        try:
            if getattr(yf_df.index, "tz", None) is not None:
                yf_df = yf_df.copy()
                yf_df.index = yf_df.index.tz_localize(None)
        except Exception:
            pass
        try:
            mask = (yf_df.index.date >= start_d) & (yf_df.index.date <= end_d)
            yf_df = yf_df.loc[mask]
        except Exception:
            continue
        if yf_df.empty:
            continue
        return yf_df
    return None


def _fetch_ohlcv_pykrx_quiet(code: str, start: str, end: str):
    """pykrx 일봉. 라이브러리가 stderr/stdout 에 찍는 JSON 오류 메시지를 숨김."""
    try:
        _buf_out = io.StringIO()
        _buf_err = io.StringIO()
        with contextlib.redirect_stdout(_buf_out), contextlib.redirect_stderr(_buf_err):
            df = pykrx_stock.get_market_ohlcv(start, end, code, adjusted=False)
        if df is not None and not getattr(df, "empty", True):
            return df
    except Exception:
        pass
    return None


def _fetch_ohlcv(code: str, start: str, end: str):
    """yfinance 우선 (대부분 환경에서 KRX/pykrx 가 빈 응답). 실패 시 pykrx 폴백."""
    df = _fetch_ohlcv_yfinance(code, start, end)
    if df is not None:
        return df
    df = _fetch_ohlcv_pykrx_quiet(code, start, end)
    if df is not None:
        print(f"[INFO] pykrx 사용 (yfinance 없음): {code} ({len(df)}행)")
    return df


def _to_int_or_none(v):
    try:
        if v is None:
            return None
        n = int(round(float(v)))
        return n if n > 0 else None
    except (TypeError, ValueError):
        return None


def backfill_one(cur, code: str, name: str, start: str, end: str) -> int:
    df = _fetch_ohlcv(code, start, end)
    if df is None:
        return 0

    df = df.sort_index()
    rename_map = {"시가": "Open", "고가": "High", "저가": "Low", "종가": "Close", "거래량": "Volume"}
    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})
    if "Close" not in df.columns:
        return 0

    stock_id = _ensure_stock_id(cur, code, name)
    if not stock_id:
        return 0

    inserted = 0
    prev_close: int | None = None
    last_close: int | None = None
    for ts, row in df.iterrows():
        try:
            date_str = ts.strftime("%Y-%m-%d")
        except Exception:
            continue

        close_p = _to_int_or_none(row.get("Close"))
        if close_p is None:
            prev_close = None
            continue

        open_p = _to_int_or_none(row.get("Open")) or close_p
        high_p = _to_int_or_none(row.get("High")) or close_p
        low_p = _to_int_or_none(row.get("Low")) or close_p
        volume = _to_int_or_none(row.get("Volume")) or 0

        cur.execute(
            """
            INSERT INTO stock_price_daily (
                stock_id, date,
                open_price, high_price, low_price,
                close_price, prev_close, volume, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON DUPLICATE KEY UPDATE
                open_price  = COALESCE(NULLIF(VALUES(open_price), 0),  open_price),
                high_price  = COALESCE(NULLIF(VALUES(high_price), 0),  high_price),
                low_price   = COALESCE(NULLIF(VALUES(low_price), 0),   low_price),
                close_price = COALESCE(NULLIF(VALUES(close_price), 0), close_price),
                prev_close  = COALESCE(NULLIF(VALUES(prev_close), 0),  prev_close),
                volume      = COALESCE(NULLIF(VALUES(volume), 0),      volume),
                created_at  = NOW()
            """,
            (stock_id, date_str, open_p, high_p, low_p, close_p, prev_close, volume),
        )
        inserted += 1
        prev_close = close_p
        last_close = close_p

    # fetch_live_snapshot_batch 가 장외에 s.current_price 를 우선 사용하므로
    # 일봉만 채우고 stocks.current_price 가 옛날이면 화면 가격이 갱신되지 않음.
    if last_close is not None:
        cur.execute("SHOW COLUMNS FROM stocks LIKE 'current_price'")
        if cur.fetchone() is not None:
            cur.execute(
                """
                UPDATE stocks
                SET current_price = %s, updated_at = NOW()
                WHERE stock_id = %s
                """,
                (last_close, stock_id),
            )
            cur.execute("SHOW COLUMNS FROM stocks LIKE 'last_api_update'")
            if cur.fetchone() is not None:
                cur.execute(
                    "UPDATE stocks SET last_api_update = NOW() WHERE stock_id = %s",
                    (stock_id,),
                )

    return inserted


def main() -> int:
    args = _parse_args()

    end_dt = datetime.now()
    start_dt = end_dt - timedelta(days=max(args.days, 5))
    start = start_dt.strftime("%Y%m%d")
    end = end_dt.strftime("%Y%m%d")

    targets = _resolve_targets(args)
    if not targets:
        print("[ERROR] 백필 대상 종목이 없습니다.")
        return 1

    print(f"[BACKFILL] 대상 {len(targets)} 종목, 기간 {start}~{end}")

    conn = None
    total_rows = 0
    try:
        conn = get_connection()
        for i, (code, name) in enumerate(targets.items(), start=1):
            with conn.cursor() as cur:
                rows = backfill_one(cur, code, name, start, end)
            conn.commit()
            total_rows += rows
            print(f"  [{i:>3}/{len(targets)}] {code} {name}: {rows} 행")
            if args.gap > 0 and i < len(targets):
                time.sleep(args.gap)
    except KeyboardInterrupt:
        print("\n[INTERRUPT] 사용자 중단. 지금까지 변경 내용은 commit 됨.")
    except Exception as exc:
        if conn:
            conn.rollback()
        print(f"[FATAL] 백필 중 오류: {exc}")
        return 2
    finally:
        if conn:
            conn.close()

    print(f"[DONE] 총 {total_rows} 행 UPSERT")
    return 0


if __name__ == "__main__":
    sys.exit(main())
