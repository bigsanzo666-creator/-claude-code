#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""국내 관심사 필터링(domestic_affinity) 검증.

네트워크도 시크릿도 필요 없다. 필터 규칙을 손볼 때마다 이걸 먼저 돌려볼 것:

    python scripts/test_domestic_filter.py
"""
from __future__ import annotations

import os
import sys

# 이 스크립트를 어디서 실행하든 naver_news를 임포트할 수 있게 한다
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# naver_news는 임포트 시점에 키를 읽지 않지만, 혹시 몰라 더미를 넣어둔다
os.environ.setdefault("NAVER_CLIENT_ID", "dummy")
os.environ.setdefault("NAVER_CLIENT_SECRET", "dummy")

from naver_news import category_relevance, domestic_affinity  # noqa: E402

# (제목, 요약, 해외전용으로 걸러져야 하는가)
CASES = [
    # --- 걸러내야 하는 것: 국내 인물/팀이 전혀 없는 해외 기사 ---
    ("우에다 아야세, 페예노르트 거액 제안에도 침묵 깬 이유는?",
     "일본 축구대표팀 간판 스트라이커 우에다 아야세를 향해 페예노르트가 영입을 검토 중이다.",
     True),
    ("맨유, 리버풀에 3-0 완승",
     "프리미어리그 경기에서 맨유가 리버풀을 상대로 완승을 거뒀다.",
     True),
    ("중국 국가대표, 감독 경질",
     "중국 대표팀이 성적 부진으로 감독을 경질했다.",
     True),
    # substring 오탐 방지: '정부'가 "일본 정부"에 걸리면 안 된다
    ("일본 정부, 수출 규제 추가 검토",
     "일본 정부가 추가 규제 방안을 검토하고 있다고 현지 언론이 보도했다.",
     True),
    # substring 오탐 방지: '대전'이 경기를 뜻하는 경우 지역명으로 오인하면 안 된다
    ("맨유-리버풀 대전, 3-0으로 종료",
     "프리미어리그 라이벌 대전에서 맨유가 리버풀을 꺾었다.",
     True),

    # --- 살려야 하는 것: 국내 팀/인물 ---
    ("구자욱, 5안타 2홈런 폭발",
     "삼성 라이온즈 구자욱이 KBO 리그 경기에서 5안타 2홈런을 기록했다.",
     False),

    # --- 살려야 하는 것: 해외 리그지만 한국 선수가 주인공 ---
    ("이정후, MLB 데뷔 첫 홈런",
     "샌프란시스코 이정후가 메이저리그에서 첫 홈런을 터뜨렸다.",
     False),
    ("김민재, 바이에른 잔류 확정",
     "분데스리가 바이에른 뮌헨이 김민재의 잔류를 결정했다.",
     False),

    # --- 살려야 하는 것: 국내에서도 화제인 해외 스타 (GLOBAL_STARS) ---
    ("오타니는 돈값 제대로 했는데…7300억 게레로 홈런 6개, 토론토 '최악의 계약' 공포",
     "토론토 블루제이스가 14년 5억 달러를 안긴 게레로 주니어가 홈런 가뭄에 빠졌다.",
     False),
    ("메시, 은퇴 시점 직접 언급",
     "인터 마이애미의 메시가 은퇴 계획을 밝혔다.",
     False),

    # --- 여전히 걸러야 하는 것: 화제성 없는 해외 선수 단독 ---
    ("게레로 주니어, 타격 부진 지속",
     "토론토 블루제이스의 게레로 주니어가 시즌 내내 부진을 겪고 있다.",
     True),

    # --- 살려야 하는 것: 해외 국가가 나오지만 국내 사안 ---
    ("한미 정상회담 내달 개최",
     "대통령실은 미국과의 정상회담 일정을 조율 중이라고 밝혔다.",
     False),
    ("축구대표팀, 브라질과 평가전 확정",
     "대표팀이 다음 달 브라질을 상대로 평가전을 치른다.",
     False),
]

# --- 카테고리 적합성 (제목 기준) 케이스 --------------------------------
# 2026-08-17에 실제 네이버 응답에서 나온 오탐/누락을 그대로 넣었다.
# (카테고리, 제목, 이 카테고리 기사가 맞는가)
TOPIC_CASES = [
    # 오탐: 검색어에는 걸렸지만 다른 분야 기사
    ("스포츠", "차별화 상품 앞세운 편의점…역성장 끊고 성장 궤도 [똑똑! 스마슈머]", False),
    ("스포츠", "삼성전자, 3분기 영업이익 발표", False),
    ("정치", "편의점 매출 반등", False),

    # 누락 방지: 팀 이름만 나열된 순위 기사도 스포츠다
    ("스포츠", "kt·삼성 2강에 LG·KIA·두산 3중…한화는 6위마저 위태롭다", True),
    ("스포츠", "두산 제친 KIA, 나흘 만에 4위 탈환…올러, 시즌 11승 다승 선두", True),
    ("스포츠", "[단독]포옛, 임시 감독 탈락! 서류 전형서 고배...KFA, 이메일로 통보", True),

    # 누락 방지: 당내 징계·지방의원 기사도 정치다
    ("정치", "[단독] 5·18 논란 이진숙, 당 윤리위 제소됐다", True),
    ("정치", "유호준 경기도의원, 홈플러스 정상화 촉구", True),

    ("연예", "BTS 지민, 美 한복판서 태극기 무대의상", True),
    ("연예", "무지·무식·교만 현직 변호사가 본 하영 논란", True),
]


def main() -> int:
    fails = 0
    print("[1] 국내/해외 판정")
    for title, summary, expect_foreign in CASES:
        delta, foreign, matched = domestic_affinity(title, summary)
        ok = foreign == expect_foreign
        if not ok:
            fails += 1
        verdict = "제외(해외전용)" if foreign else "채택"
        mark = "OK  " if ok else "FAIL"
        hit = ",".join(matched[:3]) or "-"
        print(f"{mark} | {verdict:12} {delta:+6.1f} | {title[:30]:32} <- {hit}")

    print()
    print("[2] 카테고리 적합성 (제목만 본다)")
    for category, title, expect_on_topic in TOPIC_CASES:
        on_topic, hits = category_relevance(category, title)
        ok = on_topic == expect_on_topic
        if not ok:
            fails += 1
        verdict = "채택" if on_topic else "제외(주제불일치)"
        mark = "OK  " if ok else "FAIL"
        hit = ",".join(hits[:3]) or "-"
        print(f"{mark} | [{category}] {verdict:14} | {title[:30]:32} <- {hit}")

    print()
    print("모든 케이스 통과" if fails == 0 else f"{fails}건 실패")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
