"""
한국투자 Open API — 주식현재가 호가/예상체결 (inquire-asking-price-exp-ccn)
문서 예시용 Data Class의 문법 오류를 바로잡은 버전.

- HTTP 헤더 이름에 하이픈이 있어 Python 식별자로 쓸 수 없음 → snake_case 필드 + to_headers() 매핑
- Optional 미import, output2 누락 등 보완
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional


# --- Request -----------------------------------------------------------------


@dataclass
class KisAskingPriceRequestHeader:
    """REST 요청 시 headers 에 넣을 값 (필드명은 Python 규칙에 맞춤)."""

    authorization: str
    appkey: str
    appsecret: str
    tr_id: str
    custtype: str  # 법인 "B" / 개인 "P"
    content_type: str = "application/json; charset=utf-8"
    personalseckey: Optional[str] = None
    tr_cont: Optional[str] = None
    seq_no: Optional[str] = None
    mac_address: Optional[str] = None
    phone_number: Optional[str] = None
    ip_addr: Optional[str] = None
    gt_uid: Optional[str] = None

    def to_headers(self) -> Dict[str, str]:
        """requests 에 그대로 넣을 수 있는 헤더 dict (키는 KIS 스펙 그대로)."""
        h: Dict[str, str] = {
            "content-type": self.content_type,
            "authorization": self.authorization,
            "appkey": self.appkey,
            "appsecret": self.appsecret,
            "tr_id": self.tr_id,
            "custtype": self.custtype,
        }
        if self.personalseckey is not None:
            h["personalseckey"] = self.personalseckey
        if self.tr_cont is not None:
            h["tr_cont"] = self.tr_cont
        if self.seq_no is not None:
            h["seq_no"] = self.seq_no
        if self.mac_address is not None:
            h["mac_address"] = self.mac_address
        if self.phone_number is not None:
            h["phone_number"] = self.phone_number
        if self.ip_addr is not None:
            h["ip_addr"] = self.ip_addr
        if self.gt_uid is not None:
            h["gt_uid"] = self.gt_uid
        return h


@dataclass
class KisAskingPriceRequestQuery:
    FID_COND_MRKT_DIV_CODE: str  # 조건 시장 분류 코드 (예: J)
    FID_INPUT_ISCD: str  # 종목코드 6자리

    def to_params(self) -> Dict[str, str]:
        return {
            "FID_COND_MRKT_DIV_CODE": self.FID_COND_MRKT_DIV_CODE,
            "FID_INPUT_ISCD": self.FID_INPUT_ISCD,
        }


# --- Response ----------------------------------------------------------------


@dataclass
class KisAskingPriceResponseHeader:
    content_type: str  # 응답 헤더는 보통 requests.response.headers 로 별도 처리
    tr_id: str
    tr_cont: Optional[str] = None
    gt_uid: Optional[str] = None


def _s(d: Dict[str, Any], key: str) -> Optional[str]:
    v = d.get(key)
    return None if v is None else str(v)


@dataclass
class KisAskingPriceOutput1:
    """호가 상세 (output1). API는 문자열로 많이 내려줌."""

    aspr_acpt_hour: Optional[str] = None
    askp1: Optional[str] = None
    askp2: Optional[str] = None
    askp3: Optional[str] = None
    askp4: Optional[str] = None
    askp5: Optional[str] = None
    askp6: Optional[str] = None
    askp7: Optional[str] = None
    askp8: Optional[str] = None
    askp9: Optional[str] = None
    askp10: Optional[str] = None
    bidp1: Optional[str] = None
    bidp2: Optional[str] = None
    bidp3: Optional[str] = None
    bidp4: Optional[str] = None
    bidp5: Optional[str] = None
    bidp6: Optional[str] = None
    bidp7: Optional[str] = None
    bidp8: Optional[str] = None
    bidp9: Optional[str] = None
    bidp10: Optional[str] = None
    askp_rsqn1: Optional[str] = None
    askp_rsqn2: Optional[str] = None
    askp_rsqn3: Optional[str] = None
    askp_rsqn4: Optional[str] = None
    askp_rsqn5: Optional[str] = None
    askp_rsqn6: Optional[str] = None
    askp_rsqn7: Optional[str] = None
    askp_rsqn8: Optional[str] = None
    askp_rsqn9: Optional[str] = None
    askp_rsqn10: Optional[str] = None
    bidp_rsqn1: Optional[str] = None
    bidp_rsqn2: Optional[str] = None
    bidp_rsqn3: Optional[str] = None
    bidp_rsqn4: Optional[str] = None
    bidp_rsqn5: Optional[str] = None
    bidp_rsqn6: Optional[str] = None
    bidp_rsqn7: Optional[str] = None
    bidp_rsqn8: Optional[str] = None
    bidp_rsqn9: Optional[str] = None
    bidp_rsqn10: Optional[str] = None
    askp_rsqn_icdc1: Optional[str] = None
    askp_rsqn_icdc2: Optional[str] = None
    askp_rsqn_icdc3: Optional[str] = None
    askp_rsqn_icdc4: Optional[str] = None
    askp_rsqn_icdc5: Optional[str] = None
    askp_rsqn_icdc6: Optional[str] = None
    askp_rsqn_icdc7: Optional[str] = None
    askp_rsqn_icdc8: Optional[str] = None
    askp_rsqn_icdc9: Optional[str] = None
    askp_rsqn_icdc10: Optional[str] = None
    bidp_rsqn_icdc1: Optional[str] = None
    bidp_rsqn_icdc2: Optional[str] = None
    bidp_rsqn_icdc3: Optional[str] = None
    bidp_rsqn_icdc4: Optional[str] = None
    bidp_rsqn_icdc5: Optional[str] = None
    bidp_rsqn_icdc6: Optional[str] = None
    bidp_rsqn_icdc7: Optional[str] = None
    bidp_rsqn_icdc8: Optional[str] = None
    bidp_rsqn_icdc9: Optional[str] = None
    bidp_rsqn_icdc10: Optional[str] = None
    total_askp_rsqn: Optional[str] = None
    total_bidp_rsqn: Optional[str] = None
    total_askp_rsqn_icdc: Optional[str] = None
    total_bidp_rsqn_icdc: Optional[str] = None
    ovtm_total_askp_icdc: Optional[str] = None
    ovtm_total_bidp_icdc: Optional[str] = None
    ovtm_total_askp_rsqn: Optional[str] = None
    ovtm_total_bidp_rsqn: Optional[str] = None
    ntby_aspr_rsqn: Optional[str] = None
    new_mkop_cls_code: Optional[str] = None

    @classmethod
    def from_dict(cls, d: Optional[Dict[str, Any]]) -> Optional[KisAskingPriceOutput1]:
        if not d:
            return None
        kw = {f.name: _s(d, f.name) for f in cls.__dataclass_fields__.values()}  # type: ignore[attr-defined]
        return cls(**kw)


@dataclass
class KisAskingPriceOutput2:
    """예상체결·요약 시세 (output2)."""

    antc_mkop_cls_code: Optional[str] = None
    stck_prpr: Optional[str] = None
    stck_oprc: Optional[str] = None
    stck_hgpr: Optional[str] = None
    stck_lwpr: Optional[str] = None
    stck_sdpr: Optional[str] = None
    antc_cnpr: Optional[str] = None
    antc_cntg_vrss_sign: Optional[str] = None
    antc_cntg_vrss: Optional[str] = None
    antc_cntg_prdy_ctrt: Optional[str] = None
    antc_vol: Optional[str] = None
    stck_shrn_iscd: Optional[str] = None
    vi_cls_code: Optional[str] = None

    @classmethod
    def from_dict(cls, d: Optional[Dict[str, Any]]) -> Optional[KisAskingPriceOutput2]:
        if not d:
            return None
        kw = {f.name: _s(d, f.name) for f in cls.__dataclass_fields__.values()}  # type: ignore[attr-defined]
        return cls(**kw)


@dataclass
class KisAskingPriceResponseBody:
    rt_cd: str
    msg_cd: str
    msg1: str
    output1: Optional[KisAskingPriceOutput1] = None
    output2: Optional[KisAskingPriceOutput2] = None

    @classmethod
    def from_api_json(cls, payload: Dict[str, Any]) -> KisAskingPriceResponseBody:
        o1 = payload.get("output1")
        o2 = payload.get("output2")
        return cls(
            rt_cd=str(payload.get("rt_cd") or ""),
            msg_cd=str(payload.get("msg_cd") or ""),
            msg1=str(payload.get("msg1") or ""),
            output1=KisAskingPriceOutput1.from_dict(o1 if isinstance(o1, dict) else None),
            output2=KisAskingPriceOutput2.from_dict(o2 if isinstance(o2, dict) else None),
        )
