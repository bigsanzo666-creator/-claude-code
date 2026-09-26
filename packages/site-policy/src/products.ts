import { renderDailyReportProductPage } from './daily-product-page.ts';
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
  spiritOf, renderSpiritHead, renderSpiritPitch, SPIRITS_CSS, SPIRITS,
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
  'family-holiday-report': {
    yes: [
      '부모님 질문에 자꾸 말이 짧아지는 분',
      '시부모님 앞에서 할 말을 삼키는 분',
      '형제와 비교하는 말에 속상해지는 분',
      '가족 모임 뒤 배우자와 다투는 분',
    ],
    no: '평생 사주를 푸는 글이 아닙니다. **연휴 나흘과 한 상에 앉는 사람들**만 봅니다. 두 사람만 더 깊게 보시려면 **부모·자식 궁합**입니다.',
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
    no: '세 개만 받아 보고 정하실 거라면 **아이 이름 짓기**로 충분합니다. 값이 많이 다릅니다. 한자까지 겹치는지는 저희도 모릅니다 — 통계가 부르는 이름만 셉니다.',
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

  // ── 때를 묻는 것 ────────────────────────────────────────
  'marriage-timing-report': [
    '무엇을 배우자 자리로 보는지 — **남자는 재성, 여자는 관성**',
    '배우자가 앉는 자리(일지)가 무슨 글자인지',
    '**나이대(십 년)마다** 인연 쪽 결이 어떤지',
    '앞으로 **스무 해**를 한 해씩 견준 눈금과 그 까닭',
    '기운이 **제일 세게 들어오는 두 해** — 몇 살 몇 년인지',
    '왜 그 두 해인지 — 배우자 별이 드는지, 일지와 묶이는지, 도화가 닿는지',
    '날짜는 집지 않습니다. 자료의 눈금은 **해**까지입니다',
  ],
  'latelife-report': [
    '말년이 앉는 자리(시주)가 무슨 글자인지',
    '**예순 이후**의 십 년마다 — 간지와 그때의 십신',
    '십 년마다 채워야 할 기운이 드는지 덜어낼 기운이 드는지',
    '제일 편한 십 년과 제일 조심할 십 년',
    '시주와 걸리는 구간이 있으면 그 뜻',
    '**수명이나 병은 보지 않습니다.** 기운이 어느 쪽으로 도는지만 씁니다',
  ],
  'child-report': [
    '아이 사주 여덟 글자와 **진태양시·절기까지 맞춘** 계산 근거',
    '십신 비중과 오행 분포로 본 **타고난 결** — 아이 말로 풉니다',
    '부모가 **오해하기 쉬운 자리** — 야단칠 일이 아니라 타고난 결인 곳',
    '**앞으로 세 해를 달마다 — 서른여섯 달 전부**',
    '달마다 절입일과 절기 이름, 그 달의 간지, 아이에게 무슨 자리인지',
    '달마다 유리한지 조심할지, 명식과 걸리는 것이 있으면 그 뜻',
    '세 해를 통틀어 **특히 돌봐야 할 달**과 **밀어 줘도 좋은 달**',
    '달은 달력이 아니라 **절기로 끊습니다** — 달력으로 끊으면 월주가 어긋납니다',
  ],

  'single-report': [
    '무엇을 보고 달을 집는지 — 배우자 자리, 일지와 묶임, 도화·홍염, 용신',
    '**앞으로 세 해를 달마다** — 서른여섯 달을 하나씩',
    '그중 **인연 기운이 몰리는 달**을 짚어 드립니다',
    '달마다 절입일과 절기 이름, 그 달의 간지, 집은 까닭',
    '내 매력이 어디서 나오는지 (도화·홍염 자리)',
    '집힌 달에 **반드시 만난다는 뜻이 아닙니다** — 기운이 더 몰리는 달입니다',
  ],
  'letgo-report': [
    '무엇을 보고 달을 집는지 — 마음자리에 걸리는 것, 제 힘을 세우는 기운',
    '**앞으로 세 해를 달마다** — 서른여섯 달을 하나씩',
    '**마음이 다시 흔들릴 수 있는 달** — 미리 알면 그날 자기를 덜 탓합니다',
    '**제 힘이 돌아오는 달** — 비겁·인성이 드는 달',
    '**다시 만나는지는 보지 않습니다.** 그건 재회 리포트입니다',
  ],
  'child-aptitude-report': [
    '아이 사주 여덟 글자와 오행 분포',
    '**여덟 주제를 전부** — 돈·자리·재능·공부·사람·매력·이동·귀인',
    '주제마다 여덟 글자 **어디에서** 나왔는지',
    '**센 것 셋과 약한 것 셋** — 그래서 어느 결인지',
    '타고나지 않은 자리는 무엇인지, 없는 채로 어떻게 사는지',
    '앞으로 세 해의 학업·표현 쪽 흐름',
    '**직업이나 학과를 찍지 않습니다** — 어떤 일에서 덜 힘든지로 씁니다',
  ],
  'crush-compat-report': [
    '**두 축만 봅니다** — 일간 상성(첫인상과 끌림), 일지(얽히는 결)',
    '두 사람 각각의 매력이 어디서 나오는지 (도화·홍염)',
    '지금 밀 때인지 기다릴 때인지',
    '**오래갈지는 보지 않습니다.** 그건 궁합 리포트입니다',
    '**상대의 마음을 읽어 드리지 않습니다** — 기운이 어떻게 맞물리는지만',
  ],
  'reunion-report': [
    '궁합 **다섯 축 전부** — 무엇이 이어져 있고 무엇이 어긋나 있는지',
    '어긋나는 자리 — **감추지 않습니다.** 헤어진 까닭에 가까운 자리입니다',
    '**앞으로 세 해를 달마다** — 두 사람 자리가 다시 묶이는 달',
    '달마다 절입일과 간지와 까닭',
    '**돌아온다고 약속하지 않습니다.** 닿아도 전과 같지 않습니다',
  ],
  'family-holiday-report': [
    '앞으로 나흘 **날마다의 일진(日辰)** — 그날 기운이 내 일간과 맞는지 어긋나는지',
    '어느 날이 **말을 꺼내기 좋은 날**이고 어느 날이 참는 날인지 — 날짜를 짚어서',
    '한 상에 앉는 사람들끼리 **맞물리는 짝 전부** — 넷이면 여섯 짝, 나를 사이에 두지 않는 짝까지',
    '짝마다 **어느 축에서 그렇게 나왔는지** — 일간·일지·용신·오행·전체 다섯 축의 판정과 근거',
    '명절 자리에서 **내가 어떻게 반응하는 사람인지** — 비겁(比劫)과 식상(傷官)이 놓인 자리로',
    '그 사람에게 **피할 말과 꺼내도 되는 말** — 어느 글자에서 나온 말인지 밝혀서',
  ],
  'parent-child-report': [
    '부모와 아이의 명식을 나란히 — 오행과 십신',
    '**부딪히는 자리** — 이 리포트의 핵심입니다',
    '아이 명식에서 **부모가 어느 자리로 놓이는지**',
    '부모가 덜 부딪히는 방법 — 아이를 바꾸는 방법이 아니라',
    '**배우자 자리(일지)는 보지 않습니다** — 부모 자식 사이에 쓰는 자리가 아닙니다',
    '**점수를 앞세우지 않습니다** — 끊을 수 있는 관계가 아닙니다',
  ],

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
    '고르는 밭이 **세 배로 넓습니다** — 획수 짝 36가지, 쓸 수 있는 글자 360자',
    '(아이 이름 짓기는 획수 짝 12가지, 글자 60자에서 고릅니다)',
    '**대법원 출생신고 이름 통계**를 대조합니다 — 2023년과 2025년 각 100위',
    '지어 드린 이름마다 **최근 100위 안에 드는지** 한 줄로 밝힙니다',
    '100위 안에 드는 이름은 **피해서** 짓습니다',
    '**마음에 드실 때까지** 지어 드립니다 — 개수를 정해 두지 않습니다',
    '자료는 **부르는 이름(한글)** 기준입니다. 한자까지 같은지는 알 수 없어 그렇게 말하지 않습니다',
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
    '태어날 때 정해진 것(사주)과 살면서 새겨진 것(손금)을 **여덟 축으로** 대조',
    '축마다 두 갈래가 **같은 말을 하는지 엇갈리는지**',
    '타고난 기질과 실제로 살아온 방향이 얼마나 벌어졌는지',
    '벌어진 자리 — **감추지 않습니다.** 거기가 읽을 자리입니다',
    '한쪽만 말하는 것은 참고 수준이라고 따로 밝힙니다',
    '**얼굴은 보지 않습니다.** 셋을 다 겹치려면 삼합 리포트입니다',
  ],
  'saju-face-report': [
    '사주가 말하는 속과 얼굴이 말하는 겉을 **여덟 축으로** 대조',
    '축마다 두 갈래가 **같은 말을 하는지 엇갈리는지**',
    '남들이 보는 나와 내가 아는 나의 거리',
    '그 거리가 득이 되는 자리와 실이 되는 자리',
    '얼굴 사진은 **이 기기 밖으로 나가지 않습니다** — 브라우저 안에서만 재고 지웁니다',
    '**손금은 보지 않습니다.** 셋을 다 겹치려면 삼합 리포트입니다',
  ],
  'newyear-report': [
    '올해와 내년의 간지가 내 여덟 글자와 만나는 지점',
    '**올해 열두 달, 내년 열두 달 — 스물네 달을 하나씩**',
    '달마다 절입일과 절기 이름, 그 달의 간지, 유리한지 조심할지',
    '달은 달력이 아니라 **절기로 끊습니다**',
    '여덟 주제(돈·자리·재능·공부·사람·매력·이동·귀인)가 올해 어떤지',
    '지금 지나는 십 년(대운)이 어느 쪽인지',
    '**평생 사주를 푸는 글이 아닙니다** — 올해와 내년만 봅니다',
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
export const FONT_LINK = `<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/font-iropke-batang/1.2/font-iropke-batang.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Song+Myung&family=Noto+Serif+KR:wght@400;700;900&family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">`;

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
.pd-price-notice{margin:8px 0 12px;font-size:13.5px;color:#c9a34a;line-height:1.55}
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
.pd-samp{white-space:pre-wrap;font-size:14.5px;line-height:1.75;color:var(--nb-ink-2);
  padding:18px 18px;background:var(--nb-paper-3);border-radius:8px;word-break:keep-all}
.pd-samp-n{margin:12px 0 0;font-size:12.5px;line-height:1.7;color:var(--nb-ink-3);word-break:keep-all}

/* 「왜 늘봄인가」는 상품 화면 안에서는 한 칸으로 들어간다 */
.pd-why .why{margin:0;padding:0;border:0;background:none}

/* ══════ 상세페이지 전면 개편 스타일 (청월당 스타일) ══════ */
:root {
  --font-serif: 'Song Myung', 'Iropke Batang', 'Noto Serif KR', serif;
  --font-sans: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Noto Sans KR', sans-serif;
  --gold-primary: #d4af37;
  --gold-light: #f5d77f;
  --bg-card: #121018;
  --border-gold: rgba(212, 175, 55, 0.28);
}

body {
  font-family: var(--font-sans);
}

.pr {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 16px 36px 16px;
  box-sizing: border-box;
}

.pd-top-nav {
  padding: 14px 0 12px 0;
}

.pd-back {
  display: inline-block;
  color: rgba(245, 245, 247, 0.65);
  text-decoration: none;
  font-size: 0.86rem;
  transition: color 0.2s;
}

.pd-back:hover {
  color: var(--gold-light);
}

/* 1. 맨 위: 세로 3:4 그림과 이름만 */
.pd-hero-box {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  max-height: 540px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--border-gold);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7), 0 0 20px rgba(212, 175, 55, 0.15);
  background: #0d0c14;
  margin-bottom: 28px;
}

.pd-hero-box .pd-hero,
.pd-hero-img {
  width: 100%;
  height: 100%;
  max-width: none;
  aspect-ratio: auto;
  margin: 0;
  border: none;
  object-fit: cover;
  display: block;
}

.pd-hero-scrim {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 65%;
  background: linear-gradient(to top, rgba(0,0,0,.88) 0%, rgba(0,0,0,.55) 45%, transparent 100%);
  pointer-events: none;
}

.pd-hero-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20px 20px 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  pointer-events: none;
  box-sizing: border-box;
}

.pd-hero-spirit {
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--gold-light);
  /* 한글은 자간을 벌리면 글자가 따로 논다 — 0.18em 이면 「도 화 신 령」 으로 읽힌다.
     uppercase 는 한글에 아무 일도 하지 않으므로 뺀다 */
  letter-spacing: 0.06em;
  text-shadow: 0 2px 4px rgba(0,0,0,0.9);
}

.pd-hero-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 2.15rem;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.02em;
  background: linear-gradient(180deg, #ffffff 20%, #f5d77f 70%, #d4af37 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.95));
  word-break: keep-all;
}

.pd-hero-hook {
  margin: 2px 0 0 0;
  font-family: var(--font-sans);
  font-size: 0.92rem;
  color: rgba(245, 245, 247, 0.9);
  line-height: 1.4;
  word-break: keep-all;
  text-shadow: 0 2px 6px rgba(0,0,0,0.95);
}

/* 신령 소개 한마디 (pitch) */
.pd-pitch-box {
  background: rgba(26, 22, 34, 0.65);
  border: 1px solid rgba(212, 175, 55, 0.25);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 24px;
}

.pr-desc {
  font-size: 0.95rem;
  color: rgba(245, 245, 247, 0.85);
  line-height: 1.7;
  margin: 0 0 24px 0;
  word-break: keep-all;
}

.pd-term {
  font-size: 0.88rem;
  color: var(--gold-light);
  margin: 0 0 16px 0;
}

/* 3. 덩어리마다 다르게 생기게 (여백 확대 + 뚜렷한 제목) */
.pd-sec {
  margin: 36px 0;
}

.pd-l {
  font-size: 0.78rem;
  color: var(--gold-light);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0 0 4px 0;
}

.pd-h {
  font-family: var(--font-serif);
  font-size: 1.45rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 16px 0;
  letter-spacing: -0.01em;
}

/* 3-a. 이런 분이 보시면 좋습니다 (체크 목록, 배경 없음) */
.pd-fit {
  background: transparent;
  border: none;
  padding: 0;
}

.pd-yes {
  list-style: none;
  padding: 0;
  margin: 0 0 16px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pd-yes li {
  position: relative;
  padding-left: 24px;
  font-size: 0.93rem;
  line-height: 1.55;
  color: rgba(245, 245, 247, 0.92);
}

.pd-yes li::before {
  content: '✓';
  position: absolute;
  left: 0;
  top: 0;
  color: var(--gold-primary);
  font-weight: 700;
  font-size: 1rem;
}

.pd-no {
  background: rgba(24, 18, 22, 0.85);
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 0.86rem;
  color: rgba(245, 245, 247, 0.75);
  line-height: 1.5;
  margin: 0;
}

.pd-no b {
  color: var(--gold-light);
}

/* 3-b. 이 리포트에 담기는 것 (번호 목록 + 금색 세로선) */
.pd-contents-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-left: 2.5px solid var(--gold-primary);
  padding-left: 16px;
  margin-top: 10px;
}

.pd-content-item {
  position: relative;
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 0.93rem;
  color: rgba(245, 245, 247, 0.92);
  line-height: 1.55;
}

.pd-content-num {
  font-family: var(--font-sans);
  font-weight: 700;
  color: var(--gold-light);
  font-size: 0.84rem;
  flex-shrink: 0;
}

/* 2. 가운데: 맛보기 (문장 한 번 + 목차) */
.pd-sample-lead {
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--gold-light);
  margin: 0 0 12px;
  line-height: 1.5;
}

.pd-sample-card {
  background: var(--bg-card);
  border: 1px solid var(--border-gold);
  border-radius: 12px;
  padding: 18px 20px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.pd-sample-body {
  position: relative;
  font-family: var(--font-serif);
  font-size: 0.94rem;
  color: rgba(245, 245, 247, 0.88);
  line-height: 1.75;
  word-break: keep-all;
  white-space: pre-wrap;
  max-height: 140px;
  overflow: hidden;
}

.pd-sample-fade {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 48px;
  background: linear-gradient(to top, var(--bg-card) 20%, transparent 100%);
  pointer-events: none;
}

.pd-sample-toc {
  list-style: none;
  margin: 16px 0 0;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pd-sample-toc-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 0.92rem;
  line-height: 1.55;
}

.pd-sample-toc-num {
  font-family: var(--font-serif);
  color: var(--gold-light);
  font-weight: 700;
  font-size: 0.88rem;
  white-space: nowrap;
  flex: 0 0 auto;
}

.pd-sample-toc-title {
  font-family: var(--font-serif);
  color: rgba(245, 245, 247, 0.92);
  word-break: keep-all;
}

.pd-samp-n {
  font-size: 0.78rem;
  color: rgba(245, 245, 247, 0.5);
  margin-top: 10px;
  word-break: keep-all;
}

/* 3-c. 그래서 믿어도 되는가 (2칸 비교표) */
.pd-why table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-card);
  border: 1px solid var(--border-gold);
  border-radius: 10px;
  overflow: hidden;
  font-size: 0.86rem;
}

.pd-why th, .pd-why td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-align: left;
}

.pd-why th {
  background: rgba(212, 175, 55, 0.12);
  color: var(--gold-light);
  font-weight: 700;
}

/* 명절 가족운세 전용: 이 집 계산 (3문단) */
.pd-why-custom {
  background: var(--bg-card);
  border: 1px solid var(--border-gold);
  border-radius: 12px;
  padding: 20px 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.pd-why-custom p {
  margin: 0 0 16px 0;
  font-size: 0.94rem;
  line-height: 1.8;
  color: rgba(245, 245, 247, 0.88);
  word-break: keep-all;
}

.pd-why-custom p:last-child {
  margin-bottom: 0;
}

/* 명절 가족운세 전용: FAQ Q&A */
.pd-faq-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pd-faq-item {
  background: var(--bg-card);
  border: 1px solid var(--border-gold);
  border-radius: 12px;
  padding: 18px 18px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.pd-faq-q {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}

.pd-faq-badge {
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: 1.05rem;
  color: var(--gold-light);
  flex-shrink: 0;
}

.pd-faq-q h4 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.02rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.45;
  word-break: keep-all;
}

.pd-faq-a {
  display: flex;
  align-items: baseline;
  gap: 10px;
  border-top: 1px solid rgba(212, 175, 55, 0.12);
  padding-top: 10px;
}

.pd-faq-badge-a {
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: 0.98rem;
  color: rgba(245, 245, 247, 0.45);
  flex-shrink: 0;
}

.pd-faq-a p {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.68;
  color: rgba(245, 245, 247, 0.88);
  word-break: keep-all;
}

/* 화면 아래에 붙어 따라다니는 사는 자리 */
.pd-sticky{position:fixed;left:0;right:0;bottom:0;z-index:40;
  display:flex;align-items:center;gap:12px;
  padding:10px 16px calc(10px + env(safe-area-inset-bottom));
  background:rgba(10,8,16,.96);border-top:1px solid rgba(212,175,55,.35);
  backdrop-filter:blur(8px)}
.pd-sticky-price{flex:1 1 auto;font-family:var(--nb-serif);font-size:20px;color:#f3e5ab;
  display:flex;align-items:baseline;gap:6px;white-space:nowrap}
.pd-sticky-price small{font-size:11px;color:#9a93a6;font-family:inherit}
.pd-sticky-go{flex:0 0 auto;padding:12px 26px;border-radius:8px;text-decoration:none;
  font-size:16px;font-weight:800;color:#1a1208;
  background:linear-gradient(135deg,#d4af37,#f0d478)}
/* 띠가 맨 아래 글을 가리지 않게 자리를 비워 둔다 */
body{padding-bottom:72px}
@media (min-width:760px){.pd-sticky{max-width:720px;margin:0 auto;border-radius:12px 12px 0 0}}

/* 4. 맨 아래: 값과 결제 */
.pd-buy {
  background: linear-gradient(135deg, rgba(28, 22, 38, 0.95) 0%, rgba(14, 11, 20, 0.98) 100%);
  border: 1px solid var(--border-gold);
  border-radius: 16px;
  padding: 24px 20px;
  text-align: center;
  margin: 40px 0 28px 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.pd-price {
  font-family: var(--font-serif);
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--gold-light);
  letter-spacing: -0.02em;
}

.pr-vat {
  font-size: 0.84rem;
  color: rgba(245, 245, 247, 0.6);
  margin-left: 4px;
}

.pd-also {
  font-size: 0.85rem;
  color: rgba(245, 245, 247, 0.7);
  line-height: 1.55;
  margin: 10px 0 0 0;
}

.pd-also a {
  color: var(--gold-light);
  text-decoration: underline;
}

/* 5. 다른 상품으로 넘기기 (같은 갈래/연계 상품) */
.pd-cross-box {
  background: rgba(18, 14, 24, 0.7);
  border: 1px solid var(--border-gold);
  border-radius: 14px;
  padding: 18px;
  margin: 32px 0;
}

.pd-cross-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.pd-cross-spirit-img {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1.5px solid var(--gold-primary);
  object-fit: cover;
  flex-shrink: 0;
}

.pd-cross-speech {
  font-family: var(--font-serif);
  font-size: 0.88rem;
  color: var(--gold-light);
  line-height: 1.45;
  word-break: keep-all;
}

.pd-cross-items {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.pd-cross-card {
  display: flex;
  flex-direction: column;
  background: rgba(8, 6, 12, 0.8);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 10px;
  overflow: hidden;
  text-decoration: none;
  transition: transform 0.2s, border-color 0.2s;
}

.pd-cross-card:hover {
  border-color: var(--gold-primary);
  transform: translateY(-2px);
}

.pd-cross-thumb {
  width: 100%;
  /* 상품 그림은 세로 3:4 다. 3:2 로 눌러 담으면 인물 얼굴이 잘려 나간다 */
  aspect-ratio: 3 / 4;
  object-fit: cover;
  object-position: center 22%;
  display: block;
}

.pd-cross-info {
  padding: 8px 10px;
}

.pd-cross-title {
  font-family: var(--font-serif);
  font-size: 0.84rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
  line-height: 1.3;
}

/* 4-b. 이용 안내 및 약관 세 줄 */
.pd-terms {
  margin: 28px 0 16px 0;
  padding: 0;
  font-size: 0.82rem;
  color: rgba(245, 245, 247, 0.65);
  line-height: 1.6;
}

.pd-terms dt {
  color: rgba(245, 245, 247, 0.88);
  font-weight: 700;
  margin-top: 10px;
}

.pd-terms dd {
  margin: 2px 0 0 0;
}

.pd-terms a {
  color: var(--gold-light);
  text-decoration: underline;
}

.pr-note {
  font-size: 0.76rem;
  color: rgba(245, 245, 247, 0.45);
  line-height: 1.5;
  margin: 20px 0 24px 0;
}

.pr-note a {
  color: rgba(212, 175, 55, 0.75);
}

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
  const go = `/checkout?product=${encodeURIComponent(product.id)}`;
  if (product.needsPartner) {
    return `<a class="pd-go" href="${go}">두 사람 생년월일 넣고 받기</a>`;
  }
  if (product.needsFace) {
    return `<a class="pd-go" href="${go}">얼굴·손까지 넣고 받기</a>`
      + '<p class="pd-also">사진은 기기 밖으로 나가지 않습니다. 화면에서 특징만 고르시면 됩니다.</p>';
  }
  return `<a class="pd-go" href="${go}">생년월일 넣고 받기</a>`
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
  initialQuery?: { date?: string; time?: string; place?: string; gender?: string },
): string {
  if (product.id === 'daily-report') {
    return renderDailyReportProductPage(product, info, ready, footer, images, faces, sample, initialQuery);
  }
  const site = show(info, 'serviceName', '서비스 이름');
  const spirit = spiritOf(product.category);

  // 이 리포트에 담기는 것 (번호 목록 + 금색 세로선)
  const rawContents = CONTENTS[product.id] ?? [];
  const contentsItems = rawContents.map((t, idx) => {
    return `<div class="pd-content-item">
      <span class="pd-content-num">${idx + 1}.</span>
      <span>${bold(t)}</span>
    </div>`;
  }).join('\n');

  const packs = Object.values(PACKAGES)
    .filter((p) => p.members.includes(product.id))
    .sort((a, b) => a.priceKrw - b.priceKrw);
  const alsoIn = packs.length
    ? `<p class="pd-also">이 리포트는 ${packs.map((p) => `<b>${esc(p.name)}</b>(${won(bundleMath(p.id).bundleKrw)})`).join(', ')} 묶음에도 들어 있습니다.</p>`
    : '';

  // 5. 다른 상품으로 넘기기 (같은 갈래 다른 상품 둘셋)
  const otherProducts = Object.values(CATALOG)
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 2);

  let crossSection = '';
  if (spirit && otherProducts.length > 0) {
    const speech = spirit.greet || '함께 살펴보면 좋은 리포트입니다.';
    const spiritFaceTag = faces.has(spirit.id)
      ? `<img src="/img/spirits/${spirit.id}" alt="${spirit.name}" class="pd-cross-spirit-img" loading="lazy" width="38" height="38">`
      : `<span class="sp-seal pd-cross-spirit-img" style="display:inline-flex;align-items:center;justify-content:center;">${spirit.seal}</span>`;

    crossSection = `
  <div class="pd-cross-box">
    <div class="pd-cross-header">
      ${spiritFaceTag}
      <div class="pd-cross-speech">"${esc(speech)}"</div>
    </div>
    <div class="pd-cross-items">
      ${otherProducts.map((op) => {
        const opThumb = images.has(op.id)
          ? `<img src="/img/products/${op.id}" alt="" class="pd-cross-thumb" loading="lazy" width="160" height="213">`
          : '';
        return `
        <a href="/products/${encodeURIComponent(op.id)}" class="pd-cross-card">
          ${opThumb}
          <div class="pd-cross-info">
            <h4 class="pd-cross-title">${esc(op.name)}</h4>
          </div>
        </a>`;
      }).join('')}
    </div>
  </div>`;
  }

  const cleanHook = (product.hook || '').replace(/^[\"\'\s]+|[\"\'\s]+$/g, '');

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
  <div class="pd-top-nav">
    <a class="pd-back" href="/products">← 판매 상품 전체 보기</a>
  </div>

  ${images.has(product.id)
    ? `<div class="pd-hero-box">
        <img class="pd-hero" src="${imageUrl(product.id)}" alt="" width="390" height="520" loading="eager" decoding="async">
        <div class="pd-hero-scrim"></div>
        <div class="pd-hero-overlay">
          ${spirit ? `<div class="pd-hero-spirit">${esc(spirit.name)}</div>` : ''}
          <h1 class="pd-hero-title">${esc(product.name)}</h1>
          <p class="pd-hero-hook">"${esc(cleanHook)}"</p>
        </div>
      </div>`
    : `<div style="margin-bottom: 24px;">
        <p class="pr-hook">${esc(product.hook)}</p>
        <h2>${esc(product.name)}</h2>
      </div>`}

  ${spirit ? `<div class="pd-pitch-box">${renderSpiritPitch(spirit, product.id, faces)}</div>` : ''}
  ${product.topic ? `<p class="pd-term">명리에서는 <b>${esc(TERM_OF[product.topic] ?? '')}</b>이라 부르는 자리입니다.</p>` : ''}
  <p class="pr-desc">${esc(product.description)}</p>

${renderFit(product.id)}

  ${rawContents.length > 0 ? `<section class="pd-sec">
    <p class="pd-l">차례</p>
    <h3 class="pd-h">이 리포트에 담기는 것</h3>
    <div class="pd-contents-list">
      ${contentsItems}
    </div>
  </section>` : ''}

${renderSample(sample, product.id)}

  <section class="pd-sec pd-why">
    <p class="pd-l">이 집 계산</p>
    <h3 class="pd-h">그래서 믿어도 되는가</h3>
${product.id === 'family-holiday-report' ? renderFamilyWhy() : renderWhy()}
  </section>

  ${product.id === 'family-holiday-report' ? renderHesitations() : ''}

  <div class="pd-buy">
    <span class="pd-price">${won(product.priceKrw)}</span><span class="pr-vat"> (부가세 포함)</span>
    ${product.id === 'family-holiday-report'
      ? '<p class="pd-price-notice">오픈 기념 · 추석 한정가입니다. 39,900원으로 올라갑니다 — 9월 28일부터</p>'
      : ''}
    ${product.needsPartner ? '<p class="pd-also">두 사람의 생년월일이 필요합니다.</p>' : ''}
    ${product.needsPick
      ? `<p class="pd-also">아직 태어나지 않았으므로 생년월일은 필요 없습니다.
        <a href="/pick">택일 화면</a>에서 <b>의사에게 받은 후보 날짜</b>를 넣으시면
        점수를 <b>공짜로</b> 먼저 보실 수 있고, 그 뒤에 이 리포트를 고르시면 됩니다.</p>`
      : ''}
    ${ready ? buyLink(product) : '<p class="pd-also"><b>결제 준비 중입니다.</b> 사주 명식·궁합·관상·손금 풀이는 지금도 결제 없이 이용하실 수 있습니다.</p>'}
    ${alsoIn}
  </div>

  ${crossSection}

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
${stickyBuy(product, ready)}
<script>
(function(){
  try{
    var m = location.search.match(/[?&]ref=([a-zA-Z0-9_-]+)/);
    if(m && m[1] && !sessionStorage.getItem('nb_ref')){
      sessionStorage.setItem('nb_ref', m[1].toLowerCase().slice(0, 20));
    }
  }catch(e){}
})();
</script>
</body>
</html>`;
}

/**
 * 화면 아래에 붙어 따라다니는 사는 자리.
 *
 * 상세페이지는 휴대폰 화면으로 일곱 장이 넘는다. 값과 사는 단추는 **맨 아래에만**
 * 있어서, 중간에서 마음이 선 손님이 사려면 끝까지 내려가야 했다. 그 사이에
 * 마음이 식는다.
 *
 * 값을 위로 올리지는 않는다 — 사장님이 값은 맨 아래에만 두기로 정했다.
 * 대신 **아래에 붙은 띠**로 언제든 살 자리로 갈 수 있게 한다. 값은 그 띠에도
 * 적는다. 값을 숨긴 채 단추만 내미는 것은 손님을 속이는 것이다.
 *
 * 거짓 급함("오늘 마감")을 쓰지 않는다. 띠는 늘 같은 말을 한다.
 */
function stickyBuy(product: Product, ready: boolean): string {
  if (!ready || product.needsPick) return '';
  const note = product.id === 'family-holiday-report'
    ? '<small class="pd-sticky-note" style="display:block;font-size:10.5px;color:#c9a34a;margin-top:2px">9월 28일부터 39,900원</small>'
    : '';
  return `<div class="pd-sticky">
    <span class="pd-sticky-price">${won(product.priceKrw)}<small>부가세 포함</small>${note}</span>
    <a class="pd-sticky-go" href="/checkout?product=${encodeURIComponent(product.id)}">받기</a>
  </div>`;
}
/** 이런 분이 보시면 좋습니다 / 이건 안 보셔도 됩니다 */
export function renderFit(productId: string): string {
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
function renderFamilyWhy(): string {
  return `<div class="pd-why-custom">
    <p>풀이의 출발점은 짐작이 아니라 계산입니다. 본인과 함께 볼 가족들의 생년월일을 바탕으로, 만세력과 절기 기준에 따라 사주 글자를 계산합니다. 부모·시부모·형제·배우자 중에서 본인 포함 넷까지 같은 값으로 함께 봅니다.</p>
    <p>결론마다 그 말이 나온 글자를 밝힙니다. 그날의 기운이 왜 나에게 순하거나 거칠다고 보는지, 두 사람은 어느 지점에서 부딪힌다고 읽는지. 계산으로 얻은 글자와 풀이의 근거를 함께 보여드립니다.</p>
    <p>큰 글씨는 일상에서 쓰는 말로 적습니다. 그 옆 작은 글씨에는 명리 용어와 한 줄 뜻을 붙입니다. 계산한 사주를 바탕으로 읽는 해석이며, 실제 가족의 말과 행동을 확정하는 답은 아닙니다.</p>
  </div>`;
}

function renderHesitations(): string {
  return `  <section class="pd-sec pd-faq">
    <p class="pd-l">자주 묻는 질문</p>
    <h3 class="pd-h">망설여지는 점</h3>
    <div class="pd-faq-list">
      <div class="pd-faq-item">
        <div class="pd-faq-q">
          <span class="pd-faq-badge">Q.</span>
          <h4>가족 모두의 생년월일이 필요한가요?</h4>
        </div>
        <div class="pd-faq-a">
          <span class="pd-faq-badge-a">A.</span>
          <p>내 생년월일과, 함께 볼 가족의 생년월일이 필요합니다.<br>본인 포함 넷까지 같은 값이고, 다섯째부터 한 분당 1만원이 더 붙습니다.<br>최대 여섯 명까지 넣으실 수 있습니다.</p>
        </div>
      </div>
      <div class="pd-faq-item">
        <div class="pd-faq-q">
          <span class="pd-faq-badge">Q.</span>
          <h4>사주를 몰라도 읽을 수 있나요?</h4>
        </div>
        <div class="pd-faq-a">
          <span class="pd-faq-badge-a">A.</span>
          <p>쉬운 말로 풀고, 명리 용어 옆에는 한 줄 뜻을 붙입니다.</p>
        </div>
      </div>
      <div class="pd-faq-item">
        <div class="pd-faq-q">
          <span class="pd-faq-badge">Q.</span>
          <h4>안 좋은 말만 듣고 더 신경 쓰이지 않을까요?</h4>
        </div>
        <div class="pd-faq-a">
          <span class="pd-faq-badge-a">A.</span>
          <p>불안하게 단정하지 않습니다. 부딪히는 이유와, 피할 말·꺼내도 되는 말을 근거와 함께 알려드립니다.</p>
        </div>
      </div>
    </div>
  </section>`;
}

function renderSample(
  sample: { text: string; notice: string } | null,
  productId?: string,
): string {
  if (!sample?.text?.trim()) return '';

  const chapters = (productId && CONTENTS[productId]) ? CONTENTS[productId] : [];
  const numKoreanCount = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
  const numKorean = ['하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];

  let leadLine = '';
  let tocHtml = '';

  if (chapters.length > 0) {
    const countWord = numKoreanCount[chapters.length]
      ? `${numKoreanCount[chapters.length]} 가지`
      : `${chapters.length}가지`;
    leadLine = `<p class="pd-sample-lead">아래 ${countWord}가 이런 문장으로 나옵니다</p>`;

    const tocItems = chapters.map((ch, idx) => {
      const numText = numKorean[idx] || String(idx + 1);
      const cleanTitle = ch.replace(/\*\*/g, '');
      return `      <li class="pd-sample-toc-item">
        <span class="pd-sample-toc-num">${numText}.</span>
        <span class="pd-sample-toc-title">${esc(cleanTitle)}</span>
      </li>`;
    }).join('\n');

    tocHtml = `    <ul class="pd-sample-toc">\n${tocItems}\n    </ul>`;
  }

  return `  <section class="pd-sec">
    <p class="pd-l">맛보기</p>
    <h3 class="pd-h">어떤 문장으로 나오는지</h3>
    ${leadLine}
    <div class="pd-sample-card">
      <div class="pd-sample-body">
        ${esc(sample.text)}
        <div class="pd-sample-fade"></div>
      </div>
    </div>
    ${tocHtml}
    <p class="pd-samp-n">${esc(sample.notice)}</p>
  </section>`;
}
/** 주제별 상품에 붙일 명리 용어. `packages/saju-rules` 의 이름표와 같은 값이다 */
const TERM_OF: Record<string, string> = {
  wealth: '재성(財星)', career: '관성(官星)', expression: '식상(食傷)',
  learning: '인성(印星)', peers: '비겁(比劫)', charm: '도화·홍염(桃花·紅艶)',
  travel: '역마(驛馬)', helper: '천을귀인(天乙貴人)',
};
