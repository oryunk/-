"""AI 종목 분석·용어 설명 API."""

from flask import Blueprint

analysis_bp = Blueprint("analysis", __name__)


@analysis_bp.route("/api/analyze", methods=["POST"])
def analyze():
    import app as app_module

    return app_module.serve_analyze()


@analysis_bp.route("/api/terms/explain", methods=["POST"])
def explain_term():
    import app as app_module

    return app_module.serve_explain_term()
