"""차트 데이터·튜토리얼 코치 API."""

from flask import Blueprint

charts_bp = Blueprint("charts", __name__)


@charts_bp.route("/api/chart-data/<code>", methods=["GET"])
def chart_data(code):
    import app as app_module

    return app_module.serve_chart_data(code)


@charts_bp.route("/api/tutorial/chart-coach", methods=["POST"])
def tutorial_chart_coach():
    import app as app_module

    return app_module.serve_tutorial_chart_coach()
