/**
 * 손금 선 읽기 — 손 모양(오행) 다음의 2단계.
 *
 * 손 모양은 점 21개의 비율만으로 잰다. 확실하다. **손금 선은 다르다.**
 * 정해진 점이 없다. 그래서 손바닥을 반듯하게 편 뒤(`palmQuad`), 전통적으로
 * 그 선이 지나가는 자리에서 **얼마나 짙은 줄이 있는가**를 잰다.
 *
 * ## 어떻게 재는가
 *
 * 손바닥을 도려낸 네모 안에서 자리를 `(u, v)` 로 잡는다.
 * `u=0` 은 엄지 쪽(검지 쪽), `u=1` 은 새끼 쪽. `v=0` 은 손가락 뿌리,
 * `v=1` 은 손목이다. 네 선의 자리는 전통 손금에서 늘 그리는 자리를
 * `PATHS` 에 박아 두었다.
 *
 * 각 자리마다 **그 자리를 가로질러** 몇 점을 더 찍어 본다. 그중 제일 밝은
 * 값과 제일 어두운 값의 차이가 크면 「거기 줄이 있다」로 본다. 손 색이나
 * 사진 밝기에 기대지 않는 이유가 이것이다 — 절대 밝기가 아니라 **그
 * 자리에서만 비교**하므로 손이 희든 검든 같은 기준이 된다.
 *
 * ## 이것도 얼굴처럼 틀릴 수 있다고 먼저 말한다
 *
 * 손금은 사람마다 자리가 다 다르다. 여기 박은 자리는 「보통 이 근처를
 * 지나간다」는 전통적인 자리일 뿐, 그 손님의 손을 직접 본 것이 아니다.
 * **아직 실제 손 사진으로 맞춰 보지 못했다** — 그래서 이 자는 만들어
 * 두었지만 화면에서 자동으로 켜지지는 않는다. 실제 사진으로 맞는지
 * 확인한 뒤에 켠다 (`docs/palm-photo-plan.md` 참고).
 */

import { type Level, type PalmFeatures } from './features.ts';
import { type Point } from './measure.ts';

/** 흑백으로 바꾼 사진 한 장. 0(검다)~255(밝다) */
export interface GrayImage {
  width: number;
  height: number;
  /** 길이 width*height. 행 우선(왼쪽 위부터) */
  data: ArrayLike<number>;
}

/** 사진 픽셀 값 하나. 격자 밖이면 가장자리 값을 그대로 쓴다 */
function pixelAt(img: GrayImage, x: number, y: number): number {
  const xi = Math.min(img.width - 1, Math.max(0, Math.round(x)));
  const yi = Math.min(img.height - 1, Math.max(0, Math.round(y)));
  return img.data[yi * img.width + xi] ?? 255;
}

/** 소수점 자리의 밝기. 네 이웃 픽셀을 섞는다(쌍선형 보간) */
function sampleGray(img: GrayImage, x: number, y: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const a = pixelAt(img, x0, y0), b = pixelAt(img, x0 + 1, y0);
  const c = pixelAt(img, x0, y0 + 1), d = pixelAt(img, x0 + 1, y0 + 1);
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/**
 * `(u, v)` 를 사진 속 실제 자리로 바꾼다.
 *
 * `palmQuad` 가 주는 네모는 **평행사변형**이다 (손가락 뿌리 선을 손목
 * 쪽으로 그대로 밀어 만들었으므로). 평행사변형은 두 변만 섞으면 되고,
 * 원근을 풀 필요가 없다 — 그래서 계산이 이 한 줄로 끝난다.
 */
function warpUV(quad: readonly [Point, Point, Point, Point], u: number, v: number): Point {
  const [tl, tr, , bl] = quad;
  return {
    x: tl.x + u * (tr.x - tl.x) + v * (bl.x - tl.x),
    y: tl.y + u * (tr.y - tl.y) + v * (bl.y - tl.y),
  };
}

function sampleUV(
  img: GrayImage, quad: readonly [Point, Point, Point, Point], u: number, v: number,
): number {
  const p = warpUV(quad, u, v);
  return sampleGray(img, p.x * img.width, p.y * img.height);
}

/** 자리 하나. 꺾은선으로 이어 붙인다 */
type Path = readonly [number, number][];

/**
 * 네 선이 전통적으로 지나가는 자리.
 *
 * `docs/palm-photo-plan.md` 에 적어 둔 대로, 실제 손 사진으로 맞춰 본
 * 적은 아직 없다. 값이 자꾸 한쪽으로 쏠리면 **여기만** 고치면 된다.
 */
export const PATHS: Record<'life' | 'head' | 'heart' | 'fate', Path> = {
  // 검지 뿌리에서 시작해 엄지 쪽을 따라 손목까지 둥글게 내려온다
  life: [[0.20, 0.10], [0.12, 0.35], [0.15, 0.60], [0.25, 0.85]],
  // 손바닥을 가로질러 새끼 쪽으로 비스듬히 나간다
  head: [[0.18, 0.18], [0.45, 0.30], [0.80, 0.40]],
  // 손가락 뿌리 바로 아래, 새끼 쪽에서 시작해 검지 쪽으로 나간다
  heart: [[0.88, 0.08], [0.55, 0.10], [0.25, 0.15]],
  // 손목 가운데서 중지 뿌리를 향해 곧게 올라간다
  fate: [[0.50, 0.90], [0.50, 0.55], [0.50, 0.20]],
};

/** 꺾은선 위 t(0~1) 지점의 자리와, 거기서 선이 뻗는 방향(길이 1) */
function pointOnPath(path: Path, t: number): { u: number; v: number; du: number; dv: number } {
  const n = path.length - 1;
  const seg = Math.min(n - 1, Math.floor(t * n));
  const local = t * n - seg;
  const [u0, v0] = path[seg]!;
  const [u1, v1] = path[seg + 1]!;
  const dx = u1 - u0, dy = v1 - v0;
  const len = Math.hypot(dx, dy) || 1;
  return { u: u0 + dx * local, v: v0 + dy * local, du: dx / len, dv: dy / len };
}

/** 한 자리를 가로질러 몇 점을 더 본다. 그 폭(정규화 좌표 기준) */
const CROSS_WIDTH = 0.05;
const CROSS_STEPS = 9;
/** 이만큼 밝기 차가 나야 「거기 줄이 있다」로 센다 (0~255 기준) */
const ON_THRESHOLD = 10;

export interface TraceResult {
  /** 자리를 따라간 점들 중, 줄이 있다고 본 비율 (0~1) */
  onFraction: number;
  /** 줄이 있다고 본 점들의 평균 밝기 차. 없으면 0 */
  avgContrast: number;
}

/**
 * 자리 하나를 따라가며 줄을 찾는다.
 *
 * **절대 밝기가 아니라 그 자리를 가로지른 밝기 차만 본다.** 손 색이 희든
 * 검든, 사진이 밝든 어둡든 같은 기준이 되게 하려는 것이다 — 관상에서
 * 절대 길이 대신 비율만 쓰는 것과 같은 이유다.
 */
export function tracePath(
  img: GrayImage, quad: readonly [Point, Point, Point, Point], path: Path,
): TraceResult {
  const steps = 48;
  let onCount = 0;
  let contrastSum = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const { u, v, du, dv } = pointOnPath(path, t);
    // 진행 방향에 수직으로 몇 점을 더 본다 (90도 돌리면 (-dv, du))
    let lo = 255, hi = 0;
    for (let s = 0; s < CROSS_STEPS; s++) {
      const off = (s / (CROSS_STEPS - 1) - 0.5) * 2 * CROSS_WIDTH;
      const b = sampleUV(img, quad, u + -dv * off, v + du * off);
      lo = Math.min(lo, b);
      hi = Math.max(hi, b);
    }
    const contrast = hi - lo;
    if (contrast >= ON_THRESHOLD) { onCount++; contrastSum += contrast; }
  }
  return { onFraction: onCount / (steps + 1), avgContrast: onCount ? contrastSum / onCount : 0 };
}

/**
 * 길이·짙기를 가르는 경계값.
 *
 * **재는 값이 틀리면 여기만 고친다.** `HAND_CUTS` 와 같은 자리다.
 */
export const LINE_CUTS = {
  /** 자리를 따라간 점 중 줄이 있다고 본 비율 */
  length: [0.35, 0.65] as [number, number],
  /** 줄이 있다고 본 점들의 평균 밝기 차 (0~255) */
  depth: [16, 30] as [number, number],
};

function level(value: number, [lo, hi]: [number, number]): Level {
  if (value < lo) return 'low';
  if (value > hi) return 'high';
  return 'mid';
}

/**
 * 막쥔손금(원숭이선) — 두뇌선과 감정선이 원래는 사이가 떠 있어야 하는데,
 * 그 사이가 뜨지 않고 하나로 붙어 있는가.
 *
 * 손바닥 가운데를 손가락 뿌리부터 손목 쪽으로 내려가며 밝기를 본다.
 * 보통은 「감정선(어둡다) → 뜬 자리(밝다) → 두뇌선(어둡다)」로 밝아졌다
 * 어두워지기를 두 번 한다. 뜬 자리가 안 밝아지면 두 선이 붙은 것이다.
 */
export function detectSimian(img: GrayImage, quad: readonly [Point, Point, Point, Point]): boolean {
  const u = 0.5;
  const heartBand = [0.06, 0.20] as const;
  const gapBand = [0.20, 0.28] as const;
  const headBand = [0.28, 0.42] as const;
  const darkestIn = (band: readonly [number, number]): number => {
    let dark = 255;
    for (let i = 0; i <= 10; i++) {
      const v = band[0] + (band[1] - band[0]) * (i / 10);
      dark = Math.min(dark, sampleUV(img, quad, u, v));
    }
    return dark;
  };
  const brightestIn = (band: readonly [number, number]): number => {
    let bright = 0;
    for (let i = 0; i <= 10; i++) {
      const v = band[0] + (band[1] - band[0]) * (i / 10);
      bright = Math.max(bright, sampleUV(img, quad, u, v));
    }
    return bright;
  };
  const heart = darkestIn(heartBand);
  const head = darkestIn(headBand);
  const gap = brightestIn(gapBand);
  const bothPresent = (255 - heart) >= ON_THRESHOLD && (255 - head) >= ON_THRESHOLD;
  // 뜬 자리가 두 선보다 뚜렷이 밝아야 「떨어져 있다」로 본다. 안 밝으면 붙은 것이다
  return bothPresent && (gap - Math.max(heart, head)) < ON_THRESHOLD;
}

export interface PalmLines {
  lifeLength: Level; lifeDepth: Level;
  headLength: Level; headDepth: Level;
  heartLength: Level; heartDepth: Level;
  fateClarity: Level;
  simianLine: boolean;
}

/**
 * 손바닥 사진에서 네 선을 읽는다.
 *
 * `quad` 는 `measureHand()` 가 준 것을 그대로 쓴다 — 손 모양을 잴 때 이미
 * 손바닥을 도려내 뒀으므로 다시 계산하지 않는다.
 */
export function readPalmLines(
  img: GrayImage, quad: readonly [Point, Point, Point, Point],
): PalmLines {
  const life = tracePath(img, quad, PATHS.life);
  const head = tracePath(img, quad, PATHS.head);
  const heart = tracePath(img, quad, PATHS.heart);
  const fate = tracePath(img, quad, PATHS.fate);
  return {
    lifeLength: level(life.onFraction, LINE_CUTS.length),
    lifeDepth: level(life.avgContrast, LINE_CUTS.depth),
    headLength: level(head.onFraction, LINE_CUTS.length),
    headDepth: level(head.avgContrast, LINE_CUTS.depth),
    heartLength: level(heart.onFraction, LINE_CUTS.length),
    heartDepth: level(heart.avgContrast, LINE_CUTS.depth),
    // 운명선은 없는 사람도 많다. 「짧다/길다」가 아니라 「뚜렷한가」만 본다
    fateClarity: level(fate.onFraction, LINE_CUTS.length),
    simianLine: detectSimian(img, quad),
  };
}

/** 나머지 값(손 모양)과 합쳐서 화면에 낼 때 쓴다 */
export function mergePalmLines(base: PalmFeatures, lines: PalmLines): PalmFeatures {
  return { ...base, ...lines };
}
