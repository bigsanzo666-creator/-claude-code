/**
 * 꿈해몽 판 — 값을 받지 않는다.
 *
 * ## 왜 공짜로 주는가
 *
 * 사람을 데려오는 자리다. 사주는 생년월일을 적어야 하지만 꿈은 **아무것도
 * 적을 필요가 없다.** 문턱이 제일 낮은 입구라 검색으로 들어오기도 제일 쉽다.
 *
 * 경쟁사(청월당)도 꿈해몽을 공짜로 풀어 놓고 그 손님을 유료로 넘긴다.
 * 다만 그쪽은 모델로 푼다 — 사람이 몰리면 그만큼 돈이 나간다.
 * 우리는 표에서 꺼내므로 **몇 명이 오든 원가가 0이다.**
 *
 * ## 값을 받지 않는다고 대충 하지 않는다
 *
 * 풀이마다 **손님이 쓴 어느 낱말에서 나왔는지**를 같이 적는다. 그래야
 * 「내 꿈을 읽었구나」로 받는다. 표에 없으면 없다고 말한다 — 지어내지 않는다.
 *
 * ## 겁주지 않는다
 *
 * 죽음·피·이빨처럼 놀라기 쉬운 꿈이 걸리면 **먼저 안심시킨다.**
 * 겁을 줘서 파는 것은 이 집이 하는 장사가 아니다.
 *
 * ## 화면은 서버가 그린다
 *
 * 자바스크립트로 그리지 않는다. 폼을 보내면 서버가 다시 그린다.
 * 검색엔진이 풀이까지 읽을 수 있어야 하고, 자바스크립트가 꺼진 데서도 돌아야 한다.
 */

import { type BusinessInfo } from './business.ts';
import { renderSocialHead } from './social.ts';
import { FONT_LINK, PRODUCTS_CSS } from './products.ts';
import { readDream, symbolCount, SYMBOLS, type DreamReading } from '../../dream/src/index.ts';

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/** **굵게** 를 태그로. 그 밖의 태그는 이미 esc 로 막혀 있다 */
function strong(text: string): string {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/** 적어 넣는 칸 */
function askSection(text: string): string {
  return `  <form class="dr-form" method="post" action="/dream">
    <label class="dr-l" for="dreamText">어젯밤 꿈에 무엇이 나왔나요</label>
    <textarea id="dreamText" name="text" rows="4" maxlength="500"
      placeholder="예 — 커다란 돼지가 집으로 들어왔어요">${esc(text)}</textarea>
    <p class="dr-hint">문장이 길지 않아도 됩니다. <strong>나온 것 한 낱말</strong>이면 충분합니다.
    생년월일도, 이름도 묻지 않습니다.</p>
    <button type="submit" class="dr-go">꿈 풀어 보기</button>
  </form>`;
}

/** 풀이 */
function readingSection(reading: DreamReading | null): string {
  if (!reading) return '';

  if (!reading.hits.length) {
    return `  <div class="dr-out">
    <p class="dr-head">${esc(reading.head)}</p>
    <p class="dr-miss">${strong(reading.miss ?? '')}</p>
  </div>`;
  }

  const cards = reading.hits.map((h) => `    <article class="dr-card dr-${h.tone}">
      <p class="dr-c-top"><b class="dr-c-id">${esc(h.id)}</b><span class="dr-c-tone">${esc(h.toneLabel)}</span></p>
      <p class="dr-c-say">${strong(h.say)}</p>
      <p class="dr-c-more">${strong(h.more)}</p>
      <p class="dr-c-from">적어 주신 글의 「${esc(h.found)}」에서 나왔습니다</p>
    </article>`).join('\n');

  return `  <div class="dr-out">
    <p class="dr-head">${esc(reading.head)}</p>
${cards}
    <p class="dr-cut">${strong(reading.cut)}</p>
    <a class="dr-next" href="/">여덟 글자 무료로 펼쳐 보기 →</a>
  </div>`;
}

/** 아는 낱말을 늘어놓는다. 검색엔진이 읽을 거리이기도 하다 */
function knownSection(): string {
  const groups = ['동물', '자연', '사람과 몸', '물건', '한 일'] as const;
  const rows = groups.map((g) => {
    const names = SYMBOLS.filter((s) => s.group === g).map((s) => esc(s.id)).join(' · ');
    return `      <div class="dr-k-row"><dt>${esc(g)}</dt><dd>${names}</dd></div>`;
  }).join('\n');
  return `  <h3 class="dr-sub">지금 풀 수 있는 꿈</h3>
  <dl class="dr-known">
${rows}
  </dl>
  <p class="dr-note">모두 오래 전해 내려온 해몽입니다. 새로 지어낸 풀이는 하나도 없습니다.
  적어 주신 글에서 <strong>어느 낱말을 보고 그렇게 말했는지</strong>를 함께 적어 드립니다.</p>`;
}

export function renderDreamPage(
  info: BusinessInfo, footer: string, text = '', reading: DreamReading | null = null,
): string {
  const site = info.serviceName || '늘봄사주';
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${renderSocialHead(info, {
    title: '꿈해몽 — 무료, 아무것도 적지 않아도 됩니다',
    description: `꿈에 나온 것을 한 낱말만 적으면 풀어 드립니다. 돼지·뱀·물·불·돈·아기·이빨 등 ${symbolCount()}가지. 오래 전해 내려온 해몽을 그대로 쓰고, 어느 낱말에서 나온 풀이인지 함께 보여드립니다. 값은 받지 않습니다.`,
    path: '/dream',
  })}
${FONT_LINK}
<style>
:root{color-scheme:dark}
body{margin:0}
${PRODUCTS_CSS}
${DREAM_CSS}
</style>
</head>
<body>
<section class="dr">
  <a class="dr-back" href="/">← ${esc(site)}</a>
  <p class="dr-kicker">꿈해몽</p>
  <h2>어젯밤 그 꿈, 무슨 뜻일까요</h2>
  <p class="dr-desc">생년월일도 이름도 묻지 않습니다. <strong>꿈에 무엇이 나왔는지만</strong>
  적어 주세요. ${symbolCount()}가지 꿈을 풀 수 있습니다. <strong>값은 받지 않습니다.</strong></p>

${askSection(text)}
${readingSection(reading)}

${knownSection()}
</section>
${footer}
</body>
</html>`;
}

/*
 * 색과 폰트는 `PRODUCTS_CSS` 가 이미 깔아 둔 것을 그대로 쓴다.
 * 여기서 다시 선언하면 두 군데가 다른 말을 하게 되고, 한쪽을 고칠 때 화면이 어긋난다.
 */
export const DREAM_CSS = `
.dr{max-width:720px;margin:0 auto;padding:26px 22px 40px;box-sizing:border-box}
.dr-back{display:inline-block;margin-bottom:22px;font-size:13px;color:var(--nb-ink-3);text-decoration:none}
.dr-back:hover{color:var(--nb-gold)}
.dr-kicker{margin:0 0 8px;font-size:12px;letter-spacing:.26em;color:var(--nb-gold)}
.dr h2{margin:0 0 14px;font-family:var(--nb-serif);font-weight:500;font-size:27px;
  line-height:1.5;letter-spacing:-.01em;word-break:keep-all}
.dr-desc{margin:0 0 26px;font-size:15px;line-height:1.85;color:var(--nb-ink-2);word-break:keep-all}

/* 적어 넣는 칸 */
.dr-form{display:grid;gap:12px;margin:0 0 28px;padding:22px;
  border:1px solid var(--nb-line);background:var(--nb-paper-2)}
.dr-l{font-size:12px;letter-spacing:.14em;color:var(--nb-gold)}
.dr-form textarea{width:100%;box-sizing:border-box;padding:14px;resize:vertical;
  font:16px/1.7 var(--nb-sans);color:var(--nb-ink);background:var(--nb-paper-3);
  border:1px solid var(--nb-line);border-radius:0}
.dr-form textarea:focus{outline:2px solid var(--nb-gold);outline-offset:-2px}
.dr-hint{margin:0;font-size:13px;line-height:1.7;color:var(--nb-ink-3);word-break:keep-all}
.dr-go{padding:15px;border:1px solid var(--nb-gold);background:var(--nb-gold);
  color:var(--nb-paper);font:500 15.5px var(--nb-sans);cursor:pointer}
.dr-go:hover{background:transparent;color:var(--nb-gold)}

/* 풀이 */
.dr-out{margin:0 0 30px}
.dr-head{margin:0 0 16px;padding:14px 16px;font-size:16px;line-height:1.75;
  color:var(--nb-ink);background:rgba(154,123,51,.08);
  border-left:3px solid var(--nb-gold);word-break:keep-all}
.dr-miss{margin:0;font-size:15px;line-height:1.85;color:var(--nb-ink-2);word-break:keep-all}
.dr-card{margin:0 0 10px;padding:17px 18px;border:1px solid var(--nb-line);background:var(--nb-paper-2)}
.dr-card.dr-길{border-left:3px solid var(--nb-gold)}
.dr-card.dr-흉{border-left:3px solid var(--nb-ink-3)}
.dr-card.dr-중립{border-left:3px solid var(--nb-line)}
.dr-c-top{display:flex;align-items:baseline;gap:9px;margin:0 0 7px;flex-wrap:wrap}
.dr-c-id{font-size:17px;font-weight:600;color:var(--nb-ink)}
.dr-c-tone{font-size:11.5px;letter-spacing:.06em;color:var(--nb-gold)}
.dr-c-say{margin:0 0 7px;font-size:15.5px;line-height:1.8;color:var(--nb-ink);word-break:keep-all}
.dr-c-more{margin:0 0 9px;font-size:14px;line-height:1.8;color:var(--nb-ink-2);word-break:keep-all}
.dr-c-from{margin:0;padding-top:9px;border-top:1px dashed var(--nb-line-soft);
  font-size:12.5px;color:var(--nb-ink-3)}
.dr-cut{margin:18px 0 14px;padding:16px 18px;font-size:15px;line-height:1.85;
  color:var(--nb-ink-2);background:rgba(154,123,51,.06);
  border:1px dashed var(--nb-line);word-break:keep-all}
.dr-next{display:block;padding:15px;text-align:center;text-decoration:none;
  border:1px solid var(--nb-gold);background:var(--nb-gold);color:var(--nb-paper);
  font:500 15.5px var(--nb-sans)}
.dr-next:hover{background:transparent;color:var(--nb-gold)}

/* 아는 낱말 */
.dr-sub{margin:34px 0 12px;font-family:var(--nb-serif);font-weight:500;font-size:19px}
.dr-known{margin:0 0 14px;display:grid;gap:9px}
.dr-k-row{display:grid;grid-template-columns:92px 1fr;gap:12px;align-items:baseline}
.dr-k-row dt{margin:0;font-size:12.5px;color:var(--nb-gold)}
.dr-k-row dd{margin:0;font-size:14px;line-height:1.8;color:var(--nb-ink-2);word-break:keep-all}
.dr-note{margin:0;font-size:13px;line-height:1.8;color:var(--nb-ink-3);word-break:keep-all}

@media (max-width:420px){
  .dr h2{font-size:23px}
  .dr-k-row{grid-template-columns:1fr;gap:2px}
  .dr-k-row dt{font-size:11.5px}
}
`;

export { readDream };
