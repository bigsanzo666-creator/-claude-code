/**
 * 관상 특징 → 공통 성향 척도.
 *
 * 각 규칙은 전통 관상의 십이궁 해석을 그대로 옮긴 것이다.
 * 다만 단정하지 않는다 — "부자가 된다"가 아니라 "재물을 담는 그릇이 크다고 본다"로 쓴다.
 * 근거에 원래 용어(궁 이름)를 남겨서, 나중에 사주 결과와 대조할 때
 * 어느 쪽이 무슨 말을 했는지 추적할 수 있게 한다.
 */

import type { TraitProfile, TraitSignal } from '../../traits/src/index.ts';
import { type FaceFeatures, FACE_SHAPE_LABEL } from './features.ts';

/** 세 단계를 점수로. mid는 신호를 내지 않는다 (특징 없음). */
const lv = (v: 'low' | 'mid' | 'high'): -1 | 0 | 1 => (v === 'high' ? 1 : v === 'low' ? -1 : 0);

export interface PhysiognomyReading {
  profile: TraitProfile;
  /** 부위별 사람이 읽는 풀이 */
  notes: { palace: string; text: string }[];
  /** 두드러진 특징만 추린 것 */
  highlights: string[];
}

export function readFace(f: FaceFeatures): PhysiognomyReading {
  const signals: TraitSignal[] = [];
  const notes: { palace: string; text: string }[] = [];
  const push = (axis: TraitSignal['axis'], score: number, evidence: string) => {
    if (score === 0) return;
    signals.push({ axis, score: Math.max(-2, Math.min(2, score)) as TraitSignal['score'], evidence });
  };

  // 이마 — 관록궁
  const fw = lv(f.foreheadWidth);
  if (fw !== 0) {
    push('학습·직관', fw, `관록궁(이마)이 ${fw > 0 ? '넓다' : '좁다'}`);
    push('리더십', fw, `관록궁(이마)이 ${fw > 0 ? '넓다' : '좁다'}`);
    notes.push({
      palace: '관록궁 (이마)',
      text: fw > 0
        ? '이마가 넓은 편입니다. 관상에서는 배우고 헤아리는 힘이 크고, 사회적 자리가 일찍 잡힌다고 봅니다.'
        : '이마가 좁은 편입니다. 관상에서는 머리보다 몸으로 부딪쳐 익히는 쪽이고, 자리가 늦게 잡힌다고 봅니다.',
    });
  }

  // 눈썹 — 형제궁
  const bt = lv(f.browThickness);
  if (bt !== 0) {
    push('추진력', bt, `형제궁(눈썹)이 ${bt > 0 ? '짙다' : '옅다'}`);
    push('대인관계', bt, `형제궁(눈썹)이 ${bt > 0 ? '짙다' : '옅다'}`);
    notes.push({
      palace: '형제궁 (눈썹)',
      text: bt > 0
        ? '눈썹이 짙은 편입니다. 기세가 뚜렷하고 주변에 사람이 모인다고 봅니다. 다만 밀어붙임이 과할 때가 있습니다.'
        : '눈썹이 옅은 편입니다. 다투기보다 물러서는 쪽이고, 관계를 넓히기보다 좁고 깊게 두는 편으로 봅니다.',
    });
  }

  // 눈 — 전택궁
  const es = lv(f.eyeSize);
  if (es !== 0) {
    push('대인관계', es, `전택궁(눈)이 ${es > 0 ? '크다' : '작다'}`);
    push('표현력', es, `전택궁(눈)이 ${es > 0 ? '크다' : '작다'}`);
    push('안정성', -es, `전택궁(눈)이 ${es > 0 ? '크다' : '작다'}`);
    notes.push({
      palace: '전택궁 (눈)',
      text: es > 0
        ? '눈이 큰 편입니다. 감정이 잘 드러나고 사람을 끄는 힘이 있다고 봅니다. 그만큼 흔들림도 큽니다.'
        : '눈이 작은 편입니다. 속을 잘 드러내지 않고 한번 정한 것을 오래 지킨다고 봅니다.',
    });
  }

  // 코 — 재백궁
  const nb = lv(f.noseBridge);
  const nw = lv(f.noseWing);
  if (nb !== 0) {
    push('추진력', nb, `재백궁(콧대)이 ${nb > 0 ? '높다' : '낮다'}`);
    push('리더십', nb, `재백궁(콧대)이 ${nb > 0 ? '높다' : '낮다'}`);
  }
  if (nw !== 0) {
    push('재물', nw * 2, `재백궁(콧방울)이 ${nw > 0 ? '크다' : '작다'}`);
  }
  if (nb !== 0 || nw !== 0) {
    notes.push({
      palace: '재백궁 (코)',
      text: `코는 재물을 담는 그릇으로 봅니다. ` +
        (nw > 0 ? '콧방울이 발달해 모으고 지키는 힘이 크다고 봅니다. '
          : nw < 0 ? '콧방울이 작은 편이라 들어온 것을 오래 쥐고 있기보다 흘려보내는 쪽으로 봅니다. ' : '') +
        (nb > 0 ? '콧대가 높아 자기 뜻을 굽히지 않는 편입니다.'
          : nb < 0 ? '콧대가 낮은 편이라 남과 부딪치기보다 맞춰가는 쪽입니다.' : ''),
    });
  }

  // 입 — 출납관
  const ms = lv(f.mouthSize);
  const lt = lv(f.lipThickness);
  if (ms !== 0) {
    push('표현력', ms, `출납관(입)이 ${ms > 0 ? '크다' : '작다'}`);
    push('재물', ms, `출납관(입)이 ${ms > 0 ? '크다' : '작다'}`);
  }
  if (lt !== 0) {
    push('대인관계', lt, `입술이 ${lt > 0 ? '두껍다' : '얇다'}`);
  }
  if (ms !== 0 || lt !== 0) {
    notes.push({
      palace: '출납관 (입)',
      text: (ms > 0 ? '입이 큰 편입니다. 말과 활동의 폭이 넓고 먹을 복이 있다고 봅니다. '
        : ms < 0 ? '입이 작은 편입니다. 말을 아끼고 활동 범위를 좁게 잡는 쪽으로 봅니다. ' : '') +
        (lt > 0 ? '입술이 두꺼워 정이 두텁다고 봅니다.'
          : lt < 0 ? '입술이 얇아 감정보다 이치를 앞세우는 편으로 봅니다.' : ''),
    });
  }

  // 턱 — 노복궁
  const jd = lv(f.jawDevelopment);
  if (jd !== 0) {
    push('인내', jd * 2, `노복궁(턱)이 ${jd > 0 ? '발달했다' : '갸름하다'}`);
    push('안정성', jd, `노복궁(턱)이 ${jd > 0 ? '발달했다' : '갸름하다'}`);
    notes.push({
      palace: '노복궁 (턱)',
      text: jd > 0
        ? '턱이 발달한 편입니다. 오래 버티는 힘이 있고 말년이 두텁다고 봅니다.'
        : '턱이 갸름한 편입니다. 오래 끄는 일보다 짧게 끊어 가는 쪽이 맞다고 봅니다.',
    });
  }

  // 광대 — 권골
  const cb = lv(f.cheekbone);
  if (cb !== 0) {
    push('리더십', cb, `권골(광대)이 ${cb > 0 ? '발달했다' : '평평하다'}`);
    push('추진력', cb, `권골(광대)이 ${cb > 0 ? '발달했다' : '평평하다'}`);
    notes.push({
      palace: '권골 (광대)',
      text: cb > 0
        ? '광대가 발달한 편입니다. 주도권을 쥐려는 의지가 강하다고 봅니다.'
        : '광대가 평평한 편입니다. 앞에 나서기보다 뒤에서 받치는 자리가 편하다고 봅니다.',
    });
  }

  // 얼굴형
  const shapeRules: Record<FaceFeatures['faceShape'], { axis: TraitSignal['axis']; score: 1 | -1 }[]> = {
    round: [{ axis: '대인관계', score: 1 }, { axis: '안정성', score: 1 }],
    square: [{ axis: '인내', score: 1 }, { axis: '추진력', score: 1 }],
    oval: [{ axis: '안정성', score: 1 }],
    long: [{ axis: '학습·직관', score: 1 }, { axis: '인내', score: -1 }],
    heart: [{ axis: '학습·직관', score: 1 }, { axis: '표현력', score: 1 }],
  };
  for (const r of shapeRules[f.faceShape]) {
    push(r.axis, r.score, `얼굴형이 ${FACE_SHAPE_LABEL[f.faceShape]}`);
  }
  notes.push({
    palace: '얼굴형',
    text: {
      round: '둥근형은 사람을 편하게 하고 어울림이 좋다고 봅니다.',
      square: '각진형은 밀고 나가는 힘과 버티는 힘이 함께 있다고 봅니다.',
      oval: '계란형은 치우침이 적고 고르게 갖춰졌다고 봅니다.',
      long: '긴형은 생각이 깊은 대신 한 자리에 오래 머무는 것을 답답해한다고 봅니다.',
      heart: '역삼각형은 머리가 빠르고 표현이 좋은 대신 뒷심이 약하다고 봅니다.',
    }[f.faceShape],
  });

  const highlights = notes
    .filter((n) => n.palace !== '얼굴형')
    .slice(0, 4)
    .map((n) => n.text.split('.')[0] + '.');

  return { profile: { source: '관상', signals }, notes, highlights };
}
