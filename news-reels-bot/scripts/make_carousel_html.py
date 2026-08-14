#!/usr/bin/env python3
"""
make_carousel.py 와 같은 캐러셀을, PIL 대신 HTML/CSS + 헤드리스 브라우저 스크린샷으로 만든다.
실제 CSS 그라디언트/블러/그림자를 쓸 수 있어서 손으로 짠 PIL 블러보다 결과물이 매끈하다.

필요: pip install playwright (브라우저 바이너리는 /opt/pw-browsers 에 이미 설치돼 있다고 가정)
"""
from __future__ import annotations

import os

from playwright.sync_api import sync_playwright

W, H = 1080, 1920
ACCENT = "#FFC43C"
CHROME_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

FONT_FAMILY = "'Noto Sans CJK KR', sans-serif"

BASE_CSS = f"""
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
html, body {{
  width: {W}px; height: {H}px;
  font-family: {FONT_FAMILY};
  overflow: hidden;
}}
"""


def _cover_html(headline: str, category: str) -> str:
    return f"""
<html><head><style>
{BASE_CSS}
body {{
  position: relative;
  background: radial-gradient(circle at 15% -5%, #2a3a6b 0%, #0d0f1a 38%),
              radial-gradient(circle at 100% 105%, #4a3a12 0%, #0d0f1a 42%),
              linear-gradient(180deg, #0e111e 0%, #05060b 100%);
}}
body::before {{
  content: "";
  position: absolute; inset: 0;
  background:
    conic-gradient(from 200deg at 15% -10%, rgba(255,255,255,0.10), transparent 22%),
    conic-gradient(from 20deg at 100% -10%, rgba(255,255,255,0.08), transparent 22%);
  filter: blur(40px);
}}
.pill {{
  position: absolute; top: 90px; left: 60px;
  background: {ACCENT}; color: #150f05;
  font-weight: 700; font-size: 34px;
  padding: 14px 28px; border-radius: 999px;
  box-shadow: 0 0 40px rgba(255,196,60,0.35);
}}
.scrim {{
  position: absolute; left: 0; right: 0; bottom: 0; height: 62%;
  background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.92) 100%);
}}
.bar {{
  position: absolute; left: 60px; bottom: 430px;
  width: 90px; height: 8px; background: {ACCENT};
  box-shadow: 0 0 18px rgba(255,196,60,0.6);
}}
.headline {{
  position: absolute; left: 60px; right: 60px; bottom: 240px;
  color: #fff; font-weight: 700; font-size: 76px; line-height: 1.22;
  text-shadow: 0 4px 24px rgba(0,0,0,0.5);
}}
.grain {{
  position: absolute; inset: 0; opacity: 0.05; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}}
</style></head>
<body>
  <div class="pill">{category}</div>
  <div class="scrim"></div>
  <div class="bar"></div>
  <div class="headline">{headline}</div>
  <div class="grain"></div>
</body></html>
"""


def _fact_html(number: str, title: str, body: str) -> str:
    return f"""
<html><head><style>
{BASE_CSS}
body {{ background: #f7f7f5; position: relative; }}
.wrap {{
  position: absolute; left: 70px; right: 70px; bottom: 340px;
}}
.badge {{
  width: 88px; height: 88px; border-radius: 50%;
  background: #ebebe7;
  border: 4px solid {ACCENT};
  box-shadow: 0 0 0 1px rgba(0,0,0,0.03);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 42px; color: #282828;
  margin-bottom: 44px;
}}
.title {{
  font-weight: 700; font-size: 60px; color: #141414; line-height: 1.3;
  margin-bottom: 26px;
}}
.body {{
  font-weight: 400; font-size: 39px; color: #5a5a5a; line-height: 1.5;
}}
</style></head>
<body>
  <div class="wrap">
    <div class="badge">{number}</div>
    <div class="title">{title}</div>
    <div class="body">{body}</div>
  </div>
</body></html>
"""


def _closing_html(source: str, cta: str) -> str:
    return f"""
<html><head><style>
{BASE_CSS}
body {{
  position: relative;
  background: radial-gradient(circle at 50% 42%, #1c2450 0%, #0c0e1a 45%),
              linear-gradient(160deg, #0c0e1a 0%, #160f2a 100%);
}}
.glow {{
  position: absolute; left: 50%; top: 42%; width: 700px; height: 700px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255,196,60,0.16) 0%, transparent 60%);
  filter: blur(10px);
}}
.center {{
  position: absolute; left: 0; right: 0; top: 42%; transform: translateY(-30px);
  text-align: center;
}}
.divider {{
  width: 90px; height: 6px; background: {ACCENT}; margin: 0 auto 40px;
  box-shadow: 0 0 18px rgba(255,196,60,0.6);
}}
.source {{
  color: #fff; font-weight: 700; font-size: 46px; line-height: 1.4;
  margin-bottom: 34px;
}}
.cta {{
  display: inline-block;
  background: {ACCENT}; color: #150f05; font-weight: 700; font-size: 32px;
  padding: 18px 32px; border-radius: 999px;
  box-shadow: 0 0 30px rgba(255,196,60,0.3);
}}
</style></head>
<body>
  <div class="glow"></div>
  <div class="center">
    <div class="divider"></div>
    <div class="source">{source}</div>
    <div class="cta">{cta}</div>
  </div>
</body></html>
"""


def render(html: str, out_path: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME_PATH)
        page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=2)
        page.set_content(html)
        page.screenshot(path=out_path)
        browser.close()


if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(__file__), "..", "state", "media", "carousel_e37a85248a_html")
    os.makedirs(out_dir, exist_ok=True)

    render(
        _cover_html("우에다 아야세, 페예노르트 거액 제안에도 침묵 깬 이유는?", "스포츠"),
        os.path.join(out_dir, "1_cover.png"),
    )
    render(
        _fact_html(
            "1",
            "페예노르트의 통 큰 제안",
            "일본 축구대표팀 간판 스트라이커 우에다 아야세에게 약 1,500만 파운드 규모 영입을 검토 중이라는 보도가 나왔다.",
        ),
        os.path.join(out_dir, "2_fact1.png"),
    )
    render(
        _fact_html(
            "2",
            "정작 본인은 확고한 의사",
            "우에다 본인은 자신의 거취에 대해 이미 뜻을 굳힌 것으로 알려졌다.",
        ),
        os.path.join(out_dir, "3_fact2.png"),
    )
    render(
        _fact_html(
            "3",
            "그의 선택은 어디로?",
            "과연 우에다의 다음 행선지가 어디가 될지 관심이 집중되고 있다.",
        ),
        os.path.join(out_dir, "4_fact3.png"),
    )
    render(
        _closing_html("출처: 네이버뉴스 - 스포티비뉴스(SPOTV NEWS)", "더 많은 뉴스 요약이 궁금하다면 팔로우"),
        os.path.join(out_dir, "5_closing.png"),
    )
    print("done:", out_dir)
