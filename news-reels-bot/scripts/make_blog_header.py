#!/usr/bin/env python3
"""
네이버 블로그 등 수동 업로드용 헤더 이미지를 HTML/CSS + 헤드리스 브라우저로 만든다.
AI 이미지 생성 없이, 순수 CSS/SVG 일러스트로 구성한다 (야구공 스티치, 조명탑 빛줄기 등).
"""
from __future__ import annotations

import os

from playwright.sync_api import sync_playwright

W, H = 1200, 675  # 16:9, 블로그 본문 삽입에 무난한 크기
ACCENT = "#2F6FED"  # 삼성 라이온즈 블루 톤
GOLD = "#FFC43C"
CHROME_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
FONT_FAMILY = "'Noto Sans CJK KR', sans-serif"


def _header_html(title: str, subtitle: str) -> str:
    baseball_svg = f"""
    <svg width="260" height="260" viewBox="0 0 200 200" style="position:absolute; right:70px; top:50%; transform:translateY(-50%); opacity:0.95;">
      <circle cx="100" cy="100" r="92" fill="#f5f0e6" />
      <circle cx="100" cy="100" r="92" fill="none" stroke="#d8cfb8" stroke-width="2"/>
      <path d="M 45 15 Q 90 100 45 185" fill="none" stroke="#c0392b" stroke-width="4" stroke-dasharray="6,6"/>
      <path d="M 155 15 Q 110 100 155 185" fill="none" stroke="#c0392b" stroke-width="4" stroke-dasharray="6,6"/>
    </svg>
    """
    return f"""
<html><head><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:{W}px; height:{H}px; font-family:{FONT_FAMILY}; overflow:hidden; }}
body {{
  position: relative;
  background:
    radial-gradient(circle at 8% 15%, rgba(255,255,255,0.10) 0%, transparent 30%),
    radial-gradient(circle at 92% 90%, rgba(255,196,60,0.16) 0%, transparent 40%),
    linear-gradient(135deg, #0b1330 0%, #101a3d 55%, #0a1128 100%);
}}
.beam {{
  position: absolute; top: -20%; left: 8%; width: 3px; height: 140%;
  background: linear-gradient(180deg, rgba(255,255,255,0.35), transparent);
  transform: rotate(18deg);
  filter: blur(2px);
}}
.beam2 {{
  position: absolute; top: -20%; left: 18%; width: 2px; height: 140%;
  background: linear-gradient(180deg, rgba(255,255,255,0.22), transparent);
  transform: rotate(18deg);
  filter: blur(2px);
}}
.pill {{
  position: absolute; left: 70px; top: 70px;
  background: {GOLD}; color: #150f05; font-weight:700; font-size:22px;
  padding: 10px 22px; border-radius: 999px;
}}
.title {{
  position: absolute; left: 70px; top: 220px; right: 420px;
  color: #fff; font-weight: 700; font-size: 52px; line-height: 1.28;
  text-shadow: 0 3px 18px rgba(0,0,0,0.4);
}}
.subtitle {{
  position: absolute; left: 70px; top: 460px; right: 420px;
  color: #b9c2e0; font-weight: 400; font-size: 26px; line-height: 1.5;
}}
.accentbar {{
  position: absolute; left: 70px; top: 190px; width: 70px; height: 7px;
  background: {ACCENT}; box-shadow: 0 0 16px rgba(47,111,237,0.7);
}}
</style></head>
<body>
  <div class="beam"></div>
  <div class="beam2"></div>
  <div class="pill">KBO 프로야구</div>
  <div class="accentbar"></div>
  <div class="title">{title}</div>
  <div class="subtitle">{subtitle}</div>
  {baseball_svg}
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
    out_dir = os.path.join(os.path.dirname(__file__), "..", "state", "media", "blog_kbo_20260814")
    os.makedirs(out_dir, exist_ok=True)
    render(
        _header_html(
            "구자욱 5안타 2홈런 폭발",
            "삼성, 한화 꺾고 8월 첫 연승 (8-5)",
        ),
        os.path.join(out_dir, "header.png"),
    )
    print("done:", out_dir)
