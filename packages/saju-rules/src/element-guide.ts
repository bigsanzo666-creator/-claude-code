/**
 * 오행별 색·방향·시간·생활 지침 표.
 *
 * 출처: 전통 명리학 고전(자평진전, 연해자평, 황제내경)의 오행 방위·색상·시간통속 배속.
 *
 * ## 왜 이 표를 룰 엔진에 두는가
 *
 * 리포트에 「무슨 색 옷을 입고 어느 방향으로 걸어라」 같은 말을 넣을 때
 * 표가 코드에 없으면 모델이 매번 다른 색과 물건을 지어낸다.
 * 같은 사람이 어제는 초록이라더니 오늘은 빨강이라 들으면 신뢰가 끝난다.
 * 룰 엔진이 오행에 맞춰 못 박아 둔 것만 모델에게 넘긴다.
 *
 * ## 규칙
 *
 * - 유파가 갈리는 보석, 행운의 숫자 개수, 특정 브랜드 등은 넣지 않는다.
 * - 값비싼 물건(부적, 특수 원석, 비싼 제품 등)을 권하지 않는다.
 * - 손님이 오늘 당장 돈 안 들이고 일상에서 할 수 있는 것 위주로 적는다.
 */

import type { Element } from './tables.ts';
import { ELEMENT_PLAIN } from './reading.ts';

export interface ElementGuide {
  element: Element;
  /** 쉬운 이름 (예: 뻗어 나가는 기운) */
  plain: string;
  /** 기운을 돕는 색 두세 가지 */
  colors: string[];
  /** 기운이 닿는 방위 */
  direction: string;
  /** 하루 중 활발한 시간대 */
  timeOfDay: string;
  /** 일상에서 지니거나 곁에 둘 만한 물건 두세 가지 */
  items: string[];
  /** 이 기운이 주는 삶의 의미 한 줄 */
  meaning: string;
}

export const ELEMENT_GUIDE: Record<Element, ElementGuide> = {
  목: {
    element: '목',
    plain: ELEMENT_PLAIN['목'],
    colors: ['초록', '청록'],
    direction: '동쪽',
    timeOfDay: '아침',
    items: ['작은 식물이나 화분', '나무 볼펜이나 연필', '나무 팔찌'],
    meaning: '새로운 일을 시작하고 막힌 곳을 뚫어내는 생기의 힘입니다.',
  },
  화: {
    element: '화',
    plain: ELEMENT_PLAIN['화'],
    colors: ['빨강', '주황', '자주'],
    direction: '남쪽',
    timeOfDay: '낮',
    items: ['따뜻한 조명이나 향초', '붉은색 계열 손수건이나 메모지', '햇볕 쬐기'],
    meaning: '자신을 세상에 당당히 드러내고 열정을 일으키는 밝은 힘입니다.',
  },
  토: {
    element: '토',
    plain: ELEMENT_PLAIN['토'],
    colors: ['노랑', '황토색', '베이지'],
    direction: '중앙',
    timeOfDay: '오후',
    items: ['도자기 머그잔', '황토색이나 베이지색 파우치', '흙길 산책'],
    meaning: '흔들리지 않고 중심을 잡으며 모든 기운을 든든히 품어 안는 힘입니다.',
  },
  금: {
    element: '금',
    plain: ELEMENT_PLAIN['금'],
    colors: ['흰색', '은색', '밝은 회색'],
    direction: '서쪽',
    timeOfDay: '저녁',
    items: ['금속 시계나 열쇠고리', '은색 펜', '흰색 손수건'],
    meaning: '군더더기를 깔끔하게 잘라내고 결실을 다부지게 맺는 결단의 힘입니다.',
  },
  수: {
    element: '수',
    plain: ELEMENT_PLAIN['수'],
    colors: ['검정', '남색', '짙은 파랑'],
    direction: '북쪽',
    timeOfDay: '밤',
    items: ['자주 마시는 물병(텀블러)', '검정색이나 남색 수첩', '잔잔한 물가 산책'],
    meaning: '굳어지지 않고 유연하게 흘러가며 지혜를 깊이 모으는 힘입니다.',
  },
};

/** 주어진 오행들에 해당하는 지침을 순서대로 돌려준다 (중복 오행은 한 번만) */
export function guideFor(elements: Element[]): ElementGuide[] {
  const seen = new Set<Element>();
  const list: ElementGuide[] = [];
  for (const el of elements) {
    if (!seen.has(el) && ELEMENT_GUIDE[el]) {
      seen.add(el);
      list.push(ELEMENT_GUIDE[el]);
    }
  }
  return list;
}

export interface ElementCorrespondence {
  element: Element;
  /** 맞는 방향 (목=동, 화=남, 토=중앙, 금=서, 수=북) */
  direction: string;
  /** 맞는 색 (목=청·초록, 화=적, 토=황, 금=백, 수=흑·남색) */
  color: string;
  /** 맞는 숫자 (목=3·8, 화=2·7, 토=5·10, 금=4·9, 수=1·6) */
  numbers: string;
  /** 안내 문구: 고를 일이 있을 때 기울이면 되는 쪽 */
  guide: string;
}

export const ELEMENT_CORRESPONDENCES: Record<Element, ElementCorrespondence> = {
  목: {
    element: '목',
    direction: '동',
    color: '청·초록',
    numbers: '3·8',
    guide: '고를 일이 있을 때 마음을 편히 기울이면 되는 쪽입니다.',
  },
  화: {
    element: '화',
    direction: '남',
    color: '적',
    numbers: '2·7',
    guide: '고를 일이 있을 때 마음을 편히 기울이면 되는 쪽입니다.',
  },
  토: {
    element: '토',
    direction: '중앙',
    color: '황',
    numbers: '5·10',
    guide: '고를 일이 있을 때 마음을 편히 기울이면 되는 쪽입니다.',
  },
  금: {
    element: '금',
    direction: '서',
    color: '백',
    numbers: '4·9',
    guide: '고를 일이 있을 때 마음을 편히 기울이면 되는 쪽입니다.',
  },
  수: {
    element: '수',
    direction: '북',
    color: '흑·남색',
    numbers: '1·6',
    guide: '고를 일이 있을 때 마음을 편히 기울이면 되는 쪽입니다.',
  },
};

/** 오행 하나를 넣으면 맞는 방향·색·숫자를 돌려준다 */
export function elementCorrespondence(element: Element): ElementCorrespondence {
  return ELEMENT_CORRESPONDENCES[element];
}
