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
  compatibility, sajuToTraits, crossValidate,
} from '../../../packages/saju-rules/src/index.ts';
import { pickDays, mergeHours, bestPerDay, slotSpan, slotLabel } from '../../../packages/saju-rules/src/index.ts';
import { readFace, NEUTRAL_FEATURES } from '../../../packages/physiognomy/src/index.ts';
import { readPalm, NEUTRAL_PALM_FEATURES } from '../../../packages/palmistry/src/index.ts';
import { CATALOG, type ProductId } from '../../../packages/commerce/src/index.ts';
import type { ReportKind } from '../../../packages/report/src/prompt.ts';

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

export interface ReadingRequest {
  productId: ProductId;
  birth: BirthInput;
  /** 택일 상품에서만 쓴다 */
  pick?: PickInput;
  /** 궁합용 상대 */
  partner?: BirthInput;
  /** 교차검증용 관상·손금 특징 */
  face?: Parameters<typeof readFace>[0];
  palm?: Parameters<typeof readPalm>[0];
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
};

export function kindOf(productId: ProductId): ReportKind {
  const listed = KIND_EXCEPTIONS[productId];
  if (listed) return listed;
  // 얼굴과 손을 받는 상품은 전부 교차검증이다. 표에 적는 것을 잊어도 여기서 걸린다
  if (CATALOG[productId]?.needsFace) return '교차검증';
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
): { productId: ProductId; kind: ReportKind; data: unknown; subject: string }[] {
  return orderable(req.productId).members.map((productId) => ({
    productId,
    ...buildPayload({ ...req, productId }),
  }));
}

/** 상품별로 리포트에 실을 데이터를 조립한다. */
export function buildPayload(req: ReadingRequest): { kind: ReportKind; data: unknown; subject: string } {
  const subject = req.birth?.name?.trim() || '이 분';

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

  // 교차검증만 얼굴과 손을 쓴다. 여기 오는 상품은 화면에서 둘을 받아 온다
  const face = readFace(req.face ?? NEUTRAL_FEATURES);
  const palm = readPalm(req.palm ?? NEUTRAL_PALM_FEATURES);
  return {
    kind: '교차검증',
    subject,
    data: {
      사주: base,
      관상: { 부위별: face.notes, 신호: face.profile.signals },
      손금: { 항목별: palm.notes, 신호: palm.profile.signals },
      교차검증: crossValidate(sajuToTraits(an), face.profile, palm.profile),
    },
  };
}
