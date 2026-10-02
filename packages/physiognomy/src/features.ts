/**
 * 관상 특징 — 얼굴에서 읽어내는 값들.
 *
 * 전통 관상은 얼굴을 십이궁(十二宮)으로 나눠 본다. 각 부위가 삶의 어떤 영역을
 * 맡는다고 보는데, 이 모듈은 그 부위별 상태를 세 단계로만 기록한다.
 *
 * 왜 세 단계뿐인가: 얼굴에서 뽑을 수 있는 값은 비율이고, 비율은 촬영 각도와
 * 조명에 따라 흔들린다. 소수점까지 내밀면 정밀해 보이지만 그만큼 틀린다.
 * 크다/보통/작다 수준이 실제로 신뢰할 수 있는 해상도다.
 *
 * 그리고 **점수를 매기지 않는다.** 외모 점수화는 편향 문제와 정신건강 문제로
 * 논란이 확실한 영역이라, 우리는 유형과 경향만 말한다.
 */

export type Level = 'low' | 'mid' | 'high';
export type FaceShape = 'round' | 'square' | 'oval' | 'long' | 'heart';

export interface FaceFeatures {
  /** 이마 넓이 — 관록궁(官祿宮). 사회적 자리와 초년운을 본다 */
  foreheadWidth: Level;
  /** 눈썹 짙기 — 형제궁(兄弟宮). 기세와 형제·동료 관계를 본다 */
  browThickness: Level;
  /** 눈 크기 — 전택궁(田宅宮). 감정과 사람을 대하는 방식을 본다 */
  eyeSize: Level;
  /** 콧대 높이 — 재백궁(財帛宮) 상단. 자존과 추진을 본다 */
  noseBridge: Level;
  /** 콧방울 크기 — 재백궁 하단. 재물을 담는 그릇으로 본다 */
  noseWing: Level;
  /** 입 크기 — 출납관(出納官). 표현과 활동 범위를 본다 */
  mouthSize: Level;
  /** 입술 두께. 정(情)의 두께로 본다 */
  lipThickness: Level;
  /** 턱 발달 — 노복궁(奴僕宮). 말년과 지구력을 본다 */
  jawDevelopment: Level;
  /** 광대 발달 — 권골(權骨). 주도권과 의지를 본다 */
  cheekbone: Level;
  /** 얼굴형 */
  faceShape: FaceShape;
}

export const FACE_SHAPE_LABEL: Record<FaceShape, string> = {
  round: '둥근형',
  square: '각진형',
  oval: '계란형',
  long: '긴형',
  heart: '역삼각형',
};

export const LEVEL_LABEL: Record<Level, string> = { low: '작음·좁음', mid: '보통', high: '큼·넓음' };

/** 각 특징이 어느 궁(宮)에 속하는지. 결과 화면에서 근거로 보여준다. */
export const FEATURE_PALACE: Record<keyof Omit<FaceFeatures, 'faceShape'>, string> = {
  foreheadWidth: '관록궁 (이마)',
  browThickness: '형제궁 (눈썹)',
  eyeSize: '전택궁 (눈)',
  noseBridge: '재백궁 (콧대)',
  noseWing: '재백궁 (콧방울)',
  mouthSize: '출납관 (입)',
  lipThickness: '출납관 (입술)',
  jawDevelopment: '노복궁 (턱)',
  cheekbone: '권골 (광대)',
};

export const FEATURE_LABEL: Record<keyof Omit<FaceFeatures, 'faceShape'>, string> = {
  foreheadWidth: '이마 넓이',
  browThickness: '눈썹 짙기',
  eyeSize: '눈 크기',
  noseBridge: '콧대 높이',
  noseWing: '콧방울 크기',
  mouthSize: '입 크기',
  lipThickness: '입술 두께',
  jawDevelopment: '턱 발달',
  cheekbone: '광대 발달',
};

/** 아무 특징도 두드러지지 않은 기본값. 수동 입력의 출발점으로 쓴다. */
export const NEUTRAL_FEATURES: FaceFeatures = {
  foreheadWidth: 'mid', browThickness: 'mid', eyeSize: 'mid',
  noseBridge: 'mid', noseWing: 'mid', mouthSize: 'mid',
  lipThickness: 'mid', jawDevelopment: 'mid', cheekbone: 'mid',
  faceShape: 'oval',
};

/**
 * 바깥에서 들어온 값을 **믿지 않고** 얼굴 특징으로 바꾼다.
 *
 * 터진 뒤에 적은 것 (2026-10-02): 화면이 보내는 이름(forehead, brow, eye …)과
 * 여기서 쓰는 이름(foreheadWidth, browThickness, eyeSize …)이 서로 달랐다.
 * 손금 쪽은 아예 터져서 「HAND_SHAPE_RULES[f.handShape] is not iterable」로
 * 리포트가 안 나왔다. **화면이 보낸 값은 늘 모자라거나 틀릴 수 있다.**
 * 모르는 값은 가운데(mid)로 두고, 절대 던지지 않는다.
 */
export function sanitizeFaceFeatures(input: unknown): FaceFeatures {
  const o = (input ?? {}) as Record<string, unknown>;
  const lv = (v: unknown, fallback: Level): Level =>
    v === 'low' || v === 'mid' || v === 'high' ? v : fallback;
  const shape = o.faceShape;
  return {
    foreheadWidth: lv(o.foreheadWidth ?? o.forehead, NEUTRAL_FEATURES.foreheadWidth),
    browThickness: lv(o.browThickness ?? o.brow, NEUTRAL_FEATURES.browThickness),
    eyeSize: lv(o.eyeSize ?? o.eye, NEUTRAL_FEATURES.eyeSize),
    noseBridge: lv(o.noseBridge, NEUTRAL_FEATURES.noseBridge),
    noseWing: lv(o.noseWing, NEUTRAL_FEATURES.noseWing),
    mouthSize: lv(o.mouthSize ?? o.mouth, NEUTRAL_FEATURES.mouthSize),
    lipThickness: lv(o.lipThickness ?? o.lip, NEUTRAL_FEATURES.lipThickness),
    jawDevelopment: lv(o.jawDevelopment ?? o.jaw, NEUTRAL_FEATURES.jawDevelopment),
    cheekbone: lv(o.cheekbone ?? o.cheek, NEUTRAL_FEATURES.cheekbone),
    faceShape: shape === 'round' || shape === 'square' || shape === 'oval'
      || shape === 'long' || shape === 'heart' ? shape : NEUTRAL_FEATURES.faceShape,
  };
}
