"""실시간 시세 → DB 반영."""

import time

from auth_api import get_connection


def _to_int(value, default=0):
    if value is None or value == "":
        return default
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default
    try:
        s = str(value).replace(",", "").strip()
        if not s or s == "-":
            return default
        return int(float(s))
    except (TypeError, ValueError):
        return default


def _optional_ohlc(value):
    """0 이하면 NULL (미제공)."""
    v = _to_int(value, default=0)
    return v if v > 0 else None


def sync_live_price_batch(items):
    """시세 배치를 DB에 반영."""
    if not items:
        return 0

    max_retries = 4
    updated_count = 0

    for attempt in range(max_retries):
        conn = None
        try:
            conn = get_connection()
            with conn.cursor() as cursor:
                cursor.execute("SHOW COLUMNS FROM stocks LIKE 'current_price'")
                has_current_price = cursor.fetchone() is not None

                for item in items:
                    code = str(item.get("code") or "").strip()
                    name = str(item.get("name") or code).strip()
                    price = _to_int(item.get("price"), default=0)
                    volume = _to_int(item.get("volume"), default=0)
                    open_p = _optional_ohlc(item.get("open"))
                    high_p = _optional_ohlc(item.get("high"))
                    low_p = _optional_ohlc(item.get("low"))
                    # 장외/폴백 소스에서 시고저가가 비어 오면 종가로 보정해 NULL 누적 방지
                    if open_p is None:
                        open_p = price
                    if high_p is None:
                        high_p = price
                    if low_p is None:
                        low_p = price
                    # 등락률 계산용 전일 종가 (KIS: stck_sdpr / stck_prdy_clpr,
                    # yfinance/pykrx fallback 도 _build_yfinance_payload 에서 같이 채움)
                    prev_close = _optional_ohlc(item.get("previous_close"))
                    if not code or price <= 0:
                        continue

                    if has_current_price:
                        cursor.execute(
                            """
                            INSERT INTO stocks (symbol, name_ko, current_price, created_at, updated_at)
                            VALUES (%s, %s, %s, NOW(), NOW())
                            ON DUPLICATE KEY UPDATE
                                name_ko = VALUES(name_ko),
                                current_price = VALUES(current_price),
                                updated_at = NOW()
                            """,
                            (code, name, price),
                        )
                    else:
                        cursor.execute(
                            """
                            INSERT INTO stocks (symbol, name_ko, created_at, updated_at)
                            VALUES (%s, %s, NOW(), NOW())
                            ON DUPLICATE KEY UPDATE
                                name_ko = VALUES(name_ko),
                                updated_at = NOW()
                            """,
                            (code, name),
                        )

                    cursor.execute("SELECT stock_id FROM stocks WHERE symbol = %s", (code,))
                    stock_row = cursor.fetchone()
                    if not stock_row:
                        continue
                    stock_id = stock_row["stock_id"]

                    # prev_close 는 들어온 값이 양수일 때만 덮어쓴다.
                    # (장중에 KIS 가 일시적으로 0/공백을 주더라도 기존 값 유지)
                    cursor.execute(
                        """
                        INSERT INTO stock_price_daily (
                            stock_id, date,
                            open_price, high_price, low_price,
                            close_price, prev_close, volume, created_at
                        )
                        VALUES (%s, CURDATE(), %s, %s, %s, %s, %s, %s, NOW())
                        ON DUPLICATE KEY UPDATE
                            open_price = VALUES(open_price),
                            high_price = VALUES(high_price),
                            low_price = VALUES(low_price),
                            close_price = VALUES(close_price),
                            prev_close = COALESCE(NULLIF(VALUES(prev_close), 0), prev_close),
                            volume = VALUES(volume),
                            created_at = NOW()
                        """,
                        (stock_id, open_p, high_p, low_p, price, prev_close, volume),
                    )
                    updated_count += 1

            conn.commit()
            return updated_count
        except Exception as e:
            if conn:
                conn.rollback()
            msg = str(e)
            deadlock = ("1213" in msg) or ("Deadlock found" in msg)
            if deadlock and attempt < (max_retries - 1):
                wait_s = 0.15 * (attempt + 1)
                print(f"[LIVE_DB_SYNC] deadlock 재시도 {attempt + 1}/{max_retries - 1} ({wait_s:.2f}s)")
                time.sleep(wait_s)
                continue
            print(f"[LIVE_DB_SYNC] 동기화 실패: {e}")
            return updated_count
        finally:
            if conn:
                conn.close()

    return updated_count


def fetch_live_snapshot_batch(codes):
    """DB 시세 스냅샷 (표시용)."""
    cleaned = [str(code).strip() for code in (codes or []) if str(code).strip()]
    if not cleaned:
        return {}

    placeholders = ",".join(["%s"] * len(cleaned))
    # prev_close 우선순위:
    #   1) sp_latest.prev_close 컬럼 (시세 동기화 시 같이 박은 KIS 전일 종가)
    #   2) 그 종목의 sp_latest.date 보다 이전 일자 행의 close_price (백필 후 폴백)
    sql_with_cp = f"""
        SELECT
            s.symbol,
            s.name_ko,
            s.current_price AS price,
            sp_latest.close_price AS latest_close,
            sp_latest.volume AS latest_volume,
            sp_latest.date AS latest_date,
            COALESCE(
                NULLIF(sp_latest.prev_close, 0),
                (
                    SELECT sp2.close_price
                    FROM stock_price_daily sp2
                    WHERE sp2.stock_id = s.stock_id
                      AND sp_latest.date IS NOT NULL
                      AND sp2.date < sp_latest.date
                    ORDER BY sp2.date DESC
                    LIMIT 1
                )
            ) AS prev_close
        FROM stocks s
        LEFT JOIN stock_price_daily sp_latest
            ON sp_latest.stock_id = s.stock_id
           AND sp_latest.date = (
                SELECT MAX(spx.date) FROM stock_price_daily spx WHERE spx.stock_id = s.stock_id
           )
        WHERE s.symbol IN ({placeholders})
    """
    sql_without_cp = f"""
        SELECT
            s.symbol,
            s.name_ko,
            sp_latest.close_price AS price,
            sp_latest.close_price AS latest_close,
            sp_latest.volume AS latest_volume,
            sp_latest.date AS latest_date,
            COALESCE(
                NULLIF(sp_latest.prev_close, 0),
                (
                    SELECT sp2.close_price
                    FROM stock_price_daily sp2
                    WHERE sp2.stock_id = s.stock_id
                      AND sp_latest.date IS NOT NULL
                      AND sp2.date < sp_latest.date
                    ORDER BY sp2.date DESC
                    LIMIT 1
                )
            ) AS prev_close
        FROM stocks s
        LEFT JOIN stock_price_daily sp_latest
            ON sp_latest.stock_id = s.stock_id
           AND sp_latest.date = (
                SELECT MAX(spx.date) FROM stock_price_daily spx WHERE spx.stock_id = s.stock_id
           )
        WHERE s.symbol IN ({placeholders})
    """

    conn = None
    rows_by_code = {}
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SHOW COLUMNS FROM stocks LIKE 'current_price'")
            has_current_price = cursor.fetchone() is not None
            sql = sql_with_cp if has_current_price else sql_without_cp
            cursor.execute(sql, tuple(cleaned))
            rows = cursor.fetchall() or []
            for row in rows:
                code = str(row.get("symbol") or "").strip()
                if not code:
                    continue
                price = _to_int(row.get("price"), default=0)
                latest_close = _to_int(row.get("latest_close"), default=0)
                if price <= 0 and latest_close > 0:
                    price = latest_close
                if price <= 0:
                    continue

                prev_close = _to_int(row.get("prev_close"), default=0)
                if prev_close > 0:
                    change = price - prev_close
                    rate = (change / prev_close) * 100.0
                else:
                    change = 0
                    rate = 0.0
                if change > 0:
                    direction = "up"
                elif change < 0:
                    direction = "down"
                else:
                    direction = "flat"
                raw_ld = row.get("latest_date")
                latest_date_str = None
                if raw_ld is not None:
                    try:
                        latest_date_str = (
                            raw_ld.strftime("%Y-%m-%d")
                            if hasattr(raw_ld, "strftime")
                            else str(raw_ld)[:10]
                        )
                    except Exception:
                        latest_date_str = None
                rows_by_code[code] = {
                    "code": code,
                    "name": row.get("name_ko") or code,
                    "price": price,
                    "change": change,
                    "rate": round(rate, 2),
                    "volume": _to_int(row.get("latest_volume"), default=0),
                    "direction": direction,
                    "stale": True,
                    "error": None,
                    # 장외 보강: 전일 종가 없으면 등락률이 0으로만 나오므로 API에서 yfinance로 채울 때 구분
                    "previous_close": prev_close,
                    # 장외 stale 검사: stock_price_daily 최신 일자 (YYYY-MM-DD)
                    "latest_date": latest_date_str,
                }
    except Exception as e:
        print(f"[LIVE_DB_SNAPSHOT] 조회 실패: {e}")
    finally:
        if conn:
            conn.close()

    return rows_by_code
