import { orderable } from '../../../packages/commerce/src/orderable.ts';
/**
 * 리포트에 넘길 데이터를 서버가 직접 만든다.
 *
 * 클라이언트가 계산 결과를 보내오게 하면 안 된다. 그러면 아무 값이나 만들어
 * 보내서 원하는 리포트를 뽑을 수 있다. 서버는 생년월일 같은 **입력만** 받고
 * 결과는 스스로 계산한다 — 어차피 결정론이라 결과가 같다.
 */

import { calculate } from '../../../packages/manseryeok/src/index.ts';
import {
  analyze, calculateDaeun, currentDaeun, annualLuck,
  compatibility, sajuToTraits, crossValidate, groupElement, dailyLuck,
  extractTopic, allTopics, type TopicId,
  marriageTiming, lateLife, monthlyLuck,
} from '../../../packages/saju-rules/src/index.ts';
import { pickDays, mergeHours, bestPerDay, slotSpan, slotLabel } from '../../../packages/saju-rules/src/index.ts';
import { readFace, NEUTRAL_FEATURES } from '../../../packages/physiognomy/src/index.ts';
import { readPalm, NEUTRAL_PALM_FEATURES } from '../../../packages/palmistry/src/index.ts';
import { nameField, type NameWish } from '../../../packages/naming/src/index.ts';
import { CATALOG, type ProductId } from '../../../packages/commerce/src/index.ts';
import { cleanQuestion, type ReportKind } from '../../../packages/report/src/prompt.ts';

export interface BirthInput {
  date: string;
  time: string | null;
  longitude?: number;
  gender?: '남' | '여';
  name?: string;
}

/** 택일에 넣는 것. 아직 태어나지 않았으므로 생년월일이 없다 */
export interface PickInput {
  /** 의사가 된다고 한 날들 */
  dates: string[];
  /** 수술이 가능한 시각들. 화면에서는 「07~08시」처럼 폭으로 고르고 값은 그 한가운데다 */
  times: string[];
  /** 태어날 곳의 경도. 시주는 그곳의 해 위치로 선다 */
  longitude?: number;
  /** 태어날 곳 이름. 글에 그대로 쓴다 */
  place?: string;
}

/** 작명에 넣는 것. 아이의 사주는 birth 로 받고, 여기에는 집안 사정을 받는다 */
export interface NameInput {
  /** 성. 「김」처럼 한글로 받거나 「金」처럼 한자로 받는다 */
  surname: string;
  /** 돌림자. 형제가 쓰는 글자를 그대로 이어 갈 때만 */
  fixed?: { char: string; at: '앞' | '뒤' };
  /** 쓰고 싶지 않은 글자 */
  avoid?: string[];
}

export interface ReadingRequest {
  productId: ProductId;
  birth: BirthInput;
  /** 택일 상품에서만 쓴다 */
  pick?: PickInput;
  /** 작명 상품에서만 쓴다 */
  name?: NameInput;
  /** 궁합용 상대 */
  partner?: BirthInput;
  /** 교차검증용 관상·손금 특징 */
  face?: Parameters<typeof readFace>[0];
  palm?: Parameters<typeof readPalm>[0];
  /**
   * 손님이 신령에게 직접 물은 것 한 가지.
   *
   * 화면에서 신령이 「원하는 것 하나를 말해 보렴」이라고 했으니 여기로 받아
   * 리포트까지 실어 보낸다. 안 적었으면 없는 채로 간다.
   */
  question?: string;
}

/**
 * 상품 → 리포트 갈래.
 *
 * 상품은 열셋이지만 갈래는 셋뿐이다. 주제별 상품(돈그릇·출세운 …)은
 * 전부 하나의 명식에서 나오므로 「사주」 갈래를 쓴다 — 계산은 한 번,
 * 파는 건 열 번이라는 구조가 여기에도 그대로 적용된다.
 *
 * 빠짐없이 적는 대신 예외만 적는다. 상품이 늘 때마다 이 표를 고치는 것을
 * 잊으면 그 상품은 조용히 잘못된 갈래로 나가는데, 기본값을 두면 그 사고가 없다.
 */
/**
 * 주제별 상품이 어느 주제를 보는가.
 *
 * ## 이걸 안 하고 있었다
 *
 * 룰 엔진에는 주제별로 명식을 자르는 장치(`extractTopic`)가 처음부터 있었는데
 * **유료 리포트가 그걸 한 번도 부르지 않았다.** 그래서 돈그릇(14,900원)을 산
 * 손님과 사주 종합(34,900원)을 산 손님이 **글자 하나까지 같은 글**을 받고
 * 있었다. 캐시 열쇠까지 같아서 정말로 같은 글이 나갔다.
 *
 * 값이 다른데 물건이 같으면 그건 파는 것이 아니다. 여기서 끊는다.
 *
 * ## 그래서 무엇이 달라지는가
 *
 * 주제 상품은 **여덟 글자와 그 주제 하나**를 받는다.
 * 사주 종합은 **여덟 글자와 여덟 주제 전부**에 대운 전체·신살·특징까지 받는다.
 * 값 차이가 물건 차이로 선다.
 */
interface TopicScope {
  /** 볼 주제들. 여럿이면 그만큼 넓게 본다 */
  topics: TopicId[];
  /** 손님이 이 상품을 누르며 품은 물음. 글이 여기에 답해야 한다 */
  asks: string;
  /** 몇 해치 세운을 실을 것인가. 때를 묻는 상품일수록 길게 */
  years: number;
}

const TOPIC_OF_PRODUCT: Partial<Record<ProductId, TopicScope>> = {
  'wealth-report': { topics: ['wealth'], asks: '내 돈그릇은 얼마만 한가', years: 3 },
  'career-report': { topics: ['career'], asks: '이 일을 계속하는 게 맞는가', years: 3 },
  'expression-report': { topics: ['expression'], asks: '나는 무엇을 잘 타고났는가', years: 3 },
  'peers-report': { topics: ['peers'], asks: '사람과는 어떻게 지내는 편인가', years: 3 },
  'helper-report': { topics: ['helper'], asks: '나를 도와줄 사람은 어디에 있는가', years: 3 },
  'learning-report': { topics: ['learning'], asks: '공부와 문서의 일은 어떤가', years: 3 },
  'travel-report': { topics: ['travel'], asks: '자리를 옮기는 일은 어떤가', years: 3 },

  /*
   * 아래 셋은 위의 것과 뿌리가 겹친다. 그래서 **보는 자리를 넓혀서** 가른다.
   * 같은 자료에 이름만 달리 붙이면 그건 같은 물건을 두 값에 파는 것이다.
   */
  // 시험은 문서의 기운에 **자리를 얻는 기운**을 겹쳐 본다. 때가 중요하니 세운을 길게
  'exam-report': { topics: ['learning', 'career'], asks: '이번 시험에 붙을 수 있는가', years: 5 },
  // 진학은 문서의 기운에 **타고난 결(재능)**을 겹쳐 본다. 어느 쪽으로 보낼지의 물음이다
  'admission-report': { topics: ['learning', 'expression'], asks: '어느 쪽으로 가야 이 아이가 덜 힘든가', years: 3 },
  // 취업은 자리의 기운에 문서의 기운을 겹쳐 본다
  'job-report': { topics: ['career', 'learning'], asks: '내 자리는 언제 어디서 열리는가', years: 5 },
};

/**
 * 교차검증 상품이 **실제로 대조하는 갈래**.
 *
 * 상품 이름과 설명이 곧 약속이다. 「사주 × 손금」이라고 팔았으면 관상은
 * 싣지 않는다. 자료에 있으면 모델은 결국 쓴다.
 */
const CROSS_SOURCES: Partial<Record<ProductId, { 사주: boolean; 관상: boolean; 손금: boolean }>> = {
  // 생년월일을 아예 받지 않는 상품이다. 사주가 실리면 거짓말이 된다
  'face-palm-report': { 사주: false, 관상: true, 손금: true },
  'saju-palm-report': { 사주: true, 관상: false, 손금: true },
  'saju-face-report': { 사주: true, 관상: true, 손금: false },
  'cross-report': { 사주: true, 관상: true, 손금: true },
  'charm-report': { 사주: true, 관상: true, 손금: true },
};

/** 그 상품이 보는 축만 남긴다. 비워 두면 여덟 축을 다 본다 */
const CROSS_AXES: Partial<Record<ProductId, string[]>> = {
  // 매력은 사람을 끌어들이는 힘과 밖으로 내보이는 힘에서 나온다
  'charm-report': ['대인관계', '표현력'],
};

const KIND_EXCEPTIONS: Partial<Record<ProductId, ReportKind>> = {
  // 두 사람의 명식을 대조하는 것은 전부 「궁합」 갈래다
  'compat-report': '궁합',
  'crush-compat-report': '궁합',
  'reunion-report': '궁합',
  'parent-child-report': '궁합',
  // 세 갈래를 대조하는 것
  'cross-report': '교차검증',
  'charm-report': '교차검증',
  // 사람이 아니라 **날**을 보는 것
  'pick-report': '택일',
  // 오늘 하루의 흐름을 보는 것
  'daily-report': '오늘운세',
  /*
   * 때를 묻는 상품들.
   *
   * 셋 다 여덟 글자를 통째로 받아 가고 있었다. 재료가 같으니 나오는 글도
   * 같았다 — 결혼 시기와 노후 말년과 우리 아이가 한 글자도 안 다른 글을
   * 받았다. 상품이 묻는 것이 다르면 재료도 달라야 한다.
   */
  'marriage-timing-report': '결혼시기',
  'latelife-report': '말년',
  'child-report': '아이',
};

export function kindOf(productId: ProductId): ReportKind {
  const listed = KIND_EXCEPTIONS[productId];
  if (listed) return listed;
  if (TOPIC_OF_PRODUCT[productId]) return '주제';
  // 얼굴과 손을 받는 상품은 전부 교차검증이다. 표에 적는 것을 잊어도 여기서 걸린다
  if (CATALOG[productId]?.needsFace) return '교차검증';
  // 성을 받는 상품은 전부 작명이다
  if (CATALOG[productId]?.needsName) return '작명';
  return '사주';
}

/** @deprecated `kindOf()`를 쓸 것. 기존 호출부 호환용 */
export const KIND_OF = new Proxy({} as Record<ProductId, ReportKind>, {
  get: (_t, key: string) => kindOf(key as ProductId),
});

function sajuBundle(birth: BirthInput) {
  const ms = calculate({ date: birth.date, time: birth.time, longitude: birth.longitude });
  const an = analyze(ms);
  const daeun = calculateDaeun(ms, birth.gender ?? '남', an.yongsin);
  const year = new Date().getFullYear();
  return { ms, an, daeun, age: year - ms.meta.solarYear, year };
}

/**
 * 묶음이면 편마다 하나씩, 단품이면 한 편.
 *
 * 묶음도 리포트를 새로 쓰는 것이 아니라 **구성 상품을 그대로 여러 편 만든다.**
 * 그래야 낱개로 산 사람과 묶음으로 산 사람이 같은 글을 받는다.
 */
export function buildPayloads(
  req: ReadingRequest,
): { productId: ProductId; kind: ReportKind; data: unknown; subject: string; question?: string }[] {
  const members = orderable(req.productId).members;
  /*
   * 질문은 **마지막 편에만** 싣는다.
   *
   * 편마다 실으면 같은 답이 세 번 나온다. 손님은 한 번 물었는데 세 번
   * 답하는 글은 성의가 아니라 허술함으로 읽힌다. 묶음은 이어 붙여 한 벌로
   * 나가므로, 마지막 편 끝에 답이 오면 읽는 사람이 다 읽고 나서 받는다.
   */
  const question = cleanQuestion(req.question);
  return members.map((productId, i) => ({
    productId,
    ...buildPayload({ ...req, productId }),
    question: question && i === members.length - 1 ? question : undefined,
  }));
}

function seoulTodayISO(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function luckyPrescription(elements: string[]) {
  const el = elements[0] || '토';
  const MAP: Record<string, { colors: string[]; directions: string[]; numbers: number[] }> = {
    목: { colors: ['초록색', '청색'], directions: ['동쪽'], numbers: [3, 8] },
    화: { colors: ['붉은색', '분홍색', '주황색'], directions: ['남쪽'], numbers: [2, 7] },
    토: { colors: ['노란색', '베이지색', '황토색'], directions: ['중앙'], numbers: [5, 10] },
    금: { colors: ['흰색', '은색', '아이보리'], directions: ['서쪽'], numbers: [4, 9] },
    수: { colors: ['검은색', '남색', '짙은 파란색'], directions: ['북쪽'], numbers: [1, 6] },
  };
  return MAP[el] ?? MAP['토'];
}

/** 상품별로 리포트에 실을 데이터를 조립한다. */
export function buildPayload(req: ReadingRequest): { kind: ReportKind; data: unknown; subject: string } {
  const subject = req.birth?.name?.trim() || '이 분';

  /*
   * 오늘의 운세.
   *
   * 오늘 하루치 일진(日辰)과 내 사주가 맺는 유불리 및 충합 관계를 본다.
   * 평생 사주를 다 푸는 것이 아니라, 오늘 하루 무엇을 조심하고 어떤 행동을
   * 취해야 할지 핵심만 처방전처럼 명쾌하게 전달한다.
   */
  if (req.productId === 'daily-report') {
    const { ms, an } = sajuBundle(req.birth);
    const today = seoulTodayISO();
    const luck = dailyLuck(ms, an.yongsin, today);
    const me = an.dayMaster.element;
    const want = an.yongsin.primary.map((g) => groupElement(me, g));
    const tips = luckyPrescription(want);
    return {
      kind: '오늘운세',
      subject,
      data: {
        오늘날짜: today,
        오늘의간지: `${luck.pillar.stem}${luck.pillar.branch} (${luck.pillar.stemHanja}${luck.pillar.branchHanja})`,
        오늘의오행: { 천간: luck.pillar.element.stem, 지지: luck.pillar.element.branch },
        내일간: an.dayMaster,
        오늘의십신: { 천간: luck.stemGod, 지지: luck.branchGod },
        오늘의기운_유불리: luck.favor,
        사주와의_충합_관계: luck.interactions.length ? luck.interactions : ['특이 충돌이나 강한 묶임 없이 평온하게 흘러가는 기운입니다.'],
        오늘의_처방전: {
          나를_돕는_기운: want,
          행운의_색상: tips.colors,
          행운의_방향: tips.directions,
          행운의_숫자: tips.numbers,
        },
      },
    };
  }

  /*
   * 택일.
   *
   * 여기서는 손님의 명식을 세지 않는다. **아직 태어나지 않은 아이**의 날을 고르는 것이라
   * 셀 명식 자체가 없다. 계산은 `/pick` 화면이 쓰는 것과 **같은 함수**를 쓴다 —
   * 공짜로 본 점수와 돈 내고 받은 글의 점수가 다르면 그 순간 신뢰가 끝난다.
   */
  if (req.productId === 'pick-report') {
    const pick = req.pick;
    if (!pick?.dates?.length) throw new Error('택일에는 의사에게 받은 후보 날짜가 필요합니다.');
    if (!pick.times?.length) throw new Error('택일에는 수술이 가능한 시각이 필요합니다.');
    const scores = pickDays({ dates: pick.dates, times: pick.times, longitude: pick.longitude });
    const ranked = mergeHours(scores);
    /*
     * 손님이 고른 것은 「16~17시」이지 16:30 이 아니다. 16:30 은 우리가 재려고
     * 잡은 한가운데일 뿐이라, 그대로 넘기면 리포트가 손님이 고른 적 없는 시각을
     * 말하게 된다. 넘길 때 부르는 말로 바꿔 둔다.
     */
    const say = (g: (typeof ranked)[number]) => ({
      날: g.date, 때: slotSpan(g.time, g.untilTime),
      점수: g.total, 등급: g.band, 여덟글자: g.eight, 까닭: g.says,
    });
    return {
      kind: '택일',
      subject: pick.place ? `${pick.place}에서 태어날 아이` : '태어날 아이',
      data: {
        고른곳: pick.place ?? null,
        후보날: pick.dates,
        가능시각: pick.times.map(slotLabel),
        순위: ranked.map(say),
        날마다최고: bestPerDay(ranked).map(say),
        눈금: '연주와 월주는 이미 정해져 있어 고를 수 있는 것은 절반뿐이다. 100점은 나오지 않는다.',
      },
    };
  }

  /*
   * 작명.
   *
   * 아이의 사주를 먼저 세우고, 거기서 **채워야 할 기운(용신)** 을 꺼낸다.
   * 그 기운과 성의 획수로 쓸 수 있는 글자를 좁혀 밭을 만든다.
   *
   * 여기서 이름을 정하지 않는다. 밭만 만들어 넘긴다 — 어느 것이 이름다운지는
   * 획수로 정해지지 않기 때문이다. 그건 글을 쓰는 쪽이 고른다.
   */
  if (kindOf(req.productId) === '작명') {
    const wish = req.name;
    if (!wish?.surname?.trim()) throw new Error('작명에는 아이의 성이 필요합니다.');
    const { ms, an } = sajuBundle(req.birth);
    /*
     * 용신은 「식상이 필요하다」처럼 **십신**으로 나온다. 글자를 고르려면
     * 「그래서 무슨 기운의 글자냐」로 바꿔야 한다. 십신이 가리키는 오행은
     * 일간이 무엇이냐에 따라 달라진다 — 일간이 목이면 재성은 토고, 화면 금이다.
     */
    const me = an.dayMaster.element;
    const want = an.yongsin.primary.map((g) => groupElement(me, g)) as NameWish['elements'];
    const avoidEl = an.yongsin.avoid.map((g) => groupElement(me, g));
    /*
     * 밭을 얼마나 크게 펼칠 것인가.
     *
     * 엔진은 길한 획수 짝을 마흔 가지쯤 찾아내고 자리마다 스무 자를 낸다.
     * 그것을 다 실으면 리포트 한 편에 십구만 토큰이 들어간다 — 이름 다섯 개를
     * 짓는 데 그만한 돈을 쓸 수 없다.
     *
     * 열두 짝에 자리마다 열두 자면 조합이 천칠백 가지가 넘는다. 다섯을 고르는
     * 데 모자라지 않는다.
     */
    const field = nameField({
      surname: wish.surname,
      elements: want,
      fixed: wish.fixed,
      avoid: wish.avoid,
      pairLimit: 12,
      charLimit: 12,
    });
    return {
      kind: '작명',
      subject: `${field.성.한글} 씨 아이`,
      data: {
        채워야할기운: {
          오행: want,
          십신: an.yongsin.primary,
          덜어낼기운: { 오행: avoidEl, 십신: an.yongsin.avoid },
          까닭: an.yongsin.reasoning,
          유파: an.yongsin.school,
        },
        아이사주: {
          명식: {
            연주: `${ms.year.stem}${ms.year.branch}`,
            월주: `${ms.month.stem}${ms.month.branch}`,
            일주: `${ms.day.stem}${ms.day.branch}`,
            시주: ms.hour ? `${ms.hour.stem}${ms.hour.branch}` : null,
          },
          일간: an.dayMaster,
          오행: an.elements,
          강약: an.strength,
          용신: an.yongsin,
          없는_십신: an.missingGroups,
        },
        이름밭: slimField(field),
      },
    };
  }

  if (req.productId === 'compat-report') {
    if (!req.partner) throw new Error('궁합 리포트에는 상대의 생년월일이 필요합니다.');
    const a = calculate({ date: req.birth.date, time: req.birth.time, longitude: req.birth.longitude });
    const b = calculate({ date: req.partner.date, time: req.partner.time, longitude: req.partner.longitude });
    const nameA = subject;
    const nameB = req.partner.name?.trim() || '상대분';
    return {
      kind: '궁합',
      subject: `${nameA}·${nameB}`,
      data: {
        A: { 명식: `${a.year.stem}${a.year.branch} ${a.month.stem}${a.month.branch} ${a.day.stem}${a.day.branch}`, 분석: analyze(a) },
        B: { 명식: `${b.year.stem}${b.year.branch} ${b.month.stem}${b.month.branch} ${b.day.stem}${b.day.branch}`, 분석: analyze(b) },
        궁합: compatibility(a, b, nameA, nameB),
      },
    };
  }

  const { ms, an, daeun, age, year } = sajuBundle(req.birth);

  const base = {
    명식: {
      연주: `${ms.year.stem}${ms.year.branch}`,
      월주: `${ms.month.stem}${ms.month.branch}`,
      일주: `${ms.day.stem}${ms.day.branch}`,
      시주: ms.hour ? `${ms.hour.stem}${ms.hour.branch}` : null,
    },
    계산근거: ms.meta,
    일간: an.dayMaster,
    기둥별_십신: an.pillars,
    십신_비중: an.strength.scores,
    없는_십신: an.missingGroups,
    오행: an.elements,
    강약: an.strength,
    용신: an.yongsin,
    관계: an.relations,
    신살: an.sinsal,
    두드러진_특징: an.highlights,
    대운: { 방향: daeun.direction, 근거: daeun.basis, 현재: currentDaeun(daeun, age), 전체: daeun.periods },
    세운: annualLuck(ms, an.yongsin, year, 5),
  };

  /*
   * 주제 하나만 보는 상품.
   *
   * 여덟 글자와 **그 주제에 해당하는 글자들**만 싣는다. 십신 비중 전체,
   * 신살 전체, 대운 전체는 빼 둔다 — 그건 사주 종합이 파는 것이다.
   *
   * 지시문으로 「그 주제만 쓰라」고 시키는 것으로는 부족하다. 자료에 다 들어
   * 있으면 모델은 결국 쓴다. **자료 자체를 잘라야** 물건이 갈린다.
   */
  const scope = TOPIC_OF_PRODUCT[req.productId];
  if (scope) {
    return {
      kind: '주제',
      subject,
      data: {
        손님이_묻는_것: scope.asks,
        명식: base.명식,
        계산근거: base.계산근거,
        일간: base.일간,
        강약: base.강약,
        용신: base.용신,
        주제: scope.topics.map((t) => extractTopic(an, t)),
        지금_대운: { 방향: daeun.direction, 현재: currentDaeun(daeun, age) },
        세운: annualLuck(ms, an.yongsin, year, scope.years),
      },
    };
  }

  /*
   * 사주 종합은 **여덟 주제를 전부** 받는다.
   *
   * 값 차이가 물건 차이로 서게 하는 자리다. 낱개로 여덟 번 사는 것보다
   * 한 번에 사는 쪽이 낫다는 것이 자료에서부터 사실이어야 한다.
   */
  if (req.productId === 'saju-report') {
    return { kind: '사주', subject, data: { ...base, 여덟_주제: allTopics(an) } };
  }

  /*
   * 결혼 시기 — 나이대마다 어떤 결인지와, 기운이 제일 세게 들어오는 두 해.
   *
   * 두 해를 집는다. 하나만 집으면 그 해가 지나면 끝인 것처럼 읽힌다.
   */
  if (req.productId === 'marriage-timing-report') {
    return {
      kind: '결혼시기',
      subject,
      data: {
        손님이_묻는_것: '결혼은 언제쯤이 좋은가',
        명식: base.명식,
        계산근거: base.계산근거,
        일간: base.일간,
        강약: base.강약,
        용신: base.용신,
        결혼시기: marriageTiming(ms, an, daeun, req.birth?.gender ?? '남', year, 20),
      },
    };
  }

  /*
   * 노후·말년운 — **예순 이후만.**
   *
   * 젊은 시절 대운까지 실으면 평생 사주가 되고, 34,900원짜리 사주 종합과
   * 같은 글이 24,900원에 나간다.
   */
  if (req.productId === 'latelife-report') {
    return {
      kind: '말년',
      subject,
      data: {
        손님이_묻는_것: '내 노후는 어떨까',
        명식: base.명식,
        계산근거: base.계산근거,
        일간: base.일간,
        강약: base.강약,
        용신: base.용신,
        노후: lateLife(ms, an, calculateDaeun(ms, req.birth?.gender ?? '남', an.yongsin, 12)),
      },
    };
  }

  /*
   * 우리 아이 사주 — 앞으로 **세 해를 달마다.**
   *
   * 달은 달력이 아니라 절기로 끊는다. 명리에서 한 달은 절(節)이 드는
   * 날부터다. 달력으로 끊으면 월주가 하루 이틀씩 어긋난다.
   */
  if (req.productId === 'child-report') {
    return {
      kind: '아이',
      subject,
      data: {
        손님이_묻는_것: '우리 아이는 어떤 아이일까, 앞으로 세 해는 어떤가',
        명식: base.명식,
        계산근거: base.계산근거,
        일간: base.일간,
        기둥별_십신: base.기둥별_십신,
        십신_비중: base.십신_비중,
        없는_십신: base.없는_십신,
        오행: base.오행,
        강약: base.강약,
        용신: base.용신,
        관계: base.관계,
        두드러진_특징: base.두드러진_특징,
        지금_대운: { 방향: daeun.direction, 현재: currentDaeun(daeun, age) },
        세_해_달마다: [year, year + 1, year + 2].map((y) => ({
          해: y,
          달: monthlyLuck(ms, an.yongsin, y),
        })),
      },
    };
  }

  /*
   * 신년운세는 **한 해**를 보는 글이다.
   *
   * 평생 명식을 통째로 실으면 모델이 평생 사주를 쓰고, 그러면 34,900원짜리
   * 사주 종합과 같은 글이 24,900원에 나간다. 올해와 내년의 흐름, 그리고
   * 그 해의 기운이 여덟 주제 각각에 어떻게 닿는지까지만 싣는다.
   */
  if (req.productId === 'newyear-report') {
    return {
      kind: '사주',
      subject,
      data: {
        손님이_묻는_것: '올 한 해는 나에게 어떤 해인가',
        명식: base.명식,
        계산근거: base.계산근거,
        일간: base.일간,
        강약: base.강약,
        용신: base.용신,
        지금_대운: { 방향: daeun.direction, 현재: currentDaeun(daeun, age) },
        올해와_내년: annualLuck(ms, an.yongsin, year, 2),
        여덟_주제: allTopics(an),
      },
    };
  }

  /*
   * 갈래는 `kindOf()` 하나가 정한다.
   *
   * 전에는 여기서 「saju-report 면 사주, 나머지는 전부 교차검증」으로 갈랐다.
   * 그래서 우리 아이 사주·재물운·오늘의 운세처럼 **얼굴과 손을 받지도 않는**
   * 상품까지 교차검증으로 나갔고, 없는 얼굴·손 대신 중립값을 넣어 「세 갈래를
   * 대조했습니다」라고 쓰는 글이 만들어졌다. 대조한 적이 없는 것을 대조했다고
   * 쓰는 것이라, 손님이 돈을 내고 받는 글로는 나가면 안 된다.
   *
   * 갈래표(`KIND_EXCEPTIONS`)는 이미 어느 상품이 교차검증인지 알고 있었다.
   * 두 곳에서 따로 정하던 것을 한 곳으로 모은다.
   */
  const kind = kindOf(req.productId);
  if (kind !== '교차검증') return { kind, subject, data: base };

  /*
   * 어느 갈래를 싣는가는 **상품마다 다르다.**
   *
   * 전에는 다섯 상품이 전부 사주·관상·손금 셋을 받았다. 그래서
   * 「생년월일 없이 얼굴과 손만으로 봅니다」라고 팔아 놓은 상품에 사주가
   * 실리고, 「사주 × 손금」이라고 팔아 놓은 상품에 관상까지 실렸다.
   * 자료에 있으면 모델은 쓴다 — 대조한 적 없는 것을 대조했다고 쓰는 글이
   * 나가게 된다. 상품 설명과 글이 다른 말을 하면 그 자체가 위반이다.
   */
  const uses = CROSS_SOURCES[req.productId] ?? { 사주: true, 관상: true, 손금: true };
  const face = uses.관상 ? readFace(req.face ?? NEUTRAL_FEATURES) : null;
  const palm = uses.손금 ? readPalm(req.palm ?? NEUTRAL_PALM_FEATURES) : null;
  const profiles = [
    ...(uses.사주 ? [sajuToTraits(an)] : []),
    ...(face ? [face.profile] : []),
    ...(palm ? [palm.profile] : []),
  ];

  /*
   * 매력 삼합은 셋을 다 보되 **매력이 걸린 축만** 본다.
   * 그래서 삼합 리포트(69,000원)와 값도 다르고 물건도 다르다.
   */
  const axes = CROSS_AXES[req.productId];
  const cross = crossValidate(...profiles);
  /*
   * 축을 좁힐 때는 **갈래별 모음까지 같이** 좁힌다.
   * 비교표만 자르고 일치·엇갈림 목록을 그대로 두면, 「두 축을 봅니다」라고
   * 해 놓고 여덟 축의 결과를 늘어놓게 된다.
   */
  const keep = <T extends { axis: string }>(xs: T[]) => (axes ? xs.filter((x) => axes.includes(x.axis)) : xs);
  const 교차검증 = axes
    ? {
      ...cross,
      comparisons: keep(cross.comparisons),
      agreed: keep(cross.agreed),
      conflicted: keep(cross.conflicted),
      soloOnly: keep(cross.soloOnly),
    }
    : cross;

  return {
    kind: '교차검증',
    subject,
    data: {
      보는_갈래: Object.entries(uses).filter(([, on]) => on).map(([k]) => k),
      ...(uses.사주 ? { 사주: axes ? { 명식: base.명식, 일간: base.일간, 매력: extractTopic(an, 'charm') } : base } : {}),
      ...(face ? { 관상: { 부위별: face.notes, 신호: face.profile.signals } } : {}),
      ...(palm ? { 손금: { 항목별: palm.notes, 신호: palm.profile.signals } } : {}),
      교차검증,
    },
  };
}

/**
 * 이름밭을 글 쓰는 쪽이 읽기 좋게 줄인다.
 *
 * 엔진이 내는 값은 부수 번호까지 들고 있는데, 글에는 쓰이지 않으면서 자리는
 * 그대로 차지한다. 이름 하나에 백 자가 넘는 JSON 이 붙으면 정작 읽어야 할
 * 글자가 묻힌다.
 *
 * 열쇠말을 한글로 두는 것도 같은 까닭이다. 모델이 「strokes」보다 「획」을
 * 덜 헷갈린다.
 */
function slimField(field: ReturnType<typeof nameField>) {
  const say = (h: { char: string; readings: string[]; strokes: number; element: string | null; meaning: string }) => ({
    자: h.char, 소리: h.readings.join('·'), 획: h.strokes,
    기운: h.element ?? '갈림', 뜻: h.meaning || null,
  });
  return {
    성: field.성,
    돌림자: field.돌림자,
    후보: field.후보.map((p) => ({
      앞획: p.first,
      끝획: p.last,
      네격: {
        초년운: { 획: p.frames.won, 수: p.frames.wonN.name, 뜻: p.frames.wonN.say },
        청년운: { 획: p.frames.hyeong, 수: p.frames.hyeongN.name, 뜻: p.frames.hyeongN.say },
        장년운: { 획: p.frames.i, 수: p.frames.iN.name, 뜻: p.frames.iN.say },
        전체운: { 획: p.frames.jeong, 수: p.frames.jeongN.name, 뜻: p.frames.jeongN.say },
      },
      앞자리: p.firstChars.map(say),
      끝자리: p.lastChars.map(say),
    })),
    눈금: field.눈금,
  };
}
