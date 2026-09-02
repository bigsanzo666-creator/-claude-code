/**
 * 신령 일곱.
 *
 * 지금까지 이 집에는 **주인이 없었다.** 상품 스물한 개가 표처럼 늘어서 있고,
 * 설명은 다 맞는 말인데 말을 거는 사람이 아무도 없었다. 그런 가게에서는
 * 아무도 지갑을 안 연다 — 설명만 있는 곳은 누구나 만들 수 있다.
 *
 * 그래서 갈래마다 **신령을 한 명씩 앉힌다.** 손님이 「연애」 칸에 오면
 * 꽃신령이 나와서 말을 걸고, 「가족」 칸에 오면 산신령이 나와서 말을 건다.
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
 * 일곱 신령.
 *
 * 순서는 상품 갈래 순서와 같다. 앞이 손님이 많이 들어오는 입구다.
 */
export const SPIRITS: Spirit[] = [
  {
    id: 'flower', name: '꽃신령', seal: '花', keeps: '연애',
    holds: '복사꽃 가지',
    greet: '누구한테 마음이 가는지, 내가 꽃가지로 짚어 줄게.',
    intro: '마음이 어느 쪽으로 기우는지 봅니다.',
    crop: { zoom: 1.55, down: '26%' },
  },
  {
    id: 'moon', name: '달신령', seal: '月', keeps: '재회',
    holds: '물에 비친 둥근 달',
    greet: '떠난 사람은 물에 비친 달 같아. 그래도 하늘에 달은 남아 있지.',
    intro: '지나간 사람이 돌아올 자리가 있는지 봅니다.',
    // 정사각형에 얼굴이 작게 들어온 그림. 얼굴부터 달 윗부분까지만 당겨 쓴다
    crop: { zoom: 2.5, down: '66%' },
  },
  {
    id: 'thread', name: '실신령', seal: '絲', keeps: '궁합',
    holds: '붉은 실타래',
    greet: '두 사람 사이에 실이 몇 가닥 걸렸는지, 내가 세어 줄게.',
    intro: '두 사람을 이은 실이 튼튼한지 봅니다.',
    crop: { zoom: 1.7, down: '34%' },
  },
  {
    id: 'mountain', name: '산신령', seal: '山', keeps: '가족',
    holds: '지팡이와 곁에 앉은 호랑이',
    greet: '이 집 일은 내가 제일 오래 봤단다. 앉아 보렴.',
    intro: '집안 사람들 사이를 봅니다.',
    crop: { zoom: 1.55, down: '26%' },
  },
  {
    id: 'mirror', name: '거울신령', seal: '鏡', keeps: '나',
    holds: '오래된 청동 거울',
    greet: '거울은 안 속여. 네가 진짜 어떤 사람인지 비춰 줄게.',
    intro: '내가 어떤 사람인지 있는 그대로 비춥니다.',
    crop: { zoom: 1.55, down: '26%' },
  },
  {
    id: 'jar', name: '곳간신령', seal: '庫', keeps: '돈과 일',
    holds: '엽전 자루와 곡식 됫박',
    greet: '네 그릇이 얼마나 큰지 됫박으로 달아 볼게. 그릇보다 많이 담으면 넘쳐.',
    intro: '돈이 담기는 그릇 크기와 일자리를 봅니다.',
    crop: { zoom: 1.45, down: '22%' },
  },
  {
    id: 'wind', name: '바람신령', seal: '風', keeps: '시기',
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
  // 꽃신령 — 연애
  'charm-report': '네가 어디가 예쁜지는 내가 첫눈에 알아. 얼굴하고 손금까지 같이 보고 말해 줄게.',
  'single-report': '꽃은 아무 때나 피지 않아. 네 꽃이 피는 달이 언제인지 세어 줄게.',
  'marriage-timing-report': '서두르면 꽃이 진다. 언제가 좋은 때인지 짚어 줄게.',

  // 달신령 — 재회
  'reunion-report': '물에 비친 달은 못 잡아. 그래도 하늘에 달이 남았는지는 내가 봐 줄게.',

  // 실신령 — 궁합
  'compat-report': '두 사람한테 걸린 실을 다 세어 볼게. 어느 가닥이 튼튼하고 어느 가닥이 끊어질 실인지.',
  'crush-compat-report': '아직 실이 한 가닥이구나. 이어질 실인지 아닌지만 빨리 봐 줄게.',

  // 산신령 — 가족
  'child-report': '아이는 나무 같단다. 어떤 나무로 태어났는지 알아야 물을 얼마나 줄지 알지.',
  'child-aptitude-report': '밤나무한테 사과가 열리라고 하면 안 되지. 이 아이한테 뭐가 열리는지 봐 주마.',
  'parent-child-report': '부딪히는 건 누가 나빠서가 아니야. 두 사람 자리가 어긋난 거지. 어디가 어긋났는지 짚어 주마.',
  'latelife-report': '산은 내려올 때가 더 어렵다. 남은 길에 무엇을 챙겨야 하는지 말해 주마.',

  // 거울신령 — 나
  'saju-report': '네가 어떤 사람으로 태어났는지, 여덟 글자를 다 펴서 보여 줄게.',
  'cross-report': '거울 하나로는 뒤통수를 못 봐. 사주하고 얼굴하고 손금, 거울 세 개를 같이 볼게.',
  'expression-report': '네가 진짜 잘하는 건 따로 있어. 그게 뭔지 비춰 줄게.',
  'peers-report': '사람 때문에 힘든 데는 자리가 있어. 네 자리가 어딘지 보여 줄게.',
  'helper-report': '널 도울 사람이 어느 쪽에서 오는지, 거울에 비친다.',

  // 곳간신령 — 돈과 일
  'wealth-report': '네 그릇이 얼마나 큰지 됫박으로 달아 볼게. 그릇보다 많이 담으면 넘쳐.',
  'career-report': '이 일이 네 자리인지 아닌지는 곳간 문 앞에서 보면 알아.',
  'learning-report': '시험도 계약도 다 문서야. 네 문서가 열리는 때가 언제인지 봐 줄게.',

  // 바람신령 — 시기
  'daily-report': '오늘 바람이 어느 쪽에서 부는지, 아침에 알려 줄게.',
  'newyear-report': '올해 바람은 열두 달이 다 달라. 달마다 나눠서 말해 줄게.',
  'travel-report': '떠날 때가 있고 머물 때가 있다. 지금 종이 울리는지 들어 볼게.',
};

/** 그림이 실제로 있는 신령의 아이디 모음. 서버가 기동할 때 세어 넘겨준다 */
export type SpiritImages = ReadonlySet<string>;

const NO_FACES: SpiritImages = new Set();

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
 * 「이 사람, 어떨까?」라는 글자만 있는 것과, 꽃신령이 그 말을 하고 있는 것은
 * 다른 화면이다.
 */
export function renderSpiritHead(spirit: Spirit, question: string, faces: SpiritImages = NO_FACES): string {
  return `<div class="sp-head">
  ${face(spirit, faces, 96)}
  <div class="sp-said">
    <p class="sp-who">${esc(spirit.name)}</p>
    <h3 class="pr-q">${esc(question)}</h3>
    <p class="sp-line">${esc(spirit.greet)}</p>
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
  const cards = SPIRITS.map((s) => `  <li class="sp-card">
    ${face(s, faces, 120)}
    <p class="sp-name">${esc(s.name)}</p>
    <p class="sp-keeps">${esc(s.keeps)}</p>
    <p class="sp-intro">${esc(s.intro)}</p>
  </li>`).join('\n');

  return `<section class="lp sp-row-wrap" id="spirits">
<p class="pr-kicker">신령 일곱</p>
<h2 class="sp-title">이 집에는 신령 일곱이 삽니다</h2>
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

/* 갈래 머리 — 신령이 질문을 던지고 있다 */
.sp-head{display:flex;align-items:flex-start;gap:14px;margin:0 0 22px}
.sp-head .sp-face{width:60px;height:60px}
.sp-head .pr-q{margin:2px 0 6px}
.sp-said{min-width:0}
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
  .sp-head{gap:18px}
  .sp-head .sp-face{width:76px;height:76px}
  .sp-title{font-size:28px}
  /* 넓은 화면에서는 일곱이 한눈에 들어온다. 밀지 않아도 된다 */
  .sp-row{display:grid;grid-template-columns:repeat(7,1fr);gap:18px;overflow:visible;
    margin:0;padding:0}
  .sp-card{flex:none}
  .sp-card .sp-face{width:92px;height:92px}
}`;
