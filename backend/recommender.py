"""
Claude API를 활용한 키워드 추천.
- 전환 키워드 + 브랜드 컨텍스트 + 네거티브 키워드 → 유사/신규 키워드 추천
- 할루시네이션 방지: 추천 키워드는 반드시 JSON 형식으로 반환, 근거 필수
"""
import json
import os
import anthropic
from dotenv import load_dotenv
from models import RecommendedKeyword

load_dotenv()

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY가 설정되지 않았습니다.")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


SYSTEM_PROMPT = """당신은 디지털 마케팅 SA(검색 광고) 키워드 전략 전문가입니다.
전환이 발생한 키워드 데이터를 분석하고, 유사 키워드와 신규 키워드를 추천합니다.

규칙:
1. 반드시 실제 존재할 법한 검색 키워드만 추천하세요. 없는 키워드를 만들어내지 마세요.
2. 추천 이유는 데이터 근거(전환 키워드와의 의미적 연관성, 검색 의도)를 명확히 서술하세요.
3. 데이터가 부족하거나 확신이 없으면 '확인 필요'로 명시하세요.
4. 반드시 아래 JSON 형식으로만 응답하세요."""

RECOMMEND_PROMPT = """
## 입력 데이터

### 전환 발생 키워드 (상위 {top_n}개, 견적요청 기준)
{conversion_keywords}

### 브랜드 컨텍스트
{brand_context}

### 네거티브 키워드 (이 키워드들은 추천 금지)
{negative_keywords}

### 이미 등록된 키워드 (중복 추천 금지)
{registered_keywords}

## 요청
위 전환 키워드를 분석하여 아래 JSON 형식으로 추천 키워드를 생성하세요.
- 유사 키워드: 전환 키워드와 의미·맥락이 유사하지만 현재 미등록인 키워드
- 신규 키워드: 브랜드 서비스와 관련 있으며 잠재 전환 가능성이 있는 새로운 키워드

```json
{{
  "recommendations": [
    {{
      "keyword": "추천 키워드",
      "type": "유사 또는 신규",
      "reason": "추천 이유 (전환 키워드와의 연관성, 검색 의도 등)",
      "suggested_ad_group": "적합한 광고그룹명",
      "media_targets": ["네이버", "구글"]
    }}
  ],
  "insight_summary": "전체 키워드 전략 인사이트 요약 (3-5문장)"
}}
```

유사 키워드 15개 이상, 신규 키워드 10개 이상 추천하세요.
"""


def recommend_keywords(
    conversion_keywords: list[dict],
    brand_context: str,
    negative_keywords: list[str],
    registered_keywords: list[str],
    top_n: int = 30,
) -> tuple[list[RecommendedKeyword], str]:
    """
    Returns (recommendations, insight_summary)
    """
    if not conversion_keywords:
        return [], "전환 키워드 데이터가 없어 추천을 생성할 수 없습니다."

    top_keywords = conversion_keywords[:top_n]
    kw_list = "\n".join(
        f"- {k['keyword']} (매체: {k['media']}, 광고그룹: {k['ad_group']}, "
        f"전환: {k['conversions']}회, 비용: ₩{k['cost']:,.0f}, CPA: ₩{k['cpa']:,.0f})"
        for k in top_keywords
    )

    prompt = RECOMMEND_PROMPT.format(
        top_n=top_n,
        conversion_keywords=kw_list,
        brand_context=brand_context or "헤이딜러 — 중고차 매매/견적 플랫폼",
        negative_keywords="\n".join(f"- {k}" for k in negative_keywords) or "없음",
        registered_keywords="\n".join(f"- {k}" for k in registered_keywords[:50]) or "없음",
    )

    client = _get_client()
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # JSON 블록 추출
    json_start = raw.find("{")
    json_end = raw.rfind("}") + 1
    if json_start == -1 or json_end == 0:
        return [], f"응답 파싱 실패: {raw[:200]}"

    parsed = json.loads(raw[json_start:json_end])
    recs_raw = parsed.get("recommendations", [])
    insight = parsed.get("insight_summary", "")

    recommendations = []
    for item in recs_raw:
        recommendations.append(RecommendedKeyword(
            keyword=item.get("keyword", ""),
            type=item.get("type", "신규"),
            reason=item.get("reason", ""),
            suggested_ad_group=item.get("suggested_ad_group", ""),
            media_targets=item.get("media_targets", ["네이버"]),
        ))

    return recommendations, insight


def generate_insight_report(
    summary: dict,
    top_keywords: list[dict],
    period: str,
) -> str:
    """매체별 성과 인사이트 리포트 생성."""
    kw_text = "\n".join(
        f"- {k['keyword']}: 전환 {k['conversions']}회, CPA ₩{k['cpa']:,.0f}, 클릭 {k['clicks']}회"
        for k in top_keywords[:20]
    )
    media_text = "\n".join(
        f"- {m['media']}: 전환 {m['conversions']}회, 비용 ₩{m['cost']:,.0f}, CPA ₩{m['cpa']:,.0f}"
        for m in summary.get("by_media", [])
    )

    prompt = f"""
다음 SA(검색광고) 성과 데이터를 바탕으로 마케터를 위한 인사이트 리포트를 작성하세요.

## 분석 기간
{period}

## 전체 성과 요약
- 총 비용: ₩{summary.get('total_cost', 0):,.0f}
- 총 전환: {summary.get('total_conversions', 0)}회
- 평균 CPA: ₩{summary.get('avg_cpa', 0):,.0f}
- 총 클릭: {summary.get('total_clicks', 0):,}회
- 평균 CTR: {summary.get('avg_ctr', 0)}%

## 매체별 성과
{media_text}

## 전환 상위 키워드 (견적요청 기준)
{kw_text}

## 작성 지침
1. 데이터에 근거한 사실만 서술하세요. 데이터에 없는 내용을 추측하지 마세요.
2. 매체별 주요 특징, 상위 전환 키워드 패턴, 개선 포인트를 포함하세요.
3. 마크다운 형식으로, 300-500자 이내로 간결하게 작성하세요.
"""

    client = _get_client()
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()
