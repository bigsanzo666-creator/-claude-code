#!/usr/bin/env python3
"""
네이버 공식 API만 사용해서 카테고리별 뉴스 헤드라인 후보를 모으고,
실시간 인기 검색어(데이터랩)와 겹치는 정도로 "터질 만한" 정도를 점수화한다.

주의: 본문 전문을 가져오지 않는다 (검색 API는 제목+요약만 제공).
      실제 카드뉴스/릴스 문구는 이 결과를 참고해서 별도로 새로 작성해야 한다
      (원문 문장을 그대로 복사하지 말 것 - 저작권).

필요 환경변수:
  NAVER_CLIENT_ID, NAVER_CLIENT_SECRET

주의(2026-08 기준): 검색/데이터랩(검색어트렌드) API는 기존 개발자센터에서
NAVER API HUB(네이버클라우드플랫폼, NCP)로 이관되었다. 이 스크립트의 인증 방식
(X-Naver-Client-Id / X-Naver-Client-Secret 헤더)은 기존 개발자센터 방식이다.
NAVER API HUB가 동일한 방식을 유지하는지, 아니면 NCP식 액세스키/시크릿키
서명(HMAC) 방식을 요구하는지 실제 발급받은 문서를 보고 확인 후 필요하면
_headers()/엔드포인트를 수정해야 한다.
"""
from __future__ import annotations

import html
import json
import os
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass

NAVER_SEARCH_URL = "https://openapi.naver.com/v1/search/news.json"
NAVER_DATALAB_URL = "https://openapi.naver.com/v1/datalab/search"

# 카테고리 -> 검색 쿼리(들). 네이버 뉴스 검색 API는 카테고리 필터가 없어서
# 대표 키워드로 검색해 근사한다.
CATEGORY_QUERIES = {
    "정치": ["정치 국회", "대통령실", "정당"],
    "사회": ["사회 사건사고", "사회 이슈"],
    "경제": ["경제 증시", "부동산", "금리"],
    "연예": ["연예 이슈", "아이돌 컴백"],
    "스포츠": ["프로야구", "축구 국가대표", "스포츠 이슈"],
}


@dataclass
class Article:
    category: str
    title: str
    summary: str
    link: str
    source_hint: str
    pub_date: str
    score: float = 0.0


def _strip_tags(s: str) -> str:
    return html.unescape(re.sub(r"</?b>", "", s)).strip()


def _headers() -> dict:
    cid = os.environ["NAVER_CLIENT_ID"]
    csec = os.environ["NAVER_CLIENT_SECRET"]
    return {"X-Naver-Client-Id": cid, "X-Naver-Client-Secret": csec}


def search_news(query: str, display: int = 10, sort: str = "sim") -> list[dict]:
    params = urllib.parse.urlencode({"query": query, "display": display, "sort": sort})
    req = urllib.request.Request(f"{NAVER_SEARCH_URL}?{params}", headers=_headers())
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("items", [])


def fetch_category_candidates(category: str) -> list[Article]:
    queries = CATEGORY_QUERIES[category]
    seen_links = set()
    out: list[Article] = []
    for q in queries:
        for item in search_news(q, display=10, sort="date"):
            link = item["link"]
            if link in seen_links:
                continue
            seen_links.add(link)
            out.append(
                Article(
                    category=category,
                    title=_strip_tags(item["title"]),
                    summary=_strip_tags(item["description"]),
                    link=link,
                    source_hint=urllib.parse.urlparse(item.get("originallink") or link).netloc,
                    pub_date=item.get("pubDate", ""),
                )
            )
    return out


def trending_keywords(keyword_groups: list[dict], start: str, end: str) -> dict:
    """네이버 데이터랩 검색어트렌드 API. keyword_groups 예:
    [{"groupName": "정치", "keywords": ["대통령", "국회"]}, ...]
    반환: {groupName: 최신 상대지수(float)}
    POST 요청이라 client id/secret을 헤더로 사용 (검색 API와 동일 앱 사용 가능).
    """
    body = json.dumps(
        {
            "startDate": start,
            "endDate": end,
            "timeUnit": "date",
            "keywordGroups": keyword_groups,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        NAVER_DATALAB_URL,
        data=body,
        headers={**_headers(), "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    out = {}
    for result in data.get("results", []):
        series = result.get("data", [])
        out[result["title"]] = series[-1]["ratio"] if series else 0.0
    return out


def score_articles(articles: list[Article], trend_scores: dict[str, float]) -> list[Article]:
    """카테고리 트렌드 지수 + 제목 길이/키워드 자극도 같은 단순 휴리스틱으로 점수화.
    실제 조회수를 알 방법은 없으므로 '참고용 우선순위'로만 사용한다.
    """
    punchy_markers = ["단독", "속보", "긴급", "충격", "논란", "결국", "파장"]
    for a in articles:
        score = trend_scores.get(a.category, 0.0)
        score += sum(3.0 for m in punchy_markers if m in a.title)
        a.score = score
    return sorted(articles, key=lambda a: a.score, reverse=True)


def pick_top_per_category(max_per_category: int = 2) -> dict[str, list[Article]]:
    from datetime import date, timedelta as _td

    end = date.today()
    start = end - _td(days=7)
    groups = [{"groupName": cat, "keywords": qs} for cat, qs in CATEGORY_QUERIES.items()]
    try:
        trend = trending_keywords(groups, start.isoformat(), end.isoformat())
    except Exception:
        trend = {}

    result = {}
    for category in CATEGORY_QUERIES:
        candidates = fetch_category_candidates(category)
        ranked = score_articles(candidates, trend)
        result[category] = ranked[:max_per_category]
    return result


if __name__ == "__main__":
    picks = pick_top_per_category()
    for cat, arts in picks.items():
        print(f"## {cat}")
        for a in arts:
            print(f"  [{a.score:.1f}] {a.title}  ({a.source_hint})")
