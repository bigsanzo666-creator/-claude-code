#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""일반 뉴스 카드뉴스 렌더러 — HTML/CSS + Playwright 스크린샷.

`make_cards_memorial.py`의 형제 스크립트다. 구조는 같고 톤만 다르다.

  - `make_cards_memorial.py` : 부고 전용. 검정 바탕 + 명조체. 조용한 톤.
  - `make_cards_news.py`     : 이 파일. 스포츠·경제 등 일반 뉴스용.
                               표지/마무리는 짙은 남색, 본문 카드는 밝은 바탕.

⚠️ 크기는 **1080x1350 (4:5)** 로 고정한다. 바꾸지 말 것.
   인스타그램 캐러셀은 가로세로 비율 0.8~1.91만 받는다. 4:5 = 0.800 으로 하한선이고,
   `make_carousel_html.py`가 쓰던 1080x1920(9:16)은 0.5625라 **게시 자체가 거부된다.**

다음 게시물을 만들 때는 맨 아래 `SPEC`만 고쳐 쓰면 된다.

실행:
    python scripts/make_cards_news.py

필요:
    pip install playwright
    apt-get install -y fonts-noto-cjk      # 없으면 한글이 두부(□)로 나온다
"""
from __future__ import annotations

import glob
import os
import sys

W, H = 1080, 1350          # 4:5 — 고정. 위 주의사항 참고.


def chrome_path() -> str | None:
    """이 환경에 이미 깔려 있는 Chromium 실행 파일을 찾는다.

    클라우드 세션에는 `/opt/pw-browsers/chromium-<빌드번호>/` 로 크로미움이 미리 깔려
    있는데, `pip install playwright`로 받은 playwright가 더 최신이면 자기가 기대하는
    빌드번호(예: 1234)를 찾다가 실패한다. 그때 `playwright install`을 하지 말 것 —
    이미 있는 바이너리를 executable_path로 직접 넘기면 된다.

    못 찾으면 None을 반환하고, 그러면 playwright 기본 동작에 맡긴다(로컬 PC 등).
    """
    for pattern in (
        "/opt/pw-browsers/chromium-*/chrome-linux/chrome",
        "/opt/pw-browsers/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell",
    ):
        hits = sorted(glob.glob(pattern))
        if hits:
            return hits[-1]
    return None

INK = "#14161C"            # 밝은 카드의 본문 글자
PAPER = "#F5F4F1"          # 밝은 카드 바탕
DEEP = "#101623"           # 표지/마무리 바탕 (짙은 남색)
ON_DEEP = "#F7F6F3"        # 짙은 바탕 위 글자
SOFT = "#6E7076"           # 밝은 카드의 보조 글자
SOFT_ON_DEEP = "#9AA1AE"   # 짙은 바탕의 보조 글자
LINE = "#DAD8D2"
GOLD = "#FFC43C"           # 브랜드 액센트

SANS = "'Noto Sans CJK KR','Noto Sans KR','Malgun Gothic',sans-serif"

BASE_CSS = f"""
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  html, body {{ width:{W}px; height:{H}px; }}
  body {{
    font-family:{SANS}; background:{PAPER}; color:{INK};
    padding:92px 84px; display:flex; flex-direction:column;
    -webkit-font-smoothing:antialiased;
  }}
  body.deep {{ background:{DEEP}; color:{ON_DEEP}; }}

  .sp {{ flex:1; }}
  .eye {{ font-size:27px; letter-spacing:.16em; font-weight:700; color:{GOLD}; }}
  .hr {{ width:96px; height:6px; background:{GOLD}; margin:34px 0; }}

  .title {{ font-size:78px; line-height:1.26; font-weight:800; letter-spacing:-.02em; }}
  .title.sm {{ font-size:62px; }}
  .cap {{ font-size:37px; line-height:1.6; color:{SOFT}; }}
  body.deep .cap {{ color:{SOFT_ON_DEEP}; }}

  .num {{ font-size:230px; line-height:.94; font-weight:800;
          letter-spacing:-.04em; font-variant-numeric:tabular-nums; }}
  .unit {{ font-size:96px; font-weight:800; margin-left:10px; letter-spacing:-.02em; }}

  .brand {{ font-size:26px; letter-spacing:.12em; color:{SOFT}; }}
  body.deep .brand {{ color:{SOFT_ON_DEEP}; }}

  .pill {{ align-self:flex-start; background:{GOLD}; color:#151005;
           font-weight:800; font-size:28px; letter-spacing:.06em;
           padding:13px 26px; border-radius:999px; }}

  .list {{ list-style:none; margin-top:40px; }}
  .list li {{ display:flex; justify-content:space-between; align-items:baseline;
              font-size:37px; color:{SOFT};
              border-bottom:1px solid {LINE}; padding-bottom:19px; margin-bottom:19px; }}
  .list b {{ color:{INK}; font-size:52px; font-weight:800;
             font-variant-numeric:tabular-nums; letter-spacing:-.02em; }}

  .cta {{ align-self:flex-start; background:{GOLD}; color:#151005;
          font-weight:800; font-size:30px;
          padding:18px 32px; border-radius:999px; }}
"""


def _page(body: str, deep: bool = False) -> str:
    cls = " class='deep'" if deep else ""
    return (f"<!doctype html><meta charset='utf-8'>"
            f"<style>{BASE_CSS}</style><body{cls}>{body}</body>")


def cover(pill: str, title: str, caption: str, brand: str) -> str:
    """표지. 짙은 바탕 + 카테고리 알약 + 큰 제목."""
    return _page(f"""
      <div class="pill">{pill}</div>
      <div class="sp"></div>
      <p class="title">{title}</p>
      <div class="hr"></div>
      <p class="cap">{caption}</p>
      <div class="sp"></div>
      <p class="brand">{brand}</p>
    """, deep=True)


def big_number(eyebrow: str, number: str, unit: str, caption: str, brand: str) -> str:
    """숫자 한 방 카드. 밝은 바탕."""
    unit_html = f'<span class="unit">{unit}</span>' if unit else ""
    return _page(f"""
      <p class="eye">{eyebrow}</p>
      <div class="sp"></div>
      <p class="num">{number}{unit_html}</p>
      <div class="hr"></div>
      <p class="cap">{caption}</p>
      <div class="sp"></div>
      <p class="brand">{brand}</p>
    """)


def stat_list(eyebrow: str, title: str, rows: list[tuple[str, str]], brand: str) -> str:
    """항목-숫자 목록 카드. 밝은 바탕."""
    items = "".join(f"<li><span>{k}</span><b>{v}</b></li>" for k, v in rows)
    return _page(f"""
      <p class="eye">{eyebrow}</p>
      <div class="sp"></div>
      <p class="title sm">{title}</p>
      <ul class="list">{items}</ul>
      <div class="sp"></div>
      <p class="brand">{brand}</p>
    """)


def closing(eyebrow: str, title: str, source: str, cta: str) -> str:
    """마무리. 짙은 바탕 + 출처 고지(저작권상 필수) + 팔로우 유도."""
    return _page(f"""
      <p class="eye">{eyebrow}</p>
      <div class="sp"></div>
      <p class="title sm">{title}</p>
      <div class="hr"></div>
      <p class="cap">{source}</p>
      <div class="sp"></div>
      <div class="cta">{cta}</div>
    """, deep=True)


# --- 2026-08-17 빅뱅 데뷔 20주년 컴백 -----------------------------------
# 수치는 6개 이상 매체에서 동일하게 확인된 것만 썼다.
#   신곡 'BiiiG' 8/19 공개 / 월드투어 'BIGBANG 2026-2027 WORLD TOUR <XX : COSMOS>'
#   8/21~23 고양종합운동장 주경기장 시작 / 전 세계 19개 도시 / 총 33회
#   현재 멤버 3명 (지드래곤·태양·대성)
# '우주항공청 홍보대사'는 한 매체에서만 봐서 넣지 않았다.
# 멤버 변동은 사실만 담담하게 적고, 탈퇴 사유나 논란은 언급하지 않는다.
BRAND = "늘봄이야기"

CARDS = [
    ("01_cover", cover(
        "연예",
        "빅뱅 20주년<br>19개 도시 33회",
        "8월 19일 신곡 공개<br>21일 고양에서 월드투어 시작",
        BRAND)),
    ("02_years", big_number(
        "데뷔부터 지금까지",
        "20", "주년",
        "2006년 데뷔한 빅뱅이<br>20주년 컴백에 나섭니다.",
        BRAND)),
    ("03_cities", big_number(
        "월드투어 규모",
        "19", "개 도시",
        "북미, 유럽, 오세아니아, 아시아<br>주요 도시를 돕니다.",
        BRAND)),
    ("04_shows", big_number(
        "총 공연 횟수",
        "33", "회",
        "19개 도시에서<br>모두 33번 무대에 오릅니다.",
        BRAND)),
    ("05_tour", stat_list(
        "투어 개요",
        "XX : COSMOS",
        [("시작", "8월 21일"), ("여는 도시", "고양"), ("도시", "19개"), ("공연", "33회")],
        f"{BRAND} · BIGBANG 2026-2027 WORLD TOUR")),
    ("06_single", stat_list(
        "신곡",
        "BiiiG",
        [("공개일", "8월 19일"), ("소속사", "YG엔터테인먼트")],
        BRAND)),
    ("07_members", big_number(
        "현재 멤버",
        "3", "명",
        "지드래곤, 태양, 대성<br>세 사람이 20주년을 맞습니다.",
        BRAND)),
    ("08_start", cover(
        "시작은 한국",
        "첫 무대는<br>고양입니다",
        "8월 21일부터 23일까지<br>고양종합운동장 주경기장에서<br>투어의 막을 엽니다.",
        BRAND)),
    ("09_regions", big_number(
        "투어가 도는 대륙",
        "4", "개 대륙",
        "아시아, 북미, 유럽, 오세아니아<br>네 개 대륙을 모두 돕니다.",
        BRAND)),
    ("10_closing", closing(
        "2026-2027",
        "20년 만의<br>가장 큰 무대",
        "출처: 네이버뉴스 (스포츠조선, 마이데일리 등)",
        "매일 뉴스 요약 · @neulbomlife")),
]

OUT_DIR = os.path.join("state", "media", "bigbang_20th_20260817")


def render_all(cards=CARDS, out_dir: str = OUT_DIR) -> list[str]:
    from playwright.sync_api import sync_playwright

    os.makedirs(out_dir, exist_ok=True)
    paths = []
    launch_kwargs = {}
    exe = chrome_path()
    if exe:
        launch_kwargs["executable_path"] = exe
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kwargs)
        page = browser.new_page(viewport={"width": W, "height": H},
                                device_scale_factor=1)
        for name, html in cards:
            page.set_content(html)
            page.wait_for_timeout(150)      # 폰트 적용 대기
            out = os.path.join(out_dir, f"{name}.png")
            page.screenshot(path=out)
            paths.append(out)
            print(f"  {out}")
        browser.close()
    return paths


if __name__ == "__main__":
    print(f"카드 {len(CARDS)}장 렌더링 ({W}x{H})")
    made = render_all()
    print(f"완료: {len(made)}장")
    sys.exit(0)
