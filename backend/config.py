"""
기초 정보 (브랜드 컨텍스트, 네거티브 키워드, 등록 키워드) 관리.
현재는 파일 기반. 추후 DB 연동으로 교체 가능.
"""
import json
import os
from pathlib import Path

CONFIG_DIR = Path(__file__).parent / "config_data"
CONFIG_DIR.mkdir(exist_ok=True)

BRAND_FILE = CONFIG_DIR / "brand_context.txt"
NEGATIVE_FILE = CONFIG_DIR / "negative_keywords.json"
REGISTERED_FILE = CONFIG_DIR / "registered_keywords.json"
AD_GROUP_FILE = CONFIG_DIR / "ad_group_structure.json"


def get_brand_context() -> str:
    if BRAND_FILE.exists():
        return BRAND_FILE.read_text(encoding="utf-8").strip()
    return "헤이딜러 — 중고차 매매 및 견적 플랫폼. 차량 매도/매수를 연결하는 O2O 서비스."


def get_negative_keywords() -> list[str]:
    if NEGATIVE_FILE.exists():
        return json.loads(NEGATIVE_FILE.read_text(encoding="utf-8"))
    return []


def get_registered_keywords() -> list[str]:
    if REGISTERED_FILE.exists():
        return json.loads(REGISTERED_FILE.read_text(encoding="utf-8"))
    return []


def get_ad_group_structure() -> dict:
    if AD_GROUP_FILE.exists():
        return json.loads(AD_GROUP_FILE.read_text(encoding="utf-8"))
    return {}


def save_brand_context(text: str) -> None:
    BRAND_FILE.write_text(text, encoding="utf-8")


def save_negative_keywords(keywords: list[str]) -> None:
    NEGATIVE_FILE.write_text(json.dumps(keywords, ensure_ascii=False, indent=2), encoding="utf-8")


def save_registered_keywords(keywords: list[str]) -> None:
    REGISTERED_FILE.write_text(json.dumps(keywords, ensure_ascii=False, indent=2), encoding="utf-8")


def save_ad_group_structure(structure: dict) -> None:
    AD_GROUP_FILE.write_text(json.dumps(structure, ensure_ascii=False, indent=2), encoding="utf-8")
