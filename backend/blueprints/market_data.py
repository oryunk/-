"""헬스·시장 지수·환율 API."""

from flask import Blueprint, jsonify

market_data_bp = Blueprint("market_data", __name__)


@market_data_bp.route("/api/health", methods=["GET"])
def health():
    """헬스 체크"""
    return jsonify({"status": "ok", "message": "서버가 정상 작동 중입니다."}), 200


@market_data_bp.route("/api/market-indices", methods=["GET"])
def market_indices():
    import app as app_module

    return app_module.serve_market_indices()


@market_data_bp.route("/api/market-indices/history/<index_key>", methods=["GET"])
def market_index_history(index_key):
    import app as app_module

    return app_module.serve_market_index_history(index_key)


@market_data_bp.route("/api/fx-usd-krw", methods=["GET"])
def fx_usd_krw():
    import app as app_module

    return app_module.serve_fx_usd_krw()
