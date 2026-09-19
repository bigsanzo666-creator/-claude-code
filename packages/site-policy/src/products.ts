/**
 * 상품·가격 안내.
 *
 * PG 심사의 「상품 등록 유무」 항목을 위한 것이다. 심사는 **첫 화면만** 본다 —
 * 생년월일을 넣고 스크롤해야 나오는 가격은 없는 것과 같다.
 *
 * 그래서 이 화면은 세 가지를 지킨다.
 *
 * 1. **서버가 HTML로 직접 그린다.** 자바스크립트로 만들면 자동 검사기가 못 본다.
 * 2. **결제가 꺼져 있어도 나온다.** 심사를 통과해야 결제가 켜지는데,
 *    결제가 켜져야 가격이 보이면 영원히 통과 못 한다.
 * 3. **가격은 카탈로그 한 곳에서만 온다.** 화면에 적힌 값과 서버가 대조하는 값이
 *    다르면 그 자체가 사고다.
 */

import { CATALOG, CATEGORIES, productsIn, type Product } from '../../commerce/src/catalog.ts';
import { PACKAGES, bundleMath, type BundlePackage } from '../../commerce/src/packages.ts';
import { WITHDRAWAL_WINDOW_DAYS, DELIVERY_DUE_DAYS } from '../../commerce/src/refund.ts';
import { type BusinessInfo, show } from './business.ts';
import {
  spiritOf, renderSpiritHead, renderSpiritPitch, SPIRITS_CSS,
  type SpiritImages,
} from './spirits.ts';
import { renderWhy, WHY_CSS } from './why.ts';
import { renderSocialHead } from './social.ts';
// 하단 사업자 정보는 모든 화면에 나간다. 스타일도 같이 따라가야 읽힌다
import { FOOTER_CSS } from './pages.ts';

/** 얼굴 그림이 아직 하나도 없을 때. 도장 한 글자로 자리를 지킨다 */
const NO_FACES: SpiritImages = new Set();

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

/**
 * 그림 자리.
 *
 * 그림이 아직 없는 상품은 **자리를 아예 안 만들고 있었다.** 그러면 격자에서
 * 옆 칸은 그림이 있고 이 칸만 짧아져 줄이 어긋난다 — 빠뜨린 것처럼 보인다.
 *
 * 그림이 없으면 그 상품을 파는 신령의 **도장 한 글자**로 자리를 지킨다.
 * 신령 얼굴이 이미 같은 방식을 쓰고 있다. 그림이 들어오면 저절로 바뀐다.
 */
function shot(product: Product, images: ProductImages): string {
  if (images.has(product.id)) {
    return `<span class="pr-shot"><img class="pr-thumb" src="${imageUrl(product.id)}" alt="" width="480" height="640" loading="lazy" decoding="async"></span>`;
  }
  const keeper = spiritOf(product.category);
  return `<span class="pr-shot pr-seal" aria-hidden="true">${esc(keeper?.seal ?? '命')}</span>`;
}

/**
 * 그림이 있는 상품의 아이디 모음.
 *
 * 서버가 기동할 때 실제로 있는 파일을 세어 넘겨준다. 여기서 파일을 뒤지지 않는
 * 이유는, 이 패키지가 어느 서버의 어느 폴더에 붙을지 몰라야 하기 때문이다.
 *
 * **없으면 아무것도 그리지 않는다.** 빈 네모를 남기면 그림이 없느니만 못하다.
 * 그래서 21장이 다 나오기 전에도 나온 것만 먼저 붙일 수 있다.
 */
export type ProductImages = ReadonlySet<string>;

const NO_IMAGES: ProductImages = new Set();

/** 갈래 맨 앞에 크게 거는 상품 */
const FEATURED = 'cross-report';

/** 확장자를 URL에 넣지 않는다 — 서버가 실제 파일을 알고 있다. */
export const imageUrl = (id: string) => `/img/products/${encodeURIComponent(id)}`;

/**
 * 상품마다 "무엇을 받는지"를 못 박는다.
 *
 * 카탈로그의 한 줄 설명만으로는 부족하다 — 손님도 심사자도
 * 결제 버튼을 누르기 전에 받을 것을 알아야 한다.
 *
 * 주제별 상품은 여기 없다. 그쪽은 카탈로그의 `hook`과 `description`이
 * 이미 그 일을 한다. 없는 상품은 목록 없이 설명만 나간다.
 */
/**
 * 주제 하나를 보는 상품이 실제로 받는 것.
 *
 * **여기 적힌 것은 전부 자료에 실제로 들어 있다.** 상품마다 손으로 적으면
 * 자료를 고칠 때 한쪽만 바뀌어 화면이 거짓말을 하게 된다. 그래서 주제 이름만
 * 넣으면 같은 줄이 나오게 해 둔다 — 자료 구조가 바뀌면 여기 한 곳만 고친다.
 */
const 해세기: Record<number, string> = { 2: '두 해', 3: '세 해', 5: '다섯 해' };

function topicContents(term: string, gloss: string, years: number, extra?: string): string[] {
  return [
    '사주 여덟 글자와 **진태양시·절기까지 맞춘** 계산 근거',
    '나를 뜻하는 글자(일간)와 그 힘이 센 편인지 약한 편인지',
    `${term}이 여덟 글자 **어디에** 있는지 — 기둥마다, 지지 속에 숨은 것까지`,
    `${gloss}`,
    `많은지 적은지, 그리고 **채워야 할 기운(용신)**에서 볼 때 써야 할 쪽인지 덜어낼 쪽인지`,
    `지금 지나는 십 년(대운)과 **올해부터 ${해세기[years] ?? `${years}해`}**가 이 자리에 유리한지`,
    ...(extra ? [extra] : []),
  ];
}


/**
 * 이런 분이 보시면 좋습니다 / 이건 안 보셔도 됩니다.
 *
 * ## 안 보셔도 된다고 말하는 이유
 *
 * 경쟁사 상세페이지는 「이런 분들이라면 꼭 보세요」만 있다. 읽는 사람은
 * 전부 자기 얘기 같아서 결국 아무 얘기도 아니게 된다.
 *
 * 우리는 **안 사도 되는 경우를 먼저 적는다.** 손님 하나를 놓치지만,
 * 사는 사람은 「이 집은 아무한테나 팔지는 않는구나」로 받는다. 그리고
 * 무엇보다 — 기대와 다른 것을 받은 손님은 환불하고 다시는 안 온다.
 *
 * 적는 것은 전부 **이 리포트가 실제로 하고 안 하는 일**이다.
 */
interface Fit {
  /** 보시면 좋은 경우 */
  yes: string[];
  /** 이건 이 상품이 아니라고 말해 주는 한 줄 */
  no: string;
}

const FIT: Record<string, Fit> = {
  'charm-report': {
    yes: ['같은 사람만 반복해서 만나는 것 같을 때', '내가 어떤 사람에게 끌리는지 나도 모를 때', '연애가 늘 비슷한 이유로 끝날 때'],
    no: '지금 만나는 그 사람과 잘 맞는지를 묻는 거라면 **궁합 리포트**가 맞습니다. 이건 상대가 아니라 **나**를 보는 글입니다.',
  },
  'single-report': {
    yes: ['혼자인 기간이 길어져 조급할 때', '소개를 받아야 할지 기다려야 할지 모를 때', '언제쯤이라는 대략의 때를 알고 싶을 때'],
    no: '정확한 날짜를 집어 드리지는 않습니다. **어느 해 어느 철이 열리는 때인지**까지 봅니다.',
  },
  'marriage-timing-report': {
    yes: ['결혼 이야기가 오가는데 때를 못 정할 때', '미루는 게 나은지 당기는 게 나은지 궁금할 때', '양가 일정 때문에 기준이 필요할 때'],
    no: '상대와 잘 맞는지는 이 글이 아닙니다. 그건 **궁합 리포트**입니다. 여기서는 **나의 때**만 봅니다.',
  },
  'reunion-report': {
    yes: ['헤어지고 나서 계속 생각날 때', '연락해도 되는 때인지 모를 때', '붙잡을지 놓을지 결정을 못 할 때'],
    no: '돌아온다고 약속하는 글이 아닙니다. **두 사람의 자리가 아직 이어져 있는지**를 봅니다.',
  },
  'letgo-report': {
    yes: ['끝난 걸 아는데 마음이 안 따라올 때', '언제쯤 괜찮아질지 가늠이 안 될 때', '다음으로 넘어가야 하는데 못 넘어갈 때'],
    no: '다시 만날 가능성을 보는 글이 아닙니다. 그건 **재회 가능성**입니다. 여기는 **정리하는 쪽**을 봅니다.',
  },
  'compat-report': {
    yes: ['오래 만났는데 확신이 안 설 때', '싸우는 지점이 늘 똑같을 때', '결혼까지 갈 사이인지 보고 싶을 때'],
    no: '상대의 생년월일이 있어야 합니다. 없으면 **매력 삼합**처럼 나만 보는 글을 보세요.',
  },
  'crush-compat-report': {
    yes: ['아직 사귀기 전, 티를 내야 할지 고민될 때', '상대 마음이 어느 쪽인지 모를 때', '고백 시점을 재고 있을 때'],
    no: '상대의 마음을 읽어 드리는 글이 아닙니다. **두 사람 기운이 어떻게 맞물리는지**까지 봅니다.',
  },
  'child-report': {
    yes: ['아이가 왜 저러는지 모르겠을 때', '형제인데 성격이 너무 다를 때', '어떻게 키워야 할지 기준이 필요할 때'],
    no: '아이의 성적이나 앞날을 정해 드리는 글이 아닙니다. **타고난 결**을 봅니다.',
  },
  'child-aptitude-report': {
    yes: ['학원을 뭘 시킬지 정해야 할 때', '아이가 뭘 좋아하는지 모를 때', '문과 이과를 정해야 할 때'],
    no: '직업을 찍어 드리지 않습니다. **어느 쪽이 덜 힘든 결인지**를 봅니다.',
  },
  'parent-child-report': {
    yes: ['같은 말도 이 아이에게만 안 통할 때', '사춘기가 유난히 힘들 때', '부모인 내 문제인지 궁금할 때'],
    no: '누가 잘못했는지 가려 주는 글이 아닙니다. **두 사람 기운이 어디서 부딪히는지**를 봅니다.',
  },
  'pick-report': {
    yes: ['병원에서 후보 날짜를 여럿 받았을 때', '그중 어느 날이 나은지 기준이 필요할 때', '같은 날이라도 시간이 갈리는지 궁금할 때'],
    no: '의사가 주지 않은 날은 다루지 않습니다. **주신 후보 안에서만** 견줍니다. 몸이 먼저입니다.',
  },
  'naming-report': {
    yes: ['이름 후보가 너무 많아 못 고를 때', '돌림자를 넣어야 할 때', '출생신고가 되는 한자인지 걱정될 때'],
    no: '이름이 아이의 앞날을 정한다고 말하지 않습니다. 이름은 **부르는 것**입니다.',
  },
  'naming-plus-report': {
    yes: ['반에 같은 이름이 없었으면 할 때', '마음에 들 때까지 계속 받아 보고 싶을 때', '한자까지 겹치지 않게 짓고 싶을 때'],
    no: '세 개만 받아 보고 정하실 거라면 **아이 이름 짓기**로 충분합니다. 값이 많이 다릅니다.',
  },
  'latelife-report': {
    yes: ['은퇴 이후가 막막할 때', '지금 준비를 해야 하나 싶을 때', '자식에게 기댈 수 있을지 궁금할 때'],
    no: '수명이나 병을 말하지 않습니다. **말년의 기운이 어느 쪽으로 도는지**만 봅니다.',
  },
  'saju-report': {
    yes: ['나에 대해 한 번은 제대로 정리하고 싶을 때', '이것저것 보기 전에 뼈대부터 잡고 싶을 때', '지금이 내 인생의 어느 구간인지 궁금할 때'],
    no: '한 가지만 급하게 궁금하시면 그 **낱개 리포트**가 값도 싸고 답도 빠릅니다.',
  },
  'expression-report': {
    yes: ['잘하는 걸로 먹고살 수 있을지 궁금할 때', '취미를 일로 바꿔 볼까 싶을 때', '남들이 칭찬하는 게 뭔지 모를 때'],
    no: '적성 검사가 아닙니다. **타고난 결**을 여덟 글자에서 봅니다.',
  },
  'peers-report': {
    yes: ['사람 때문에 지치는 일이 반복될 때', '조직 생활이 유난히 안 맞을 때', '혼자 하는 게 나은지 궁금할 때'],
    no: '특정한 누구를 가려내 드리지 않습니다. **내가 사람과 맺는 결**을 봅니다.',
  },
  'helper-report': {
    yes: ['도움을 청할 데가 없다고 느낄 때', '인맥이 늘 겉도는 것 같을 때', '누구를 붙잡아야 할지 모를 때'],
    no: '귀인의 이름이나 얼굴을 알려 드리지 않습니다. **어느 자리에서 오는지**를 봅니다.',
  },
  'cross-report': {
    yes: ['사주만으로는 미심쩍을 때', '세 갈래가 같은 말을 하는지 보고 싶을 때', '엇갈리는 지점이 궁금할 때'],
    no: '얼굴과 손 사진이 있어야 합니다. 생년월일만 있으면 **사주 종합 리포트**입니다.',
  },
  'face-palm-report': {
    yes: ['태어난 시간을 모를 때', '생년월일을 밝히고 싶지 않을 때', '얼굴과 손만으로 한번 보고 싶을 때'],
    no: '사주는 보지 않습니다. 생년월일을 넣으실 수 있으면 **삼합 리포트**가 훨씬 깊습니다.',
  },
  'saju-palm-report': {
    yes: ['타고난 것과 지금이 다른 것 같을 때', '손금이 바뀐 것 같을 때', '사주와 손금만 맞춰 보고 싶을 때'],
    no: '얼굴은 보지 않습니다. 셋을 다 겹치려면 **삼합 리포트**입니다.',
  },
  'saju-face-report': {
    yes: ['남들이 보는 나와 내가 아는 내가 다를 때', '첫인상이 늘 오해를 살 때', '사주와 관상만 맞춰 보고 싶을 때'],
    no: '손금은 보지 않습니다. 셋을 다 겹치려면 **삼합 리포트**입니다.',
  },
  'wealth-report': {
    yes: ['벌어도 남지 않는 것 같을 때', '목돈을 만들 때가 언제인지 궁금할 때', '돈 때문에 사람과 부딪힐 때'],
    no: '얼마를 벌게 된다고 말하지 않습니다. **그릇의 크기와 모양**을 봅니다. 투자 조언도 하지 않습니다.',
  },
  'career-report': {
    yes: ['지금 일을 계속할지 고민될 때', '승진이나 이직 시기를 재고 있을 때', '조직에서 내 자리가 흔들릴 때'],
    no: '어느 회사로 가라고 말하지 않습니다. **자리의 기운이 언제 열리는지**를 봅니다.',
  },
  'learning-report': {
    yes: ['시험·계약·서류가 몰려 있을 때', '공부가 유난히 안 붙을 때', '도장을 찍어야 할 때가 궁금할 때'],
    no: '합격 여부를 맞히는 글이 아닙니다. 이번 시험만 급하시면 **시험 합격운**이 그 해를 더 길게 봅니다.',
  },
  'exam-report': {
    yes: ['수능·공시·자격증이 코앞일 때', '올해가 아니면 언제인지 알고 싶을 때', '한 해 더 할지 말지 정해야 할 때'],
    no: '붙는다 떨어진다를 말하지 않습니다. **문서의 기운과 자리의 기운이 어느 해에 겹치는지**를 봅니다.',
  },
  'admission-report': {
    yes: ['아이 진학 방향을 정해야 할 때', '전공을 두고 집안이 갈릴 때', '아이가 하고 싶은 게 없다고 할 때'],
    no: '학교나 학과를 찍어 드리지 않습니다. **어느 결이 덜 힘든지**를 봅니다.',
  },
  'job-report': {
    yes: ['취업이 길어져 지칠 때', '직무를 바꿔야 하나 싶을 때', '언제쯤 자리가 잡힐지 궁금할 때'],
    no: '합격을 보장하지 않습니다. **자리가 열리는 해**를 다섯 해 안에서 봅니다.',
  },
  'daily-report': {
    yes: ['오늘 중요한 일이 있을 때', '가볍게 매일 보고 싶을 때', '사주가 처음이라 한번 맛보고 싶을 때'],
    no: '하루치입니다. 타고난 그릇과 십 년 흐름은 **사주 종합 리포트**에서 봅니다.',
  },
  'newyear-report': {
    yes: ['새해 계획을 세울 때', '올해가 버틸 해인지 밀 해인지 궁금할 때', '달마다의 흐름을 알고 싶을 때'],
    no: '평생 사주를 푸는 글이 아닙니다. **올해와 내년**만 봅니다.',
  },
  'travel-report': {
    yes: ['이사·이직·유학을 두고 고민될 때', '떠나고 싶은 마음이 계속될 때', '해외에 나갈 때가 궁금할 때'],
    no: '어느 나라로 가라고 말하지 않습니다. **움직이는 기운이 언제 도는지**를 봅니다.',
  },
};

/** 검증이 상품마다 다 적혔는지 볼 수 있게 밖으로 낸다 */
export function FIT_FOR(productId: string): Fit | undefined {
  return FIT[productId];
}

/** 상세페이지가 적는 「담기는 것」. 검증이 자료와 대조할 수 있게 밖으로 낸다 */
export function CONTENTS_FOR(productId: string): string[] | undefined {
  return CONTENTS[productId];
}

const CONTENTS: Record<string, string[]> = {
  // ── 주제 하나를 보는 것 ─────────────────────────────────
  'wealth-report': topicContents('재성(財星)', '재성은 **내가 다루는 재물과 사람**을 뜻합니다', 3),
  'career-report': topicContents('관성(官星)', '관성은 **나를 규율하는 자리와 명예**를 뜻합니다', 3),
  'expression-report': topicContents('식상(食傷)', '식상은 **내가 밖으로 내놓는 것** — 표현·재능을 뜻합니다', 3),
  'peers-report': topicContents('비겁(比劫)', '비겁은 **나와 같은 편에 선 힘** — 동료와 경쟁자를 뜻합니다', 3),
  'helper-report': topicContents('천을귀인 등 귀인 신살', '귀인은 **막혔을 때 손을 내미는 자리**를 뜻합니다', 3),
  'learning-report': topicContents('인성(印星)', '인성은 **받아들이고 배우는 힘** — 공부와 문서를 뜻합니다', 3),
  'travel-report': topicContents('역마 등 이동 신살', '역마는 **자리를 옮기는 기운**을 뜻합니다', 3),
  // 아래 셋은 보는 자리를 넓혀서 위의 것과 가른다
  'exam-report': topicContents('인성(印星)과 관성(官星)', '문서의 기운과 **자리를 얻는 기운**을 겹쳐 봅니다', 5,
    '시험은 때가 갈리므로 **다섯 해**를 봅니다 — 올해가 아니면 어느 해인지'),
  'admission-report': topicContents('인성(印星)과 식상(食傷)', '문서의 기운과 **타고난 결(재능)**을 겹쳐 봅니다', 3,
    '어느 쪽으로 가야 **덜 힘든지** — 아이가 이미 가진 결에 맞춰서'),
  'job-report': topicContents('관성(官星)과 인성(印星)', '자리의 기운과 **문서의 기운**을 겹쳐 봅니다', 5,
    '자리가 **언제 열리는지** — 다섯 해의 흐름에서'),

  // ── 하루 ────────────────────────────────────────────────
  'daily-report': [
    '오늘의 간지와 오행이 **내 일간**과 맺는 관계',
    '오늘 나에게 유리한 기운인지 조심할 기운인지',
    '내 명식과 오늘 사이의 **충·합** — 있으면 무엇을 뜻하는지',
    '오늘 특히 조심할 일을 **구체적인 상황**으로',
    '오늘의 행운 색·방향·숫자 — **채워야 할 기운에서 나온 것**',
  ],

  // ── 매력 ────────────────────────────────────────────────
  'charm-report': [
    '도화·홍염이 여덟 글자 어디에 있는지',
    '얼굴이 말하는 것과 손이 말하는 것을 **같은 눈금**으로 옮긴 값',
    '세 갈래가 **대인관계·표현력** 두 축에서 같은 말을 하는 곳',
    '엇갈리는 곳 — 타고난 결과 지금 드러나는 모습의 차이로 읽습니다',
    '**이 두 축만 봅니다.** 여덟 축 전부는 삼합 리포트가 봅니다',
  ],

  'naming-report': [
    '아이 사주에서 비어 있는 기운과 채워야 할 기운',
    '그 기운에 맞는 이름 **세 개**',
    '이름마다 한자와 뜻, 왜 이 아이에게 맞는지',
    '초년운·청년운·장년운·전체운 네 격의 수와 길흉',
    '발음 오행과 음양이 고른지',
    '셋 다 마음에 들지 않으시면 **두 개를 더** 지어 드립니다',
    '넣고 싶은 글자가 있으면 그 글자로 짓습니다',
  ],
  'naming-plus-report': [
    '위의 것 전부',
    '**마음에 드실 때까지** 지어 드립니다 — 개수를 정해 두지 않습니다',
    '요즘 많이 쓰는 이름과 **겹치는지** 따로 알려 드립니다',
    '겹치지 않으면서 사주에도 맞는 이름을 골라 드립니다',
    '한자까지 같은 이름인지, 소리만 같은 이름인지 나눠서',
  ],
  'pick-report': [
    '의사에게 받은 후보 날짜와 가능한 시각을 전부 견준 순위',
    '1순위가 왜 앞섰는지 — 힘의 치우침·오행·충·귀인을 하나씩',
    '그날 그때 세워지는 여덟 글자',
    '2·3순위와 무엇을 주고받는지',
    '피하는 게 나은 때와 그 까닭',
    '날마다 제일 좋은 시각 — 같은 날도 두 시간마다 갈립니다',
  ],
  'saju-report': [
    '사주 여덟 글자와 지장간까지 펼친 명식',
    '일간의 강약과 용신 — 어느 기운을 써야 하는지',
    '십신 분포로 본 성향과 비어 있는 자리',
    '10년 대운과 올해 세운의 흐름',
  ],
  'compat-report': [
    '두 사람의 명식을 다섯 축으로 대조',
    '잘 맞는 지점과 부딪히는 지점을 함께',
    '합·충·형 관계와 그것이 실제로 뜻하는 바',
    '관계를 오래 끌고 가려면 무엇을 조심해야 하는지',
  ],
  'cross-report': [
    '사주·관상·손금을 같은 여덟 축으로 환산',
    '**세 갈래가 일치하는 것** — 가장 믿을 만한 성향',
    '**엇갈리는 것** — 겉과 속이 다른 지점',
    '**하나만 말하는 것** — 아직 드러나지 않은 면',
    '각 결론이 어느 글자·어느 부위에서 나왔는지 표시',
  ],
  'letgo-report': [
    '지금 이 마음이 어느 흐름 위에 놓여 있는지',
    '대운·세운에서 마음이 가벼워지는 구간',
    '그때까지 무엇을 붙들고 무엇을 놓으면 되는지',
    '**돌아온다고 지어내지 않습니다** — 없는 것을 있다고 말하지 않습니다',
  ],
  'face-palm-report': [
    '얼굴 사진과 손 사진만으로 봅니다 — 생년월일이 필요 없습니다',
    '관상 십이궁과 손금 주요 선을 같은 여덟 축으로 환산',
    '**두 갈래가 같은 말을 하는 것** — 겉으로 가장 잘 드러나는 성향',
    '**엇갈리는 것** — 얼굴이 말하는 나와 손이 말하는 나의 차이',
  ],
  'saju-palm-report': [
    '태어날 때 정해진 것(사주)과 살면서 새겨진 것(손금)을 대조',
    '타고난 기질과 실제로 살아온 방향이 얼마나 벌어졌는지',
    '벌어진 자리에서 무엇을 조심하면 되는지',
  ],
  'saju-face-report': [
    '사주가 말하는 속과 얼굴이 말하는 겉을 대조',
    '남들이 보는 나와 내가 아는 나의 거리',
    '그 거리가 득이 되는 자리와 실이 되는 자리',
  ],
  'newyear-report': [
    '올해 세운이 내 명식과 만나는 지점',
    '달별로 나뉜 흐름',
    '올해 특히 조심할 것과 밀어붙일 것',
  ],
};

function bold(text: string): string {
  // 설명 안의 **강조**만 살리고 나머지는 escape 한다
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function productCard(
  product: Product, ready: boolean, images: ProductImages, groupQuestion = '', prices = true,
): string {
  // 21개를 낱장으로 늘어놓으면 아무도 끝까지 못 본다. 그래서 목록은 **그림 격자**다 —
  // 후킹 질문·이름·값만 싣고, 설명과 담기는 내용은 상세 페이지가 맡는다.
  // alt 를 비우는 것은 장식이기 때문이다. 바로 아래에 상품 이름이 글자로 있다.
  return `<article class="pr-card">
  <a class="pr-link" href="/products/${esc(product.id)}">
    ${shot(product, images)}
    ${product.hook === groupQuestion ? '' : `<span class="pr-hook">${esc(product.hook)}</span>`}
    <h3>${esc(product.name)}</h3>
  </a>
  ${prices ? `<p class="pr-foot"><span class="pr-price">${won(product.priceKrw)}</span><span class="pr-vat"> (부가세 포함)</span>${
    ready ? '' : '<span class="pr-soon">결제 준비 중</span>'}</p>` : ''}
</article>`;
}

/**
 * 크게 거는 카드.
 *
 * 삼합 리포트는 제일 비싸고 우리만 하는 것인데, 다른 스무 개와 똑같이 생겨 있으면
 * 아무도 그것부터 보지 않는다. 갈래 맨 앞에 한 칸을 다 쓰고, 설명과 담기는 내용까지
 * 여기서 보여 준다.
 */
function featureCard(product: Product, ready: boolean, images: ProductImages, prices = true): string {
  const items = (CONTENTS[product.id] ?? []).map((t) => `<li>${bold(t)}</li>`).join('');
  return `<article class="pr-card pr-wide">
  <a class="pr-link" href="/products/${esc(product.id)}">
    ${shot(product, images)}
    <span class="pr-body">
      <span class="pr-tag">가장 깊이 봅니다</span>
      <span class="pr-hook">${esc(product.hook)}</span>
      <h3>${esc(product.name)}</h3>
      <span class="pr-desc">${esc(product.description)}</span>
      ${items ? `<ul class="pr-list">${items}</ul>` : ''}
      ${prices ? `<span class="pr-foot"><span class="pr-price">${won(product.priceKrw)}</span><span class="pr-vat"> (부가세 포함)</span>${
        ready ? '' : '<span class="pr-soon">결제 준비 중</span>'}</span>` : ''}
    </span>
  </a>
</article>`;
}

/**
 * 묶음 카드.
 *
 * 정가를 지어내지 않는다. 경쟁사들이 쓰는 "정가 128,000원 → 61% 할인"은
 * 그 가격에 실제로 판 적이 없으면 표시광고법상 거짓·과장광고가 된다.
 * 우리는 구성 상품이 전부 실재하므로 **그 합계를 그대로 쓴다.**
 */
function packageCard(pack: BundlePackage, ready: boolean): string {
  const m = bundleMath(pack.id);
  const names = pack.members.map((id) => CATALOG[id].name).join(' + ');
  return `<article class="pr-card pr-wide pr-pack${pack.recommended ? ' pr-rec' : ''}">
  <span class="pr-body">
    ${pack.recommended ? '<span class="pr-badge">추천</span>' : ''}
    <span class="pr-hook">${esc(pack.hook)}</span>
    <h3>${esc(pack.name)}</h3>
    <span class="pr-desc">${esc(names)}</span>
    <span class="pr-foot">
      <span class="pr-price">${won(m.bundleKrw)}</span><span class="pr-vat"> (부가세 포함)</span>
      <span class="pr-save">따로 사면 ${won(m.individualKrw)} · ${m.percent}% 절약</span>
      ${ready ? '' : '<span class="pr-soon">결제 준비 중</span>'}
    </span>
  </span>
</article>`;
}

/**
 * 화면 전체의 색과 글자.
 *
 * **색은 상품 그림에서 가져왔다.** 짙은 남색 먹, 한지 바탕, 은은한 금 —
 * 21장이 전부 그 세 가지로 그려져 있다. 화면이 다른 색이면 그림이 겉돈다.
 *
 * 값을 여기 한 곳에만 두는 이유는, 이 CSS 가 첫 화면·상품 목록·상품 상세
 * 세 군데에 모두 실리는 유일한 조각이기 때문이다. 첫 화면 스타일은 여기의
 * `--ink` 를 가져다 쓴다.
 */
export const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700;900&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap">`;

export const PRODUCTS_CSS = `
/*
 * 색은 **밤 한 벌뿐이다.**
 *
 * 손님 폰이 밝든 어둡든 이 집은 언제나 밤이다. 신령계는 밤에 열리고,
 * 영상도 신령 그림도 전부 어두운 바탕에 그려져 있다. 밝은 종이 위에
 * 그것을 얹으면 그림만 검은 네모로 뜬다.
 *
 * 색은 여기 한 곳에서만 온다. 다른 데 색을 적으면 한쪽만 고쳐져서
 * 화면이 어긋난다.
 */
:root{
  color-scheme:dark;
  --nb-paper:#06060A; --nb-paper-2:#12121C; --nb-paper-3:#1A1A26;
  --nb-line:rgba(212,175,55,.34); --nb-line-soft:rgba(255,255,255,.12);
  --nb-ink:#F5F5F7; --nb-ink-2:#C8C8D4; --nb-ink-3:#A0A0B2;
  --nb-gold:#D4AF37; --nb-gold-2:#F3E5AB; --nb-crimson:#9E1B32;
  --nb-veil-0:rgba(6,6,10,0); --nb-veil-1:rgba(6,6,10,.72);
  /* 글씨는 두 벌만 쓴다. 아래 무료 만세력 조각이 이미 이 둘을 받아 오므로
     새로 받지 않는다 — 한 페이지에 명조 두 벌, 고딕 두 벌이 도는 것을 막는다 */
  --nb-serif:"Noto Serif KR",AppleMyungjo,Batang,serif;
  --nb-sans:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
}
body{background:var(--nb-paper)}
.pr,.lp{width:100%;max-width:1080px;margin:0 auto;padding:0 22px;box-sizing:border-box;
  font:16px/1.75 var(--nb-sans);color:var(--nb-ink);-webkit-font-smoothing:antialiased}
.pr img,.lp img{max-width:100%;display:block}
.pr h2,.pr h3,.pr h4{font-family:var(--nb-serif);font-weight:500;letter-spacing:-.01em}

/* 목록 머리 */
.pr-top{text-align:center;padding:74px 0 10px}
.pr-kicker{margin:0 0 12px;font-size:12.5px;letter-spacing:.28em;color:var(--nb-gold)}
.pr-top h2{font-size:27px;margin:0 0 10px}
.pr-intro{margin:0 auto;max-width:34em;font-size:14.5px;color:var(--nb-ink-2);word-break:keep-all}
.pr-rule{width:38px;height:1px;background:var(--nb-gold);margin:26px auto 0}

/* 갈래 */
.pr-group{padding:46px 0 0}
.pr-cat{margin:0 0 7px;font-size:12px;letter-spacing:.24em;color:var(--nb-gold)}
.pr-q{font-size:22px;margin:0 0 22px}

/* 격자 */
.pr-grid{display:grid;grid-template-columns:1fr 1fr;gap:26px 18px}
.pr-grid>*{min-width:0}
.pr-card{margin:0}
.pr-link{display:block;color:inherit;text-decoration:none}
.pr-shot{display:block;aspect-ratio:3/4;overflow:hidden;
  background:var(--nb-paper-2);border:1px solid var(--nb-line-soft)}
.pr-thumb{width:100%;height:100%;object-fit:cover}
/* 그림이 아직 없는 자리. 빈 네모 대신 그 갈래를 지키는 신령의 도장이 선다 */
.pr-seal{display:flex;align-items:center;justify-content:center;
  font-family:var(--nb-serif);font-size:38px;color:var(--nb-gold);opacity:.5;
  background:var(--nb-paper-2)}
.pr-wide .pr-seal{font-size:52px}
/* 확대는 쇼핑몰 몸짓이다. 수묵 그림에는 테두리 한 줄이면 된다 */
.pr-shot{transition:border-color .15s}
.pr-link:hover .pr-shot,.pr-link:focus .pr-shot{border-color:var(--nb-gold)}
.pr-hook{display:block;margin:14px 0 3px;font-size:12.5px;line-height:1.5;color:var(--nb-gold);word-break:keep-all}
.pr-card h3{font-size:16.5px;margin:0;line-height:1.5;word-break:keep-all}
.pr-link:hover h3,.pr-link:focus h3{text-decoration:underline;text-underline-offset:3px}
.pr-foot{display:block;margin:7px 0 0;font-size:14px;color:var(--nb-ink-2);font-variant-numeric:tabular-nums}
.pr-price{font-size:15px;color:var(--nb-ink)}
.pr-vat{font-size:12px;color:var(--nb-ink-3)}
.pr-soon{display:block;margin:2px 0 0;font-size:11.5px;color:var(--nb-ink-3)}
.pr-save{display:block;margin-top:4px;font-size:13px;color:var(--nb-ink-3)}

/* 크게 거는 카드 · 묶음 */
.pr-wide{grid-column:1/-1;border:1px solid var(--nb-line);background:var(--nb-paper-2)}
.pr-wide>.pr-link,.pr-pack{display:block}
.pr-wide .pr-shot{border:0;border-bottom:1px solid var(--nb-line);aspect-ratio:16/11}
.pr-body{display:block;padding:26px 24px 28px}
.pr-tag{display:inline-block;margin-bottom:14px;padding:3px 10px;border:1px solid var(--nb-gold);
  font-size:11.5px;letter-spacing:.18em;color:var(--nb-gold)}
.pr-wide h3{font-size:22px;margin:0 0 8px}
.pr-desc{display:block;margin:0 0 14px;font-size:14.5px;color:var(--nb-ink-2);word-break:keep-all}
.pr-wide .pr-price{font-family:var(--nb-serif);font-size:22px}
.pr-list{margin:0 0 16px;padding-left:19px}
.pr-list li{margin:4px 0;font-size:14px;color:var(--nb-ink-2)}
.pr-link .pr-soon{display:inline;margin:0 0 0 10px}
.pr-rec{border-color:var(--nb-gold)}
.pr-badge{display:inline-block;margin-bottom:12px;padding:3px 10px;background:var(--nb-gold);
  color:var(--nb-paper);font-size:11.5px;font-weight:700;letter-spacing:.06em}
.pr-note{margin:56px 0 0;padding:22px 0 0;border-top:1px solid var(--nb-line-soft);
  font-size:13px;line-height:1.85;color:var(--nb-ink-3)}
.pr-note a{color:var(--nb-gold)}

/* 상품 하나짜리 페이지 */
.pd-back{display:inline-block;margin-bottom:18px;font-size:13.5px;color:var(--nb-gold);text-decoration:none}
.pd-hero{width:100%;max-width:300px;aspect-ratio:3/4;object-fit:cover;margin:0 0 22px;
  background:var(--nb-paper-2);border:1px solid var(--nb-line-soft)}
.pd-term{margin:0 0 14px;font-size:13.5px;color:var(--nb-ink-2)}
.pd-term b{color:var(--nb-ink)}
.pd-buy{margin:22px 0;padding:20px 22px;border:1px solid var(--nb-line);background:var(--nb-paper-2)}
.pd-price{font-family:var(--nb-serif);font-size:27px}
.pd-also{margin:8px 0 0;font-size:14px;color:var(--nb-ink-2)}
/* 언제·어떻게 받고 어떻게 무르는지. 카드사 심사가 상세페이지에서 이걸 본다 */
.pd-terms{margin:22px 0 0;padding:20px 22px;border:1px solid var(--nb-line-soft);background:var(--nb-paper-2)}
.pd-terms dt{font-family:var(--nb-serif);font-size:14.5px;color:var(--nb-gold);margin:14px 0 4px}
.pd-terms dt:first-child{margin-top:0}
.pd-terms dd{margin:0;font-size:14.5px;line-height:1.8;color:var(--nb-ink-2);word-break:keep-all}
.pd-terms dd b{color:var(--nb-ink)}
.pd-terms a{color:var(--nb-gold)}
.pr-body>h3,.pr-card>h3{font-family:var(--nb-serif)}

@media (min-width:760px){
  .pr-top h2{font-size:34px}
  .pr-grid{grid-template-columns:repeat(3,1fr);gap:40px 28px}
  .pr-wide>.pr-link{display:grid;grid-template-columns:1.15fr 1fr}
  .pr-wide>.pr-link>*{min-width:0}
  .pr-wide .pr-shot{aspect-ratio:auto;height:100%;border-bottom:0;border-right:1px solid var(--nb-line)}
  .pr-body{align-self:center;padding:40px 38px}
}
/*
 * 화면이 옆으로 구르지 않게 못 박는다.
 *
 * 안에 옆으로 미는 줄(신령 판)이 있어서, 어딘가에서 몇 px 이 새면 화면 전체가
 * 옆으로 움직인다. 폰에서 그러면 손님은 결제 칸을 누르려다 화면을 밀어 버린다.
 * clip 을 쓴다 — hidden 은 붙어 다니는 막대(sticky)를 망가뜨린다.
 */
html,body{overflow-x:clip;max-width:100%}

/* 상품 화면에서 사러 가는 단추. 값 바로 아래에 놓아 눈이 멈춘 자리에서 눌리게 한다 */
.pd-go{display:block;margin:14px 0 0;padding:16px;text-align:center;text-decoration:none;
  border:0;border-radius:12px;background:linear-gradient(135deg,var(--nb-gold),#A37C15);
  color:#120D04;font:700 16px var(--nb-sans);
  box-shadow:0 8px 30px rgba(212,175,55,.34)}
.pd-go:hover{filter:brightness(1.12)}

/* ── 상세페이지의 칸들 ────────────────────────────────────
   값은 맨 아래다. 무엇을 받는지 다 보여 준 다음에 값을 말한다 */
.pd-sec{margin:34px 0 0;padding:24px 22px;border:1px solid var(--nb-line-soft);
  background:var(--nb-paper-2);border-radius:12px}
.pd-l{margin:0 0 6px;font-size:11.5px;letter-spacing:.22em;color:var(--nb-gold)}
.pd-h{margin:0 0 16px;font-size:19px;line-height:1.45;word-break:keep-all}

/* 안 사도 되는 경우를 먼저 적는다. 손님 하나를 놓치고 믿음을 얻는다 */
.pd-fit{border-color:var(--nb-line)}
.pd-yes{margin:0;padding-left:19px;display:grid;gap:7px}
.pd-yes li{font-size:15px;line-height:1.7;word-break:keep-all}
.pd-no{margin:18px 0 0;padding:14px 16px;font-size:14px;line-height:1.8;
  color:var(--nb-ink-2);background:var(--nb-paper-3);
  border-left:2px solid var(--nb-ink-3);border-radius:0 8px 8px 0;word-break:keep-all}
.pd-no b{color:var(--nb-ink)}

/* 실제로 나가는 글의 앞부분. 그림으로 보여 주고 글로 주지 않는 짓은 안 한다 */
.pd-samp{white-space:pre-wrap;font-size:14.5px;line-height:1.9;color:var(--nb-ink-2);
  padding:18px 18px;background:var(--nb-paper-3);border-radius:8px;word-break:keep-all}
.pd-samp-n{margin:12px 0 0;font-size:12.5px;line-height:1.7;color:var(--nb-ink-3);word-break:keep-all}

/* 「왜 늘봄인가」는 상품 화면 안에서는 한 칸으로 들어간다 */
.pd-why .why{margin:0;padding:0;border:0;background:none}
${SPIRITS_CSS}
${WHY_CSS}
${FOOTER_CSS}`;

/**
 * 상품 목록 한 덩어리. 화면에도 붙이고 전용 페이지에도 쓴다.
 *
 * 열셋을 그냥 늘어놓으면 아무도 못 고른다. 그래서 갈래로 묶고,
 * 갈래 제목을 **질문으로** 단다 — 「연애」라고만 쓰면 안 눌리고
 * 「이 사람, 괜찮을까?」라고 쓰면 눌린다.
 */
/**
 * 상품 목록.
 *
 * `prices` 를 끄면 값과 묶음이 빠진다. **첫 화면에서 값부터 보이면 손님이
 * 물러선다** — 아직 뭘 봐 주는지도 모르는 사람에게 계산부터 시키는 셈이다.
 * 그래서 첫 화면은 무엇을 봐 주는지만 보여 주고, 값은 가격표 페이지에서 본다.
 *
 * 값을 아주 없애지는 않는다. 카드사 등록심사가 「상품과 가격이 홈페이지에
 * 있는가」를 보기 때문에, `/products` 와 상품별 페이지에는 그대로 남는다.
 */
export function renderProducts(
  ready: boolean, images: ProductImages = NO_IMAGES, faces: SpiritImages = NO_FACES,
  prices = true, scenes: ReadonlySet<string> = new Set(),
): string {
  const groups = CATEGORIES.map((c) => {
    const all = productsIn(c.key);
    // 삼합 리포트는 갈래 맨 앞에 한 칸을 다 쓴다. 제일 비싸고 우리만 하는 것이다
    const star = all.find((p) => p.id === FEATURED);
    const cards = [
      ...(star ? [featureCard(star, ready, images, prices)] : []),
      ...all.filter((p) => p !== star).map((p) => productCard(p, ready, images, c.question, prices)),
    ].join('\n');
    // 갈래마다 주인이 있다. 신령이 질문을 던지고, 그 아래에 그 신령의 물건이 놓인다
    const spirit = spiritOf(c.key);
    const head = spirit
      ? renderSpiritHead(spirit, c.question, faces, scenes)
      : `<h3 class="pr-q">${esc(c.question)}</h3>`;
    return `<section class="pr-group">
<p class="pr-cat">${esc(c.key)}</p>
${head}
<div class="pr-grid">
${cards}
</div>
</section>`;
  }).join('\n');

  const packs = Object.values(PACKAGES)
    .sort((a, b) => a.priceKrw - b.priceKrw)
    .map((p) => packageCard(p, ready)).join('\n');

  return `<section class="pr" id="products">
<div class="pr-top">
<h2>${prices ? '판매 상품과 가격' : '무엇을 봐 드리나'}</h2>
<p class="pr-intro">${prices
    ? `사주 명식·궁합·관상·손금 풀이 자체는 무료이며, 결제 없이 이용하실 수 있습니다.
아래는 그보다 깊이 들어가는 유료 리포트입니다.`
    : `사주 명식·궁합·관상·손금 풀이는 결제 없이 보실 수 있습니다.
아래는 신령이 한 갈래씩 깊이 들여다보는 것들입니다.`}</p>
<div class="pr-rule"></div>
</div>
${groups}
${prices ? `<section class="pr-group">
<p class="pr-cat">묶음</p>
<h3 class="pr-q">여러 개를 함께 보시려면</h3>
<div class="pr-grid">
${packs}
</div>
</section>` : ''}
${renderWhy()}
${prices ? `<p class="pr-note">
묶음 가격 옆의 「따로 사면」은 <strong>구성 상품을 실제로 낱개 판매하는 가격의 합계</strong>입니다.
판매한 적 없는 정가를 지어내 할인율을 부풀리지 않습니다.<br>
결제 전에 리포트 일부를 미리 보실 수 있으며, 결제일부터 ${WITHDRAWAL_WINDOW_DAYS}일 이내에
청약철회가 가능합니다. 자세한 내용은 <a href="/refund">취소·환불 정책</a>을 참고해 주세요.
</p>` : `<p class="pr-note">
값은 상품마다 다릅니다. <a href="/products">판매 상품과 가격 전체 보기</a><br>
결제 전에 리포트 일부를 미리 보실 수 있으며, 결제일부터 ${WITHDRAWAL_WINDOW_DAYS}일 이내에
청약철회가 가능합니다.
</p>`}
</section>`;
}

/** 상품만 담은 독립 페이지. 심사가 곧바로 열어볼 수 있는 주소를 만든다 */
export function renderProductsPage(
  info: BusinessInfo, ready: boolean, footer: string, images: ProductImages = NO_IMAGES,
  faces: SpiritImages = NO_FACES, scenes: ReadonlySet<string> = new Set(),
): string {
  const site = show(info, 'serviceName', '서비스 이름');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${renderSocialHead(info, {
    title: '판매 상품과 가격',
    description: '사주 명식·궁합·관상·손금 풀이는 결제 없이 보실 수 있습니다. 더 깊이 보는 리포트의 값을 여기에 모두 적어 두었습니다.',
    path: '/products',
  })}
${FONT_LINK}
<style>
:root{color-scheme:dark}
body{margin:0}
${PRODUCTS_CSS}
</style>
</head>
<body>
${renderProducts(ready, images, faces, true, scenes)}
<div style="height:24px"></div>
${footer}
</body>
</html>`;
}


/**
 * 상품 하나짜리 페이지.
 *
 * 카드사 등록심사가 **"상품을 클릭했을 때 상세페이지에 상품 설명이 제대로
 * 되어 있는가"** 를 본다. 목록에 설명이 다 있어도 클릭해서 들어갈 곳이 없으면
 * 걸린다. 그래서 상품마다 고유한 주소를 준다.
 *
 * 검색에도 같은 이유로 유리하다 — 사람들은 「사주」가 아니라 「재물운 사주」로
 * 검색하고, 그 검색어에 대응하는 페이지가 있어야 걸린다.
 */
/**
 * 이 상품을 사러 가는 길.
 *
 * 전에는 「첫 화면에서 생년월일을 넣으시면 구매하실 수 있습니다」라고만 적었다.
 * 그 말대로 첫 화면에 가도 **이 상품을 사는 자리는 없었다** — 살 수 있는 곳은
 * 관상·손금 화면 하나뿐이었다. 없는 길을 안내한 셈이라 아무도 살 수 없었다.
 *
 * 이제 주소에 상품을 실어 보낸다. 첫 화면이 그것을 읽고 곧바로 살 자리를 연다.
 */
function buyLink(product: Product): string {
  if (product.needsPick) return '';
  if (product.needsPartner) {
    return `<a class="pd-go" href="/?buy=${encodeURIComponent(product.id)}">두 사람 생년월일 넣고 받기</a>`;
  }
  if (product.needsFace) {
    return `<a class="pd-go" href="/?buy=${encodeURIComponent(product.id)}">얼굴·손까지 넣고 받기</a>`
      + '<p class="pd-also">사진은 기기 밖으로 나가지 않습니다. 화면에서 특징만 고르시면 됩니다.</p>';
  }
  return `<a class="pd-go" href="/?buy=${encodeURIComponent(product.id)}">생년월일 넣고 받기</a>`
    + '<p class="pd-also">결제 전에 무엇이 담기는지와 예시 문장을 먼저 보여 드립니다.</p>';
}

/**
 * 상세페이지.
 *
 * ## 순서가 곧 장사다
 *
 * 값을 맨 위에 두면 손님이 값부터 재고 나간다. **무엇을 받는지 다 보여 준
 * 다음**에 값을 말한다. 경쟁사도 아홉 칸 중 여덟 번째에 값을 둔다.
 *
 * 순서: 누가 봐 주는가 → 이런 분이 보시면 / 안 보셔도 → 담기는 것 →
 *       어떤 문장으로 나오는지 → 이 집 계산을 믿어도 되는가 → 값 → 묶음 → 약속
 *
 * ## 따라 하지 않는 것
 *
 * 남은 시간 세는 시계, 안 사면 벌어질 일의 연표, 적중률 숫자, 후기,
 * 판 적 없는 정가에 그은 줄. 하나도 쓰지 않는다. 2024년 개정 전자상거래법이
 * 다크패턴으로 이름 붙여 둔 것들이고, 없는 숫자를 지어내는 것은 그냥 거짓말이다.
 */
export function renderProductPage(
  product: Product, info: BusinessInfo, ready: boolean, footer: string,
  images: ProductImages = NO_IMAGES, faces: SpiritImages = NO_FACES,
  sample: { text: string; notice: string } | null = null,
): string {
  const site = show(info, 'serviceName', '서비스 이름');
  // 이 상품을 파는 신령. 목록에서 이 상품을 누른 손님은 같은 얼굴을 다시 만난다
  const spirit = spiritOf(product.category);
  const items = (CONTENTS[product.id] ?? []).map((t) => `<li>${bold(t)}</li>`).join('');
  const packs = Object.values(PACKAGES)
    .filter((p) => p.members.includes(product.id))
    .sort((a, b) => a.priceKrw - b.priceKrw);
  const alsoIn = packs.length
    ? `<p class="pd-also">이 리포트는 ${packs.map((p) => `<b>${esc(p.name)}</b>(${won(bundleMath(p.id).bundleKrw)})`).join(', ')} 묶음에도 들어 있습니다.</p>`
    : '';

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${renderSocialHead(info, {
    title: product.name,
    description: `${product.hook} ${product.description}`,
    path: `/products/${encodeURIComponent(product.id)}`,
  })}
${FONT_LINK}
<style>
:root{color-scheme:dark}
body{margin:0}
${PRODUCTS_CSS}
</style>
</head>
<body>
<section class="pr">
  <a class="pd-back" href="/products">← 판매 상품 전체 보기</a>
  ${images.has(product.id)
    ? `<img class="pd-hero" src="${imageUrl(product.id)}" alt="" width="280" height="373" decoding="async">`
    : ''}
  <p class="pr-hook">${esc(product.hook)}</p>
  <h2>${esc(product.name)}</h2>
  ${spirit ? renderSpiritPitch(spirit, product.id, faces) : ''}
  ${product.topic ? `<p class="pd-term">명리에서는 <b>${esc(TERM_OF[product.topic] ?? '')}</b>이라 부르는 자리입니다.</p>` : ''}
  <p class="pr-desc">${esc(product.description)}</p>

${renderFit(product.id)}

  ${items ? `<section class="pd-sec">
    <p class="pd-l">차례</p>
    <h3 class="pd-h">이 리포트에 담기는 것</h3>
    <ul class="pr-list">${items}</ul>
  </section>` : ''}

${renderSample(sample)}

  <section class="pd-sec pd-why">
    <p class="pd-l">이 집 계산</p>
    <h3 class="pd-h">그래서 믿어도 되는가</h3>
${renderWhy()}
  </section>

  <div class="pd-buy">
    <span class="pd-price">${won(product.priceKrw)}</span><span class="pr-vat"> (부가세 포함)</span>
    ${product.needsPartner ? '<p class="pd-also">두 사람의 생년월일이 필요합니다.</p>' : ''}
    ${product.needsPick
      // 택일은 태어난 날이 아직 없다. 첫 화면이 아니라 택일 화면으로 보낸다
      ? `<p class="pd-also">아직 태어나지 않았으므로 생년월일은 필요 없습니다.
        <a href="/pick">택일 화면</a>에서 <b>의사에게 받은 후보 날짜</b>를 넣으시면
        점수를 <b>공짜로</b> 먼저 보실 수 있고, 그 뒤에 이 리포트를 고르시면 됩니다.</p>`
      : ''}
    ${ready ? buyLink(product) : '<p class="pd-also"><b>결제 준비 중입니다.</b> 사주 명식·궁합·관상·손금 풀이는 지금도 결제 없이 이용하실 수 있습니다.</p>'}
    ${alsoIn}
  </div>

  <dl class="pd-terms">
    <dt>언제 받나요</dt>
    <dd>결제하시면 <b>바로</b> 보실 수 있습니다. 늦어도 ${DELIVERY_DUE_DAYS}일 이내에 드립니다.</dd>
    <dt>어떻게 받나요</dt>
    <dd>화면으로 보여 드립니다. 택배로 보내는 물건이 아닙니다.</dd>
    <dt>무르고 싶으면</dt>
    <dd>결제일부터 ${WITHDRAWAL_WINDOW_DAYS}일 안에 말씀하시면 돌려드립니다.
    글로 된 것이라 바꿔 드리는 것(교환)은 없고, 돈으로 돌려드립니다.
    <a href="/refund">자세한 규정</a></dd>
  </dl>

  <p class="pr-note">
  결제 전에 리포트 일부를 미리 보실 수 있으며, 결제일부터 ${WITHDRAWAL_WINDOW_DAYS}일 이내에
  청약철회가 가능합니다. 자세한 내용은 <a href="/refund">취소·환불 정책</a>을 참고해 주세요.<br>
  이 해석은 전통 명리 이론에 근거한 참고 자료이며, 의료·법률·투자 판단의 근거가 아닙니다.
  </p>
  <p><a class="pd-back" href="/">← ${esc(site)} 첫 화면</a></p>
</section>
<div style="height:24px"></div>
${footer}
</body>
</html>`;
}

/** 이런 분이 보시면 좋습니다 / 이건 안 보셔도 됩니다 */
function renderFit(productId: string): string {
  const fit = FIT[productId];
  if (!fit) return '';
  const ys = fit.yes.map((y) => `<li>${bold(y)}</li>`).join('');
  return `  <section class="pd-sec pd-fit">
    <p class="pd-l">고르기 전에</p>
    <h3 class="pd-h">이런 분이 보시면 좋습니다</h3>
    <ul class="pd-yes">${ys}</ul>
    <p class="pd-no"><b>이건 안 보셔도 됩니다 —</b> ${bold(fit.no)}</p>
  </section>`;
}

/**
 * 어떤 문장으로 나오는지.
 *
 * 그림으로 보여 주고 각주에 「실제로는 글로 드립니다」라고 적는 집이 있다.
 * 그건 화면에 보여 준 것을 안 주는 것이다. 우리는 **실제로 나가는 글**의
 * 앞부분을 그대로 보여 주고, 누구 것인지도 밝힌다.
 */
function renderSample(sample: { text: string; notice: string } | null): string {
  if (!sample?.text?.trim()) return '';
  return `  <section class="pd-sec">
    <p class="pd-l">맛보기</p>
    <h3 class="pd-h">어떤 문장으로 나오는지</h3>
    <div class="pd-samp">${esc(sample.text)}</div>
    <p class="pd-samp-n">${esc(sample.notice)}</p>
  </section>`;
}

/** 주제별 상품에 붙일 명리 용어. `packages/saju-rules` 의 이름표와 같은 값이다 */
const TERM_OF: Record<string, string> = {
  wealth: '재성(財星)', career: '관성(官星)', expression: '식상(食傷)',
  learning: '인성(印星)', peers: '비겁(比劫)', charm: '도화·홍염(桃花·紅艶)',
  travel: '역마(驛馬)', helper: '천을귀인(天乙貴人)',
};
