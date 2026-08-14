#!/usr/bin/env python3
"""
기사 하나를 인스타그램 캐러셀(여러 장 카드) 게시물용 이미지로 만든다.
AI 이미지 생성 없이 순수 로컬 렌더링(Pillow)만 사용 — 크레딧/외부 API 불필요.
"""
from __future__ import annotations

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_REGULAR = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"


def font(path, size):
    return ImageFont.truetype(path, size, index=0)


def _split_long_word(draw, word, fnt, max_width):
    parts, cur = [], ""
    for ch in word:
        test = cur + ch
        if draw.textlength(test, font=fnt) > max_width and cur:
            parts.append(cur)
            cur = ch
        else:
            cur = test
    if cur:
        parts.append(cur)
    return parts


def wrap_text(draw, text, fnt, max_width):
    """단어(공백 기준) 단위로 줄바꿈. 단어 하나가 너무 길면 그 단어만 글자 단위로 쪼갠다."""
    lines, cur = [], ""
    for word in text.split(" "):
        candidate = f"{cur} {word}".strip()
        if draw.textlength(candidate, font=fnt) <= max_width:
            cur = candidate
            continue
        if cur:
            lines.append(cur)
            cur = ""
        if draw.textlength(word, font=fnt) <= max_width:
            cur = word
        else:
            sub_parts = _split_long_word(draw, word, fnt, max_width)
            lines.extend(sub_parts[:-1])
            cur = sub_parts[-1] if sub_parts else ""
    if cur:
        lines.append(cur)
    return lines


def vertical_gradient(size, top_color, bottom_color):
    w, h = size
    base = Image.new("RGB", size, top_color)
    top = Image.new("RGB", size, top_color)
    bottom = Image.new("RGB", size, bottom_color)
    mask = Image.new("L", size)
    mask_data = [int(255 * (y / h)) for y in range(h) for _ in range(w)]
    mask.putdata(mask_data)
    base = Image.composite(bottom, top, mask)
    return base


def draw_pill(draw, xy, text, fnt, fg, bg, pad_x=20, pad_y=10):
    x, y = xy
    tw = draw.textlength(text, font=fnt)
    th = fnt.size
    draw.rounded_rectangle(
        [x, y, x + tw + pad_x * 2, y + th + pad_y * 2], radius=(th + pad_y * 2) // 2, fill=bg
    )
    draw.text((x + pad_x, y + pad_y), text, font=fnt, fill=fg)


def make_cover(headline: str, category: str, out_path: str):
    img = vertical_gradient((W, H), (18, 22, 38), (6, 8, 16))
    draw = ImageDraw.Draw(img)

    # 은은한 스포트라이트 느낌의 원형 글로우 두 개
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-200, -200, 500, 500], fill=(90, 130, 255, 60))
    gd.ellipse([W - 500, H - 900, W + 200, H - 200], fill=(255, 210, 90, 45))
    glow = glow.filter_placeholder if False else glow
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(img)

    pill_font = font(FONT_BOLD, 34)
    draw_pill(draw, (60, 80), category, pill_font, (10, 10, 10), (255, 214, 92))

    headline_font = font(FONT_BOLD, 74)
    max_w = W - 120
    lines = wrap_text(draw, headline, headline_font, max_w)
    line_h = 90
    total_h = line_h * len(lines)
    y = H - 260 - total_h
    # 가독성용 반투명 박스
    draw.rectangle([0, y - 50, W, H - 150], fill=(0, 0, 0))
    img = img.convert("RGBA")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle([0, y - 60, W, H - 130], fill=(0, 0, 0, 140))
    img = Image.alpha_composite(img, overlay).convert("RGB")
    draw = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        draw.text((60, y + i * line_h), line, font=headline_font, fill=(255, 255, 255))

    img.save(out_path)


def make_fact_card(number: str, title: str, body: str, out_path: str):
    img = Image.new("RGB", (W, H), (247, 247, 245))
    draw = ImageDraw.Draw(img)

    badge_d = 130
    bx, by = 70, 130
    draw.ellipse([bx, by, bx + badge_d, by + badge_d], fill=(230, 230, 226))
    num_font = font(FONT_BOLD, 64)
    tw = draw.textlength(number, font=num_font)
    draw.text((bx + (badge_d - tw) / 2, by + (badge_d - 78) / 2), number, font=num_font, fill=(40, 40, 40))

    title_font = font(FONT_BOLD, 62)
    ty = by + badge_d + 70
    max_w = W - 140
    for line in wrap_text(draw, title, title_font, max_w):
        draw.text((70, ty), line, font=title_font, fill=(20, 20, 20))
        ty += 78

    body_font = font(FONT_REGULAR, 40)
    ty += 30
    for line in wrap_text(draw, body, body_font, max_w):
        draw.text((70, ty), line, font=body_font, fill=(90, 90, 90))
        ty += 58

    img.save(out_path)


def make_closing(source: str, cta: str, out_path: str):
    img = vertical_gradient((W, H), (10, 14, 28), (20, 16, 40))
    draw = ImageDraw.Draw(img)

    src_font = font(FONT_BOLD, 46)
    cta_font = font(FONT_REGULAR, 34)

    lines = wrap_text(draw, source, src_font, W - 160)
    total_h = len(lines) * 60
    y = H / 2 - total_h / 2 - 60
    for line in lines:
        tw = draw.textlength(line, font=src_font)
        draw.text(((W - tw) / 2, y), line, font=src_font, fill=(255, 255, 255))
        y += 60

    y += 40
    tw = draw.textlength(cta, font=cta_font)
    draw.text(((W - tw) / 2, y), cta, font=cta_font, fill=(170, 170, 190))

    img.save(out_path)


if __name__ == "__main__":
    import os

    out_dir = os.path.join(os.path.dirname(__file__), "..", "state", "media", "carousel_e37a85248a")
    os.makedirs(out_dir, exist_ok=True)

    make_cover(
        "우에다 아야세, 페예노르트 거액 제안에도 침묵 깬 이유는?",
        "스포츠",
        os.path.join(out_dir, "1_cover.png"),
    )
    make_fact_card(
        "1",
        "페예노르트의 통 큰 제안",
        "일본 축구대표팀 간판 스트라이커 우에다 아야세에게 약 1,500만 파운드 규모 영입을 검토 중이라는 보도가 나왔다.",
        os.path.join(out_dir, "2_fact1.png"),
    )
    make_fact_card(
        "2",
        "정작 본인은 확고한 의사",
        "우에다 본인은 자신의 거취에 대해 이미 뜻을 굳힌 것으로 알려졌다.",
        os.path.join(out_dir, "3_fact2.png"),
    )
    make_fact_card(
        "3",
        "그의 선택은 어디로?",
        "과연 우에다의 다음 행선지가 어디가 될지 관심이 집중되고 있다.",
        os.path.join(out_dir, "4_fact3.png"),
    )
    make_closing(
        "출처: 네이버뉴스 - 스포티비뉴스(SPOTV NEWS)",
        "더 많은 뉴스 요약이 궁금하다면 팔로우",
        os.path.join(out_dir, "5_closing.png"),
    )
    print("done:", out_dir)
