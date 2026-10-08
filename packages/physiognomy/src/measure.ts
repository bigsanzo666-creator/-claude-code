/**
 * 얼굴 사진에서 관상 값을 재는 자(尺).
 *
 * 손님이 「이마 넓음/보통/좁음」을 직접 고르게 하는 것은 관상이 아니다.
 * 이미 답을 아는 사람만 쓸 수 있고, 모르는 사람은 아무렇게나 찍는다.
 * 사진 한 장에서 우리가 재 준다.
 *
 * **여기에는 브라우저가 없다.** 얼굴 점 468개를 숫자로 받아 아홉 값으로 바꾸는
 * 계산만 한다. 점을 어떻게 뽑는지(MediaPipe·WASM)는 화면 쪽 일이고, 그래야
 * 이 계산을 `verify.ts` 로 검증할 수 있다.
 *
 * **사진은 폰 밖으로 안 나간다.** 얼굴 사진은 생체정보다. 서버로 보내는 순간
 * 보관·파기·동의 문제가 전부 따라붙는다. 브라우저 안에서 점만 뽑고 사진은 버린다.
 *
 * ## 재는 방법
 *
 * 길이를 픽셀로 재면 사진 크기마다 달라진다. 그래서 **얼굴 너비로 나눈 비율**만
 * 쓴다. 사진이 크든 작든, 멀든 가깝든 같은 값이 나온다.
 *
 * 세 단계(작다·보통·크다)까지만 낸다. 소수점까지 내밀면 정밀해 보이지만
 * 촬영 각도와 조명에 그만큼 흔들린다.
 */

import {
  type FaceFeatures, type FaceShape, type Level, NEUTRAL_FEATURES,
} from './features.ts';

/** 얼굴 점 하나. MediaPipe 가 주는 모양 그대로 받는다 (0~1 로 정규화된 값) */
export interface Point { x: number; y: number; z?: number }

/**
 * 얼굴 점 468개에서 우리가 쓰는 번호.
 *
 * MediaPipe Face Mesh 의 고정 번호다. 사람 얼굴을 정면에서 봤을 때 기준이며,
 * 「왼쪽」은 **보는 사람 기준 왼쪽**이다.
 */
export const LM = {
  /** 이마 꼭대기 */ crown: 10,
  /** 턱 끝 */ chin: 152,
  /** 얼굴 왼쪽 끝(귀 앞) */ faceL: 234,
  /** 얼굴 오른쪽 끝 */ faceR: 454,
  /** 관자놀이 왼쪽 */ templeL: 21,
  /** 관자놀이 오른쪽 */ templeR: 251,
  /** 광대 왼쪽 */ cheekL: 116,
  /** 광대 오른쪽 */ cheekR: 345,
  /** 턱선 왼쪽(각) */ jawL: 172,
  /** 턱선 오른쪽(각) */ jawR: 397,
  /** 왼눈 바깥 꼬리 */ eyeLOut: 33,
  /** 왼눈 안쪽 꼬리 */ eyeLIn: 133,
  /** 왼눈 윗꺼풀 */ eyeLTop: 159,
  /** 왼눈 아랫꺼풀 */ eyeLBot: 145,
  /** 오른눈 안쪽 꼬리 */ eyeRIn: 362,
  /** 오른눈 바깥 꼬리 */ eyeROut: 263,
  /** 오른눈 윗꺼풀 */ eyeRTop: 386,
  /** 오른눈 아랫꺼풀 */ eyeRBot: 374,
  /** 왼쪽 눈썹 위 */ browLTop: 105,
  /** 왼쪽 눈썹 아래 */ browLBot: 53,
  /** 오른쪽 눈썹 위 */ browRTop: 334,
  /** 오른쪽 눈썹 아래 */ browRBot: 283,
  /** 콧대 시작(두 눈 사이) */ noseTop: 168,
  /** 코끝 */ noseTip: 1,
  /** 콧방울 왼쪽 */ noseWingL: 129,
  /** 콧방울 오른쪽 */ noseWingR: 358,
  /** 입꼬리 왼쪽 */ mouthL: 61,
  /** 입꼬리 오른쪽 */ mouthR: 291,
  /** 윗입술 위 */ lipTop: 0,
  /** 윗입술 아래 */ lipTopIn: 13,
  /** 아랫입술 위 */ lipBotIn: 14,
  /** 아랫입술 아래 */ lipBot: 17,
} as const;

/** 점 468개가 다 있어야 하는 것은 아니다. 우리가 쓰는 번호만 있으면 된다 */
export const NEEDED: number[] = [...new Set(Object.values(LM))].sort((a, b) => a - b);

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 사진에서 뽑은 날것의 비율.
 *
 * 이 숫자들을 그대로 손님에게 보여주지 않는다. 소수점 셋째 자리까지 보여주면
 * 「내 이마는 0.412」 같은, 뜻도 없고 틀리기도 쉬운 말이 된다.
 * 다만 값이 이상할 때 어디가 틀렸는지 보려면 필요하므로 밖으로 내보낸다.
 */
export interface FaceRatios {
  /** 얼굴 길이 ÷ 얼굴 너비. 얼굴형을 가르는 기준 */
  lengthOverWidth: number;
  /** 관자놀이 너비 ÷ 얼굴 너비 */
  forehead: number;
  /** 눈썹 두께 ÷ 두 눈 사이 거리 */
  brow: number;
  /** 눈 넓이 × 높이 ÷ 얼굴 너비² */
  eye: number;
  /** 콧대 길이 ÷ 얼굴 길이 */
  noseBridge: number;
  /** 콧방울 너비 ÷ 얼굴 너비 */
  noseWing: number;
  /** 입 너비 ÷ 얼굴 너비 */
  mouth: number;
  /** 입술 두께 ÷ 입 너비 */
  lip: number;
  /** 턱 너비 ÷ 얼굴 너비 */
  jaw: number;
  /** 광대 너비 ÷ 얼굴 너비 */
  cheek: number;
}

/**
 * 크다·보통·작다를 가르는 경계값.
 *
 * **재는 값이 틀리면 여기만 고친다.** 사진을 여러 장 재 보고 한쪽으로 쏠리면
 * 이 숫자를 옮기면 되고, 다른 곳은 손댈 것이 없다.
 *
 * 지금 값은 정면 얼굴의 일반적인 비율에서 잡은 것이다. 사람 얼굴을 모아
 * 통계를 낸 값이 아니므로, 실제 사진으로 맞춰 가야 한다.
 */
export const CUTS: Record<keyof Omit<FaceRatios, 'lengthOverWidth'>, [number, number]> = {
  forehead: [0.72, 0.82],
  brow: [0.13, 0.20],
  eye: [0.0075, 0.0115],
  noseBridge: [0.26, 0.32],
  noseWing: [0.26, 0.31],
  mouth: [0.36, 0.43],
  lip: [0.22, 0.30],
  jaw: [0.76, 0.86],
  cheek: [0.86, 0.94],
};

function level(value: number, [lo, hi]: [number, number]): Level {
  if (value < lo) return 'low';
  if (value > hi) return 'high';
  return 'mid';
}

/**
 * 얼굴형.
 *
 * 길이와 너비의 비, 그리고 이마·광대·턱 중 어디가 제일 넓은지로 가른다.
 * 순서가 중요하다 — 긴 얼굴을 먼저 걸러야 「길면서 각진」 얼굴이
 * 각진형으로만 잡히는 일이 없다.
 */
export function faceShapeOf(r: FaceRatios): FaceShape {
  const jawOverCheek = r.jaw / r.cheek;
  const foreheadOverCheek = r.forehead / r.cheek;

  if (r.lengthOverWidth >= 1.48) return 'long';
  if (foreheadOverCheek >= 1.0 && jawOverCheek <= 0.74) return 'heart';
  if (jawOverCheek >= 0.88) return r.lengthOverWidth <= 1.30 ? 'round' : 'square';
  if (r.lengthOverWidth <= 1.22) return 'round';
  return 'oval';
}

/** 점 목록에서 우리가 쓰는 번호가 다 있는지 본다 */
export function hasNeeded(points: readonly Point[]): boolean {
  return NEEDED.every((i) => {
    const p = points[i];
    return p != null && Number.isFinite(p.x) && Number.isFinite(p.y);
  });
}

/** 얼굴 점에서 날것의 비율을 뽑는다 */
export function faceRatios(points: readonly Point[]): FaceRatios {
  const at = (i: number) => points[i]!;
  const faceWidth = dist(at(LM.faceL), at(LM.faceR));
  const faceLength = dist(at(LM.crown), at(LM.chin));
  const interocular = dist(at(LM.eyeLIn), at(LM.eyeRIn));

  // 얼굴 너비가 0 이면 나눌 수 없다. 점이 한 자리에 뭉친 잘못된 입력이다
  if (faceWidth <= 0 || faceLength <= 0 || interocular <= 0) {
    throw new Error('얼굴 점이 제대로 잡히지 않았습니다.');
  }

  const eyeWidth = (dist(at(LM.eyeLOut), at(LM.eyeLIn)) + dist(at(LM.eyeRIn), at(LM.eyeROut))) / 2;
  const eyeHeight = (dist(at(LM.eyeLTop), at(LM.eyeLBot)) + dist(at(LM.eyeRTop), at(LM.eyeRBot))) / 2;
  const browGap = (dist(at(LM.browLTop), at(LM.browLBot)) + dist(at(LM.browRTop), at(LM.browRBot))) / 2;
  const mouthWidth = dist(at(LM.mouthL), at(LM.mouthR));
  const lipHeight = dist(at(LM.lipTop), at(LM.lipTopIn)) + dist(at(LM.lipBotIn), at(LM.lipBot));

  return {
    lengthOverWidth: faceLength / faceWidth,
    forehead: dist(at(LM.templeL), at(LM.templeR)) / faceWidth,
    brow: browGap / interocular,
    eye: (eyeWidth * eyeHeight) / (faceWidth * faceWidth),
    noseBridge: dist(at(LM.noseTop), at(LM.noseTip)) / faceLength,
    noseWing: dist(at(LM.noseWingL), at(LM.noseWingR)) / faceWidth,
    mouth: mouthWidth / faceWidth,
    lip: mouthWidth > 0 ? lipHeight / mouthWidth : 0,
    jaw: dist(at(LM.jawL), at(LM.jawR)) / faceWidth,
    cheek: dist(at(LM.cheekL), at(LM.cheekR)) / faceWidth,
  };
}

/**
 * 얼굴이 옆으로 돌아간 정도.
 *
 * 옆으로 돌린 얼굴은 한쪽이 짧게 찍혀서 재는 값이 다 틀어진다.
 * 두 눈에서 얼굴 가운데선까지의 거리를 견줘 본다 — 정면이면 0에 가깝고,
 * 많이 돌아갈수록 1에 가까워진다.
 */
export function yawOf(points: readonly Point[]): number {
  const at = (i: number) => points[i]!;
  const left = Math.abs(at(LM.eyeLIn).x - at(LM.faceL).x);
  const right = Math.abs(at(LM.faceR).x - at(LM.eyeRIn).x);
  const sum = left + right;
  return sum > 0 ? Math.abs(left - right) / sum : 1;
}

/** 이 정도 넘게 돌아간 사진은 재지 않는다 */
export const YAW_LIMIT = 0.22;

export interface Measured {
  features: FaceFeatures;
  ratios: FaceRatios;
  /** 옆으로 돌아간 정도. 0에 가까울수록 정면 */
  yaw: number;
}

/**
 * 얼굴 점에서 관상 아홉 값을 잰다.
 *
 * 점이 모자라거나 얼굴이 너무 돌아가 있으면 **재지 않고 알린다.** 억지로
 * 숫자를 내면 손님은 그것이 틀린 줄 모른 채 결과를 믿는다.
 */
export function measureFace(points: readonly Point[]): Measured {
  if (!hasNeeded(points)) {
    throw new Error('얼굴이 잘 안 잡혔습니다. 정면 사진으로 다시 해 주세요.');
  }
  const yaw = yawOf(points);
  if (yaw > YAW_LIMIT) {
    throw new Error('얼굴이 옆으로 돌아가 있습니다. 정면 사진으로 다시 해 주세요.');
  }
  const r = faceRatios(points);
  return {
    yaw,
    ratios: r,
    features: {
      foreheadWidth: level(r.forehead, CUTS.forehead),
      browThickness: level(r.brow, CUTS.brow),
      eyeSize: level(r.eye, CUTS.eye),
      noseBridge: level(r.noseBridge, CUTS.noseBridge),
      noseWing: level(r.noseWing, CUTS.noseWing),
      mouthSize: level(r.mouth, CUTS.mouth),
      lipThickness: level(r.lip, CUTS.lip),
      jawDevelopment: level(r.jaw, CUTS.jaw),
      cheekbone: level(r.cheek, CUTS.cheek),
      faceShape: faceShapeOf(r),
    },
  };
}

/**
 * 사진으로 잰 값을 손님에게 어떻게 말할지.
 *
 * 「관록궁 0.412」가 아니라 「이마가 넓은 편입니다」라고 말한다.
 * 그리고 **틀릴 수 있다고 먼저 말한다** — 사진 한 장으로 재는 것이고,
 * 각도와 조명에 흔들린다. 손님이 고칠 수 있어야 한다.
 */
export const MEASURE_NOTE =
  '사진에서 잰 값입니다. 사진 각도나 빛에 따라 조금씩 달라질 수 있으니, '
  + '보시고 다른 것 같으면 직접 고치셔도 됩니다.';

/** 점을 못 뽑았을 때 손으로 고르는 화면이 그대로 남는다 */
export const FALLBACK_FEATURES = NEUTRAL_FEATURES;
