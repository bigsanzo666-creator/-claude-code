/**
 * 신령들.
 *
 * 지금까지 이 집에는 **주인이 없었다.** 상품 스물한 개가 표처럼 늘어서 있고,
 * 설명은 다 맞는 말인데 말을 거는 사람이 아무도 없었다. 그런 가게에서는
 * 아무도 지갑을 안 연다 — 설명만 있는 곳은 누구나 만들 수 있다.
 *
 * 그래서 갈래마다 **신령을 한 명씩 앉힌다.** 손님이 「연애」 칸에 오면
 * 도화신령이 나와서 말을 걸고, 「가족」 칸에 오면 산신령이 나와서 말을 건다.
 * 상품을 파는 것은 이제 표가 아니라 사람(신령)이다.
 *
 * 세 가지를 지킨다.
 *
 * **1. 신령은 없는 말을 하지 않는다.** 신령의 말은 그 상품이 실제로 하는 일을
 *    쉬운 말로 바꾼 것뿐이다. 「맞춰 드립니다」 같은 말은 안 한다.
 *
 * **2. 여덟 살이 알아듣는 말만 쓴다.** 신령이 어려운 말을 하면 신령이 아니라
 *    그냥 또 하나의 설명문이다.
 *
 * **3. 그림이 없어도 말은 나온다.** 얼굴 그림은 나중에 붙는다. 그림이 없는
 *    동안에는 한자 도장 한 글자가 얼굴 자리를 대신한다 — 빈 네모를 남기지 않는다.
 */

import { type Category } from '../../commerce/src/catalog.ts';

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

export interface Spirit {
  /** 파일 이름과 주소에 쓰는 영문 아이디 */
  id: string;
  /** 손님에게 보이는 이름 */
  name: string;
  /** 얼굴 그림이 없을 때 얼굴 자리에 찍는 한 글자 */
  seal: string;
  /** 이 신령이 맡은 갈래 */
  keeps: Category;
  /** 손에 들고 다니는 것. 그림을 그릴 때도 이 물건이 기준이 된다 */
  holds: string;
  /** 신령계에서 이 신령이 서 있는 곳. 배경 그림 이름과 같다 */
  place: string;
  /**
   * 예전에 쓰던 이름.
   *
   * 이름을 바꿔도 **이미 올려 둔 그림 파일은 옛 이름**이다. 그것까지 알아듣게
   * 남겨 둔다. 이름 한 번 고칠 때마다 그림을 다시 올리게 하면 안 된다.
   */
  aka?: string[];
  /** 갈래 맨 위에서 손님에게 거는 말 */
  greet: string;
  /** 첫 화면 소개 줄. 한 줄로 자기가 무엇을 보는지 말한다 */
  intro: string;
  /**
   * 얼굴 그림에서 어디를 동그랗게 잘라 낼지.
   *
   * 그림마다 구도가 다르게 나온다 — 어떤 것은 세로로 길고 얼굴이 크고, 어떤 것은
   * 정사각형에 얼굴이 작다. **그림을 다시 뽑는 대신 여기 숫자를 고친다.**
   *
   * - `zoom` 몇 배로 당길지 (1 = 그대로)
   * - `down` 당긴 뒤 얼마나 내릴지 (원 지름 대비 %)
   *
   * 둘 다 없으면 세로로 긴 그림 기준으로 위쪽을 잡는다.
   */
  crop?: { zoom: number; down: string };
}

/**
 * 신령들.
 *
 * 순서는 상품 갈래 순서와 같다. 앞이 손님이 많이 들어오는 입구다.
 *
 * **몇 명인지를 다른 곳에 적지 않는다.** 화면은 이 배열의 길이를 세어 쓴다 —
 * 한때 「신령 일곱이 삽니다」가 여덟일 때도 열일 때도 그대로 나갔다.
 */
/** 하나부터 열둘까지 우리말로. 화면에 숫자를 손으로 적지 않기 위한 것이다 */
export function countWord(n: number): string {
  const W = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열', '열하나', '열둘'];
  return W[n] ?? String(n);
}

export const SPIRITS: Spirit[] = [
  {
    id: 'flower', name: '도화신령', seal: '桃', aka: ['꽃신령'], keeps: '연애', place: '꽃터',
    holds: '복사꽃 가지',
    greet: '누구한테 마음이 가는지, 내가 꽃가지로 짚어 줄게.',
    intro: '마음이 어느 쪽으로 기우는지 봅니다.',
    crop: { zoom: 1.55, down: '16%' },
  },
  {
    id: 'moon', name: '월신령', seal: '月', aka: ['달신령'], keeps: '재회', place: '달터',
    holds: '물에 비친 둥근 달',
    greet: '떠난 사람은 물에 비친 달 같아. 그래도 하늘에 달은 남아 있지.',
    intro: '지나간 사람이 돌아올 자리가 있는지 봅니다.',
    // 정사각형에 얼굴이 작게 들어온 그림. 얼굴부터 달 윗부분까지만 당겨 쓴다
    crop: { zoom: 2.5, down: '66%' },
  },
  {
    id: 'thread', name: '연신령', seal: '緣', aka: ['실신령'], keeps: '궁합', place: '실터',
    holds: '붉은 실타래',
    greet: '두 사람 사이에 실이 몇 가닥 걸렸는지, 내가 세어 줄게.',
    intro: '두 사람을 이은 실이 튼튼한지 봅니다.',
    crop: { zoom: 1.7, down: '34%' },
  },
  {
    id: 'mountain', name: '산신령', seal: '山', keeps: '가족', place: '산터',
    holds: '지팡이와 곁에 앉은 호랑이',
    greet: '이 집 일은 내가 제일 오래 봤단다. 앉아 보렴.',
    intro: '집안 사람들 사이를 봅니다.',
    crop: { zoom: 1.55, down: '26%' },
  },
  {
    id: 'name', name: '작명신령', seal: '名', aka: ['이름신령'],
    keeps: '작명', place: '붓터',
    holds: '먹과 붓, 그리고 이름책',
    greet: '이름은 평생 입고 살 옷이야. 아이에게 딱 맞는 고운 이름을 지어 줄게.',
    intro: '평생 불릴 귀하고 고운 이름을 짓습니다.',
    crop: { zoom: 1.55, down: '26%' },
  },
  {
    id: 'birth', name: '삼신할매', seal: '三', aka: ['삼신'],
    keeps: '출산', place: '삼신터',
    holds: '새 생명을 품은 흰 타래실과 포대기',
    greet: '아이고 내 새끼 오느라 고생했다. 가장 복된 날에 곱게 안아 줄 테니 걱정 말거라.',
    intro: '아이와 엄마가 모두 편안한 복된 날을 고릅니다.',
    crop: { zoom: 1.55, down: '26%' },
  },
  {
    id: 'mirror', name: '명경신령', seal: '鏡', aka: ['거울신령'], keeps: '나', place: '거울터',
    holds: '오래된 청동 거울',
    greet: '거울은 안 속여. 네가 진짜 어떤 사람인지 비춰 줄게.',
    intro: '내가 어떤 사람인지 있는 그대로 비춥니다.',
    crop: { zoom: 1.55, down: '26%' },
  },
  {
    /*
     * 삼합신령 — 세 가지를 겹쳐 보는 신령.
     *
     * 사주는 태어날 때 정해진 것, 관상은 얼굴에 드러난 것, 손금은 살면서
     * 새겨진 것이다. 세 가지를 **같이** 보는 곳은 우리뿐이다. 그런데 그동안
     * 이 상품 넷이 명경신령 칸에 섞여 있어서, 우리가 제일 잘하는 것이
     * 스물다섯 개 중 하나로 보였다.
     *
     * 三合은 사주에서 실제로 쓰는 말이다 — 셋이 모여 하나가 된다는 뜻.
     * 뜻도 맞고, 손님이 들으면 진짜 있는 말처럼 들린다.
     */
    id: 'cross', name: '삼합신령', seal: '三', keeps: '삼합', place: '삼합터',
    holds: '실 세 가닥이 하나로 꼬인 매듭',
    greet: '사주는 타고난 것, 얼굴은 드러난 것, 손금은 살아온 것이야. 셋을 겹쳐야 네가 보여.',
    intro: '사주·관상·손금 셋을 겹쳐서 봅니다.',
    // 그림에서 얼굴이 작게 들어왔다. 다른 신령들과 얼굴 크기를 맞춘다
    crop: { zoom: 1.95, down: '30%' },
  },
  {
    id: 'jar', name: '재신령', seal: '財', aka: ['곳간신령'], keeps: '돈과 일', place: '곳간터',
    holds: '엽전 자루와 곡식 됫박',
    greet: '네 그릇이 얼마나 큰지 됫박으로 달아 볼게. 그릇보다 많이 담으면 넘쳐.',
    intro: '돈이 담기는 그릇 크기와 일자리를 봅니다.',
    crop: { zoom: 1.45, down: '22%' },
  },
  {
    id: 'wind', name: '풍신령', seal: '風', aka: ['바람신령'], keeps: '시기', place: '바람터',
    holds: '처마 끝 풍경(風磬)',
    greet: '바람이 불면 종이 울려. 지금 울리는지 같이 들어 보자.',
    intro: '지금이 움직일 때인지 봅니다.',
    crop: { zoom: 1.5, down: '24%' },
  },
];

/** 갈래로 신령을 찾는다. 갈래가 늘어나 신령이 없으면 그냥 없이 간다 */
export function spiritOf(category: Category): Spirit | null {
  return SPIRITS.find((s) => s.keeps === category) ?? null;
}

/** 상품 아이디로 그 상품을 파는 신령을 찾는다 */
export function spiritFor(category: Category): Spirit | null {
  return spiritOf(category);
}

/**
 * 신령이 상품 하나를 두고 하는 말.
 *
 * 스물한 개 전부 손으로 썼다. 틀로 찍으면 「○○를 봐 드립니다」가 스물한 번
 * 반복되고, 그건 신령이 아니라 다시 표다.
 *
 * 없는 상품은 말없이 넘어간다 — 상품이 늘 때마다 여기를 채우면 되고,
 * 안 채웠다고 화면이 깨지지는 않는다.
 */
export const PITCH: Record<string, string> = {
  // 도화신령 — 연애
  'charm-report': '네가 어디가 예쁜지는 내가 첫눈에 알아. 얼굴하고 손금까지 같이 보고 말해 줄게.',
  'single-report': '꽃은 아무 때나 피지 않아. 네 꽃이 피는 달이 언제인지 세어 줄게.',
  'marriage-timing-report': '서두르면 꽃이 진다. 언제가 좋은 때인지 짚어 줄게.',

  // 월신령 — 재회
  'reunion-report': '물에 비친 달은 못 잡아. 그래도 하늘에 달이 남았는지는 내가 봐 줄게.',
  'letgo-report': '달도 기울었다가 다시 찬다. 네 마음이 가벼워지는 때가 언제인지 짚어 줄게.',

  // 연신령 — 궁합
  'compat-report': '두 사람한테 걸린 실을 다 세어 볼게. 어느 가닥이 튼튼하고 어느 가닥이 끊어질 실인지.',
  'crush-compat-report': '아직 실이 한 가닥이구나. 이어질 실인지 아닌지만 빨리 봐 줄게.',

  // 산신령 — 가족
  'child-report': '아이는 나무 같단다. 어떤 나무로 태어났는지 알아야 물을 얼마나 줄지 알지.',
  'child-aptitude-report': '밤나무한테 사과가 열리라고 하면 안 되지. 이 아이한테 뭐가 열리는지 봐 주마.',
  'parent-child-report': '부딪히는 건 누가 나빠서가 아니야. 두 사람 자리가 어긋난 거지. 어디가 어긋났는지 짚어 주마.',
  'latelife-report': '산은 내려올 때가 더 어렵다. 남은 길에 무엇을 챙겨야 하는지 말해 주마.',

  // 작명신령 — 작명
  'naming-report': '이름은 평생 입고 살 귀한 옷이야. 아이 사주에 꼭 맞고 소리까지 고운 이름으로 지어 줄게. 마음에 들 때까지 써 보자.',
  'naming-plus-report': '예쁜 이름이라도 너무 흔하면 아쉽지. 사주 기운은 꽉 채우면서 요즘 흔한 이름은 쏙 빼고 지어 줄게.',

  // 삼신할매 — 출산
  'pick-report': '어린 생명이 세상에 첫발을 딛는 날이란다. 의사 선생님이 된다고 한 날 중에, 아이 앞길이 제일 활짝 열릴 복된 날로 골라 주마.',

  // 명경신령 — 나
  'saju-report': '네가 어떤 사람으로 태어났는지, 여덟 글자를 다 펴서 보여 줄게.',
  'cross-report': '거울 하나로는 뒤통수를 못 봐. 사주하고 얼굴하고 손금, 거울 세 개를 같이 볼게.',
  'expression-report': '네가 진짜 잘하는 건 따로 있어. 그게 뭔지 비춰 줄게.',
  'peers-report': '사람 때문에 힘든 데는 자리가 있어. 네 자리가 어딘지 보여 줄게.',
  'helper-report': '널 도울 사람이 어느 쪽에서 오는지, 거울에 비친다.',
  'face-palm-report': '태어난 날을 몰라도 된다. 얼굴하고 손바닥, 그 둘만 있으면 봐 줄게.',
  'saju-palm-report': '태어날 때 정해진 것과 살면서 새겨진 것. 그 둘이 같은 말을 하는지 보자.',
  'saju-face-report': '속은 사주에 있고 겉은 얼굴에 있어. 둘이 얼마나 떨어져 있는지 재 줄게.',

  // 재신령 — 돈과 일
  'wealth-report': '네 그릇이 얼마나 큰지 됫박으로 달아 볼게. 그릇보다 많이 담으면 넘쳐.',
  'career-report': '이 일이 네 자리인지 아닌지는 곳간 문 앞에서 보면 알아.',
  'learning-report': '시험도 계약도 다 문서야. 네 문서가 열리는 때가 언제인지 봐 줄게.',
  'exam-report': '붙을 자리에 앉았는지, 한 해 더 두어야 하는지. 네 문서 운을 그 날짜에 맞춰 볼게.',
  'admission-report': '어느 쪽으로 가야 이 아이가 덜 힘든지, 타고난 결을 보고 짚어 줄게.',
  'job-report': '네 자리가 어느 문 뒤에 있는지, 그 문이 언제 열리는지 봐 줄게.',

  // 풍신령 — 시기
  'daily-report': '오늘 바람이 어느 쪽에서 부는지, 아침에 알려 줄게.',
  'newyear-report': '올해 바람은 열두 달이 다 달라. 달마다 나눠서 말해 줄게.',
  'travel-report': '떠날 때가 있고 머물 때가 있다. 지금 종이 울리는지 들어 볼게.',
};

/**
 * 가림막 앞에서 신령이 하는 말.
 *
 * `PITCH` 와 다르다. `PITCH` 는 「이 상품은 이런 것입니다」이고,
 * 여기는 **손님이 이미 앞부분을 다 보고 난 뒤**에 하는 말이다.
 * 이미 본 것을 또 말하면 안 사고 나간다.
 */
export const BLIND: Record<string, string> = {
  'saju-report': '여기서부터는 앞으로 열 해가 어떻게 흐르는지다. 거울을 더 깊이 들여다봐야 보인다.',
  'cross-report': '거울 하나로는 뒤통수를 못 본다. 얼굴과 손금까지 겹쳐 봐야 여기가 보인다.',
  'saju-face-report': '겉과 속이 어디서 갈라지는지는 여기서부터다.',
  'compat-report': '실이 몇 가닥인지는 봤지. 어느 가닥이 먼저 끊어지는지는 여기서부터다.',
  'newyear-report': '올해 바람이 어느 쪽에서 부는지, 달마다 나눠 보는 건 여기서부터다.',
};

/** 그림이 실제로 있는 신령의 아이디 모음. 서버가 기동할 때 세어 넘겨준다 */
export type SpiritImages = ReadonlySet<string>;

export const NO_FACES_SET: SpiritImages = new Set();
const NO_FACES = NO_FACES_SET;

/** 확장자를 주소에 넣지 않는다 — 서버가 실제 파일을 안다 */
export const spiritImageUrl = (id: string) => `/img/spirits/${encodeURIComponent(id)}`;

/**
 * 신령 얼굴 하나.
 *
 * 그림이 있으면 그림, 없으면 한자 도장. **어느 쪽이든 같은 크기의 둥근 자리**를
 * 차지하기 때문에, 일곱 중 셋만 그려져 있어도 줄이 흐트러지지 않는다.
 */
function face(spirit: Spirit, faces: SpiritImages, size: number): string {
  if (!faces.has(spirit.id)) {
    return `<span class="sp-face sp-seal" aria-hidden="true">${esc(spirit.seal)}</span>`;
  }
  // 그림은 원 밖으로 넘겨 놓고 원이 잘라 낸다. 그래야 얼굴만 당겨 쓸 수 있다
  const c = spirit.crop;
  const cut = c ? ` style="--sp-zoom:${c.zoom};--sp-down:${esc(c.down)}"` : '';
  return `<span class="sp-face"${cut}><img src="${spiritImageUrl(spirit.id)}" alt=""
      width="${size}" height="${size}" loading="lazy" decoding="async"></span>`;
}

/**
 * 갈래 맨 위에 서는 신령.
 *
 * 갈래 제목(질문)은 그대로 두고, 그 질문을 **누가 묻고 있는지**를 옆에 세운다.
 * 「이 사람, 어떨까?」라는 글자만 있는 것과, 도화신령이 그 말을 하고 있는 것은
 * 다른 화면이다.
 */
export function renderSpiritHead(
  spirit: Spirit, question: string, faces: SpiritImages = NO_FACES,
  scenes: ReadonlySet<string> = new Set(),
): string {
  // 신령은 자기 터에 서 있다. 터 그림이 없으면 종이색 바탕에 그대로 선다
  const ground = scenes.has(spirit.id)
    ? ` style="--nb-place:url(/img/scene/${encodeURIComponent(spirit.id)})"` : '';
  return `<div class="sp-head nb-rise${scenes.has(spirit.id) ? ' sp-here' : ''}"${ground}>
  <div class="sp-ground" aria-hidden="true"></div>
  <div class="sp-veil" aria-hidden="true"></div>
  <div class="sp-said">
    ${face(spirit, faces, 96)}
    <div class="sp-words">
      <p class="sp-who">${esc(spirit.name)}<span class="sp-place"> · ${esc(spirit.place)}</span></p>
      <h3 class="pr-q">${esc(question)}</h3>
      <p class="sp-line">${esc(spirit.greet)}</p>
    </div>
  </div>
</div>`;
}

/**
 * 상품 하나짜리 페이지에서 신령이 하는 말.
 *
 * 상품 설명 바로 위에 놓는다. 설명은 우리가 무엇을 만드는지를 적은 글이고,
 * 이 말은 신령이 손님에게 거는 말이다. 둘 다 필요하다.
 */
export function renderSpiritPitch(
  spirit: Spirit, productId: string, faces: SpiritImages = NO_FACES,
): string {
  const pitch = PITCH[productId];
  if (!pitch) return '';
  return `<aside class="sp-pitch">
  ${face(spirit, faces, 72)}
  <div class="sp-said">
    <p class="sp-who">${esc(spirit.name)}<span class="sp-keeps"> · ${esc(spirit.keeps)} 담당</span></p>
    <p class="sp-line">${esc(pitch)}</p>
  </div>
</aside>`;
}

/**
 * 첫 화면의 신령 소개 띠.
 *
 * 손님이 상품을 보기 전에 **이 집에 누가 사는지** 먼저 안다. 일곱 얼굴이
 * 한 줄로 서 있으면, 스물한 개 표가 일곱 사람의 가게로 바뀐다.
 */
export function renderSpiritRow(faces: SpiritImages = NO_FACES): string {
  const cards = SPIRITS.map((s) => `  <li class="sp-card nb-rise">
    ${face(s, faces, 120)}
    <p class="sp-name">${esc(s.name)}</p>
    <p class="sp-keeps">${esc(s.keeps)}</p>
    <p class="sp-intro">${esc(s.intro)}</p>
  </li>`).join('\n');

  /*
   * 숫자를 손으로 적지 않는다.
   *
   * 「신령 일곱」이라고 박아 두었더니 여덟이 된 뒤에도 일곱이라고 나갔고,
   * 열이 된 지금도 일곱이라고 나가고 있었다. **화면이 거짓말을 하는 것**이라,
   * 신령이 늘 때마다 고치는 것을 잊지 않을 방법은 안 적는 것뿐이다.
   */
  const 몇 = countWord(SPIRITS.length);
  return `<section class="lp sp-row-wrap" id="spirits">
<p class="pr-kicker">신령 ${몇}</p>
<h2 class="sp-title">이 집에는 신령 ${몇}이 삽니다</h2>
<p class="sp-sub">칸마다 주인이 다릅니다. 궁금한 것에 맞는 신령을 찾아가시면 됩니다.</p>
<ul class="sp-row">
${cards}
</ul>
</section>`;
}

/**
 * 신령 화면 스타일.
 *
 * 색은 새로 만들지 않는다. 상품 화면이 이미 정해 둔 `--nb-*` 를 그대로 쓴다 —
 * 신령이 다른 색으로 오면 같은 집 사람으로 안 보인다.
 */
export const SPIRITS_CSS = `
/* 얼굴 자리. 그림이 있든 도장뿐이든 크기가 같아야 줄이 안 흐트러진다 */
/* 얼굴 자리는 **원이 그림을 잘라 내는 창**이다. 그림이 세로로 길든 정사각형이든,
   얼굴이 크든 작든, 원 밖으로 넘겨 놓고 필요한 만큼만 보여 준다.
   기본값은 세로로 긴 그림 기준 — 가운데를 잡으면 얼굴이 잘리므로 위쪽을 잡는다 */
.sp-face{flex:0 0 auto;display:block;width:64px;height:64px;border-radius:50%;overflow:hidden;
  background:var(--nb-paper-2);border:1px solid var(--nb-line-soft)}
.sp-face img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 15%;
  transform:translateY(var(--sp-down,0)) scale(var(--sp-zoom,1))}
.sp-seal{display:grid;place-items:center;font-family:var(--nb-serif);font-size:26px;color:var(--nb-gold)}

/* 갈래 머리 — 신령이 자기 터에 서서 질문을 던지고 있다.
   터 그림은 배경으로 깔고 그 위에 베일을 한 겹 덮는다. 안 덮으면 글자가 안 읽힌다 */
.sp-head{position:relative;margin:0 0 22px}
.sp-here{margin-left:-22px;margin-right:-22px;padding:26px 22px 24px;overflow:hidden}
.sp-ground{display:none}
.sp-here .sp-ground{display:block;position:absolute;inset:0;
  background:var(--nb-paper) center 22%/cover no-repeat;background-image:var(--nb-place,none);
  animation:nbDrift 34s ease-in-out infinite alternate}
.sp-veil{display:none}
.sp-here .sp-veil{display:block;position:absolute;inset:0;background:
  linear-gradient(to bottom,var(--nb-veil-0),var(--nb-veil-1) 52%,var(--nb-paper) 98%)}
.sp-said{position:relative;display:flex;align-items:flex-start;gap:14px;min-width:0}
.sp-words{min-width:0}
.sp-here .sp-said{padding-top:96px}
.sp-head .sp-face{width:60px;height:60px}
.sp-head .pr-q{margin:2px 0 6px}
.sp-place{color:var(--nb-ink-3);letter-spacing:.06em}
.sp-who{margin:0 0 2px;font-size:12px;letter-spacing:.2em;color:var(--nb-gold)}
.sp-keeps{color:var(--nb-ink-3);letter-spacing:0}
.sp-line{margin:0;font-size:14.5px;line-height:1.75;color:var(--nb-ink-2);word-break:keep-all}

/* 상품 하나짜리 페이지에서 거는 말 */
.sp-pitch{display:flex;align-items:flex-start;gap:14px;margin:0 0 20px;padding:16px 18px;
  border-left:2px solid var(--nb-gold);background:var(--nb-paper-2)}
.sp-pitch .sp-face{width:54px;height:54px}
.sp-pitch .sp-line{font-size:15px;color:var(--nb-ink)}

/* 첫 화면 소개 띠 — 폰에서는 옆으로 밀어서 본다 */
/* 좌우 여백을 지우면 아래 띠의 「가장자리까지 밀기」가 화면 밖으로 나간다 */
.sp-row-wrap{padding-top:64px}
.sp-title{font-family:var(--nb-serif);font-weight:500;font-size:23px;margin:0 0 8px}
.sp-sub{margin:0 0 22px;font-size:14.5px;color:var(--nb-ink-2);word-break:keep-all}
.sp-row{list-style:none;margin:0;padding:0 22px 4px;display:flex;gap:16px;
  overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;
  margin-left:-22px;margin-right:-22px}
.sp-card{flex:0 0 132px;scroll-snap-align:start;text-align:center}
.sp-card .sp-face{width:84px;height:84px;margin:0 auto 10px}
.sp-card .sp-seal{font-size:34px}
.sp-name{margin:0;font-family:var(--nb-serif);font-size:16px}
.sp-card .sp-keeps{display:block;margin:2px 0 6px;font-size:11.5px;letter-spacing:.16em;color:var(--nb-gold)}
.sp-intro{margin:0;font-size:12.5px;line-height:1.7;color:var(--nb-ink-2);word-break:keep-all}

@media (min-width:760px){
  .sp-said{gap:18px}
  .sp-here{margin:0 0 26px;padding:34px 30px 30px;border:1px solid var(--nb-line-soft)}
  .sp-here .sp-said{padding-top:120px}
  .sp-head .sp-face{width:76px;height:76px}
  .sp-title{font-size:28px}
  /* 넓은 화면에서는 일곱이 한눈에 들어온다. 밀지 않아도 된다 */
  .sp-row{display:grid;grid-template-columns:repeat(7,1fr);gap:18px;overflow:visible;
    margin:0;padding:0}
  .sp-card{flex:none}
  .sp-card .sp-face{width:92px;height:92px}
}`;

/* ═══════════════════════════════════════════════════════════════════════
   신령이 신령을 소개한다

   이 집의 영업사원은 여덟이고, 각자 자기 분야만 본다. 손님이 한 신령의
   풀이를 다 읽고 나면 **그 신령이 다음 신령에게 말을 넣는다.**

       도화신령  "네 매력은 내가 봤다. 그런데 그 사람 마음은 내 소관이 아니야.
                 실터의 연신령이 그걸 본다 — 내가 말을 넣어 줄까?"
       연신령    "도화가 직접 부탁을 하다니. 그럼 특별히,
                 네가 제일 궁금한 것 하나부터 봐 주지."

   화면에 「묶음 39,800원 · 20% 아낍니다」라고 적는 것과 파는 물건은 같다.
   다른 것은 **손님이 그것을 할인으로 받느냐 부탁으로 받느냐**다.

   ## 왜 신령마다 한 줄씩만 두는가

   여덟이 서로를 소개하면 짝이 쉰여섯이다. 쉰여섯 벌을 손으로 적으면
   반드시 어딘가 어색해지고, 신령을 하나 더 들일 때마다 열다섯 줄이 는다.
   그래서 **보내는 말 여덟 줄, 맞는 말 여덟 줄**만 둔다. 상대 이름은 끼워 넣는다.

   ## 같은 신령이면 소개가 아니다

   「늘봄 아이」처럼 한 신령 안에서 끝나는 묶음이 절반이다. 거기서 남을
   부르면 말이 안 된다. 그때는 그 신령이 직접 「기왕 온 김에」로 말한다.

   ## 지어낸 할인율은 여기에도 없다

   신령이 「특별히 깎아 준다」고 말하지만, 그 값은 구성 상품 **실제 판매가의
   합**에서 깎은 값이다. 판 적 없는 정가를 지어내지 않는다.
   ═══════════════════════════════════════════════════════════════════════ */

/** 보내는 신령이 하는 말. `to` 에 받을 신령 이름, `place` 에 그 신령이 사는 곳이 들어간다 */
export const SEND_OFF: Record<string, (to: string, place: string) => string> = {
  flower: (to, place) =>
    `네 쪽은 꽃가지로 다 짚었다. 그런데 그 다음은 내 꽃밭 밖의 일이야. ` +
    `${place}에 ${to}이 있다 — 내가 말을 넣어 줄까?`,
  moon: (to, place) =>
    `물에 비친 달까지는 내가 봤다. 여기서부터는 달빛이 안 닿아. ` +
    `${place}의 ${to}에게 부탁해 두마.`,
  thread: (to, place) =>
    `걸린 실은 다 세었다. 실이 어디로 이어지는지는 ${place}에서 봐야 해. ` +
    `${to}에게 내가 한마디 해 두지.`,
  mountain: (to, place) =>
    `이 집 일은 여기까지 봤다. 나머지는 ${place}의 ${to}이 나보다 낫지. ` +
    `늙은이가 부탁하면 그 아이가 안 거절한단다.`,
  mirror: (to, place) =>
    `거울에 비친 것은 다 보여 주었다. 거울 밖의 일은 ${place}의 ${to}이 본다. ` +
    `내가 비춰 보낸 사람이라고 말해 두마.`,
  cross: (to, place) =>
    `세 가닥을 겹쳐 봤으니 큰 그림은 잡혔다. 한 가닥을 더 당겨 보려면 ` +
    `${place}의 ${to}에게 가야 해. 내 매듭을 보여 주면 알아볼 거야.`,
  jar: (to, place) =>
    `그릇 크기는 됫박으로 달았다. 그 그릇이 언제 어떻게 채워지는지는 ` +
    `${place}의 ${to} 몫이야. 곳간 열쇠를 들려 보내마.`,
  wind: (to, place) =>
    `종이 울리는 때는 일러 주었다. 울린 뒤에 무엇이 오는지는 ` +
    `${place}의 ${to}이 안다. 바람 편에 말을 실어 보내지.`,
  name: (to, place) =>
    `이름 석 자는 고운 옷으로 지어 입혔다. 앞으로 살아갈 길은 ` +
    `${place}의 ${to}이 더 잘 알지. 내가 미리 글을 띄워 둘게.`,
  birth: (to, place) =>
    `세상에 나올 복된 날은 내가 잘 잡아 주었다. 그 아이가 자라며 겪을 일은 ` +
    `${place}의 ${to} 몫이지. 할미가 잘 봐 달라고 귀띔해 두마.`,
};

/** 소개받은 신령이 하는 말. `from` 에 보낸 신령 이름이 들어간다 */
export const WELCOME: Record<string, (from: string) => string> = {
  flower: (from) =>
    `${from}이 직접 말을 넣었구나. 그 아이가 아무한테나 그러지 않는데. ` +
    `그럼 꽃가지 하나 더 꺾어 주지 — 제일 궁금한 것 하나, 그것부터 말해 보렴.`,
  moon: (from) =>
    `${from}의 부탁이라면 달빛을 조금 더 비춰 주마. ` +
    `가슴에 걸린 것 하나만 말해 보렴. 그것부터 보자.`,
  thread: (from) =>
    `${from}이 청을 넣다니. 그 아이 부탁은 내가 안 거절한다. ` +
    `실을 한 가닥 더 풀어 주마 — 제일 알고 싶은 것 하나를 말해 보렴.`,
  mountain: (from) =>
    `${from}이 보냈으면 그냥 온 손님이 아니지. 앉아 보렴. ` +
    `이 늙은이한테 묻고 싶은 것 하나, 그것도 같이 봐 주마.`,
  mirror: (from) =>
    `${from}의 소개라면 거울을 한 번 더 닦아 주지. ` +
    `비춰 보고 싶은 것 하나를 말해 보렴. 거울은 안 속인다.`,
  cross: (from) =>
    `${from}이 보낸 사람이구나. 그럼 매듭을 하나 더 풀어 주마. ` +
    `셋을 겹쳐서 꼭 확인하고 싶은 것 하나, 그것을 말해 보렴.`,
  jar: (from) =>
    `${from}의 청이라면 곳간 문을 조금 더 열어 주지. ` +
    `돈 때문에 제일 걸리는 것 하나를 말해 보렴. 그것부터 달아 보자.`,
  wind: (from) =>
    `${from}이 바람 편에 말을 실어 보냈구나. 그럼 종을 한 번 더 울려 주마. ` +
    `때를 알고 싶은 것 하나, 그것을 말해 보렴.`,
  name: (from) =>
    `${from}이 적어 보낸 글을 보았어. 아무에게나 붓을 쥐여 주지 않는데. ` +
    `제일 마음에 걸리는 것 하나를 말해 줘. 그 뜻을 담아 이름에 새겨 줄게.`,
  birth: (from) =>
    `${from}이 내게 부탁을 다 했구나. 어디 보자, 착한 아이가 왔네. ` +
    `어린 생명을 위해 가장 묻고 싶은 것 하나만 말해 보렴. 할미가 품에 안고 짚어 주마.`,
};

/** 같은 신령 안에서 하나 더 볼 때. 소개가 아니라 「기왕 온 김에」다 */
export const ONE_MORE: Record<string, string> = {
  flower: '기왕 꽃가지를 들었으니 이것도 같이 짚어 줄까. 따로 오는 것보다 낫다.',
  moon: '달이 아직 안 기울었다. 이것까지 같이 비춰 봐 주마.',
  thread: '실타래를 이미 풀었으니 한 가닥 더 세는 건 어렵지 않다.',
  mountain: '앉은 김에 이것도 같이 보자꾸나. 두 번 걸음할 것 없다.',
  mirror: '거울을 닦아 놓았으니 이것도 같이 비춰 주마.',
  cross: '매듭을 이미 풀었으니 여기서 한 가닥 더 당겨 보자.',
  jar: '됫박을 꺼낸 김에 이것도 같이 달아 주지.',
  wind: '종이 울리는 참이니 이것도 같이 들어 보자.',
  name: '먹물이 아직 마르지 않았어. 이왕 붓을 든 김에 이것도 함께 적어 줄게.',
  birth: '강보를 펼친 김에 이것도 같이 봐 주마. 두 번 걸음할 것 없단다.',
};

/**
 * 소개로 넘어간 손님에게 **실제로 더 주는 것**.
 *
 * 신령이 「원하는 것 하나를 말해 보렴」이라고 하면, 그 말은 지켜야 한다.
 * 그래서 묶음으로 사면 리포트에 **손님이 적은 물음 하나**가 함께 들어간다.
 * 말만 하고 안 주면 그게 거짓 광고다.
 */
export const HANDOFF_GIFT = '신령에게 묻고 싶은 것 하나를 적어 주시면, 리포트에 그 답까지 함께 담아 드립니다.';

/** 소개 한 판에 필요한 것 전부 */
export interface Handoff {
  /** 같은 신령이면 소개가 아니라 「기왕 온 김에」다 */
  kind: '소개' | '덧보기';
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  toPlace: string;
  /** 보내는 신령의 말. 「덧보기」면 빈 문자열 */
  send: string;
  /** 받는 신령의 말. 「덧보기」면 그 신령이 직접 하는 말 */
  greet: string;
  gift: string;
}

/** 신령 아이디로 찾는다. 모르는 아이디면 null */
function bySpiritId(id: string) {
  return SPIRITS.find((s) => s.id === id) ?? null;
}

/**
 * 어느 신령에게서 어느 신령에게로 넘어가는가.
 *
 * 같은 신령이면 「덧보기」, 다르면 「소개」다.
 * 모르는 신령이 들어오면 null 을 돌려준다 — 없는 말을 지어내지 않는다.
 */
export function handoffBetween(fromId: string, toId: string): Handoff | null {
  const from = bySpiritId(fromId);
  const to = bySpiritId(toId);
  if (!from || !to) return null;

  if (from.id === to.id) {
    const say = ONE_MORE[from.id];
    if (!say) return null;
    return {
      kind: '덧보기',
      fromId: from.id, fromName: from.name,
      toId: to.id, toName: to.name, toPlace: to.place,
      send: '', greet: say, gift: HANDOFF_GIFT,
    };
  }

  const send = SEND_OFF[from.id];
  const greet = WELCOME[to.id];
  if (!send || !greet) return null;
  return {
    kind: '소개',
    fromId: from.id, fromName: from.name,
    toId: to.id, toName: to.name, toPlace: to.place,
    send: send(to.name, to.place),
    greet: greet(from.name),
    gift: HANDOFF_GIFT,
  };
}

/** 어느 갈래를 어느 신령이 지키는가 */
export function spiritOfCategory(category: string): string | null {
  return SPIRITS.find((s) => s.keeps === category)?.id ?? null;
}
