"""모의투자 관련 API (/api/mock/*)."""

from flask import Blueprint

mock_trading_bp = Blueprint("mock_trading", __name__)


@mock_trading_bp.route("/api/mock/traded-value-rank", methods=["GET"])
def mock_traded_value_rank():
    import app as app_module

    return app_module.serve_mock_traded_value_rank()


@mock_trading_bp.route("/api/mock/asking-price/<code>", methods=["GET"])
def mock_asking_price(code):
    import app as app_module

    return app_module.serve_mock_asking_price(code)


@mock_trading_bp.route("/api/mock/portfolio", methods=["GET"])
def mock_portfolio():
    import app as app_module

    return app_module.serve_mock_portfolio()


@mock_trading_bp.route("/api/mock/trade", methods=["POST"])
def mock_trade():
    import app as app_module

    return app_module.serve_mock_trade()
