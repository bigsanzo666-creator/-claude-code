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


# --- 2026-08-17 KBO 선두 경쟁 ----------------------------------------
# 수치는 2026-08-16 경기 종료 기준이며, 복수 매체에서 교차 확인된 것만 썼다.
#   - KT 62승 2무 39패 / 승률 .614 / 103경기
#   - 삼성 62승 2무 41패 / 승률 .602 / 105경기 → 1경기차
# 3~5위(LG·KIA·두산)의 정확한 승패는 매체마다 기준일이 달라 숫자를 쓰지 않고
# "3파전"이라는 서술만 남겼다. 확인 안 된 숫자는 카드에 넣지 않는다.
BRAND = "늘봄이야기"

CARDS = [
    ("1_cover", cover(
        "스포츠",
        "KBO 선두 경쟁<br>단 1경기 차",
        "정규시즌 70% 지점<br>KT와 삼성이 붙어 있습니다",
        BRAND)),
    ("2_gap", big_number(
        "1위와 2위의 격차",
        "1", "경기",
        "8월 16일 경기 종료 기준<br>승수는 62승으로 똑같습니다.",
        BRAND)),
    ("3_standings", stat_list(
        "선두 KT 위즈",
        "62승 2무 39패",
        [("승률", ".614"), ("치른 경기", "103"), ("순위", "1위")],
        f"{BRAND} · 2026 신한 SOL 뱅크 KBO리그")),
    ("4_samsung", stat_list(
        "2위 삼성 라이온즈",
        "62승 2무 41패",
        [("승률", ".602"), ("치른 경기", "105"), ("순위", "2위")],
        f"{BRAND} · 2026 신한 SOL 뱅크 KBO리그")),
    ("5_closing", closing(
        "남은 30~40경기",
        "3위 싸움도<br>안 끝났습니다",
        "LG · KIA · 두산이 3~5위를 놓고 경쟁 중입니다.<br><br>"
        "출처: 네이버뉴스 (스포츠조선, 연합뉴스 등)",
        "매일 뉴스 요약 · @neulbomlife")),
]

OUT_DIR = os.path.join("state", "media", "kbo_race_20260817")


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
