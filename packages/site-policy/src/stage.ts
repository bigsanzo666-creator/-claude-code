/**
 * 들어가는 길 — 전체 화면 세 장면.
 *
 * 지금까지 첫 화면은 **길게 스크롤되는 종이 한 장**이었다. 브랜드 소개가 있고,
 * 신령이 있고, 상품이 있고, 그 아래 만세력이 있었다. 다 맞는 말인데
 * 손님은 **어디가 어디인지 모른다.** 「뭘 어떻게 봐야 돼?」로 끝난다.
 *
 * 그래서 들어오는 길을 **한 번에 한 장면씩** 보여 준다. 스크롤은 사주가
 * 나온 뒤부터 한다.
 *
 * 1. **길** — 풍신령이 손을 잡고 문까지 데려간다
 * 2. **문** — 문 앞에 서서 이름·태어난 날·태어난 시를 밝힌다
 * 3. **열림** — 문이 열리고 신령계로 들어간다
 *
 * 광고에서 들어온 손님은 광고에서 이미 1번을 봤다. 그래도 다시 보여 준다 —
 * 광고를 안 보고 주소로 바로 온 손님도 같은 곳에 도착해야 하기 때문이다.
 *
 * ## 덮개이지 대문이 아니다
 *
 * 이 세 장면은 **화면을 덮는 것**이지 페이지를 대신하는 것이 아니다.
 * 아래에는 상품과 가격과 사업자 정보가 그대로 있다.
 *
 * 그래야 카드사 등록심사가 상품과 가격을 볼 수 있고, 검색엔진도 읽는다.
 * 「그냥 둘러보기」를 누르면 덮개가 걷히고 그 화면이 나온다.
 *
 * ## 기다리게 하지 않는다
 *
 * 영상이 없거나 아직 안 받아졌으면 **그 장면을 건너뛴다.** 손님을 검은 화면
 * 앞에 세워 두지 않는다. 자바스크립트가 꺼져 있으면 덮개 자체가 안 뜬다.
 */

import { CATEGORIES, productsIn } from '../../commerce/src/catalog.ts';
import { type BusinessInfo } from './business.ts';
import { type SceneImages, NO_SCENES, sceneUrl } from './gate.ts';
import { SPIRITS, spiritOf, PITCH, type SpiritImages, NO_FACES_SET, spiritImageUrl } from './spirits.ts';

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/** 태어난 시. 12지지를 시각과 함께 — 「인시」만 쓰면 아무도 모른다 */
const HOURS: { value: string; label: string }[] = [
  { value: '', label: '모름 — 시간을 몰라도 됩니다' },
  { value: '00:30', label: '자시 (밤 11:30 ~ 새벽 1:30)' },
  { value: '02:30', label: '축시 (새벽 1:30 ~ 3:30)' },
  { value: '04:30', label: '인시 (새벽 3:30 ~ 5:30)' },
  { value: '06:30', label: '묘시 (아침 5:30 ~ 7:30)' },
  { value: '08:30', label: '진시 (아침 7:30 ~ 9:30)' },
  { value: '10:30', label: '사시 (오전 9:30 ~ 11:30)' },
  { value: '12:30', label: '오시 (낮 11:30 ~ 오후 1:30)' },
  { value: '14:30', label: '미시 (오후 1:30 ~ 3:30)' },
  { value: '16:30', label: '신시 (오후 3:30 ~ 5:30)' },
  { value: '18:30', label: '유시 (저녁 5:30 ~ 7:30)' },
  { value: '20:30', label: '술시 (저녁 7:30 ~ 9:30)' },
  { value: '22:30', label: '해시 (밤 9:30 ~ 11:30)' },
];

export interface StageVideos {
  /** 풍신령이 문까지 데려가는 장면 */
  walk: boolean;
  /** 문이 열리는 장면 */
  open: boolean;
  /**
   * 같은 장면의 webm 한 벌.
   *
   * mp4(H.264) 를 못 여는 브라우저가 아직 있다. 그런 손님에게는 영상이
   * 아예 없는 것과 똑같이 보인다 — 그림 한 장이 가만히 있는 화면.
   * 두 벌을 다 걸어 두면 브라우저가 제가 아는 쪽을 골라 튼다.
   */
  walkWebm?: boolean;
  openWebm?: boolean;
}

export const NO_VIDEOS: StageVideos = { walk: false, open: false };

export function renderStage(
  info: BusinessInfo, scenes: SceneImages = NO_SCENES, videos: StageVideos = NO_VIDEOS,
  faces: SpiritImages = NO_FACES_SET,
): string {
  const hours = HOURS.map((h) =>
    `<option value="${esc(h.value)}">${esc(h.label)}</option>`).join('\n        ');

  // 영상을 받기 전에는 그림이 깔려 있다. 검은 네모를 남기지 않는다
  const path = scenes.has('path') ? ` style="--st-shot:url(${sceneUrl('path')})"` : '';
  const gate = scenes.has('gate') ? ` style="--st-shot:url(${sceneUrl('gate')})"` : '';

  // 첫 화면에서 바로 보이는 영상이다. 자바스크립트가 자리를 잡을 때까지
  // 기다리면 손님은 그림 한 장만 보고 넘어간다. 주소를 여기 박아 두어
  // 브라우저가 화면을 그리면서 같이 받고 같이 튼다
  // mp4 를 먼저 건다. 폰은 mp4(H.264) 를 칩으로 풀어서 덜 뜨겁고 덜 끊긴다.
  // mp4 를 못 여는 브라우저만 아래 webm 으로 내려간다
  const sources = (base: string, webm: boolean) =>
    `
      <source src="${base}" type="video/mp4">` +
    `${webm ? `
      <source src="${base}.webm" type="video/webm">` : ''}`;

  const walk = videos.walk ? `
    <video class="st-vid" id="stWalkVid"
      autoplay muted playsinline preload="auto" aria-hidden="true">${
      sources('/video/gate-walk', !!videos.walkWebm)}
    </video>` : '';
  const open = videos.open ? `
    <video class="st-vid" id="stOpenVid"
      muted playsinline preload="none" aria-hidden="true">${
      sources('/video/gate-open', !!videos.openWebm)}
    </video>` : '';

  return `<div class="stage" id="stage" hidden>

  <section class="st st-on" id="stWalk"${path}>${walk}
    <div class="st-veil"></div>
    <div class="st-in">
      <p class="st-kicker">${esc(info.serviceName || '늘봄사주')}</p>
      <h1 class="st-h">풍신령이<br><em>문까지 데려다</em> 드립니다</h1>
      <button type="button" class="st-next" id="stGo">문 앞으로</button>
    </div>
  </section>

  <section class="st" id="stGate"${gate}>
    <div class="st-veil st-veil-2"></div>
    <div class="st-in">
      <p class="st-kicker">신령계 들어가는 문</p>
      <h2 class="st-h">문을 열려면<br><em>이름을 밝히셔야</em> 합니다</h2>
      <p class="st-sub">밝히신 것은 이 자리에서만 씁니다.
      어디로도 보내지 않고, 저장하지도 않습니다.</p>

      <form class="st-form" id="stForm" novalidate>
        <label class="st-f">
          <span class="st-l">이름</span>
          <input type="text" id="stName" maxlength="10" autocomplete="name" placeholder="홍길동">
        </label>
        <label class="st-f">
          <span class="st-l">태어난 날</span>
          <input type="date" id="stDate" min="1900-01-01" max="2100-12-31" required>
        </label>
        <label class="st-f st-wide">
          <span class="st-l">태어난 시</span>
          <select id="stHour">
        ${hours}
          </select>
        </label>
        <div class="st-bar">
          <button type="submit" class="st-go">문을 엽니다</button>
          <span class="st-msg" id="stMsg" role="status"></span>
        </div>
      </form>

      <button type="button" class="st-skip" id="stSkip">밝히지 않고 그냥 둘러보기</button>
    </div>
  </section>

  <section class="st" id="stOpen">${open}
    <div class="st-in st-mid">
      <p class="st-open-t">문이 열립니다</p>
    </div>
  </section>

  <div class="st-ask" id="stLeave" hidden>
    <div class="st-ask-box" role="dialog" aria-modal="true" aria-labelledby="stLeaveT">
      <p class="st-ask-t" id="stLeaveT">신령계를 나가시겠습니까</p>
      <p class="st-ask-b">나가시면 밝히신 것도 함께 사라집니다.
      다시 오시려면 처음부터 밝히셔야 합니다.</p>
      <div class="st-ask-bar">
        <button type="button" class="st-stay" id="stStay">더 볼래요</button>
        <button type="button" class="st-leave" id="stLeaveGo">나갈래요</button>
      </div>
    </div>
  </div>

${renderWorld(scenes, faces)}
${SPIRITS.map((sp) => renderSpiritStage(sp, scenes, faces)).join('\n')}
</div>`;
}

/**
 * 신령계 — 누구에게 물을지 고르는 화면.
 *
 * 상품 스물다섯 개를 늘어놓으면 아무도 못 고른다. **사람 일곱**이면 고른다.
 * 손님은 상품 이름이 아니라 「내가 지금 누구한테 물어봐야 하지」로 고른다.
 *
 * 맨 위에는 **무료 사주**를 크게 건다. 이미 태어난 날을 받았으므로 볼 것이
 * 이미 있다. 값을 묻기 전에 먼저 주는 것이 순서다.
 */
/**
 * 신령들이 서 있는 자리.
 *
 * 배경 그림(`신령계`) 안의 장소와 **같은 자리**여야 한다. 그림에는 기와집이
 * 왼쪽 위에 있는데 산신령이 오른쪽 아래에 서 있으면 지도가 아니라 그냥
 * 그림 위에 얹은 단추다.
 *
 * 값은 그림 가로·세로에 대한 %다. 그림을 새로 뽑으면 **여기 숫자만 고친다.**
 * 배경 프롬프트(`docs/scene-prompts.md`)에 같은 자리를 못 박아 두었다.
 */
const SPOTS: Record<string, { x: number; y: number }> = {
  // 신령계.jpg 안의 장소 자리에 맞춘 값이다. 그림을 새로 뽑으면 여기만 고친다
  mountain: { x: 21, y: 17 },   // 왼쪽 위 — 산자락 기와집
  wind: { x: 79, y: 15 },       // 오른쪽 위 — 누각 처마와 풍경
  flower: { x: 21, y: 34 },     // 왼쪽 — 복사꽃 나무
  thread: { x: 82, y: 36 },     // 오른쪽 — 붉은 실 걸린 나무
  mirror: { x: 50, y: 50 },     // 가운데 — 맑은 샘
  jar: { x: 20, y: 66 },        // 왼쪽 아래 — 곳간과 항아리
  moon: { x: 79, y: 70 },       // 오른쪽 아래 — 달 비친 연못
  // 돌길 한가운데. 셋을 겹쳐 보는 신령이라 어느 터에도 치우치지 않는다
  cross: { x: 50, y: 26 },      // 가운데 위 — 돌계단 길
};

/**
 * 신령계 — 누구에게 물을지 고르는 화면.
 *
 * 격자로 늘어놓으면 그냥 목록이다. **배경 그림 위에 신령을 자리마다 세운다.**
 * 손님은 상품 이름이 아니라 「저기 저 사람한테 물어볼까」로 고른다.
 *
 * 맨 아래에 **무료 사주**를 걸어 둔다. 값을 묻기 전에 먼저 주는 것이 순서다.
 */
function renderWorld(scenes: SceneImages, faces: SpiritImages): string {
  const shot = scenes.has('world') ? ` style="--st-shot:url(${sceneUrl('world')})"` : '';
  const pins = SPIRITS.map((sp) => {
    const at = SPOTS[sp.id] ?? { x: 50, y: 50 };
    return `      <button type="button" class="wd-pin" data-sp="${esc(sp.id)}"
        style="left:${at.x}%;top:${at.y}%" aria-label="${esc(sp.name)} — ${esc(sp.keeps)}">
        ${stageFace(sp.id, sp.seal, faces, 72)}
        <span class="wd-tag"><b>${esc(sp.name)}</b><i>${esc(sp.keeps)}</i></span>
      </button>`;
  }).join('\n');

  return `  <section class="st" id="stWorld"${shot}>
    <div class="st-map">
${pins}
    </div>
    <div class="wd-bottom">
      <p class="st-kicker" id="stHello">신령계</p>
      <h2 class="st-h wd-h">누구에게 <em>물어보시겠습니까</em></h2>
      <button type="button" class="wd-free" id="stFree">
        <span class="wd-free-t">먼저, 무료로 보는 내 사주</span>
        <span class="wd-free-go">공짜로 보기 →</span>
      </button>
    </div>
${renderPeeks(faces)}
  </section>`;
}

/**
 * 신령을 눌렀을 때 **그 자리에서** 나와 말을 거는 판.
 *
 * 전에는 누르는 순간 화면이 통째로 넘어갔다. 그러면 손님은 뭘 봐 주는
 * 곳인지도 모르고 들어갔다가, 아니면 뒤로 나와야 한다. 그 한 번이
 * 손님을 잃는 자리다.
 *
 * 그래서 화면은 그대로 두고 **신령만 앞으로 나온다.** 자기가 무엇을 봐
 * 주는지 손님 말로 세 줄 말하고, 그래도 보겠다고 하면 그때 들어간다.
 *
 * 여덟 개를 다 그려서 감춰 둔다. 누를 때 서버에 다시 묻지 않으므로
 * 손가락을 대는 순간 바로 뜬다 — 기다림이 0이다.
 */
function renderPeeks(faces: SpiritImages): string {
  return SPIRITS.map((sp) => {
    const asks = productsIn(sp.keeps).slice(0, 3)
      .map((p) => `        <li>${esc(p.hook)}</li>`).join('\n');
    return `    <div class="wd-peek" id="wdPeek-${esc(sp.id)}" hidden>
      <div class="wd-peek-in" role="dialog" aria-label="${esc(sp.name)}">
        ${stageFace(sp.id, sp.seal, faces, 96)}
        <p class="st-kicker">${esc(sp.name)} · ${esc(sp.place)}</p>
        <p class="wd-peek-say">${esc(sp.greet)}</p>
        <p class="wd-peek-l">이런 것을 봐 준다</p>
        <ul class="wd-peek-list">
${asks}
        </ul>
        <button type="button" class="wd-peek-go" data-peek-go="${esc(sp.id)}">
          ${esc(sp.name)}에게 물어보기
        </button>
        <button type="button" class="wd-peek-x" data-peek-x="1">다른 신령 볼래요</button>
      </div>
    </div>`;
  }).join('\n');
}

/**
 * 신령 하나의 판 — 무엇을 볼지 고르는 화면.
 *
 * 값은 여기서 말하지 않는다. 아직 뭘 봐 주는지도 모르는 사람에게 계산부터
 * 시키면 물러선다. 값은 고르고 들어간 화면에서 본다.
 */
function renderSpiritStage(
  sp: (typeof SPIRITS)[number], scenes: SceneImages, faces: SpiritImages,
): string {
  const shot = scenes.has(sp.id) ? ` style="--st-shot:url(${sceneUrl(sp.id)})"` : '';
  const question = CATEGORIES.find((c) => c.key === sp.keeps)?.question ?? '';
  /*
   * 고르는 칸.
   *
   * `<a>` 가 아니라 `<button>` 이다 — 누르면 **화면을 떠나지 않고** 그
   * 자리에서 신령이 한 조각 봐 준다. 값을 보러 가는 것은 그다음이다.
   *
   * 그래도 주소(`data-href`)를 들고 있다. 자바스크립트가 꺼져 있으면
   * 아래 `<noscript>` 의 링크가 그대로 남으므로 손님이 못 하게 되는
   * 일은 없고, 카드사 심사와 검색엔진도 상품과 값을 볼 수 있다.
   */
  const items = productsIn(sp.keeps).map((p) => `      <button type="button" class="sp-item"
        data-taste="${esc(p.id)}" data-href="/products/${encodeURIComponent(p.id)}">
        <span class="sp-shot" style="--sp-pic:url(/img/products/${encodeURIComponent(p.id)})"></span>
        <span class="sp-hook">${esc(p.hook)}</span>
        <span class="sp-name">${esc(p.name)}</span>
      </button>`).join('\n');

  const plain = productsIn(sp.keeps).map((p) =>
    `      <a href="/products/${encodeURIComponent(p.id)}">${esc(p.name)}</a>`).join('\n');

  return `  <section class="st st-scroll" id="stSp-${esc(sp.id)}"${shot}>
    <div class="st-veil st-veil-3"></div>
    <div class="st-page">
      <button type="button" class="st-back" data-back="1">← 신령계로</button>
      <div class="sp-top">
        ${stageFace(sp.id, sp.seal, faces, 84)}
        <div>
          <p class="st-kicker">${esc(sp.name)} · ${esc(sp.place)}</p>
          <h2 class="st-h sp-q">${esc(question)}</h2>
        </div>
      </div>
      <p class="st-sub">${esc(sp.greet)}</p>

      <!--
        신령과 주고받는 자리.

        여기가 없으면 손님은 「홈페이지가 설명해 주는」 화면을 본다. 신령을
        눌러 들어왔는데 또 표가 나오면, 신령은 그냥 그림이 된다.
        그래서 신령이 먼저 말을 걸고, 손님이 답하고, 신령이 되묻는다.

        자바스크립트가 꺼져 있으면 이 칸은 통째로 안 보이고 아래 목록만
        남는다 — 손님이 못 하게 되는 일은 없다.
      -->
      <div class="tk" id="tk-${esc(sp.id)}" data-sp="${esc(sp.id)}" hidden>
        <div class="tk-log" role="log" aria-live="polite"></div>
        <form class="tk-row">
          <label class="tk-l" for="tk-in-${esc(sp.id)}">${esc(sp.name)}에게 물어보기</label>
          <input class="tk-in" id="tk-in-${esc(sp.id)}" type="text" maxlength="300"
            autocomplete="off" placeholder="여기에 쓰시면 ${esc(sp.name)}이 답합니다">
          <button class="tk-go" type="submit">묻기</button>
        </form>
        <p class="tk-note">${esc(sp.name)}이 하는 말은 손님의 사주에서 나온 것입니다.
        몸·죽음·투자·법으로 다투는 일은 답하지 않습니다.</p>
      </div>

      <!--
        신령이 「무엇부터 보고 싶으냐」 하고 내미는 것.

        예전에는 여기가 상품 목록이었다. 신령을 눌러 들어왔는데 표가
        나오면 신령은 그냥 그림이 된다.

        이제 큰 칸으로 내민다. 고르면 **그 자리에서 한 조각 봐 준다** —
        값을 받기 전에 먼저 주는 것이 순서다.

        칸마다 3~5초 영상이 들어갈 자리를 만들어 뒀다. 영상이 없으면
        상품 그림으로 돌고, 올리면 자동으로 영상으로 바뀐다. 그 영상은
        그대로 인스타·틱톡·네이버 클립 소재가 된다.
      -->
      <p class="sp-l" id="spAsk-${esc(sp.id)}">무엇부터 보시겠습니까</p>
      <div class="sp-list">
${items}
      </div>
      <noscript><div class="sp-plain">
${plain}
      </div></noscript>
    </div>
  </section>`;
}

/** 얼굴 그림이 없으면 한자 도장으로 자리를 지킨다 */
function stageFace(id: string, seal: string, faces: SpiritImages, size: number): string {
  if (!faces.has(id)) {
    return `<span class="st-face st-seal" aria-hidden="true">${esc(seal)}</span>`;
  }
  return `<span class="st-face"><img src="${spiritImageUrl(id)}" alt=""
    width="${size}" height="${size}" loading="lazy" decoding="async"></span>`;
}

/**
 * 들어가는 길 스타일.
 *
 * 색은 새로 만들지 않는다. 상품 화면이 정해 둔 `--nb-*` 를 그대로 쓴다.
 * 높이는 `100dvh` 를 쓴다 — 폰에서 주소창이 접혔다 펴질 때 `100vh` 는
 * 화면 아래가 잘린다.
 */
export const STAGE_CSS = `
.stage{position:fixed;inset:0;z-index:80;background:var(--nb-paper);
  font:16px/1.75 var(--nb-sans);color:var(--nb-ink)}
.stage[hidden]{display:none}
/* 덮개가 떠 있는 동안 뒤 화면은 움직이지 않는다 */
body.st-locked{overflow:hidden}

.st{position:absolute;inset:0;display:none;overflow:hidden;
  background:var(--nb-paper) center top/cover no-repeat;background-image:var(--st-shot,none)}
.st.st-on{display:block}
.st-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  opacity:0;transition:opacity .5s ease}
.st-vid.on{opacity:1}
.st-veil{position:absolute;inset:0;background:
  linear-gradient(to bottom,var(--nb-veil-0),var(--nb-veil-0) 34%,var(--nb-paper) 92%)}
.st-veil-2{background:
  linear-gradient(to bottom,var(--nb-veil-0),var(--nb-veil-1) 17%,var(--nb-paper) 33%)}

.st-in{position:absolute;left:0;right:0;bottom:0;padding:0 24px 34px;
  max-width:560px;margin:0 auto;box-sizing:border-box}
.st-mid{top:0;display:grid;place-items:center;padding:0}
.st-kicker{margin:0 0 12px;font-size:12px;letter-spacing:.26em;color:var(--nb-gold)}
.st-h{font-family:var(--nb-serif);font-weight:500;font-size:27px;line-height:1.55;
  letter-spacing:-.01em;word-break:keep-all;margin:0 0 12px}
.st-h em{font-style:normal;color:var(--nb-gold)}
.st-sub{margin:0 0 22px;font-size:14.5px;line-height:1.8;color:var(--nb-ink-2);
  max-width:26em;word-break:keep-all}
.st-open-t{font-family:var(--nb-serif);font-size:19px;letter-spacing:.24em;color:var(--nb-gold)}

.st-form{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.st-f{display:block;min-width:0}
.st-wide{grid-column:1/-1}
.st-l{display:block;margin:0 0 6px;font-size:12px;letter-spacing:.16em;color:var(--nb-gold)}
.st-f input,.st-f select{width:100%;box-sizing:border-box;padding:13px;
  font:16px/1.4 var(--nb-sans);color:var(--nb-ink);background:var(--nb-paper-2);
  border:1px solid var(--nb-line);border-radius:0;appearance:none}
.st-f input:focus,.st-f select:focus{outline:2px solid var(--nb-gold);outline-offset:-2px}
.st-bar{grid-column:1/-1;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.st-go,.st-next{padding:15px 32px;border:1px solid var(--nb-ink);background:var(--nb-ink);
  color:var(--nb-paper-2);font:500 15.5px var(--nb-sans);letter-spacing:.02em;cursor:pointer}
.st-go:hover,.st-next:hover{background:transparent;color:var(--nb-ink)}
/* 글 아래에 그대로 붙는다. 화면 구석에 따로 떠 있으면 넓은 화면에서 글자를 덮는다 */
.st-next{margin:10px 0 0}
.st-msg{font-size:13.5px;color:var(--nb-gold)}
.st-skip{display:block;margin:16px 0 0;padding:0;border:0;background:none;
  font:13px var(--nb-sans);color:var(--nb-ink-3);text-decoration:underline;
  text-underline-offset:3px;cursor:pointer}

/* 신령계·신령 판은 안에서 조금 움직일 수 있다. 뒤 화면으로 넘어가는 스크롤이 아니라
   이 화면 안에서만 도는 것이다 */
.st-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch}
.st-page{position:relative;padding:34px 24px 40px;max-width:720px;margin:0 auto;
  min-height:100%;box-sizing:border-box}
.st-veil-3{background:linear-gradient(to bottom,var(--nb-veil-1),var(--nb-paper) 30%);
  position:fixed}

.st-face{display:block;width:64px;height:64px;border-radius:50%;overflow:hidden;
  background:var(--nb-paper-2);border:1px solid var(--nb-line-soft);flex:0 0 auto}
.st-face img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 15%}
.st-seal{display:grid;place-items:center;font-family:var(--nb-serif);font-size:26px;
  color:var(--nb-gold)}

/* 신령계 — 배경 그림 위에 신령이 자리마다 서 있다 */
#stWorld{background-position:center;background-size:cover}
.st-map{position:absolute;inset:0}
.wd-pin{position:absolute;transform:translate(-50%,-50%);display:grid;justify-items:center;
  gap:5px;padding:0;border:0;background:none;cursor:pointer;font:inherit;color:inherit;
  animation:wdFloat 5.5s ease-in-out infinite alternate}
.wd-pin:nth-child(2n){animation-duration:6.5s}
.wd-pin:nth-child(3n){animation-duration:7.5s}
@keyframes wdFloat{from{transform:translate(-50%,-50%)}to{transform:translate(-50%,calc(-50% - 7px))}}
.wd-pin .st-face{width:54px;height:54px;
  box-shadow:0 0 0 1px var(--nb-paper-2),0 6px 18px rgba(0,0,0,.28)}
.wd-pin .st-seal{font-size:21px}
.wd-pin:hover .st-face,.wd-pin:focus-visible .st-face{border-color:var(--nb-gold);
  box-shadow:0 0 0 2px var(--nb-gold),0 6px 18px rgba(0,0,0,.28)}
.wd-tag{display:grid;justify-items:center;padding:3px 9px;background:var(--nb-veil-1);
  backdrop-filter:blur(2px)}
.wd-tag b{font-family:var(--nb-serif);font-weight:500;font-size:13px;white-space:nowrap}
.wd-tag i{font-style:normal;font-size:10.5px;letter-spacing:.12em;color:var(--nb-gold)}

/* 제목을 아래에 둔다. 위에 두면 그림 위쪽의 기와집과 누각을 덮는다.
   지도가 주인공이고 글자는 그 아래에서 거든다 */
.wd-h{font-size:21px;margin:0 0 14px;line-height:1.4;word-break:keep-all;
  max-width:520px;margin-left:auto;margin-right:auto}
.wd-bottom{position:absolute;left:0;right:0;bottom:0;padding:56px 20px 22px;
  background:linear-gradient(to top,var(--nb-paper) 44%,var(--nb-veil-1) 76%,var(--nb-veil-0))}
.wd-bottom .st-kicker{max-width:520px;margin:0 auto 8px}
.wd-free{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;
  max-width:520px;margin:0 auto;padding:15px 20px;border:1px solid var(--nb-gold);
  background:var(--nb-paper-2);cursor:pointer;font:inherit;color:inherit;text-align:left}
.wd-free:hover{background:var(--nb-paper)}
.wd-free-t{font-family:var(--nb-serif);font-size:16.5px;word-break:keep-all}
.wd-free-go{font-size:13.5px;color:var(--nb-gold);white-space:nowrap}

@media (prefers-reduced-motion:reduce){ .wd-pin{animation:none} }

/* 나가시겠습니까 */
.st-ask{position:absolute;inset:0;z-index:10;display:grid;place-items:center;padding:24px;
  background:rgba(0,0,0,.42)}
.st-ask[hidden]{display:none}
.st-ask-box{width:100%;max-width:360px;padding:26px 24px;background:var(--nb-paper-2);
  border:1px solid var(--nb-gold);box-sizing:border-box}
.st-ask-t{margin:0 0 10px;font-family:var(--nb-serif);font-size:20px}
.st-ask-b{margin:0 0 20px;font-size:14px;line-height:1.8;color:var(--nb-ink-2);word-break:keep-all}
.st-ask-bar{display:flex;gap:10px}
.st-stay,.st-leave{flex:1;padding:13px 10px;font:500 15px var(--nb-sans);cursor:pointer;
  border:1px solid var(--nb-ink)}
.st-stay{background:var(--nb-ink);color:var(--nb-paper-2)}
.st-leave{background:none;color:var(--nb-ink-3);border-color:var(--nb-line)}

/* 신령 하나의 판 */
.st-back{margin:0 0 20px;padding:0;border:0;background:none;cursor:pointer;
  font:13.5px var(--nb-sans);color:var(--nb-gold)}
.sp-top{display:flex;align-items:center;gap:14px;margin:0 0 14px}
.sp-q{font-size:24px;margin:0}
/* 신령이 내미는 칸 — 표가 아니라 고르는 것이라 크게 둔다 */
.sp-l{margin:26px 0 12px;font-size:11.5px;letter-spacing:.2em;color:var(--nb-gold)}
.sp-list{display:grid;gap:12px}
.sp-item{display:block;width:100%;padding:0 0 16px;text-align:left;cursor:pointer;
  color:inherit;background:var(--nb-paper-2);border:1px solid var(--nb-line-soft);
  border-radius:0;overflow:hidden;font:inherit}
.sp-item:hover,.sp-item:focus-visible{border-color:var(--nb-gold)}
/* 그림·영상 자리. 없으면 종이색 한 칸으로 남는다 — 검은 네모를 안 만든다 */
.sp-shot{display:block;aspect-ratio:16/9;margin:0 0 14px;
  background:var(--nb-paper) var(--sp-pic) center/cover no-repeat}
.sp-vid{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;margin:0 0 14px}
.sp-hook{display:block;padding:0 16px;font-size:12.5px;color:var(--nb-gold);margin-bottom:5px}
.sp-item .sp-name{display:block;padding:0 16px;font-family:var(--nb-serif);font-size:18px;
  line-height:1.45;word-break:keep-all}
.sp-plain{display:grid;gap:10px;margin-top:20px}
.sp-plain a{color:var(--nb-ink);font-size:15px}

/* 고른 칸 안에서 신령이 그 자리에서 봐 주는 말 */
.sp-taste{padding:16px;margin:0 16px;border-top:1px solid var(--nb-line-soft);
  font-size:14.5px;line-height:1.9;word-break:keep-all;cursor:auto}
.sp-taste p{margin:0 0 10px}
.sp-taste p:last-of-type{margin-bottom:0}
.sp-taste-more{margin:14px 0 0;padding-top:14px;border-top:1px dashed var(--nb-line);
  font-family:var(--nb-serif);font-size:15px;color:var(--nb-gold);line-height:1.75}
.sp-buy{display:block;width:100%;margin:14px 0 0;padding:14px;text-align:center;
  text-decoration:none;border:1px solid var(--nb-ink);background:var(--nb-ink);
  color:var(--nb-paper-2);font:500 15px var(--nb-sans)}
.sp-buy:hover{background:transparent;color:var(--nb-ink)}
@media (prefers-color-scheme:dark){
  .sp-buy{background:var(--nb-gold);border-color:var(--nb-gold);color:#131A26}
  .sp-buy:hover{background:transparent;color:var(--nb-gold)}
}

/* 신령을 누르면 그 자리에서 앞으로 나오는 판 */
.wd-peek{position:absolute;inset:0;z-index:12;display:grid;place-items:center;padding:22px;
  background:var(--nb-veil-1)}
.wd-peek[hidden]{display:none}
.wd-peek-in{width:100%;max-width:340px;padding:24px 22px 20px;text-align:center;
  background:var(--nb-paper-2);border:1px solid var(--nb-line);
  animation:wdRise .28s ease both}
@keyframes wdRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.wd-peek-in .st-face{width:96px;height:96px;margin:0 auto 14px}
.wd-peek-say{margin:8px 0 18px;font-family:var(--nb-serif);font-size:17px;line-height:1.7;
  word-break:keep-all}
.wd-peek-l{margin:0 0 8px;font-size:11.5px;letter-spacing:.2em;color:var(--nb-gold)}
.wd-peek-list{margin:0 0 20px;padding:0;list-style:none;display:grid;gap:7px}
.wd-peek-list li{font-size:14px;line-height:1.6;color:var(--nb-ink-2);word-break:keep-all}
.wd-peek-list li::before{content:'· '}
.wd-peek-go{display:block;width:100%;padding:15px;border:1px solid var(--nb-ink);
  background:var(--nb-ink);color:var(--nb-paper-2);font:500 15.5px var(--nb-sans);cursor:pointer}
.wd-peek-go:hover{background:transparent;color:var(--nb-ink)}
.wd-peek-x{display:block;width:100%;margin:12px 0 0;padding:0;border:0;background:none;
  font:13px var(--nb-sans);color:var(--nb-ink-3);text-decoration:underline;
  text-underline-offset:3px;cursor:pointer}
@media (prefers-color-scheme:dark){
  .wd-peek-go{background:var(--nb-gold);border-color:var(--nb-gold);color:#131A26}
  .wd-peek-go:hover{background:transparent;color:var(--nb-gold)}
}
@media (prefers-reduced-motion:reduce){ .wd-peek-in{animation:none} }

/* 신령과 주고받는 자리 */
.tk{margin:0 0 22px}
.tk[hidden]{display:none}
.tk-log{display:grid;gap:10px;margin:0 0 14px}
.tk-say{padding:13px 15px;font-size:14.5px;line-height:1.85;word-break:keep-all;
  border:1px solid var(--nb-line-soft);background:var(--nb-paper-2)}
/* 신령의 말은 왼쪽, 손님의 말은 오른쪽. 누가 한 말인지 한눈에 갈린다 */
.tk-me{justify-self:end;max-width:82%;background:var(--nb-ink);color:var(--nb-paper-2);
  border-color:var(--nb-ink)}
.tk-ask{display:block;margin:8px 0 0;color:var(--nb-gold);font-family:var(--nb-serif);font-size:15.5px}
.tk-wait{color:var(--nb-ink-3);font-style:italic}
.tk-row{display:flex;gap:8px;align-items:stretch}
.tk-l{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.tk-in{flex:1 1 auto;min-width:0;padding:13px;font:16px/1.4 var(--nb-sans);
  color:var(--nb-ink);background:var(--nb-paper-2);border:1px solid var(--nb-line);
  border-radius:0;appearance:none}
.tk-in:focus{outline:2px solid var(--nb-gold);outline-offset:-2px}
.tk-go{flex:0 0 auto;padding:0 20px;border:1px solid var(--nb-ink);background:var(--nb-ink);
  color:var(--nb-paper-2);font:500 15px var(--nb-sans);cursor:pointer}
.tk-go:hover{background:transparent;color:var(--nb-ink)}
.tk-go[disabled]{opacity:.45;cursor:default}
.tk-note{margin:10px 0 0;font-size:12px;line-height:1.7;color:var(--nb-ink-3);word-break:keep-all}
@media (prefers-color-scheme:dark){
  .tk-me{background:var(--nb-gold);border-color:var(--nb-gold);color:#131A26}
  .tk-go{background:var(--nb-gold);border-color:var(--nb-gold);color:#131A26}
  .tk-go:hover{background:transparent;color:var(--nb-gold)}
}

@media (min-width:760px){
  /* 그림과 영상이 전부 세로(784x1168)다. 넓은 화면에서 가로로 늘려 자르면
     신령이 화면 밖으로 밀려나고, 신령계 지도의 자리도 그림과 어긋난다.
     그래서 화면 가운데에 같은 비율의 세로 칸을 두고 그 안에서만 그린다 */
  .st{left:50%;right:auto;transform:translateX(-50%);
    width:min(100%,calc(100dvh * 784 / 1168))}
  .st-h{font-size:34px}
  .wd-pin .st-face{width:72px;height:72px}
  .wd-tag b{font-size:14.5px}
  .wd-h{font-size:27px}
  .st-page{padding:56px 24px}
  .st-in{padding-bottom:52px}
}
@media (prefers-color-scheme:dark){
  .st-go,.st-next{background:var(--nb-gold);border-color:var(--nb-gold);color:#131A26}
  .st-go:hover,.st-next:hover{background:transparent;color:var(--nb-gold)}
}`;

/**
 * 들어가는 손놀림.
 *
 * 세 장면을 넘기고, 밝힌 것을 아래 만세력 칸에 옮겨 담고, 덮개를 걷는다.
 * **여기서 계산하지 않는다** — 계산은 이미 조각 안에 있고, 두 곳에서
 * 계산하면 언젠가 두 값이 달라진다.
 */
export const STAGE_SCRIPT = `<script>(function(){
  var stage=document.getElementById('stage');
  if(!stage)return;
  var $=function(id){return document.getElementById(id);};
  var c=navigator.connection;
  /*
   * 영상을 버리는 조건은 **데이터를 아끼는 손님** 하나뿐이다.
   *
   * 예전에는 「화면 움직임 줄이기」를 켠 손님에게도 영상을 버렸다.
   * 그런데 그 설정은 윈도우·맥에서 흔하게 켜져 있고, 켜져 있으면
   * 크롬이든 엣지든 전부 그림 한 장만 뜬다 — 우리 화면에서 제일 중요한
   * 장면이 통째로 사라진다. 이 영상은 장식이 아니라 **내용**이다.
   * 저 혼자 도는 장식(떠다니는 신령 표)은 CSS 에서 따로 멈춘다.
   */
  var thin=!!(c&&(c.saveData||/2g/.test(c.effectiveType||'')));

  // 자바스크립트가 살아 있을 때만 덮개를 세운다.
  // 꺼져 있으면 지금까지의 화면이 그대로 남는다 — 손님이 못 하게 되는 일은 없다
  stage.hidden=false;
  document.body.classList.add('st-locked');

  var show=function(id){
    var all=stage.querySelectorAll('.st');
    for(var i=0;i<all.length;i++)all[i].classList.remove('st-on');
    var el=$(id); if(el)el.classList.add('st-on');
  };

  // 영상은 뒤에서 받아 둔다. 첫 화면이 뜨는 것을 늦추지 않는다.
  // 그래서 **화질을 깎지 않는다.** 손님이 이름을 치는 동안 다 받아지므로
  // 몇 MB 를 아끼려고 흐린 영상을 보여 줄 이유가 없다
  var pull=function(v,onReady){
    if(!v||thin)return;
    var done=false;
    // canplaythrough 만 기다리면 끝까지 받아질 때까지 그림 한 장으로 머문다.
    // 첫 그림이 준비되는 순간(canplay) 바로 보여 주고 재생한다
    var ready=function(){
      if(done)return; done=true;
      v.classList.add('on');
      if(onReady)onReady();
    };
    var go=function(){
      v.preload='auto';
      v.addEventListener('loadeddata',ready);
      v.addEventListener('canplay',ready);
      v.addEventListener('canplaythrough',ready);
      v.load();
    };
    if('requestIdleCallback' in window)requestIdleCallback(go,{timeout:600});
    else setTimeout(go,200);
  };
  var walk=$('stWalkVid'), open=$('stOpenVid');
  var openReady=false;
  pull(open,function(){openReady=true;});

  if(walk){
    if(thin){
      // 데이터를 아끼는 손님에게는 그림 한 장만 남긴다
      walk.removeAttribute('autoplay');
      while(walk.firstChild)walk.removeChild(walk.firstChild);
      walk.load();
    } else {
      var lit=function(){ walk.classList.add('on'); };
      walk.addEventListener('loadeddata',lit);
      walk.addEventListener('canplay',lit);
      walk.addEventListener('playing',lit);
      if(walk.readyState>=2)lit();
      // 브라우저가 저절로 틀지 않는 경우가 있다. 몇 번 더 눌러 본다
      var kick=function(){ if(walk.paused)walk.play().catch(function(){}); };
      kick();
      setTimeout(kick,400); setTimeout(kick,1500);
      addEventListener('pointerdown',kick,{once:true});
      addEventListener('keydown',kick,{once:true});
      document.addEventListener('visibilitychange',function(){
        if(!document.hidden)kick();
      });
    }
  }

  // 길 → 문. 영상이 끝나면 저절로, 안 끝나도 단추로 넘어간다
  var atGate=false;
  var toGate=function(){
    if(atGate)return; atGate=true;
    if(walk){try{walk.pause();}catch(e){}}
    mark('stGate');
    show('stGate');
    var d=$('stDate'); if(d&&d.focus)setTimeout(function(){d.focus();},200);
  };
  if(walk)walk.addEventListener('ended',toGate,{once:true});
  var go=$('stGo'); if(go)go.addEventListener('click',toGate);
  /*
   * 영상이 아직 안 받아졌다고 **넘겨 버리지 않는다.**
   *
   * 넘겨 버리면 좋은 영상이 있어도 폰에서는 거의 안 보인다. 그렇다고
   * 다 받을 때까지 붙들면 손님이 기다린다.
   *
   * 그래서 **그림을 먼저 깔고 단추를 준다.** 손님은 언제든 「문 앞으로」를
   * 눌러 갈 수 있고, 그동안 영상이 다 받아지면 조용히 겹쳐 재생된다.
   * 기다리는 사람도 없고, 화질을 깎을 이유도 없다.
   *
   * 영상을 아예 못 받는 경우(데이터 절약·느린 연결)에는 그림 한 장만 남는다.
   */

  var put=function(id,v){
    var el=$(id); if(!el)return false;
    el.value=v;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  };

  var leave=function(){
    stage.hidden=true;
    document.body.classList.remove('st-locked');
  };

  // 문이 열리면 신령계로. 덮개는 그대로 있고 장면만 바뀐다 —
  // 신령계와 신령 판도 전체 화면이다. 스크롤은 글을 읽을 때부터다
  var told=false;
  var toWorld=function(name){
    if(name){ var h=$('stHello'); if(h)h.textContent=name+'님, 신령계에 드셨습니다'; }
    mark('stWorld');
    show('stWorld');
    var w=$('stWorld'); if(w)w.scrollTop=0;
  };

  // 덮개를 걷고 글을 읽는 곳으로. 여기서부터가 스크롤이다
  var read=function(id){
    mark('read');
    leave();
    if(typeof window.NB_SKIP_WIZARD==='function')window.NB_SKIP_WIZARD();
    var to=document.getElementById(id)||document.getElementById('products');
    if(to)setTimeout(function(){to.scrollIntoView({behavior:'smooth',block:'start'});},60);
  };

  var skip=$('stSkip');
  if(skip)skip.addEventListener('click',function(){toWorld('');});

  /**
   * 뒤로가기.
   *
   * 폰에서 뒤로가기는 손님이 제일 많이 누르는 단추다. 그런데 우리 화면은
   * 주소가 안 바뀌므로, 그냥 두면 **한 번에 사이트가 꺼진다.**
   * 잘못 눌러 들어온 손님이 신령 하나 보고 나가 버린다.
   *
   * 그래서 장면을 옮길 때마다 **되돌아올 자리를 하나씩 쌓아 둔다.**
   * 뒤로가기는 그 자리를 하나씩 되짚고, 더 되짚을 곳이 없을 때에만
   * 「나가시겠습니까」를 묻는다.
   */
  var back=[];                 // 되돌아갈 장면 이름들
  var here='stWalk';
  var asking=false;

  var mark=function(name){
    if(name===here)return;
    // 길(들어오는 영상)로는 되돌아가지 않는다. 이미 본 영상을 또 보여 주는 것은
    // 되돌아가는 것이 아니라 붙잡는 것이다
    if(here!=='stWalk')back.push(here);
    here=name;
    history.pushState({nb:back.length},'',location.href);
  };

  var ask=function(on){
    var box=$('stLeave');
    if(!box)return;
    asking=on;
    box.hidden=!on;
    if(on)history.pushState({nbAsk:1},'',location.href);
  };

  var stay=$('stStay');
  if(stay)stay.addEventListener('click',function(){ ask(false); });
  var out=$('stLeaveGo');
  if(out)out.addEventListener('click',function(){
    // 정말 나가겠다면 막지 않는다. 붙잡는 것은 한 번이면 족하다
    ask(false); back=[]; here='';
    history.back();
  });

  // 처음 한 자리를 깔아 둔다. 이게 없으면 첫 뒤로가기가 곧바로 사이트를 닫는다
  history.pushState({nb:0},'',location.href);
  addEventListener('popstate',function(){
    if(asking){ ask(false); return; }
    // 신령이 앞에 나와 있으면, 뒤로가기는 그 판만 닫는다
    if(peeking){ closePeek(); return; }
    if(!here){ return; }          // 나가기로 한 손님은 그냥 보낸다
    if(back.length){
      var to=back.pop();
      here=to;
      if(stage.hidden){ stage.hidden=false; document.body.classList.add('st-locked'); }
      show(to);
      history.pushState({nb:back.length},'',location.href);
      return;
    }
    ask(true);
  });

  var free=$('stFree');
  if(free)free.addEventListener('click',function(){
    read(told?'out':'products');
  });

  /*
   * 신령을 누르면 **화면은 그대로 두고 신령만 앞으로 나온다.**
   *
   * 누르자마자 화면을 통째로 넘기면, 손님은 뭘 봐 주는 곳인지도 모르고
   * 들어갔다가 아니면 뒤로 나와야 한다. 그 한 번에 손님을 잃는다.
   */
  var peeking=null;
  var closePeek=function(){
    if(!peeking)return;
    var box=$('wdPeek-'+peeking); if(box)box.hidden=true;
    peeking=null;
  };
  var openPeek=function(id){
    var box=$('wdPeek-'+id); if(!box)return;
    closePeek();
    box.hidden=false; peeking=id;
    var go=box.querySelector('.wd-peek-go'); if(go&&go.focus)go.focus();
    // 뒤로가기 한 번에 이 판만 닫히게, 자리를 하나 만들어 둔다
    history.pushState({nb:'peek'},'',location.href);
  };
  var enter=function(id){
    closePeek();
    mark('stSp-'+id); show('stSp-'+id);
    var s=$('stSp-'+id); if(s)s.scrollTop=0;
    openTalk(id);
  };

  stage.addEventListener('click',function(e){
    var pin=e.target.closest('.wd-pin');
    if(pin){ openPeek(pin.dataset.sp); return; }
    var go=e.target.closest('[data-peek-go]');
    if(go){ enter(go.dataset.peekGo); return; }
    if(e.target.closest('[data-peek-x]')){ history.back(); return; }
    if(e.target.closest('[data-back]')){ history.back(); }
  });

  /* ─── 신령과 주고받기 ────────────────────────────────────────────
   *
   * 손님이 신령을 누르면 그 신령이 먼저 말을 건다. 손님이 답하면 신령이
   * 받아서 답하고 되묻는다. 세 번까지 공짜다.
   *
   * 사주 계산은 **여기서 한다** — 만세력 조각이 이미 이 화면에 실려 있다.
   * 서버로는 계산 결과(어떤 사람인가)만 간다. 생년월일은 안 보낸다.
   */
  var told2={};   // 신령마다 몇 번 주고받았는가
  var logs={};    // 신령마다 지금까지 주고받은 말

  function facts(){
    var name=($('stName')&&$('stName').value.trim())||'';
    var date=$('stDate')&&$('stDate').value;
    var hour=$('stHour')&&$('stHour').value;
    var out={name:name,dayStem:'',dayElement:'',eight:'',strong:false,
      topGod:'',lackGod:'',topElement:'',lackElement:'',timeKnown:!!hour};
    if(!date||!window.MS||!MS.calculate||!MS.analyze)return out;
    try{
      var ms=MS.calculate({date:date,time:hour||null});
      var an=MS.analyze(ms);
      var ps=[ms.year,ms.month,ms.day,ms.hour];
      out.eight=ps.filter(Boolean).map(function(x){return x.stem+x.branch;}).join(' ');
      out.dayStem=ms.day.stem;
      out.dayElement=an.dayMaster.element;
      out.strong=an.strength.verdict==='신강';
      var g=an.godCounts, keys=Object.keys(g);
      keys.sort(function(a,b){return g[b]-g[a];});
      out.topGod=keys[0]||'';
      out.lackGod=(an.missingGroups&&an.missingGroups[0])||keys[keys.length-1]||'';
      var el=(an.elements||[]).slice().sort(function(a,b){return b.weight-a.weight;});
      out.topElement=(el[0]&&el[0].element)||'';
      out.lackElement=(an.missingElements&&an.missingElements[0])||'';
    }catch(err){ /* 못 재면 신령은 아는 것 없이 말한다 */ }
    return out;
  }

  function bubble(box,who,text,ask){
    var d=document.createElement('div');
    d.className='tk-say'+(who==='me'?' tk-me':'');
    d.textContent=text;
    if(ask){ var a=document.createElement('b'); a.className='tk-ask'; a.textContent=ask;
      d.appendChild(a); }
    box.appendChild(d);
    return d;
  }

  function post2(url,body,done,fail){
    fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)})
      .then(function(r){ return r.ok?r.json():Promise.reject(r); })
      .then(done)['catch'](fail);
  }
  function post(body,done,fail){ post2('/api/talk',body,done,fail); }

  function openTalk(id){
    var box=$('tk-'+id); if(!box||box.dataset.on)return;
    box.dataset.on='1'; box.hidden=false;
    var log=box.querySelector('.tk-log');
    logs[id]=[]; told2[id]=0;
    var w=bubble(log,'sp','','');
    w.className='tk-say tk-wait'; w.textContent='…';
    post({spirit:id,facts:facts()},function(r){
      w.className='tk-say'; w.textContent=r.text;
      logs[id].push({who:'spirit',text:r.text});
    },function(){ w.remove(); });
  }

  /*
   * 칸을 고르면 **그 자리에서 신령이 한 조각 봐 준다.**
   *
   * 화면을 떠나 값부터 보여 주면, 아직 뭘 봐 주는지도 모르는 사람에게
   * 계산부터 시키는 것이다. 먼저 주고, 그다음에 값을 본다.
   *
   * 한 번 받아 온 것은 그대로 둔다. 다시 누르면 접혔다 펴진다 —
   * 같은 것을 서버에 두 번 묻지 않는다.
   */
  stage.addEventListener('click',function(e){
    var item=e.target.closest('[data-taste]'); if(!item)return;
    if(e.target.closest('.sp-taste'))return;   // 풀이 안을 누른 것은 넘긴다
    var had=item.querySelector('.sp-taste');
    if(had){ had.hidden=!had.hidden; return; }

    var box=document.createElement('div');
    box.className='sp-taste';
    box.textContent='…';
    item.appendChild(box);

    post2('/api/taste',{product:item.dataset.taste,facts:facts()},function(r){
      box.textContent='';
      (r.lines||[]).forEach(function(t){
        var p=document.createElement('p'); p.textContent=t; box.appendChild(p);
      });
      if(r.more){
        var m=document.createElement('p'); m.className='sp-taste-more'; m.textContent=r.more;
        box.appendChild(m);
      }
      var go=document.createElement('a');
      go.className='sp-buy'; go.href=item.dataset.href; go.textContent='자세히 보기';
      box.appendChild(go);
      box.scrollIntoView({block:'nearest',behavior:'smooth'});
    },function(){
      // 못 받아 오면 값을 보러 갈 길은 그대로 열어 둔다
      box.textContent='';
      var go=document.createElement('a');
      go.className='sp-buy'; go.href=item.dataset.href; go.textContent='자세히 보기';
      box.appendChild(go);
    });
  });

  stage.addEventListener('submit',function(e){
    var form=e.target.closest('.tk-row'); if(!form)return;
    e.preventDefault();
    var box=form.closest('.tk'), id=box.dataset.sp;
    var input=form.querySelector('.tk-in'), go=form.querySelector('.tk-go');
    var text=input.value.trim(); if(!text)return;
    var log=box.querySelector('.tk-log');
    bubble(log,'me',text,'');
    logs[id].push({who:'guest',text:text});
    input.value=''; input.disabled=true; go.disabled=true;
    var w=bubble(log,'sp','…','');
    w.className='tk-say tk-wait';
    var turn=told2[id]||0;
    post({spirit:id,facts:facts(),ask:text,history:logs[id],turn:turn},function(r){
      w.className='tk-say'; w.textContent=r.text;
      if(r.ask){ var a=document.createElement('b'); a.className='tk-ask'; a.textContent=r.ask;
        w.appendChild(a); }
      logs[id].push({who:'spirit',text:r.text});
      told2[id]=turn+1;
      if(r.close){
        bubble(log,'sp',r.close,'');
        form.remove();
      } else {
        input.disabled=false; go.disabled=false; input.focus();
      }
      box.scrollIntoView({block:'nearest'});
    },function(){
      w.className='tk-say'; w.textContent='지금은 답을 못 하겠구나. 잠시 뒤에 다시 물어 주렴.';
      input.disabled=false; go.disabled=false;
    });
  });

  var f=$('stForm');
  if(f)f.addEventListener('submit',function(e){
    e.preventDefault();
    var name=$('stName').value.trim();
    var date=$('stDate').value;
    var hour=$('stHour').value;
    if(!date){ $('stMsg').textContent='태어난 날을 알려 주세요.'; return; }
    put('date',date);
    if(name)put('name',name);
    var noTime=document.getElementById('notime');
    if(hour){ put('time',hour); if(noTime&&noTime.checked){noTime.checked=false;
      noTime.dispatchEvent(new Event('change',{bubbles:true}));} }
    else if(noTime&&!noTime.checked){ noTime.checked=true;
      noTime.dispatchEvent(new Event('change',{bubbles:true})); }

    told=true;
    // 문이 열리는 장면. 못 틀거나 오래 걸리면 기다리지 않고 그냥 들어간다
    if(!open||!openReady){ toWorld(name); return; }
    show('stOpen');
    var went=false, once=function(){ if(went)return; went=true; toWorld(name); };
    open.addEventListener('ended',once,{once:true});
    open.addEventListener('error',once,{once:true});
    setTimeout(once,5000);
    var p=open.play(); if(p&&p.catch)p.catch(once);
  });
})();</script>`;
