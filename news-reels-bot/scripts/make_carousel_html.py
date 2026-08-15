#!/usr/bin/env python3
"""
make_carousel.py 와 같은 캐러셀을, PIL 대신 HTML/CSS + 헤드리스 브라우저 스크린샷으로 만든다.
실제 CSS 그라디언트/블러/그림자를 쓸 수 있어서 손으로 짠 PIL 블러보다 결과물이 매끈하다.
각 카드에 AI로 생성해둔 사진(배경/상단 이미지)을 넣어서 "백지에 글자만" 느낌을 없앤다.

필요: pip install playwright (브라우저 바이너리는 /opt/pw-browsers 에 이미 설치돼 있다고 가정)
"""
from __future__ import annotations

import base64
import mimetypes
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


def _img_data_uri(path: str) -> str:
    mime = mimetypes.guess_type(path)[0] or "image/png"
    data = base64.b64encode(open(path, "rb").read()).decode("ascii")
    return f"data:{mime};base64,{data}"


def _cover_html(headline: str, category: str, photo_path: str) -> str:
    photo_uri = _img_data_uri(photo_path)
    return f"""
<html><head><style>
{BASE_CSS}
body {{ position: relative; background: #05060b; }}
.photo {{
  position: absolute; inset: 0;
  background-image: url("{photo_uri}");
  background-size: cover; background-position: center 30%;
}}
.scrim {{
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.55) 62%, rgba(0,0,0,0.95) 100%);
}}
.pill {{
  position: absolute; top: 90px; left: 60px;
  background: {ACCENT}; color: #150f05;
  font-weight: 700; font-size: 34px;
  padding: 14px 28px; border-radius: 999px;
  box-shadow: 0 0 40px rgba(255,196,60,0.45);
}}
.bar {{
  position: absolute; left: 60px; bottom: 430px;
  width: 90px; height: 8px; background: {ACCENT};
  box-shadow: 0 0 18px rgba(255,196,60,0.6);
}}
.headline {{
  position: absolute; left: 60px; right: 60px; bottom: 240px;
  color: #fff; font-weight: 700; font-size: 76px; line-height: 1.22;
  text-shadow: 0 4px 24px rgba(0,0,0,0.6);
}}
</style></head>
<body>
  <div class="photo"></div>
  <div class="scrim"></div>
  <div class="pill">{category}</div>
  <div class="bar"></div>
  <div class="headline">{headline}</div>
</body></html>
"""


def _fact_html(number: str, title: str, body: str, photo_path: str) -> str:
    photo_uri = _img_data_uri(photo_path)
    return f"""
<html><head><style>
{BASE_CSS}
body {{ background: #f7f7f5; position: relative; }}
.photo {{
  position: absolute; top: 0; left: 0; right: 0; height: 58%;
  background-image: url("{photo_uri}");
  background-size: cover; background-position: center;
}}
.photo::after {{
  content: "";
  position: absolute; left: 0; right: 0; bottom: 0; height: 40%;
  background: linear-gradient(180deg, rgba(247,247,245,0) 0%, #f7f7f5 100%);
}}
.seam {{
  position: absolute; top: calc(58% - 3px); left: 0; right: 0; height: 6px;
  background: {ACCENT};
}}
.panel {{
  position: absolute; left: 0; right: 0; top: 58%; bottom: 0;
  padding: 56px 70px 0;
}}
.badge {{
  width: 78px; height: 78px; border-radius: 50%;
  background: #ebebe7;
  border: 4px solid {ACCENT};
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 38px; color: #282828;
  margin-bottom: 30px;
}}
.title {{
  font-weight: 700; font-size: 52px; color: #141414; line-height: 1.28;
  margin-bottom: 22px;
}}
.body {{
  font-weight: 400; font-size: 34px; color: #5a5a5a; line-height: 1.5;
}}
</style></head>
<body>
  <div class="photo"></div>
  <div class="seam"></div>
  <div class="panel">
    <div class="badge">{number}</div>
    <div class="title">{title}</div>
    <div class="body">{body}</div>
  </div>
</body></html>
"""


def _closing_html(source: str, cta: str, photo_path: str) -> str:
    photo_uri = _img_data_uri(photo_path)
    return f"""
<html><head><style>
{BASE_CSS}
body {{ position: relative; background: #05060b; }}
.photo {{
  position: absolute; inset: 0;
  background-image: url("{photo_uri}");
  background-size: cover; background-position: center;
  filter: saturate(0.7) brightness(0.55);
}}
.scrim {{
  position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 42%, rgba(10,12,24,0.55) 0%, rgba(6,7,14,0.92) 65%);
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
  text-shadow: 0 2px 12px rgba(0,0,0,0.6);
}}
.cta {{
  display: inline-block;
  background: {ACCENT}; color: #150f05; font-weight: 700; font-size: 32px;
  padding: 18px 32px; border-radius: 999px;
  box-shadow: 0 0 30px rgba(255,196,60,0.35);
}}
</style></head>
<body>
  <div class="photo"></div>
  <div class="scrim"></div>
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
    media_dir = os.path.join(os.path.dirname(__file__), "..", "state", "media")
    out_dir = os.path.join(media_dir, "carousel_e37a85248a_html")
    os.makedirs(out_dir, exist_ok=True)

    photo_kick = os.path.join(media_dir, "e37a85248a.png")
    photo_rain = os.path.join(media_dir, "scene2.png")
    photo_net = os.path.join(media_dir, "scene3.png")
    photo_crowd = os.path.join(media_dir, "scene4.png")

    render(
        _cover_html(
            "우에다 아야세, 페예노르트 거액 제안에도 침묵 깬 이유는?", "스포츠", photo_rain
        ),
        os.path.join(out_dir, "1_cover.png"),
    )
    render(
        _fact_html(
            "1",
            "페예노르트의 통 큰 제안",
            "일본 축구대표팀 간판 스트라이커 우에다 아야세에게 약 1,500만 파운드 규모 영입을 검토 중이라는 보도가 나왔다.",
            photo_net,
        ),
        os.path.join(out_dir, "2_fact1.png"),
    )
    render(
        _fact_html(
            "2",
            "정작 본인은 확고한 의사",
            "우에다 본인은 자신의 거취에 대해 이미 뜻을 굳힌 것으로 알려졌다.",
            photo_crowd,
        ),
        os.path.join(out_dir, "3_fact2.png"),
    )
    render(
        _fact_html(
            "3",
            "그의 선택은 어디로?",
            "과연 우에다의 다음 행선지가 어디가 될지 관심이 집중되고 있다.",
            photo_kick,
        ),
        os.path.join(out_dir, "4_fact3.png"),
    )
    render(
        _closing_html(
            "출처: 네이버뉴스 - 스포티비뉴스(SPOTV NEWS)",
            "더 많은 뉴스 요약이 궁금하다면 팔로우",
            photo_rain,
        ),
        os.path.join(out_dir, "5_closing.png"),
    )
    print("done:", out_dir)
