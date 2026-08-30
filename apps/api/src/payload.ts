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
import { readFace, NEUTRAL_FEATURES } from '../../../packages/physiognomy/src/index.ts';
import { readPalm, NEUTRAL_PALM_FEATURES } from '../../../packages/palmistry/src/index.ts';
import type { ProductId } from '../../../packages/commerce/src/index.ts';
import type { ReportKind } from '../../../packages/report/src/prompt.ts';

export interface BirthInput {
  date: string;
  time: string | null;
  longitude?: number;
  gender?: '남' | '여';
  name?: string;
}

export interface ReadingRequest {
  productId: ProductId;
  birth: BirthInput;
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
};

export function kindOf(productId: ProductId): ReportKind {
  return KIND_EXCEPTIONS[productId] ?? '사주';
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

/** 상품별로 리포트에 실을 데이터를 조립한다. */
export function buildPayload(req: ReadingRequest): { kind: ReportKind; data: unknown; subject: string } {
  const subject = req.birth.name?.trim() || '이 분';

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

  if (req.productId === 'saju-report') return { kind: '사주', subject, data: base };

  // 교차검증
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
