/**
 * 「왜 늘봄이냐」 판.
 *
 * 우리는 실제로 절기를 천문식으로 풀고, 표준자오선 이력과 서머타임까지 넣어
 * 시주를 세우고, 얼굴·손금까지 겹쳐 본다. 그런데 **사이트에 그 말이 한 줄도
 * 없었다.** 손님이 보기에 우리는 「사주 봐 주는 데」 중 하나일 뿐이었다.
 *
 * ## 지어내지 않는다
 *
 * 여기 적는 것은 전부 이 저장소의 코드가 실제로 하는 일이다.
 *   - 네 층      `saju-rules/src/index.ts` — 계산은 규칙, 서술만 모델
 *   - 절기 계산   `manseryeok/src/astro.ts` — VSOP87 절단 급수, 오차 약 25초
 *   - 진태양시    `manseryeok/src/timezone.ts` — 자오선 이력 4구간, 서머타임 12회
 *   - 교차검증    `saju-rules/src/crossValidate.ts` — 일치·엇갈림·단독
 *   - 사진        `physiognomy`·`palmistry` — 브라우저 안에서만 잰다
 * 코드가 바뀌면 이 문장도 함께 바꾼다. 없는 자랑을 지어 붙이지 않는다.
 */

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/** 층 하나 — 무엇을 하고, 누가 하는가 */
export interface Layer {
  floor: string;
  name: string;
  does: string;
  /** 규칙이 하는가, 모델이 하는가 */
  by: '규칙' | 'AI';
  image: string;
  side: '왼쪽' | '오른쪽';
}

export const LAYERS: readonly Layer[] = [
  { floor: '1층', name: '명식', does: '태어난 때로 여덟 글자를 세웁니다', by: '규칙', image: 'why-layer-1.jpg', side: '왼쪽' },
  { floor: '2층', name: '파생', does: '십신·지장간·합충·신살을 뽑습니다', by: '규칙', image: 'why-layer-2.jpg', side: '왼쪽' },
  { floor: '3층', name: '해석', does: '강약을 재고 무엇을 채울지 정합니다', by: '규칙', image: 'why-layer-3.jpg', side: '왼쪽' },
  { floor: '4층', name: '글', does: '그것을 읽기 쉬운 말로 풀어냅니다', by: 'AI', image: 'why-layer-4.jpg', side: '왼쪽' },
] as const;

export interface Claim {
  head: string;
  body: string;
  image: string;
  side: '왼쪽' | '오른쪽';
}

/**
 * 우리가 실제로 하는 것들.
 *
 * 순서는 손님이 궁금해하는 순서다 — 맞느냐(계산), 언제 태어난 걸로 보느냐(시주),
 * 사주만 보느냐(교차), 내 사진은 어디 가느냐(비밀).
 */
export const CLAIMS: readonly Claim[] = [
  {
    head: '절기를 표에서 찾지 않고 계산합니다',
    body: '태양의 위치를 그때그때 직접 구합니다. 절기 절입시각의 오차는 약 25초입니다. ' +
      '표를 박아 두면 표에 없는 해에서 무너지지만, 계산은 1900년생도 2100년생도 같은 식으로 세웁니다.',
    image: 'why-claim-1.jpg',
    side: '왼쪽',
  },
  {
    head: '시주는 시계가 아니라 해로 정합니다',
    body: '한국의 표준자오선은 두 번 바뀌었고 서머타임은 열두 차례 시행됐습니다. ' +
      '그 이력과 태어난 곳의 경도를 넣어 진태양시(실제 태양 위치로 잰 시각)로 시주를 세웁니다. ' +
      '이걸 빼면 어떤 해에 태어난 사람은 시주가 통째로 어긋납니다.',
    image: 'why-claim-2.jpg',
    side: '왼쪽',
  },
  {
    head: '사주만 보지 않습니다 — 얼굴과 손금을 겹칩니다',
    body: '셋을 나란히 놓기만 하면 「그래서 뭐가 맞냐」에서 멈춥니다. ' +
      '늘봄은 항목마다 셋을 대조해 일치·엇갈림·단독으로 나눕니다. ' +
      '엇갈리는 자리를 숨기지 않습니다 — 타고난 것과 지금 사는 모습이 다른 지점이 거기입니다.',
    image: 'why-claim-3.jpg',
    side: '오른쪽',
  },
  {
    head: '얼굴과 손 사진은 이 기기 밖으로 나가지 않습니다',
    body: '사진은 브라우저 안에서만 재고 곧바로 지웁니다. 서버로 보내지 않고, 저장하지도 않습니다. ' +
      '생년월일도 마찬가지로 이 화면에서만 씁니다.',
    image: 'why-claim-4.jpg',
    side: '왼쪽',
  },
] as const;

/**
 * 판 하나를 그린다.
 *
 * 값도 상품도 말하지 않는다. 여기서 하는 일은 「이 집 계산을 믿어도 되는가」에
 * 답하는 것뿐이다.
 */
export function renderWhy(): string {
  const layers = LAYERS.map((l) => `  <li class="why-card why-f why-card-${l.side === '오른쪽' ? 'right' : 'left'}">
    <div class="why-card-bg" style="background-image:url('/img/why/${esc(l.image)}')"></div>
    <div class="why-scrim"></div>
    <div class="why-card-body">
      <div class="why-f-top">
        <b class="why-n">${esc(l.floor)}</b>
        <i class="why-by${l.by === 'AI' ? ' why-ai' : ''}">${esc(l.by)}</i>
      </div>
      <div class="why-d"><em>${esc(l.name)}</em><span>${esc(l.does)}</span></div>
    </div>
  </li>`).join('\n');

  const claims = CLAIMS.map((c) => `  <article class="why-card why-c why-card-${c.side === '오른쪽' ? 'right' : 'left'}">
    <div class="why-card-bg" style="background-image:url('/img/why/${esc(c.image)}')"></div>
    <div class="why-scrim"></div>
    <div class="why-card-body">
      <h4>${esc(c.head)}</h4>
      <p>${esc(c.body)}</p>
    </div>
  </article>`).join('\n');

  return `<section class="why" id="why">
<p class="why-cat">늘봄이 다른 점</p>
<h3 class="why-q">AI한테 물어본 거랑 뭐가 다릅니까</h3>
<p class="why-hero">그럴듯한 문장과 계산된 값은<br>같은 것이 아닙니다</p>
<p class="why-b">AI에 사주를 물으면 그 자리에서 글을 지어냅니다.
계산을 하는 게 아니라 그럴듯한 문장을 만드는 것이라, 같은 것을 두 번 물으면 답이 달라집니다.</p>

<p class="why-l">늘봄은 네 층으로 봅니다</p>
<ol class="why-stack why-grid">
${layers}
</ol>
<p class="why-b">계산은 전부 규칙이 합니다. 모델은 그 결과를 읽기 쉬운 말로 옮기기만 합니다.
그래서 <strong>같은 여덟 글자면 언제 보아도 같은 답</strong>이 나옵니다.</p>

<div class="why-grid">
${claims}
</div>
</section>`;
}

export const WHY_CSS = `
/*
 * 「왜 늘봄이냐」 판.
 *
 * 자랑을 늘어놓는 자리가 아니라 **의심에 답하는 자리**다. 그래서 제일 큰
 * 글씨가 우리 이름이 아니라 손님의 의심("AI랑 뭐가 다른데")이다.
 */
.why{margin:56px 0 0;padding:34px 0 0;border-top:1px solid var(--nb-line)}
.why-cat{margin:0 0 8px;font-family:var(--nb-sans);font-size:26px;font-weight:700;
  letter-spacing:-.01em;color:var(--nb-gold)}
.why-q{margin:0 0 18px;font-family:var(--nb-sans);font-size:19px;font-weight:600;
  line-height:1.5;word-break:keep-all}
.why-hero{margin:0 0 16px;padding:20px 18px;border:1px solid var(--nb-line);
  background:var(--nb-paper-2);text-align:center;font-family:var(--nb-sans);
  font-size:19px;font-weight:600;line-height:1.6;word-break:keep-all}
.why-b{margin:0 0 22px;font-size:16px;line-height:1.85;color:var(--nb-ink-2);
  word-break:keep-all}
.why-b strong{color:var(--nb-ink);font-weight:600}
.why-l{margin:26px 0 12px;font-size:14px;letter-spacing:.2em;color:var(--nb-gold)}

/* 네 층 & 네 약속 카드 그리드 */
.why-stack{margin:0 0 20px;padding:0;list-style:none}
.why-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}

.why-card{position:relative;overflow:hidden;min-height:210px;display:flex;flex-direction:column;
  justify-content:flex-end;box-sizing:border-box;border:1px solid var(--nb-line-soft);
  background:var(--nb-paper-2);border-radius:8px}
.why-card-bg{position:absolute;top:0;left:0;width:100%;height:100%;background-size:cover;
  background-position:center;filter:none;pointer-events:none;border-radius:8px;z-index:1}
.why-scrim{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;border-radius:8px;z-index:2}
.why-card-body{position:relative;z-index:3;padding:24px 22px;display:flex;flex-direction:column;
  justify-content:flex-start;box-sizing:border-box;width:100%}

/* side에 따른 그늘 및 정렬 — 글씨가 앉는 자리만 어둡게 하고 나머지는 사진이 살아 있게 */
.why-card-left .why-scrim{background:linear-gradient(to right,rgba(6,5,10,.94) 0%,rgba(6,5,10,.82) 36%,rgba(6,5,10,.25) 65%,transparent 88%)}
.why-card-left .why-card-body{align-items:flex-start;text-align:left}

.why-card-right .why-scrim{background:linear-gradient(to left,rgba(6,5,10,.94) 0%,rgba(6,5,10,.82) 36%,rgba(6,5,10,.25) 65%,transparent 88%)}
.why-card-right .why-card-body{align-items:flex-start;text-align:left}

@media (max-width:600px){
  .why-card-left .why-scrim, .why-card-right .why-scrim{
    background:linear-gradient(to top,rgba(6,5,10,.96) 0%,rgba(6,5,10,.82) 45%,rgba(6,5,10,.2) 75%,transparent 95%);
  }
}

/* 층 카드 세부 요소 */
.why-f-top{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.why-n{font-size:16px;letter-spacing:.08em;color:var(--nb-gold);font-weight:700;text-shadow:0 2px 12px rgba(0,0,0,.9)}
.why-by{font-style:normal;font-size:14px;letter-spacing:.1em;padding:4px 9px;
  border:1px solid var(--nb-line);color:var(--nb-ink);border-radius:4px;background:rgba(0,0,0,.65);text-shadow:0 2px 12px rgba(0,0,0,.9);font-weight:600}
.why-ai{border-color:var(--nb-gold);color:var(--nb-gold)}
.why-d{font-size:15px;line-height:1.75;color:var(--nb-ink-2);word-break:keep-all;text-shadow:0 2px 12px rgba(0,0,0,.9)}
.why-d em{display:block;font-style:normal;font-family:var(--nb-sans);font-size:18px;
  font-weight:700;color:var(--nb-ink);margin-bottom:4px;text-shadow:0 2px 12px rgba(0,0,0,.9)}

/* 약속 카드 세부 요소 */
.why-c h4{margin:0 0 10px;font-family:var(--nb-sans);font-size:18px;font-weight:700;
  line-height:1.45;color:var(--nb-ink);word-break:keep-all;text-shadow:0 2px 12px rgba(0,0,0,.9)}
.why-c p{margin:0;font-size:15px;line-height:1.75;color:var(--nb-ink-2);word-break:keep-all;text-shadow:0 2px 12px rgba(0,0,0,.9)}

@media (min-width:760px){
  .why-cat{font-size:30px}
  .why-q{font-size:21px}
  .why-hero{font-size:23px;padding:28px 24px}
}
`;
