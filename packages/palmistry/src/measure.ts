/**
 * 손 사진에서 손금 값을 재는 자(尺).
 *
 * 관상과 같은 원칙이다. **여기에는 브라우저가 없다** — 손 점 21개와 사진의
 * 밝기 값을 숫자로 받아 계산만 한다. 점을 어떻게 뽑는지는 화면 쪽 일이고,
 * 그래야 이 계산을 `verify.ts` 로 검증할 수 있다.
 *
 * **사진은 폰 밖으로 안 나간다.** 손바닥 사진도 얼굴과 같다.
 *
 * ## 두 단계로 나눈다
 *
 * **1. 손 모양(오행)** — 점 21개만으로 잰다. 얼굴처럼 확실하다.
 *    손바닥이 긴가 네모난가, 손가락이 긴가 짧은가. 그 둘로 오행이 갈린다.
 *
 * **2. 손금 선** — 훨씬 어렵다. 손금은 정해진 점이 없어서 선을 직접 찾아야
 *    한다. 그래서 손바닥만 반듯하게 펴서 도려낸 뒤(`palmQuad`), 선이 지나갈
 *    자리에서 얼마나 짙은지를 잰다.
 *
 * 이 파일은 1단계와 2단계의 **자리 잡기**까지다.
 */

import { type HandShape, type Level, type PalmFeatures, NEUTRAL_PALM_FEATURES } from './features.ts';

/** 손 점 하나. MediaPipe 가 주는 모양 그대로 (0~1 로 정규화된 값) */
export interface Point { x: number; y: number; z?: number }

/**
 * 손 점 21개에서 우리가 쓰는 번호.
 *
 * MediaPipe Hand Landmarker 의 고정 번호다.
 */
export const HL = {
  /** 손목 */ wrist: 0,
  /** 엄지 뿌리 */ thumbCmc: 1,
  /** 엄지 끝 */ thumbTip: 4,
  /** 검지 뿌리 */ indexMcp: 5,
  /** 검지 끝 */ indexTip: 8,
  /** 중지 뿌리 */ middleMcp: 9,
  /** 중지 끝 */ middleTip: 12,
  /** 약지 뿌리 */ ringMcp: 13,
  /** 약지 끝 */ ringTip: 16,
  /** 새끼 뿌리 */ pinkyMcp: 17,
  /** 새끼 끝 */ pinkyTip: 20,
} as const;

export const HAND_NEEDED: number[] = [...new Set(Object.values(HL))].sort((a, b) => a - b);

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 손에서 뽑은 날것의 비율.
 *
 * 길이를 픽셀로 재면 사진마다 달라진다. **손바닥 너비로 나눈 비율**만 쓴다.
 */
export interface HandRatios {
  /** 손바닥 길이 ÷ 손바닥 너비. 길면 손바닥이 긴 손이다 */
  palm: number;
  /** 중지 길이 ÷ 손바닥 길이. 길면 손가락이 긴 손이다 */
  finger: number;
  /** 엄지 길이 ÷ 손바닥 길이 */
  thumb: number;
  /** 손가락 네 개의 길이가 서로 얼마나 고른가 (1에 가까울수록 고르다) */
  even: number;
}

/**
 * 오행 손 모양을 가르는 경계값.
 *
 * **재는 값이 틀리면 여기만 고친다.** 실제 손 사진을 재 보고 한쪽으로 쏠리면
 * 이 숫자를 옮기면 되고, 다른 곳은 손댈 것이 없다.
 */
export const HAND_CUTS = {
  /** 손바닥이 네모난가(작다) 긴가(크다) */
  palm: [1.02, 1.20] as [number, number],
  /** 손가락이 짧은가(작다) 긴가(크다) */
  finger: [0.78, 0.92] as [number, number],
};

function level(value: number, [lo, hi]: [number, number]): Level {
  if (value < lo) return 'low';
  if (value > hi) return 'high';
  return 'mid';
}

export function hasHandPoints(points: readonly Point[]): boolean {
  return HAND_NEEDED.every((i) => {
    const p = points[i];
    return p != null && Number.isFinite(p.x) && Number.isFinite(p.y);
  });
}

export function handRatios(points: readonly Point[]): HandRatios {
  const at = (i: number) => points[i]!;
  const width = dist(at(HL.indexMcp), at(HL.pinkyMcp));
  const length = dist(at(HL.wrist), at(HL.middleMcp));
  if (width <= 0 || length <= 0) throw new Error('손이 제대로 잡히지 않았습니다.');

  const fingers = [
    dist(at(HL.indexMcp), at(HL.indexTip)),
    dist(at(HL.middleMcp), at(HL.middleTip)),
    dist(at(HL.ringMcp), at(HL.ringTip)),
    dist(at(HL.pinkyMcp), at(HL.pinkyTip)),
  ];
  const longest = Math.max(...fingers);
  const shortest = Math.min(...fingers);

  return {
    palm: length / width,
    finger: dist(at(HL.middleMcp), at(HL.middleTip)) / length,
    thumb: dist(at(HL.thumbCmc), at(HL.thumbTip)) / length,
    even: longest > 0 ? shortest / longest : 0,
  };
}

/**
 * 오행 손 모양.
 *
 * 손바닥이 긴가 네모난가, 손가락이 긴가 짧은가. 그 둘로 넷이 갈린다.
 * 둘 다 어느 쪽도 아니면 **수형** — 전통에서 수형은 뚜렷한 각이 없는 손이다.
 */
export function handShapeOf(r: HandRatios): HandShape {
  const palm = level(r.palm, HAND_CUTS.palm);
  const finger = level(r.finger, HAND_CUTS.finger);

  if (palm === 'mid' && finger === 'mid') return '수형';
  const longPalm = palm === 'high';
  const longFinger = finger === 'high';
  if (longPalm && longFinger) return '목형';
  if (longPalm && !longFinger) return '화형';
  if (!longPalm && longFinger) return '금형';
  return '토형';
}

/**
 * 손바닥만 도려낼 네 귀퉁이.
 *
 * 손금 선을 재려면 먼저 **손바닥을 반듯하게 펴야** 한다. 사진마다 손이
 * 기울어 있고 크기가 다른데, 그대로 두면 「생명선이 지나갈 자리」를 정할 수
 * 없다.
 *
 * 그래서 손목과 검지·새끼 뿌리로 네모를 잡는다. 이 네모를 정사각형으로 펴면
 * 어느 사진이든 같은 자리에 같은 선이 온다.
 *
 * 순서는 왼쪽위 → 오른쪽위 → 오른쪽아래 → 왼쪽아래다.
 */
export function palmQuad(points: readonly Point[]): [Point, Point, Point, Point] {
  const at = (i: number) => points[i]!;
  const index = at(HL.indexMcp);
  const pinky = at(HL.pinkyMcp);
  const wrist = at(HL.wrist);

  // 손목 쪽 두 귀퉁이는 손목 점 하나뿐이라, 손가락 뿌리 선을 손목으로 옮겨 만든다
  const mid = { x: (index.x + pinky.x) / 2, y: (index.y + pinky.y) / 2 };
  const shift = { x: wrist.x - mid.x, y: wrist.y - mid.y };
  return [
    { x: index.x, y: index.y },
    { x: pinky.x, y: pinky.y },
    { x: pinky.x + shift.x, y: pinky.y + shift.y },
    { x: index.x + shift.x, y: index.y + shift.y },
  ];
}

/**
 * 손이 얼마나 기울거나 접혀 있는가.
 *
 * 손을 비스듬히 찍으면 손바닥이 찌그러져 보여서 재는 값이 다 틀어진다.
 * 손가락 네 개의 길이가 서로 많이 다르면 비스듬한 것이다.
 */
export const EVEN_LIMIT = 0.55;

export interface HandMeasured {
  shape: HandShape;
  ratios: HandRatios;
  /** 손바닥을 도려낼 네 귀퉁이. 손금 선을 잴 때 쓴다 */
  quad: [Point, Point, Point, Point];
}

/**
 * 손 점에서 손 모양을 잰다.
 *
 * 점이 모자라거나 손이 너무 비스듬하면 **재지 않고 알린다.** 억지로 숫자를
 * 내면 손님은 그것이 틀린 줄 모른 채 결과를 믿는다.
 */
export function measureHand(points: readonly Point[]): HandMeasured {
  if (!hasHandPoints(points)) {
    throw new Error('손이 잘 안 잡혔습니다. 손바닥을 펴서 정면으로 찍어 주세요.');
  }
  const r = handRatios(points);
  if (r.even < EVEN_LIMIT) {
    throw new Error('손이 비스듬합니다. 손바닥을 펴서 정면으로 찍어 주세요.');
  }
  return { shape: handShapeOf(r), ratios: r, quad: palmQuad(points) };
}

/**
 * 사진으로 잰 값을 손님에게 어떻게 말할지.
 *
 * 관상과 같다. **틀릴 수 있다고 먼저 말한다.**
 */
export const HAND_MEASURE_NOTE =
  '사진에서 잰 손 모양입니다. 손을 편 정도와 빛에 따라 조금씩 달라질 수 있으니, '
  + '보시고 다른 것 같으면 직접 고치셔도 됩니다.';

/** 선까지는 아직 못 잰다. 나머지 값은 손으로 고르는 화면이 그대로 남는다 */
export const FALLBACK_PALM: PalmFeatures = NEUTRAL_PALM_FEATURES;
