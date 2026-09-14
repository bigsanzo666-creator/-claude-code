#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""추모(부고) 카드뉴스 렌더러 — HTML/CSS + Playwright 스크린샷.

`make_carousel_html.py`와 같은 방식이지만 두 가지가 다르다.

  1) 크기가 **1080x1350 (4:5)** 이다. 기존 9:16은 인스타 피드 캐러셀에서 잘린다.
  2) 부고용 톤이다. 검정 바탕 + 흰 글자 + 은은한 금색, 명조체.
     자극적인 문구나 사진을 쓰지 않는다.

실행:
    python scripts/make_cards_memorial.py

필요:
    pip install playwright && python -m playwright install chromium
"""
from __future__ import annotations

import os
import sys

W, H = 1080, 1350          # 4:5 — 인스타 피드/블로그 공용
BG = "#0F0F10"
INK = "#F4F2EC"
SOFT = "#9B968C"
LINE = "#2B2A27"
GOLD = "#C6A268"

SERIF = "'Nanum Myeongjo','Batang','AppleMyungjo','Malgun Gothic',serif"
SANS = "'Malgun Gothic','Pretendard','Apple SD Gothic Neo',sans-serif"

BASE_CSS = f"""
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  html, body {{ width:{W}px; height:{H}px; }}
  body {{
    background:{BG}; color:{INK}; font-family:{SANS};
    padding:96px 88px; display:flex; flex-direction:column;
    -webkit-font-smoothing:antialiased;
  }}
  .eye {{ font-size:26px; letter-spacing:.18em; font-weight:700; color:{GOLD}; }}
  .sp {{ flex:1; }}
  .hr {{ width:92px; height:2px; background:{GOLD}; margin:34px 0; }}
  .title {{ font-family:{SERIF}; font-size:82px; line-height:1.34; font-weight:700; }}
  .num {{ font-family:{SERIF}; font-size:210px; line-height:1; font-weight:700;
          letter-spacing:-.02em; font-variant-numeric:tabular-nums; }}
  .cap {{ font-size:38px; line-height:1.62; color:{SOFT}; }}
  .brand {{ font-size:26px; letter-spacing:.12em; color:{SOFT}; }}
  .list {{ list-style:none; margin-top:38px; }}
  .list li {{ display:flex; justify-content:space-between; align-items:baseline;
              font-size:38px; color:{SOFT};
              border-bottom:1px solid {LINE}; padding-bottom:18px; margin-bottom:18px; }}
  .list b {{ color:{INK}; font-size:52px; font-variant-numeric:tabular-nums;
             font-family:{SERIF}; }}
"""


def _page(body: str) -> str:
    return f"<!doctype html><meta charset='utf-8'><style>{BASE_CSS}</style>{body}"


def cover(eyebrow: str, title: str, caption: str, brand: str) -> str:
    return _page(f"""
      <p class="eye">{eyebrow}</p>
      <div class="sp"></div>
      <p class="title">{title}</p>
      <div class="hr"></div>
      <p class="cap">{caption}</p>
      <div class="sp"></div>
      <p class="brand">{brand}</p>
    """)


def big_number(eyebrow: str, number: str, caption: str, brand: str) -> str:
    return _page(f"""
      <p class="eye">{eyebrow}</p>
      <div class="sp"></div>
      <p class="num">{number}</p>
      <div class="hr"></div>
      <p class="cap">{caption}</p>
      <div class="sp"></div>
      <p class="brand">{brand}</p>
    """)


def stat_list(eyebrow: str, title: str, rows: list[tuple[str, str]], brand: str) -> str:
    items = "".join(f"<li><span>{k}</span><b>{v}</b></li>" for k, v in rows)
    return _page(f"""
      <p class="eye">{eyebrow}</p>
      <div class="sp"></div>
      <p class="title">{title}</p>
      <ul class="list">{items}</ul>
      <div class="sp"></div>
      <p class="brand">{brand}</p>
    """)


# --- 백인천 전 감독 추모 (2026-08-15) --------------------------------
# 수치는 보도 교차 확인분만 쓴다. 1982년 출장 경기 수는 매체마다
# 71/72로 엇갈려서 넣지 않았다.
BRAND = "늘봄이야기"

CARDS = [
    ("1_cover", cover(
        "부고 · 2026. 8. 15.",
        "백인천 전 감독<br>별세",
        "한국 프로야구 유일의 4할 타자<br>향년 83세",
        BRAND)),
    ("2_average", big_number(
        "1982년 타율",
        ".412",
        "44년이 지나도록<br>아무도 넘지 못한 기록입니다.",
        BRAND)),
    ("3_1982", stat_list(
        "프로야구 원년, 1982",
        "감독이면서<br>타자였습니다",
        [("타수", "250"), ("안타", "103"), ("홈런", "19"), ("타점", "64")],
        "MBC 청룡 감독 겸 선수")),
    ("4_japan", big_number(
        "일본에서 보낸 시간",
        "19년",
        "1,831안타 · 209홈런<br>1975년 퍼시픽리그 타격왕",
        BRAND)),
    ("5_closing", cover(
        "영결",
        "삼가 고인의<br>명복을 빕니다",
        "KBO는 고인의 공적을 기려<br>역대 두 번째 KBO장으로<br>장례를 치릅니다.",
        f"{BRAND} · @neulbomlife")),
]

OUT_DIR = os.path.join("state", "media", "memorial_baek_20260815")


def render_all(out_dir: str = OUT_DIR) -> list[str]:
    from playwright.sync_api import sync_playwright

    os.makedirs(out_dir, exist_ok=True)
    paths = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": W, "height": H},
                                device_scale_factor=1)
        for name, html in CARDS:
            page.set_content(html)
            page.wait_for_timeout(120)      # 폰트 적용 대기
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
