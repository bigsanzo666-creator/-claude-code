/**
 * 맛보기 — 신령이 **그 자리에서 진짜로 한 조각 봐 주는** 말.
 *
 * 신령을 눌러 들어왔는데 상품 목록만 나오면, 그건 상담이 아니라 표다.
 * 손님이 「이거 볼래」 하고 고르면 신령이 **바로 답을 준다.** 값을 받기
 * 전에 먼저 주는 것이 순서다.
 *
 * ## 지어내지 않는다
 *
 * 여기서 하는 말은 전부 손님의 사주에서 실제로 나온 것이다 —
 * 힘의 방향(신강·신약), 제일 두꺼운 힘, 비어 있는 기운. 그것을 그 갈래의
 * 말로 옮길 뿐이다. 「반드시 된다」, 「그 사람은 돌아온다」 같은 말은 없다.
 *
 * ## 어디서 끊는가
 *
 * **한 조각까지만 준다.** 지금 어떤 사람인지는 말해 주고, 그래서 언제
 * 어떻게 움직여야 하는지는 리포트에 있다. 끊는 자리를 신령이 직접
 * 말하므로 손님은 속았다고 느끼지 않는다.
 */

import { type TalkFacts, plainGod, plainElement } from './facts.ts';
import { PITCH } from '../../site-policy/src/spirits.ts';
import { CATALOG, type Category } from '../../commerce/src/catalog.ts';

export interface Taste {
  /** 신령이 하는 풀이. 두세 줄 */
  lines: string[];
  /** 여기서 끊고 리포트로 넘기는 말 */
  more: string;
  productId: string;
}

/** 힘의 방향을 그 갈래의 말로 */
const STRONG: Record<Category, [string, string]> = {
  연애: [
    '네 사주는 제 힘으로 미는 쪽이야. 마음이 가면 네가 먼저 다가간다. 그래서 빨리 뜨겁고, 식는 것도 네가 먼저야.',
    '네 사주는 기대는 쪽이야. 먼저 다가가기보다 기다리는 편이지. 기다림이 길어지면 없던 마음도 만들어 낸다.',
  ],
  재회: [
    '네 사주는 제 힘으로 미는 쪽이야. 그래서 놓아야 할 것도 손에 오래 쥐고 있는다.',
    '네 사주는 기대는 쪽이야. 그 사람이 없으면 허전한 게 아니라, 기댈 데가 없어서 허전한 걸 수도 있어.',
  ],
  궁합: [
    '네 사주는 제 힘으로 미는 쪽이야. 둘이 부딪히면 네가 먼저 밀어붙인다.',
    '네 사주는 기대는 쪽이야. 둘이 부딪히면 네가 먼저 물러선다. 물러선 게 쌓이면 한 번에 터진다.',
  ],
  가족: [
    '네 사주는 제 힘으로 미는 쪽이야. 그래서 집안 일도 네가 다 지려고 한다.',
    '네 사주는 기대는 쪽이야. 집안에서 네 편이 하나만 있어도 네가 훨씬 단단해진다.',
  ],
  나: [
    '네 사주는 제 힘으로 미는 쪽이야. 밀 때는 세게 밀지만, 아닌 걸 붙들 때도 그만큼 세게 붙든다.',
    '네 사주는 기대는 쪽이야. 혼자 다 지려고 하면 오래 못 가고, 곁을 두면 훨씬 멀리 간다.',
  ],
  삼합: [
    '네 사주는 제 힘으로 미는 쪽이야. 속이 이렇게 세면 겉은 오히려 순해 보이는 경우가 많다.',
    '네 사주는 기대는 쪽이야. 속이 이렇게 무르면 겉을 일부러 단단하게 꾸미는 경우가 많다.',
  ],
  '돈과 일': [
    '네 사주는 제 힘으로 미는 쪽이야. 벌 때 크게 벌지만, 쥐고 있는 건 또 다른 힘이라 따로 봐야 해.',
    '네 사주는 기대는 쪽이야. 혼자 크게 벌리는 것보다, 실한 데 붙어 오래 가는 게 네 그릇에 맞는다.',
  ],
  시기: [
    '네 사주는 제 힘으로 미는 쪽이야. 때가 안 왔는데 네가 먼저 움직이는 일이 잦다.',
    '네 사주는 기대는 쪽이야. 때가 왔는데도 한 박자 늦게 움직이는 일이 잦다.',
  ],
};

/** 비어 있는 기운을 그 갈래의 말로 */
function lack(facts: TalkFacts, keeps: Category): string {
  if (facts.lackElement) {
    const e = plainElement(facts.lackElement);
    const where: Record<Category, string> = {
      연애: `그리고 ${e}이 비어 있어. 그 자리는 대개 사람이 채워 준다 — 네가 끌리는 사람이 거기 있다.`,
      재회: `그리고 ${e}이 비어 있어. 그 사람이 그걸 채워 줬다면, 그리운 건 그 사람이 아니라 그 자리일 수도 있다.`,
      궁합: `그리고 ${e}이 비어 있어. 상대가 그걸 가졌으면 오래 가고, 둘 다 없으면 같은 데서 자꾸 걸린다.`,
      가족: `그리고 ${e}이 비어 있어. 집안에 그걸 가진 사람이 하나 있으면 네가 훨씬 편해진다.`,
      나: `그리고 ${e}이 비어 있어. 비어 있는 자리는 애써 채우기보다, 가진 사람 곁에 두는 편이 빠르다.`,
      삼합: `그리고 ${e}이 비어 있어. 사주에서 빈 것은 대개 얼굴이나 손에 표가 난다.`,
      '돈과 일': `그리고 ${e}이 비어 있어. 그 자리를 돈으로 메우려 들면 그때부터 새기 시작한다.`,
      시기: `그리고 ${e}이 비어 있어. 그 기운이 들어오는 해가 네가 움직일 때다.`,
    };
    return where[keeps];
  }
  if (facts.lackGod) return `그리고 ${plainGod(facts.lackGod)}이 얇아. 얇은 쪽은 애써야 겨우 채워진다.`;
  return '';
}

/** 제일 두꺼운 힘 한 줄 */
function top(facts: TalkFacts): string {
  if (!facts.topGod) return '';
  return `네 안에서 제일 두꺼운 건 ${plainGod(facts.topGod)}이야. 무슨 일이든 거기부터 움직인다.`;
}

/**
 * 상품 하나를 두고 신령이 그 자리에서 봐 주는 말.
 *
 * 값이나 상품 이름은 말하지 않는다. 그건 아래 단추에 이미 있다.
 */
export function taste(productId: string, facts: TalkFacts): Taste {
  const product = CATALOG[productId as keyof typeof CATALOG];
  if (!product) throw new Error(`모르는 상품입니다: ${productId}`);
  const keeps = product.category;
  const pair = STRONG[keeps];
  const lines = [
    pair[facts.strong ? 0 : 1],
    top(facts),
    lack(facts, keeps),
  ].filter(Boolean);
  return {
    lines,
    // 끊는 자리를 신령이 직접 말한다. 그래야 손님이 속았다고 느끼지 않는다
    more: PITCH[productId] ?? '여기서부터는 네 것을 처음부터 끝까지 훑어야 보인다.',
    productId,
  };
}

/** 신령이 「뭘 보고 싶으냐」 하고 묻기 전에 붙이는 한 줄 */
export function chooseAsk(facts: TalkFacts): string {
  const who = facts.topGod
    ? `${plainGod(facts.topGod)}이 두꺼운 사주야.`
    : '여덟 글자는 봤다.';
  return `${who} 무엇부터 보고 싶으냐.`;
}
