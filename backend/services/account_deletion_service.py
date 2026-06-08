"""회원 탈퇴 — 연관 데이터 삭제 후 users 행 제거."""

from __future__ import annotations

from services.profile_image_service import remove_profile_image_files


def delete_user_account(conn, user_id: int) -> None:
    """트랜잭션 내에서 사용자 및 연관 데이터 삭제."""
    uid = int(user_id)
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT account_id FROM virtual_accounts WHERE user_id = %s",
            (uid,),
        )
        account_rows = cursor.fetchall() or []
        account_ids = [int(r["account_id"]) for r in account_rows if r.get("account_id")]

        for account_id in account_ids:
            cursor.execute(
                "DELETE FROM virtual_orders WHERE account_id = %s",
                (account_id,),
            )
            cursor.execute(
                "DELETE FROM virtual_positions WHERE account_id = %s",
                (account_id,),
            )

        if account_ids:
            cursor.execute(
                "DELETE FROM virtual_accounts WHERE user_id = %s",
                (uid,),
            )

        cursor.execute(
            "UPDATE ai_analyses SET user_id = NULL WHERE user_id = %s",
            (uid,),
        )

        remove_profile_image_files(uid)

        cursor.execute(
            "DELETE FROM users WHERE user_id = %s",
            (uid,),
        )
        if cursor.rowcount <= 0:
            raise ValueError("user_not_found")

    conn.commit()
