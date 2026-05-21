"""`stocks.stock_id`를 1..N으로 재번호하고 FK 참조 테이블도 함께 갱신한다.

사용 전 권장:
1. `stock_db` 전체 백업을 먼저 만든다.
2. 앱 쓰기 트래픽을 잠시 멈춘다.
3. 먼저 `python resequence_stock_ids.py` 로 미리보기만 확인한다.
4. 이상 없을 때만 `python resequence_stock_ids.py --apply` 를 실행한다.
"""

from __future__ import annotations

import argparse
import sys

import pymysql

from runtime_config import load_env_files, mysql_config


MAP_TABLE = 'tmp_stock_id_map'


def get_connection():
    base = mysql_config()
    return pymysql.connect(
        host=base['host'],
        port=base['port'],
        user=base['user'],
        password=base['password'],
        database=base['database'],
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        init_command='SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci',
        autocommit=False,
    )


def fetch_stocks(cur):
    cur.execute(
        """
        SELECT stock_id, symbol, name_ko
        FROM stocks
        WHERE symbol REGEXP '^[0-9]{6}$'
        ORDER BY stock_id ASC, symbol ASC
        """
    )
    return cur.fetchall() or []


def discover_stock_fk_tables(cur):
    cur.execute(
        """
        SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND REFERENCED_TABLE_NAME = 'stocks'
          AND REFERENCED_COLUMN_NAME = 'stock_id'
        ORDER BY TABLE_NAME ASC, COLUMN_NAME ASC
        """
    )
    return cur.fetchall() or []


def build_mapping(rows):
    mapping = []
    for new_id, row in enumerate(rows, start=1):
        old_id = int(row['stock_id'])
        mapping.append({
            'old_stock_id': old_id,
            'new_stock_id': new_id,
            'symbol': str(row.get('symbol') or '').strip(),
            'name_ko': str(row.get('name_ko') or '').strip(),
        })
    return mapping


def is_already_sequential(mapping):
    return all(int(row['old_stock_id']) == int(row['new_stock_id']) for row in mapping)


def print_preview(mapping, fk_tables, preview_count):
    print(f'대상 종목 수: {len(mapping)}')
    print(f'참조 FK 테이블 수: {len(fk_tables)}')
    if fk_tables:
        print('FK 참조 테이블:')
        for row in fk_tables:
            print(f"  - {row['table_name']}.{row['column_name']}")
    print('')
    print('재번호 미리보기:')
    for row in mapping[:preview_count]:
        suffix = f" ({row['symbol']} {row['name_ko']})".rstrip()
        print(f"  {row['old_stock_id']} -> {row['new_stock_id']}{suffix}")
    if len(mapping) > preview_count:
        print(f'  ... 외 {len(mapping) - preview_count}건')


def create_temp_map(cur):
    cur.execute(f'DROP TEMPORARY TABLE IF EXISTS {MAP_TABLE}')
    cur.execute(
        f"""
        CREATE TEMPORARY TABLE {MAP_TABLE} (
            old_stock_id BIGINT NOT NULL PRIMARY KEY,
            new_stock_id BIGINT NOT NULL UNIQUE,
            temp_stock_id BIGINT NOT NULL UNIQUE,
            symbol VARCHAR(20) NOT NULL
        ) ENGINE=InnoDB
        """
    )


def fill_temp_map(cur, mapping):
    max_existing_id = max(int(row['old_stock_id']) for row in mapping) if mapping else 0
    shift_base = max_existing_id + len(mapping) + 1000
    params = []
    for idx, row in enumerate(mapping, start=1):
        params.append((
            int(row['old_stock_id']),
            int(row['new_stock_id']),
            shift_base + idx,
            row['symbol'],
        ))
    cur.executemany(
        f"""
        INSERT INTO {MAP_TABLE} (old_stock_id, new_stock_id, temp_stock_id, symbol)
        VALUES (%s, %s, %s, %s)
        """,
        params,
    )


def update_child_to_temp(cur, table_name, column_name):
    cur.execute(
        f"""
        UPDATE {table_name} AS t
        JOIN {MAP_TABLE} AS m
          ON t.{column_name} = m.old_stock_id
        SET t.{column_name} = m.temp_stock_id
        """
    )


def update_child_to_final(cur, table_name, column_name):
    cur.execute(
        f"""
        UPDATE {table_name} AS t
        JOIN {MAP_TABLE} AS m
          ON t.{column_name} = m.temp_stock_id
        SET t.{column_name} = m.new_stock_id
        """
    )


def update_parent_to_temp(cur):
    cur.execute(
        f"""
        UPDATE stocks AS s
        JOIN {MAP_TABLE} AS m
          ON s.stock_id = m.old_stock_id
        SET s.stock_id = m.temp_stock_id
        """
    )


def update_parent_to_final(cur):
    cur.execute(
        f"""
        UPDATE stocks AS s
        JOIN {MAP_TABLE} AS m
          ON s.stock_id = m.temp_stock_id
        SET s.stock_id = m.new_stock_id
        """
    )


def set_next_auto_increment(cur, next_id):
    cur.execute(f'ALTER TABLE stocks AUTO_INCREMENT = {int(next_id)}')


def count_orphans(cur, fk_tables):
    issues = []
    for row in fk_tables:
        table_name = row['table_name']
        column_name = row['column_name']
        cur.execute(
            f"""
            SELECT COUNT(*) AS cnt
            FROM {table_name} AS t
            LEFT JOIN stocks AS s
              ON s.stock_id = t.{column_name}
            WHERE t.{column_name} IS NOT NULL
              AND s.stock_id IS NULL
            """
        )
        hit = cur.fetchone() or {}
        cnt = int(hit.get('cnt') or 0)
        if cnt > 0:
            issues.append((table_name, column_name, cnt))
    return issues


def apply_resequence(conn, mapping, fk_tables):
    with conn.cursor() as cur:
        create_temp_map(cur)
        fill_temp_map(cur, mapping)
        cur.execute('SET FOREIGN_KEY_CHECKS = 0')
        try:
            for row in fk_tables:
                update_child_to_temp(cur, row['table_name'], row['column_name'])
            update_parent_to_temp(cur)
            update_parent_to_final(cur)
            for row in fk_tables:
                update_child_to_final(cur, row['table_name'], row['column_name'])
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.execute('SET FOREIGN_KEY_CHECKS = 1')

        next_id = (max(int(row['new_stock_id']) for row in mapping) + 1) if mapping else 1
        set_next_auto_increment(cur, next_id)
        conn.commit()
        return count_orphans(cur, fk_tables)


def parse_args(argv):
    parser = argparse.ArgumentParser(description='Resequence stocks.stock_id and dependent foreign keys.')
    parser.add_argument('--apply', action='store_true', help='실제 DB 변경을 수행합니다.')
    parser.add_argument('--preview-count', type=int, default=20, help='미리보기로 출력할 매핑 개수')
    return parser.parse_args(argv)


def main(argv=None):
    load_env_files()
    args = parse_args(argv or sys.argv[1:])
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            rows = fetch_stocks(cur)
            fk_tables = discover_stock_fk_tables(cur)
        if not rows:
            print('재번호할 종목이 없습니다.')
            return 0

        mapping = build_mapping(rows)
        print_preview(mapping, fk_tables, max(1, int(args.preview_count)))

        if is_already_sequential(mapping):
            print('\n이미 stock_id가 1..N 순서로 정렬되어 있습니다.')
            return 0

        if not args.apply:
            print('\n미리보기만 수행했습니다. 실제 적용은 --apply 옵션을 사용하세요.')
            return 0

        print('\n실제 마이그레이션을 실행합니다...')
        issues = apply_resequence(conn, mapping, fk_tables)
        if issues:
            print('\n경고: orphan 레코드가 발견되었습니다.')
            for table_name, column_name, cnt in issues:
                print(f'  - {table_name}.{column_name}: {cnt}건')
            return 1

        print('\n완료: stocks.stock_id 및 참조 FK가 순차 번호로 재정렬되었습니다.')
        return 0
    except Exception as exc:
        print(f'\n실패: {exc}')
        return 1
    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    raise SystemExit(main())
