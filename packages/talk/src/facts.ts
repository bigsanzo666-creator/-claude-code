/**
 * 신령이 손님에 대해 아는 것.
 *
 * **계산은 브라우저가 한다.** 만세력 조각이 이미 하고 있는 계산을 서버에서
 * 또 하면 언젠가 두 값이 달라진다. 그래서 화면이 계산해서 여기 담아 보내고,
 * 서버는 담긴 것을 읽기만 한다.
 *
 * 생년월일 자체는 보내지 않는다. 신령이 말하는 데 필요한 것은 「무슨 날에
 * 태어났는가」가 아니라 「그래서 어떤 사람인가」다.
 */

export interface TalkFacts {
  /** 부를 이름. 없으면 신령은 이름 없이 말한다 */
  name: string;
  /** 일간 — 이 사람 자신을 가리키는 글자 */
  dayStem: string;
  /** 일간의 오행 */
  dayElement: string;
  /** 사주 여덟 글자. 「갑자 을축 병인 정묘」 */
  eight: string;
  /** 신강이면 true. 제 힘으로 미는 쪽인지, 기대는 쪽인지 */
  strong: boolean;
  /** 제일 두꺼운 십신 그룹 */
  topGod: string;
  /** 아예 없거나 제일 얇은 십신 그룹 */
  lackGod: string;
  /** 제일 많은 오행 */
  topElement: string;
  /** 없는 오행. 없으면 빈 문자열 */
  lackElement: string;
  /** 태어난 시를 아는가. 모르면 신령이 시주 이야기를 안 한다 */
  timeKnown: boolean;
}

export const EMPTY_FACTS: TalkFacts = {
  name: '', dayStem: '', dayElement: '', eight: '', strong: false,
  topGod: '', lackGod: '', topElement: '', lackElement: '', timeKnown: false,
};

/** 보내온 값을 그대로 믿지 않는다. 길이와 글자를 자르고 걸러 낸다 */
export function cleanFacts(raw: unknown): TalkFacts {
  const o = (raw ?? {}) as Record<string, unknown>;
  const text = (v: unknown, max: number): string =>
    typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) : '';
  return {
    name: text(o.name, 10),
    dayStem: text(o.dayStem, 2),
    dayElement: text(o.dayElement, 2),
    eight: text(o.eight, 24),
    strong: o.strong === true,
    topGod: text(o.topGod, 4),
    lackGod: text(o.lackGod, 4),
    topElement: text(o.topElement, 2),
    lackElement: text(o.lackElement, 2),
    timeKnown: o.timeKnown === true,
  };
}

/** 십신 그룹을 여덟 살이 알아듣는 말로 */
export const GOD_PLAIN: Record<string, string> = {
  비겁: '혼자 밀고 나가는 힘',
  식상: '밖으로 내보이는 힘',
  재성: '쥐고 굴리는 힘',
  관성: '지키고 견디는 힘',
  인성: '받아들이고 배우는 힘',
};

/** 오행을 여덟 살이 알아듣는 말로 */
export const ELEMENT_PLAIN: Record<string, string> = {
  목: '뻗어 나가는 기운',
  화: '타오르는 기운',
  토: '품고 버티는 기운',
  금: '자르고 맺는 기운',
  수: '흐르고 스며드는 기운',
};

export function plainGod(god: string): string {
  return GOD_PLAIN[god] ?? god;
}

export function plainElement(element: string): string {
  return ELEMENT_PLAIN[element] ?? element;
}
