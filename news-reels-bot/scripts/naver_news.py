#!/usr/bin/env python3
"""
네이버 공식 API만 사용해서 카테고리별 뉴스 헤드라인 후보를 모으고,
실시간 인기 검색어(데이터랩)와 겹치는 정도로 "터질 만한" 정도를 점수화한다.

주의: 본문 전문을 가져오지 않는다 (검색 API는 제목+요약만 제공).
      실제 카드뉴스/릴스 문구는 이 결과를 참고해서 별도로 새로 작성해야 한다
      (원문 문장을 그대로 복사하지 말 것 - 저작권).

필요 환경변수:
  NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
  (NAVER API HUB - https://naverapihub.apigw.ntruss.com 에서 발급받은 Client ID/Secret.
   2026-07-31부로 기존 개발자센터에서는 신규 발급이 막혔고, NCP 콘솔의
   NAVER API HUB를 통해서만 발급 가능하다.)

인증 방식: NAVER API HUB는 요청 헤더에 X-NCP-APIGW-API-KEY-ID(Client ID),
X-NCP-APIGW-API-KEY(Client Secret)를 그대로 실어 보내는 방식이다 (HMAC 서명 불필요).
"""
from __future__ import annotations

import html
import json
import os
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Optional

NAVER_API_HUB_BASE = "https://naverapihub.apigw.ntruss.com"
NAVER_SEARCH_URL = f"{NAVER_API_HUB_BASE}/search/v1/news"
NAVER_DATALAB_URL = f"{NAVER_API_HUB_BASE}/search-trend/v1/search"

# 카테고리 -> 검색 쿼리(들). 네이버 뉴스 검색 API는 카테고리 필터가 없어서
# 대표 키워드로 검색해 근사한다.
CATEGORY_QUERIES = {
    "정치": ["정치 국회", "대통령실", "정당"],
    "사회": ["사회 사건사고", "사회 이슈"],
    "경제": ["경제 증시", "부동산", "금리"],
    "연예": ["연예 이슈", "아이돌 컴백"],
    "스포츠": ["KBO 프로야구", "K리그", "축구 국가대표"],
}

# --- 국내 관심사 필터링 -------------------------------------------------
# 한국 독자 대상 계정이라, 국내 인물/팀이 얽히지 않은 순수 해외 기사는
# 관심도가 떨어진다. 아래 두 목록으로 "국내 연관성"을 근사한다.
#
# 판정 규칙:
#   - 국내 신호가 하나라도 있으면 가점 (해외 신호가 같이 있어도 상관없음.
#     예: "이정후, MLB 데뷔전" 은 MLB가 있어도 국내 관심사다)
#   - 국내 신호가 전혀 없고 해외 신호만 있으면 감점 + '해외 전용'으로 표시
#     (예: "우에다 아야세, 페예노르트 이적설")

DOMESTIC_MARKERS = (
    # 국가/지역
    "한국", "대한민국", "국내", "우리나라", "서울", "부산", "대구", "인천",
    # '대전'은 "맨유-리버풀 대전"처럼 경기를 뜻하는 말로도 쓰여서 '대전시'로 좁힘
    "광주", "대전시", "울산", "세종", "경기도", "강원", "충청", "전라", "경상", "제주",
    # 정치/기관 ('정부'는 "일본 정부"에도 걸려서 뺐다)
    "대통령실", "국회", "여의도", "청와대", "기획재정부", "한국은행",
    "검찰", "경찰청", "헌법재판소", "더불어민주당", "국민의힘",
    # 프로야구(KBO) 10구단
    "KBO", "프로야구", "삼성 라이온즈", "LG 트윈스", "두산 베어스", "KIA 타이거즈",
    "기아 타이거즈", "롯데 자이언츠", "SSG 랜더스", "NC 다이노스", "키움 히어로즈",
    "한화 이글스", "KT 위즈",
    # 축구 (아래 AMBIGUOUS_DOMESTIC 참고 - '대표팀' 류는 여기 넣지 말 것)
    "K리그", "대한축구협회", "태극전사",
    # 해외에서 뛰는 한국 선수 (해외 리그 기사라도 국내 관심사)
    "손흥민", "이강인", "김민재", "황희찬", "이재성",
    "이정후", "김하성", "류현진", "김혜성", "고우석", "배지환",
    # 연예/문화
    "K팝", "케이팝", "한류", "가요", "방송인", "국내 가수",
)

# 국내 선수가 얽히지 않아도 한국에서 검색량이 큰 해외 스타.
# "우에다 아야세 이적설"(관심 낮음)과 "오타니 계약"(관심 높음)을 똑같이 걸러내던
# 문제 때문에 추가했다. 국내 신호와 동등하게 취급한다.
# 주의: 여기에 이름을 많이 넣을수록 필터가 무의미해진다. 정말 화제인 인물만 넣을 것.
GLOBAL_STARS = (
    # 야구
    "오타니", "쇼헤이",
    # 축구
    "메시", "호날두", "음바페", "홀란드", "레반도프스키",
    # 농구·기타
    "르브론", "커리", "조코비치",
)

FOREIGN_TEAMS_LEAGUES = (
    # 해외 리그/대회
    "프리미어리그", "EPL", "라리가", "분데스리가", "세리에", "리그앙",
    "에레디비시", "챔피언스리그", "유로파리그", "MLB", "메이저리그",
    "NBA", "NFL", "NHL", "J리그", "NPB", "일본프로야구", "슈퍼리그",
    # 해외 구단
    "맨체스터", "맨유", "리버풀", "첼시", "아스널", "토트넘", "뉴캐슬",
    "레알 마드리드", "바르셀로나", "아틀레티코", "바이에른", "도르트문트",
    "유벤투스", "AC밀란", "인터밀란", "나폴리", "파리 생제르맹", "PSG",
    "페예노르트", "아약스", "PSV", "셀틱",
    "웨스트햄", "에버턴", "브라이턴", "울버햄튼", "아스톤 빌라",
    "라이프치히", "레버쿠젠", "AS로마", "라치오", "세비야", "포르투", "벤피카",
    # MLB — 한국 스포츠 기사에 자주 나오는 구단
    "다저스", "양키스", "레드삭스", "샌디에이고", "샌프란시스코", "애틀랜타",
    "토론토", "블루제이스", "컵스", "메츠", "필라델피아", "휴스턴", "시애틀",
    "볼티모어", "애리조나", "밀워키", "클리블랜드", "미네소타", "탬파베이",
    "콜로라도", "마이애미", "피츠버그", "세인트루이스", "캔자스시티", "디트로이트",
    "에인절스", "텍사스 레인저스", "신시내티", "워싱턴 내셔널스",
    # NPB
    "요미우리", "한신 타이거스", "소프트뱅크",
)
# ※ 이 목록은 완전할 수 없다. "토론토 블루제이스"가 빠져 있어서 해외 기사가
#    그대로 통과한 적이 있다. 실제 API 응답을 돌려보다 빠진 팀이 보이면 추가할 것.

FOREIGN_NATIONS = (
    "일본", "중국", "미국", "영국", "프랑스", "독일", "스페인", "이탈리아",
    "네덜란드", "포르투갈", "브라질", "아르헨티나", "러시아", "대만", "베트남",
    "호주", "멕시코", "사우디", "카타르",
)

# 국가명도 해외 신호에 포함시킨다. 단 이건 국내 신호가 하나도 없을 때만
# 감점 근거가 된다 ("한미 정상회담"은 미국이 나와도 대통령실이 같이 잡히므로 국내 기사)
FOREIGN_MARKERS = FOREIGN_TEAMS_LEAGUES + FOREIGN_NATIONS

# '국가대표', '축구대표팀'은 그 자체로는 국적을 알 수 없는 일반 명사다.
# 실제로 "일본 축구대표팀 우에다 아야세" 기사가 국내 기사로 잘못 분류된 적이 있어서,
# 앞에 해외 국가명이 붙은 경우(아래 정규식)에는 국내 신호로 치지 않는다.
AMBIGUOUS_DOMESTIC = ("국가대표", "축구대표팀", "야구대표팀", "대표팀")

_FOREIGN_TEAM_RE = re.compile(
    r"(?:{})\s*(?:축구|야구|배구|농구)?\s*(?:국가)?대표팀?".format("|".join(FOREIGN_NATIONS))
)

DOMESTIC_BONUS = 12.0
FOREIGN_PENALTY = 15.0
# 제목이 그 카테고리 주제와 맞을 때 주는 가점 (category_relevance 참고)
TOPIC_BONUS = 8.0


@dataclass
class Article:
    category: str
    title: str
    summary: str
    link: str
    source_hint: str
    pub_date: str
    score: float = 0.0
    # 국내 신호 없이 해외 신호만 잡힌 기사 (한국 독자 관심도가 낮다고 본 것)
    foreign_only: bool = False
    matched_markers: tuple[str, ...] = ()
    # 검색어에는 걸렸지만 제목을 보면 그 카테고리 기사가 아닌 것
    # (예: "편의점 매출" 기사가 본문에 KBO 카드 얘기가 있어서 스포츠로 잡힘)
    off_topic: bool = False


def _strip_tags(s: str) -> str:
    return html.unescape(re.sub(r"</?b>", "", s)).strip()


def _headers() -> dict:
    cid = os.environ["NAVER_CLIENT_ID"]
    csec = os.environ["NAVER_CLIENT_SECRET"]
    return {"X-NCP-APIGW-API-KEY-ID": cid, "X-NCP-APIGW-API-KEY": csec}


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


def _matches(text: str, markers: tuple[str, ...]) -> list[str]:
    return [m for m in markers if m in text]


def domestic_affinity(title: str, summary: str) -> tuple[float, bool, tuple[str, ...]]:
    """제목+요약에서 국내 연관성을 판정한다.

    반환: (점수 가감치, 해외 전용 여부, 매칭된 키워드들)

    국내 신호가 하나라도 있으면 해외 신호가 같이 있어도 가점만 준다.
    ("김민재, 바이에른 잔류" 는 바이에른이 있어도 국내 관심사)
    """
    text = f"{title} {summary}"
    # 국내 신호 + 국내에서도 화제인 해외 스타를 동등하게 본다
    domestic = _matches(text, DOMESTIC_MARKERS) + _matches(text, GLOBAL_STARS)
    # 확실한 국내 신호가 없을 때만 '대표팀' 같은 모호한 표현을 본다.
    # 단 "일본 축구대표팀"처럼 해외 국가가 수식하고 있으면 그것도 국내 신호가 아니다.
    if not domestic and not _FOREIGN_TEAM_RE.search(text):
        domestic = _matches(text, AMBIGUOUS_DOMESTIC)
    foreign = _matches(text, FOREIGN_MARKERS)

    if domestic:
        return DOMESTIC_BONUS, False, tuple(domestic)
    if foreign:
        return -FOREIGN_PENALTY, True, tuple(foreign)
    return 0.0, False, ()


# --- 카테고리 적합성 (제목 기준) ---------------------------------------
# 2026-08-17에 발견한 오탐 때문에 넣었다.
#   "차별화 상품 앞세운 편의점…역성장 끊고 성장 궤도"  → 스포츠 2위로 올라옴
#   본문에 "2026 KBO 오피셜 컬렉션 카드 380만 개 판매" 라는 문장이 있어서
#   'KBO','프로야구' 마커에 걸렸다. 편의점 매출 기사인데 스포츠 기사로 분류된 것이다.
#
# 원인은 국내 필터가 제목+요약을 **통째로** 보는 데 있다. 요약(본문 일부)에 단어가
# 스쳐 지나가기만 해도 걸린다. 그래서 "이 기사가 정말 그 카테고리 기사인가"는
# **제목만** 보고 따로 판정한다. 제목은 기사의 주제를 압축한 것이라 훨씬 정확하다.
CATEGORY_CORE_TERMS = {
    "정치": (
        "정치", "국회", "대통령", "여당", "야당", "국민의힘", "더불어민주당", "민주당",
        "조국혁신당", "개혁신당", "정의당", "무소속",
        "의원", "장관", "총리", "청문회", "개헌", "총선", "대선", "공천", "당대표",
        "원내대표", "국정감사", "탄핵", "특검", "내각", "대통령실", "청와대",
        # 당내 갈등·징계 기사가 통째로 빠지던 문제 때문에 추가 (2026-08-17)
        "윤리위", "제명", "징계", "최고위", "비대위", "경선", "당권", "제소",
        "정부", "여야", "법안", "표결", "본회의", "상임위", "외교", "안보", "국방",
    ),
    "사회": (
        "경찰", "검찰", "법원", "재판", "구속", "기소", "선고", "사고", "화재", "참사",
        "사망", "부상", "실종", "폭행", "성범죄", "학교", "교육", "노조", "파업", "집회",
        "판결", "수사", "고발", "피해자", "유족", "산불", "지진", "태풍", "폭우",
    ),
    "경제": (
        "경제", "증시", "코스피", "코스닥", "주가", "환율", "금리", "물가", "부동산",
        "아파트", "분양", "집값", "전세", "수출", "무역", "반도체", "실적", "영업이익",
        "매출", "투자", "펀드", "채권", "은행", "대출", "세금", "예산", "기업", "인수",
    ),
    "연예": (
        "가수", "배우", "아이돌", "그룹", "컴백", "신곡", "앨범", "데뷔", "드라마", "영화",
        "예능", "방송", "출연", "결혼", "열애", "이혼", "소속사", "콘서트", "팬미팅",
        "무대", "차트", "빌보드", "시청률", "개봉", "캐스팅", "논란", "해명",
    ),
    "스포츠": (
        "야구", "축구", "농구", "배구", "골프", "KBO", "K리그", "프로야구", "프로축구",
        "국가대표", "감독", "선수", "리그", "구단", "이적", "우승", "승리", "패배",
        "홈런", "타율", "타자", "투수", "선발", "골키퍼", "득점", "경기", "시즌",
        "포스트시즌", "올림픽", "월드컵", "MVP", "은퇴", "부상",
    ),
}


# 순위 기사는 팀 이름만 나열하고 '야구/축구' 같은 단어가 아예 없는 경우가 많다.
#   "kt·삼성 2강에 LG·KIA·두산 3중…한화는 6위마저 위태롭다"  ← 핵심어가 하나도 없다
# 그런데 팀 약칭(삼성, LG, KIA, 롯데…)은 기업명이기도 해서 하나만으로는 못 믿는다.
# 그래서 **팀 이름이 2개 이상** 나오면 스포츠 기사로 본다. 기업 기사가 팀 약칭을
# 두 개 이상 제목에 담는 경우는 드물다.
SPORTS_TEAMS = (
    # KBO
    "kt", "KT", "삼성", "LG", "KIA", "두산", "한화", "SSG", "NC", "롯데", "키움",
    "위즈", "라이온즈", "트윈스", "타이거즈", "베어스", "이글스", "랜더스",
    "다이노스", "자이언츠", "히어로즈",
    # K리그
    "울산", "전북", "포항", "서울", "수원", "인천", "대구", "광주", "강원", "제주",
    "현대", "스틸러스", "하이파이브",
)
MIN_TEAM_HITS = 2


def category_relevance(category: str, title: str) -> tuple[bool, tuple[str, ...]]:
    """제목만 보고 이 기사가 해당 카테고리 기사인지 판정한다.

    반환: (적합한가, 제목에서 걸린 핵심어들)

    카테고리에 핵심어 목록이 없으면(새 카테고리 등) 무조건 통과시킨다 —
    목록을 안 만들었다는 이유로 기사를 다 버리는 건 더 나쁘다.

    ⚠️ 키워드 방식이라 완벽하지 않다. 새 오탐/누락을 발견하면
    `test_domestic_filter.py`에 케이스를 추가하고 목록을 손볼 것.
    """
    terms = CATEGORY_CORE_TERMS.get(category)
    if not terms:
        return True, ()
    hits = tuple(t for t in terms if t in title)
    if hits:
        return True, hits
    if category == "스포츠":
        teams = tuple(t for t in SPORTS_TEAMS if t in title)
        # 같은 팀의 약칭과 별칭이 함께 잡히는 경우가 있어 중복은 하나로 센다
        if len(set(teams)) >= MIN_TEAM_HITS:
            return True, teams
    return False, ()


def score_articles(articles: list[Article], trend_scores: dict[str, float]) -> list[Article]:
    """카테고리 트렌드 지수 + 제목 길이/키워드 자극도 같은 단순 휴리스틱으로 점수화.
    실제 조회수를 알 방법은 없으므로 '참고용 우선순위'로만 사용한다.

    여기에 더해 '국내 관심사인가'를 가장 크게 반영한다 — 한국 독자 대상 계정이라
    국내 인물/팀이 얽히지 않은 해외 기사는 반응이 나오지 않기 때문.
    """
    punchy_markers = ["단독", "속보", "긴급", "충격", "논란", "결국", "파장"]
    for a in articles:
        score = trend_scores.get(a.category, 0.0)
        score += sum(3.0 for m in punchy_markers if m in a.title)

        delta, foreign_only, matched = domestic_affinity(a.title, a.summary)
        score += delta
        a.foreign_only = foreign_only
        a.matched_markers = matched

        on_topic, topic_hits = category_relevance(a.category, a.title)
        a.off_topic = not on_topic
        if on_topic:
            score += TOPIC_BONUS
            a.matched_markers = matched + topic_hits

        a.score = score
    return sorted(articles, key=lambda a: a.score, reverse=True)


def pick_top_per_category(
    max_per_category: int = 2,
    exclude_foreign_only: bool = True,
    exclude_off_topic: bool = True,
    categories: Optional[list[str]] = None,
) -> dict[str, list[Article]]:
    """카테고리별 상위 기사를 고른다.

    exclude_foreign_only=True(기본)면 국내 신호가 전혀 없는 해외 기사는 아예 후보에서
    뺀다. 그날 해당 카테고리에 국내 기사가 없으면 그 카테고리는 빈 리스트가 될 수
    있는데, 이건 의도된 동작이다 — 반응 안 나올 걸 알면서 올리느니 그날은 건너뛴다.

    exclude_off_topic=True(기본)면 제목이 그 카테고리 주제와 안 맞는 기사를 뺀다.
    검색어에는 걸렸지만 실제로는 다른 분야 기사인 경우를 막는다 (category_relevance 참고).

    categories 를 주면 그 카테고리만 수집한다. 예: ["연예", "스포츠", "정치"]
    """
    from datetime import date, timedelta as _td

    wanted = categories or list(CATEGORY_QUERIES)
    unknown = [c for c in wanted if c not in CATEGORY_QUERIES]
    if unknown:
        raise ValueError(f"모르는 카테고리: {unknown} (가능: {list(CATEGORY_QUERIES)})")

    end = date.today()
    start = end - _td(days=7)
    groups = [{"groupName": cat, "keywords": CATEGORY_QUERIES[cat]} for cat in wanted]
    try:
        trend = trending_keywords(groups, start.isoformat(), end.isoformat())
    except Exception:
        trend = {}

    result = {}
    for category in wanted:
        candidates = fetch_category_candidates(category)
        ranked = score_articles(candidates, trend)
        if exclude_foreign_only:
            ranked = [a for a in ranked if not a.foreign_only]
        if exclude_off_topic:
            ranked = [a for a in ranked if not a.off_topic]
        result[category] = ranked[:max_per_category]
    return result


# 실제로 올리는 카테고리. 2026-08-17에 사용자가 이 셋으로 정했다.
# 나머지(사회·경제)는 CATEGORY_QUERIES에 남겨두되 기본 수집에서는 뺀다.
# 운영 카테고리 5개. 카테고리마다 1~2건씩 골라 하루 5~10개 게시물을 만든다.
ACTIVE_CATEGORIES = ["정치", "사회", "경제", "연예", "스포츠"]


if __name__ == "__main__":
    import sys

    # 인자로 카테고리를 주면 그것만 본다. 없으면 ACTIVE_CATEGORIES.
    #   python scripts/naver_news.py            → 연예·스포츠·정치
    #   python scripts/naver_news.py 경제 사회   → 지정한 것만
    #   python scripts/naver_news.py all        → 전체
    args = sys.argv[1:]
    if not args:
        wanted = ACTIVE_CATEGORIES
    elif args == ["all"]:
        wanted = list(CATEGORY_QUERIES)
    else:
        wanted = args

    picks = pick_top_per_category(max_per_category=5, categories=wanted)
    for cat, arts in picks.items():
        print(f"## {cat}")
        if not arts:
            print("  (국내 관심사로 볼 만한 기사 없음 - 오늘은 건너뜀)")
            continue
        for a in arts:
            hit = ",".join(a.matched_markers[:3]) or "-"
            print(f"  [{a.score:.1f}] {a.title}  ({a.source_hint})  <{hit}>")
