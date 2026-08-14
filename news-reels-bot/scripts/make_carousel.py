#!/usr/bin/env python3
"""
기사 하나를 인스타그램 캐러셀(여러 장 카드) 게시물용 이미지로 만든다.
AI 이미지 생성 없이 순수 로컬 렌더링(Pillow)만 사용 — 크레딧/외부 API 불필요.
"""
from __future__ import annotations

import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_REGULAR = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
ACCENT = (255, 196, 60)  # 스포트라이트 느낌의 앰버 액센트


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


def add_glow(base_rgba, ellipses, blur_radius=140):
    """ellipses: [(box, rgba_color), ...]. 실제로 가우시안 블러를 먹여서 은은하게 번지는 조명 느낌을 낸다."""
    glow = Image.new("RGBA", base_rgba.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for box, color in ellipses:
        gd.ellipse(box, fill=color)
    glow = glow.filter(ImageFilter.GaussianBlur(blur_radius))
    return Image.alpha_composite(base_rgba, glow)


def add_light_beams(base_rgba, origin, count=5, spread_deg=34, length=1600, color=(255, 236, 190, 26)):
    """스타디움 조명탑에서 뻗어나오는 듯한 부채꼴 빛줄기. 블러로 부드럽게 처리."""
    beams = Image.new("RGBA", base_rgba.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(beams)
    ox, oy = origin
    base_angle = 90  # 아래쪽으로
    for i in range(count):
        angle = base_angle - spread_deg / 2 + spread_deg * i / max(count - 1, 1)
        angle += random.uniform(-3, 3)
        rad = angle * 3.14159265 / 180
        width = 70
        import math

        dx, dy = math.cos(rad), math.sin(rad)
        px, py = -dy, dx
        tip = (ox + dx * length, oy + dy * length)
        p1 = (ox + px * 6, oy + py * 6)
        p2 = (ox - px * 6, oy - py * 6)
        p3 = (tip[0] + px * width, tip[1] + py * width)
        p4 = (tip[0] - px * width, tip[1] - py * width)
        bd.polygon([p1, p2, p4, p3], fill=color)
    beams = beams.filter(ImageFilter.GaussianBlur(60))
    return Image.alpha_composite(base_rgba, beams)


def add_vignette(base_rgba, strength=110):
    vign = Image.new("L", base_rgba.size, 0)
    vd = ImageDraw.Draw(vign)
    w, h = base_rgba.size
    vd.ellipse([-w * 0.3, -h * 0.25, w * 1.3, h * 1.15], fill=strength)
    vign = vign.filter(ImageFilter.GaussianBlur(220))
    dark = Image.new("RGBA", base_rgba.size, (0, 0, 0, 255))
    dark.putalpha(Image.eval(vign, lambda v: 255 - v))
    return Image.alpha_composite(base_rgba, dark)


def add_grain(base_rgb, amount=10):
    w, h = base_rgb.size
    noise = Image.effect_noise((w, h), amount).convert("L")
    noise_rgba = Image.merge("RGBA", (noise, noise, noise, Image.new("L", (w, h), 14)))
    return Image.alpha_composite(base_rgb.convert("RGBA"), noise_rgba).convert("RGB")


def make_cover(headline: str, category: str, out_path: str):
    img = vertical_gradient((W, H), (14, 17, 30), (4, 5, 11)).convert("RGBA")

    # 조명탑 빛줄기 두 개 (위쪽 좌우에서) + 은은한 컬러 글로우
    img = add_light_beams(img, (W * 0.15, -40), count=4, spread_deg=26)
    img = add_light_beams(img, (W * 0.9, -40), count=4, spread_deg=26)
    img = add_glow(
        img,
        [
            ([-250, -250, 450, 450], (90, 130, 255, 55)),
            ([W - 550, H - 950, W + 150, H - 250], ACCENT + (40,)),
        ],
        blur_radius=160,
    )
    img = add_vignette(img, strength=130)

    draw = ImageDraw.Draw(img)
    pill_font = font(FONT_BOLD, 34)
    draw_pill(draw, (60, 90), category, pill_font, (15, 12, 5), ACCENT)

    headline_font = font(FONT_BOLD, 76)
    max_w = W - 120
    lines = wrap_text(draw, headline, headline_font, max_w)
    line_h = 92
    total_h = line_h * len(lines)
    accent_bar_y = H - 260 - total_h - 46
    text_y = H - 260 - total_h

    # 하단 가독성용 그라디언트 스크림 (딱딱한 박스 대신 위로 갈수록 투명해지는 그림자)
    scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sw, sh = W, H
    scrim_h = H - (accent_bar_y - 120)
    grad = Image.new("L", (1, scrim_h))
    for yy in range(scrim_h):
        grad.putpixel((0, yy), int(235 * (yy / scrim_h) ** 1.4))
    grad = grad.resize((sw, scrim_h))
    black = Image.new("RGBA", (sw, scrim_h), (0, 0, 0, 255))
    black.putalpha(grad)
    scrim.paste(black, (0, H - scrim_h))
    img = Image.alpha_composite(img, scrim)
    draw = ImageDraw.Draw(img)

    # 헤드라인 위 짧은 앰버 액센트 바 (신문 헤드라인 느낌)
    draw.rectangle([60, accent_bar_y, 60 + 90, accent_bar_y + 8], fill=ACCENT)

    for i, line in enumerate(lines):
        draw.text((60, text_y + i * line_h), line, font=headline_font, fill=(255, 255, 255))

    img = add_grain(img, amount=8)
    img.save(out_path)


def make_fact_card(number: str, title: str, body: str, out_path: str):
    img = Image.new("RGB", (W, H), (247, 247, 245))
    draw = ImageDraw.Draw(img)

    badge_d = 130
    title_font = font(FONT_BOLD, 62)
    body_font = font(FONT_REGULAR, 40)
    max_w = W - 140
    title_lines = wrap_text(draw, title, title_font, max_w)
    body_lines = wrap_text(draw, body, body_font, max_w)
    title_line_h, body_line_h = 78, 58

    # 배지 + 제목 + 본문을 한 블록으로 보고, 화면 하단 쪽에 오도록 배치
    block_h = badge_d + 70 + len(title_lines) * title_line_h + 30 + len(body_lines) * body_line_h
    by = min(int(H * 0.68 - block_h / 2), H - block_h - 120)
    bx = 70

    draw.ellipse([bx - 6, by - 6, bx + badge_d + 6, by + badge_d + 6], outline=ACCENT, width=5)
    draw.ellipse([bx, by, bx + badge_d, by + badge_d], fill=(235, 235, 231))
    num_font = font(FONT_BOLD, 64)
    tw = draw.textlength(number, font=num_font)
    draw.text((bx + (badge_d - tw) / 2, by + (badge_d - 78) / 2), number, font=num_font, fill=(40, 40, 40))

    ty = by + badge_d + 70
    for line in title_lines:
        draw.text((70, ty), line, font=title_font, fill=(20, 20, 20))
        ty += title_line_h

    ty += 30
    for line in body_lines:
        draw.text((70, ty), line, font=body_font, fill=(90, 90, 90))
        ty += body_line_h

    img.save(out_path)


def make_closing(source: str, cta: str, out_path: str):
    img = vertical_gradient((W, H), (12, 14, 26), (22, 17, 42)).convert("RGBA")
    img = add_glow(
        img,
        [
            ([W * 0.5 - 420, H * 0.42 - 420, W * 0.5 + 420, H * 0.42 + 420], (110, 140, 255, 45)),
            ([W * 0.5 - 300, H * 0.42 - 300, W * 0.5 + 300, H * 0.42 + 300], ACCENT + (35,)),
        ],
        blur_radius=170,
    )
    img = add_vignette(img, strength=120)
    draw = ImageDraw.Draw(img)

    # 작은 앰버 디바이더로 시선을 모은다
    divider_y = int(H * 0.42) - 90
    draw.rectangle([W / 2 - 45, divider_y, W / 2 + 45, divider_y + 6], fill=ACCENT)

    src_font = font(FONT_BOLD, 46)
    cta_font = font(FONT_REGULAR, 34)

    lines = wrap_text(draw, source, src_font, W - 160)
    total_h = len(lines) * 60
    y = divider_y + 50
    for line in lines:
        tw = draw.textlength(line, font=src_font)
        draw.text(((W - tw) / 2, y), line, font=src_font, fill=(255, 255, 255))
        y += 60

    y += 30
    pill_font = font(FONT_BOLD, 32)
    tw = draw.textlength(cta, font=pill_font)
    draw_pill(
        draw,
        ((W - (tw + 64)) / 2, y),
        cta,
        pill_font,
        (15, 12, 5),
        ACCENT,
        pad_x=32,
        pad_y=18,
    )

    img = add_grain(img, amount=8)
    img.convert("RGB").save(out_path)


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
