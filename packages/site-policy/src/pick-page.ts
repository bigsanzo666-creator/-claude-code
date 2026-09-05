/**
 * 택일 — 수술로 낳는 날 고르기.
 *
 * 역술가는 날짜 셋을 적어 주고 끝낸다. 병원 일정과 안 맞으면 손님은 그냥 못 쓴다.
 * 여기서는 **의사한테 받은 후보 날짜와 수술이 가능한 시각을 먼저 받고**, 그 안에서만
 * 잰다. 전화 상담으로는 못 하는 일이고 이것이 우리가 파는 자리다.
 *
 * ## 자바스크립트 없이 돈다
 *
 * 폼을 보내면 서버가 재서 결과를 그린 페이지를 돌려준다. 택일에는 **손님의
 * 생년월일이 필요 없다** — 아직 태어나지 않은 아기의 날을 고르는 것이라 서버로
 * 보낼 개인정보 자체가 없다. 그래서 얼굴·손금과 달리 서버에서 계산해도 된다.
 *
 * ## 몸이 먼저다
 *
 * 화면 맨 위와 결과 아래에 「의사가 된다고 한 날만 넣으라」고 적는다. 이 값이
 * 의학적 판단을 대신하지 않는다는 것을 손님이 읽고 지나가게 한다.
 */

import { type BusinessInfo, show } from './business.ts';
import { renderSocialHead } from './social.ts';
import { FONT_LINK, PRODUCTS_CSS } from './products.ts';
import type { PickGroup } from '../../saju-rules/src/pick.ts';

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/** 태어날 곳. 진태양시로 시주를 세우는 데 경도가 필요하다 */
export const PLACES: { name: string; longitude: number }[] = [
  { name: '서울', longitude: 126.978 },
  { name: '인천', longitude: 126.705 },
  { name: '수원', longitude: 127.009 },
  { name: '춘천', longitude: 127.729 },
  { name: '대전', longitude: 127.385 },
  { name: '전주', longitude: 127.148 },
  { name: '광주', longitude: 126.851 },
  { name: '대구', longitude: 128.601 },
  { name: '창원', longitude: 128.681 },
  { name: '울산', longitude: 129.311 },
  { name: '부산', longitude: 129.075 },
  { name: '제주', longitude: 126.531 },
];

/**
 * 병원이 수술을 잡는 시간대.
 *
 * 아기가 정각에 딱 맞춰 나오는 일은 없다. 그래서 손님에게는 「07~08시」처럼
 * **한 시간 폭**으로 고르게 하고, 잴 때는 그 폭의 한가운데(07:30)로 잰다.
 * 정각은 시주의 경계와 겹칠 때가 있어(07:00은 묘시와 진시의 금) 한가운데가
 * 안전하다. 담기는 값이 한가운데인 것은 화면에 드러내지 않는다 — 손님이
 * 읽는 것은 폭이다.
 */
export const TIMES = [
  '07:30', '08:30', '09:30', '10:30', '11:30',
  '12:30', '13:30', '14:30', '15:30', '16:30',
];

/** '07:30' → '07~08시'. 담긴 값이 아니라 손님이 고른 폭을 되돌려 준다 */
export function slotLabel(value: string): string {
  const h = Number(value.slice(0, 2));
  return `${String(h).padStart(2, '0')}~${String(h + 1).padStart(2, '0')}시`;
}

/** 묶인 칸의 폭. '10:30'부터 '11:30'까지면 10시에 열려 12시에 닫힌다 */
export function slotSpan(from: string, to: string): string {
  const a = Number(from.slice(0, 2));
  const b = Number(to.slice(0, 2)) + 1;
  return `${String(a).padStart(2, '0')}~${String(b).padStart(2, '0')}시`;
}

/** 날짜 칸 개수. 의사가 주는 후보가 보통 두셋이라 넉넉히 다섯 */
export const DATE_SLOTS = 5;

const WD = ['일', '월', '화', '수', '목', '금', '토'];

function weekday(iso: string): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? '' : WD[new Date(t).getUTCDay()];
}

export interface PickForm {
  dates: string[];
  times: string[];
  place: string;
}

export interface PickResult {
  /** 좋은 순 전부. 같은 시주끼리 묶인 것 */
  ranked: PickGroup[];
  /** 날마다 그날의 제일 좋은 때 */
  perDay: PickGroup[];
}

function formSection(form: PickForm): string {
  const slots = Array.from({ length: DATE_SLOTS }, (_, i) => {
    const value = form.dates[i] ?? '';
    return `      <label class="pk-d">
        <span class="pk-dn">후보 ${i + 1}</span>
        <input type="date" name="date" value="${esc(value)}"
          min="2020-01-01" max="2100-12-31"${i === 0 ? ' required' : ''}>
      </label>`;
  }).join('\n');

  const times = TIMES.map((t) => {
    const on = form.times.includes(t);
    return `      <label class="pk-t${on ? ' pk-on' : ''}">
        <input type="checkbox" name="time" value="${t}"${on ? ' checked' : ''}><span>${slotLabel(t)}</span>
      </label>`;
  }).join('\n');

  const places = PLACES.map((p) =>
    `        <option value="${esc(p.name)}"${p.name === form.place ? ' selected' : ''}>${esc(p.name)}</option>`,
  ).join('\n');

  return `<form class="pk-form" method="post" action="/pick">
  <div class="pk-f">
    <p class="pk-l">의사가 된다고 한 날</p>
    <p class="pk-h">받은 후보만 넣으세요. 한 칸만 넣어도 됩니다.</p>
    <div class="pk-dates">
${slots}
    </div>
  </div>

  <div class="pk-f">
    <p class="pk-l">수술이 가능한 시각</p>
    <p class="pk-h">아기가 <strong>나오는</strong> 시간대로 고르세요. 수술을 시작하는 시각이 아닙니다.
    두 시간마다 시주가 바뀌므로 여기서 점수가 크게 갈립니다. 여러 개 골라도 됩니다.</p>
    <div class="pk-times">
${times}
    </div>
  </div>

  <div class="pk-f">
    <p class="pk-l">태어날 곳</p>
    <p class="pk-h">시주는 시계가 아니라 그곳의 해 위치로 정합니다.</p>
    <select name="place">
${places}
    </select>
  </div>

  <button type="submit" class="pk-go">날 골라 보기</button>
</form>`;
}

/** 같은 시주가 이어지면 폭으로 적는다. 고를 수 있는 여지가 그대로 보인다 */
function span(s: PickGroup): string {
  return slotSpan(s.time, s.untilTime);
}

function card(s: PickGroup, rank: number): string {
  const says = s.says.map((t) => `      <li>${esc(t)}</li>`).join('\n');
  return `  <article class="pk-card${rank === 1 ? ' pk-best' : ''}">
    <p class="pk-rank">${rank}순위</p>
    <h3 class="pk-when">${esc(s.date)} (${weekday(s.date)}) ${esc(span(s))}</h3>
    <p class="pk-score"><b>${s.total}</b><span>점 · ${esc(s.band)}</span></p>
    <p class="pk-eight">${esc(s.eight)}</p>
    <ul class="pk-says">
${says}
    </ul>
  </article>`;
}

/**
 * 날을 고르고 나면 반드시 다음 질문이 온다 — 「그래서 이 아이는 어떤 아이가 되는가」.
 * 점수는 언제인지만 말해 주고 거기서 끝난다. 그 다음을 여기서 잇는다.
 *
 * 고른 날을 그대로 적어 넣어 손님이 다시 옮겨 적지 않게 한다.
 */
function nextSection(best: PickGroup): string {
  return `<section class="pk-next">
  <p class="pk-nl">고르고 나면</p>
  <h3>이 아이는 어떤 아이가 될까요</h3>
  <p class="pk-nd"><strong>${esc(best.date)} (${weekday(best.date)}) ${esc(span(best))}</strong>에 태어나면
  여덟 글자는 <b>${esc(best.eight)}</b>입니다.
  이 여덟 글자가 무엇을 말하는지 — 타고난 기질, 무엇을 채워 줘야 하는지,
  언제 크게 바뀌는지 — 를 읽기 쉬운 글로 풀어 드립니다.</p>
  <a class="pk-buy" href="/products/child-report">우리 아이 사주 보기 · 19,900원</a>
  <p class="pk-nh">날 고르는 것은 계속 공짜입니다. 몇 번이든 다시 돌려 보세요.</p>
</section>`;
}

function resultSection(result: PickResult): string {
  if (!result.ranked.length) return '';
  const top = result.ranked.slice(0, 6).map((s, i) => card(s, i + 1)).join('\n');
  const rows = result.perDay.map((s) => `    <tr>
      <td>${esc(s.date)} (${weekday(s.date)})</td>
      <td>${esc(span(s))}</td>
      <td class="pk-n">${s.total}</td>
      <td>${esc(s.band)}</td>
    </tr>`).join('\n');

  return `<section class="pk-out">
  <h2>골라 본 결과</h2>
  <p class="pk-note">점수는 <strong>같은 기간 안에서 견주는 눈금</strong>입니다.
  여덟 글자 중 연주와 월주는 이미 정해져 있어 우리가 고를 수 있는 것은 절반뿐이라,
  100점은 나오지 않습니다. 70점이면 아주 좋은 편입니다.</p>

  <div class="pk-cards">
${top}
  </div>

  <h3 class="pk-sub">날마다 제일 좋은 시각</h3>
  <table class="pk-tb">
    <thead><tr><th>날</th><th>시각</th><th>점수</th><th></th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>

${nextSection(result.ranked[0]!)}

  <p class="pk-warn">이 값은 <strong>의사가 이미 된다고 한 날들 중에서 고른 것</strong>입니다.
  여기서 좋게 나온 날이 의학적으로 괜찮은 날이라는 뜻이 아닙니다.
  산모와 아기의 몸이 먼저입니다.</p>
</section>`;
}

export function renderPickPage(
  info: BusinessInfo, footer: string, form: PickForm, result: PickResult,
): string {
  const site = show(info, 'serviceName', '서비스 이름');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${renderSocialHead(info, {
    title: '제왕절개 택일 — 병원에서 되는 날 중에 고릅니다',
    description: '의사에게 받은 후보 날짜와 수술이 가능한 시각을 넣으면, 그 안에서만 사주로 재서 순위를 냅니다. 계산은 만세력과 절기로 하고, 어떤 기준으로 매긴 점수인지 함께 보여드립니다.',
    path: '/pick',
  })}
${FONT_LINK}
<style>
:root{color-scheme:light}
body{margin:0}
${PRODUCTS_CSS}
${PICK_CSS}
</style>
</head>
<body>
<section class="pr pk">
  <a class="pd-back" href="/">← ${esc(site)}</a>
  <p class="pr-hook">제왕절개 택일</p>
  <h2>병원에서 되는 날 중에 고릅니다</h2>
  <p class="pr-desc">날짜 셋을 적어 주고 끝나는 택일은 병원 일정과 안 맞으면 못 씁니다.
  여기서는 <strong>의사에게 받은 후보와 수술이 가능한 시각을 먼저 받고</strong>, 그 안에서만 잽니다.
  값은 받지 않습니다.</p>

${formSection(form)}
${resultSection(result)}

  <h3 class="pk-sub">어떻게 매기는 점수인가</h3>
  <p class="pk-why">다섯 가지를 봅니다. 어려운 말 옆에 뜻과 예를 같이 적었습니다.</p>
  <ol class="pk-rules">
    <li>
      <p class="pk-rt"><b>치우침</b> — 내 편이 얼마나 되는가</p>
      <p class="pk-rd">여덟 글자 안에는 <strong>나를 도와주는 글자</strong>와
      <strong>나를 밀어내는 글자</strong>가 섞여 있습니다. 이 둘이 반반일 때 제일 좋게 봅니다.</p>
      <p class="pk-re">예 — 여덟 중 일곱이 내 편이면 남의 말을 안 듣습니다.
      하나뿐이면 끌려다닙니다. 넷쯤이 제일 단단합니다.</p>
    </li>
    <li>
      <p class="pk-rt"><b>고름</b> — 다섯 기운이 고르게 있는가</p>
      <p class="pk-rd">기운은 <strong>나무·불·흙·쇠·물</strong> 다섯입니다.
      한쪽에 몰리지 않고 골고루 있을수록 좋게 봅니다.</p>
      <p class="pk-re">예 — 나무 2 불 2 흙 2 쇠 1 물 1이면 고른 편입니다.
      불만 여섯이고 나머지가 거의 없으면 쏠린 것입니다.</p>
    </li>
    <li>
      <p class="pk-rt"><b>빈 기운</b> — 아예 없는 기운이 있는가</p>
      <p class="pk-rd">다섯 중 하나가 <strong>0개</strong>면 점수를 깎습니다.
      없는 기운은 살면서 따로 채워 줘야 합니다.</p>
      <p class="pk-re">예 — 물이 하나도 없으면 쉬는 법과 참는 법을 스스로 익히기 어렵습니다.</p>
    </li>
    <li>
      <p class="pk-rt"><b>부딪힘</b> — 서로 미는 글자가 있는가</p>
      <p class="pk-rd">여덟 글자 중에 <strong>서로 밀어내는 짝</strong>이 있으면 깎습니다.
      한자말로는 충(沖)이라고 합니다.</p>
      <p class="pk-re">예 — 자(子)와 오(午)는 물과 불이라 마주 서면 밉니다.
      이런 짝이 있으면 잘 가다가 한 번씩 뒤집힙니다.</p>
    </li>
    <li>
      <p class="pk-rt"><b>길신</b> — 좋게 쳐 온 짝이 붙는가</p>
      <p class="pk-rd">옛날부터 <strong>좋다고 널리 인정해 온 글자 짝</strong>이 있습니다.
      붙어 있으면 점수를 더합니다.</p>
      <p class="pk-re">예 — 천을귀인은 「어려울 때 도와줄 사람이 나타나는 자리」로 봅니다.
      여기서는 널리 인정되는 것만 세고, 유파마다 갈리는 것은 안 셉니다.</p>
    </li>
  </ol>
  <p class="pr-note">다섯 가지 모두 만세력과 절기 계산에서 그대로 나오는 값입니다.
  지어낸 문장은 없습니다. 절기는 표에서 찾지 않고 태양의 위치를 직접 구합니다.</p>
</section>
${footer}
</body>
</html>`;
}

export const PICK_CSS = `
.pk .pr-desc{margin-bottom:26px}
.pk-form{display:grid;gap:26px;margin:0 0 10px;padding:22px;border:1px solid var(--nb-line);
  background:var(--nb-paper-2)}
/* 테두리와 안쪽 여백까지 칸 너비에 넣는다. 안 그러면 옆 칸을 밀고 들어간다 */
.pk-form input,.pk-form select,.pk-form button{box-sizing:border-box}
.pk-f{display:grid;gap:8px}
.pk-l{margin:0;font-size:11.5px;letter-spacing:.2em;color:var(--nb-gold)}
.pk-h{margin:0 0 4px;font-size:13px;line-height:1.7;color:var(--nb-ink-2);word-break:keep-all}
.pk-dates{display:grid;gap:16px}
.pk-d{display:grid;gap:5px}
.pk-dn{font-size:11.5px;letter-spacing:.1em;color:var(--nb-ink-3)}
.pk-form input[type=date],.pk-form select{width:100%;padding:11px 12px;font:15px var(--nb-sans);
  color:var(--nb-ink);background:var(--nb-paper);border:1px solid var(--nb-line);border-radius:0}
.pk-times{display:flex;flex-wrap:wrap;gap:10px}
.pk-t{display:inline-flex;align-items:center;gap:7px;padding:9px 13px;cursor:pointer;
  border:1px solid var(--nb-line);background:var(--nb-paper);font-size:14px;white-space:nowrap}
.pk-on{border-color:var(--nb-gold);background:var(--nb-paper-2)}
.pk-go{width:100%;padding:15px;border:1px solid var(--nb-ink);background:var(--nb-ink);
  color:var(--nb-paper-2);font:500 15.5px var(--nb-sans);cursor:pointer}
.pk-go:hover{background:transparent;color:var(--nb-ink)}

.pk-out{margin:34px 0 0}
.pk-out h2{margin:0 0 10px}
.pk-note{margin:0 0 18px;font-size:13.5px;line-height:1.85;color:var(--nb-ink-2);word-break:keep-all}
.pk-cards{display:grid;gap:10px}
.pk-card{padding:18px;border:1px solid var(--nb-line-soft);background:var(--nb-paper-2)}
.pk-best{border-color:var(--nb-gold);background:var(--nb-paper)}
.pk-rank{margin:0 0 6px;font-size:11px;letter-spacing:.16em;color:var(--nb-gold)}
.pk-when{margin:0 0 8px;font-family:var(--nb-serif);font-size:19px;font-weight:400}
.pk-score{margin:0 0 8px;display:flex;align-items:baseline;gap:6px}
.pk-score b{font-family:var(--nb-serif);font-size:28px;font-weight:400;color:var(--nb-gold)}
.pk-score span{font-size:13px;color:var(--nb-ink-2)}
.pk-eight{margin:0 0 10px;font-family:var(--nb-serif);font-size:15px;color:var(--nb-ink-2);
  letter-spacing:.06em}
.pk-says{margin:0;padding-left:16px;font-size:13.5px;line-height:1.8;color:var(--nb-ink-2)}
.pk-says li{margin:0 0 4px;word-break:keep-all}
.pk-sub{margin:28px 0 10px;font-family:var(--nb-serif);font-size:17px;font-weight:400}
.pk-tb{width:100%;border-collapse:collapse;font-size:14px}
.pk-tb th{padding:7px 6px;text-align:left;font-weight:400;font-size:11px;letter-spacing:.14em;
  color:var(--nb-ink-3);border-bottom:1px solid var(--nb-line)}
.pk-tb td{padding:10px 6px;border-bottom:1px solid var(--nb-line-soft)}
.pk-tb .pk-n{font-family:var(--nb-serif);font-size:16px;color:var(--nb-gold)}
.pk-next{margin:30px 0 0;padding:22px;border:1px solid var(--nb-gold);background:var(--nb-paper-2)}
.pk-nl{margin:0 0 6px;font-size:11px;letter-spacing:.16em;color:var(--nb-gold)}
.pk-next h3{margin:0 0 10px;font-family:var(--nb-serif);font-size:20px;font-weight:400}
.pk-nd{margin:0 0 16px;font-size:14px;line-height:1.9;color:var(--nb-ink-2);word-break:keep-all}
.pk-nd b{font-family:var(--nb-serif);font-weight:400;letter-spacing:.06em;color:var(--nb-ink)}
.pk-buy{display:block;padding:15px;text-align:center;text-decoration:none;
  border:1px solid var(--nb-ink);background:var(--nb-ink);color:var(--nb-paper-2);
  font:500 15.5px var(--nb-sans)}
.pk-buy:hover{background:transparent;color:var(--nb-ink)}
.pk-nh{margin:12px 0 0;font-size:12.5px;line-height:1.7;color:var(--nb-ink-3)}
.pk-why{margin:0 0 14px;font-size:13.5px;line-height:1.8;color:var(--nb-ink-2)}
.pk-rules{margin:0;padding:0;list-style:none;display:grid;gap:14px;counter-reset:pkr}
.pk-rules li{position:relative;padding:16px 18px 16px 46px;border:1px solid var(--nb-line-soft);
  background:var(--nb-paper-2);counter-increment:pkr}
.pk-rules li::before{content:counter(pkr);position:absolute;left:18px;top:16px;
  font-family:var(--nb-serif);font-size:16px;color:var(--nb-gold)}
.pk-rt{margin:0 0 7px;font-size:15px;color:var(--nb-ink)}
.pk-rt b{font-family:var(--nb-serif);font-weight:400;font-size:17px}
.pk-rd{margin:0 0 7px;font-size:13.5px;line-height:1.85;color:var(--nb-ink-2);word-break:keep-all}
.pk-re{margin:0;padding:9px 12px;border-left:2px solid var(--nb-gold);background:var(--nb-paper);
  font-size:13px;line-height:1.8;color:var(--nb-ink-2);word-break:keep-all}
.pk-warn{margin:22px 0 0;padding:16px;border:1px solid var(--nb-line);background:var(--nb-paper-2);
  font-size:13.5px;line-height:1.85;color:var(--nb-ink-2);word-break:keep-all}

@media (min-width:760px){
  .pk-dates{grid-template-columns:1fr 1fr 1fr}
  .pk-cards{grid-template-columns:1fr 1fr}
}
`;
