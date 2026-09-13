/**
 * 모델 없이 신령이 말하는 법.
 *
 * 지금 이 집에는 모델 열쇠(`ANTHROPIC_API_KEY`)가 없다 — 카드사 심사가
 * 끝나야 들어온다. 그동안 상담 칸을 비워 두면 **손님은 이 집에 신령이
 * 없다고 생각한다.** 그래서 열쇠가 없어도 신령은 말을 한다.
 *
 * 여기서 하는 말은 **지어낸 말이 아니다.** 전부 손님의 사주에서 실제로
 * 나온 것(일간·신강신약·제일 두꺼운 십신·없는 오행)을 쉬운 말로 바꾼 것이다.
 * 나머지 조각들이 하는 일과 같다 — 계산은 결정론, 모델은 문장화만.
 *
 * 열쇠가 들어오면 이 파일은 **그대로 남는다.** 모델이 막히거나 느릴 때
 * 손님을 빈 화면 앞에 세워 두지 않으려면 돌아올 자리가 있어야 한다.
 */

import { type TalkFacts, plainGod, plainElement } from './facts.ts';
import { PERSONAS } from './persona.ts';

/** 손님이 무엇을 물었는지 크게 나눈다. 못 알아들으면 `기타` 로 간다 */
export type Intent = '언제' | '될까' | '왜' | '사람' | '나' | '기타';

const INTENT_WORDS: { intent: Intent; words: RegExp }[] = [
  { intent: '언제', words: /언제|몇\s*월|올해|내년|시기|타이밍|때가/ },
  { intent: '될까', words: /될까|될까요|가능|괜찮을까|해도\s*되|맞을까|잘\s*될/ },
  { intent: '왜', words: /왜|어째서|이유|때문/ },
  { intent: '사람', words: /그\s*사람|상대|남자|여자|친구|엄마|아빠|아이|동생|형|누나|언니|오빠|사장|상사/ },
  { intent: '나', words: /나는|내가|제가|저는|성격|어떤\s*사람/ },
];

export function intentOf(text: string): Intent {
  for (const r of INTENT_WORDS) if (r.words.test(text)) return r.intent;
  return '기타';
}

/**
 * 손님을 부르는 말.
 *
 * 「민수아」가 아니라 「민수야」다. 받침이 있으면 「아」, 없으면 「야」.
 * 이름을 틀리게 부르는 신령은 그 순간 신령이 아니게 된다.
 */
function vocative(name: string): string {
  const last = name.codePointAt(name.length - 1) ?? 0;
  if (last < 0xac00 || last > 0xd7a3) return `${name}아`;
  return (last - 0xac00) % 28 === 0 ? `${name}야` : `${name}아`;
}

/** 이름이 없으면 이름 없이 자연스럽게 넘어간다 */
function call(f: TalkFacts): string {
  return f.name ? `${vocative(f.name)}, ` : '';
}

/**
 * 손님의 사주에서 실제로 나온 한 줄.
 *
 * 세 가지를 돌려 쓴다 — 힘의 방향(신강신약), 제일 두꺼운 힘, 없는 기운.
 * 물음이 바뀔 때마다 다른 근거를 대야 「아까 그 말」이 안 된다.
 */
function ground(f: TalkFacts, turn: number): string {
  const picks = [
    f.strong
      ? '네 사주는 제 힘으로 미는 쪽이야. 밀 때는 세게 밀지만, 아닌 걸 붙들고 있을 때도 세게 붙들지.'
      : '네 사주는 기대는 쪽이야. 혼자 다 지려고 하면 오래 못 가고, 곁을 두면 훨씬 멀리 간다.',
    f.topGod
      ? `네 안에서 제일 두꺼운 건 ${plainGod(f.topGod)}이야. 그래서 거기부터 움직인다.`
      : '',
    f.lackElement
      ? `대신 ${plainElement(f.lackElement)}이 비어 있어. 비어 있는 자리는 사람이 채워 주더라.`
      : f.lackGod
        ? `대신 ${plainGod(f.lackGod)}이 얇아. 얇은 쪽은 애써야 겨우 채워진다.`
        : '',
  ].filter(Boolean);
  return picks[turn % picks.length] ?? picks[0] ?? '';
}

/** 신령이 되묻는 말. 답만 하면 안내문이고, 되물어야 상담이다 */
const ASKS: Record<string, string[]> = {
  flower: ['그 사람이 먼저 연락한 적 있니?', '언제부터 마음이 갔는데?', '너는 그 사람한테 어떤 사람이고 싶어?'],
  moon: ['헤어진 지 얼마나 됐니.', '마지막으로 한 말이 뭐였니.', '돌아오면 그때랑 달라질 수 있겠니.'],
  thread: ['그 사람은 화가 나면 어떻게 하니?', '둘이 제일 많이 부딪히는 게 뭐야?', '집안 이야기는 해 봤니?'],
  mountain: ['그 사람하고 마지막으로 길게 이야기한 게 언제니.', '네가 제일 서운했던 게 뭐였니.', '그 사람은 뭐라고 하더냐.'],
  mirror: ['남들은 너를 뭐라고 하니?', '그게 언제부터 걸렸어?', '네가 제일 바꾸고 싶은 게 뭐야?'],
  cross: ['얼굴하고 손금 중에 뭘 먼저 볼까?', '남들이 보는 너랑 진짜 너, 어디가 제일 다르니?', '사진은 찍어 뒀니?'],
  jar: ['지금 버는 돈은 어디서 새고 있니?', '그 일을 얼마나 했어?', '옮길 자리는 봐 뒀니?'],
  wind: ['언제까지 미룰 수 있는 일이니?', '안 움직이면 뭐가 제일 아까워?', '누가 같이 움직이니?'],
};

/**
 * 물음의 갈래마다 신령이 잡아 주는 첫 문장.
 *
 * 갈래마다 셋을 둔다. 손님이 세 번 내리 같은 갈래로 물어도 신령이 같은
 * 말을 세 번 하지 않는다 — 그러면 사람이 아니라 기계인 게 바로 들킨다.
 */
const OPEN: Record<Intent, string[]> = {
  언제: [
    '때를 묻는구나. 때는 사람보다 늦게 온다.',
    '또 때를 묻네. 때가 안 오는 게 아니라 아직 준비가 덜 된 걸 수도 있어.',
    '때는 달력에 있는 게 아니야. 네가 움직일 수 있게 됐을 때가 그때다.',
  ],
  될까: [
    '될지 안 될지부터 묻는구나. 그건 대개 이미 답을 정해 놓고 묻는 거야.',
    '되고 안 되고를 또 묻네. 되게 하려면 뭘 놓아야 하는지를 먼저 봐야 해.',
    '되냐고 물을 때 사람은 사실 허락을 구하는 거야. 나한테 구할 게 아니다.',
  ],
  왜: [
    '까닭을 묻는구나. 까닭은 대개 상대가 아니라 네 쪽에 있다.',
    '왜냐고 또 묻네. 까닭을 다 알아도 마음은 잘 안 풀리더라.',
    '까닭보다 그다음이 중하다. 알고 나면 뭘 할 생각이니.',
  ],
  사람: [
    '그 사람 이야기구나. 사람은 겉으로 하는 말이 속과 다를 때가 많아.',
    '또 그 사람이네. 네 이야기를 물어도 그 사람이 나오는구나.',
    '그 사람을 보려면 네가 그 사람 앞에서 어떤 사람인지부터 봐야 해.',
  ],
  나: [
    '네 이야기구나. 그게 제일 어려운 물음이야.',
    '네 이야기를 또 하네. 좋은 신호다. 남 탓으로 안 넘기는 사람이야.',
    '너를 보는 눈이 자꾸 남의 눈이구나. 네 눈으로 한 번 보자.',
  ],
  기타: ['듣고 있다.', '더 말해 보렴.', '그래서 어떻게 됐니.'],
};

export interface ScriptedReply {
  text: string;
  /** 되묻는 말. 화면이 따로 굵게 보여 준다 */
  ask: string;
}

/**
 * 신령의 답 한 번.
 *
 * `turn` 은 0부터. 같은 신령이 세 번 말하는 동안 근거와 되묻는 말이
 * 겹치지 않게 돌려 쓴다.
 */
export function scriptedReply(
  spiritId: string, facts: TalkFacts, ask: string, turn: number,
): ScriptedReply {
  const asks = ASKS[spiritId] ?? ASKS.mirror!;
  const intent = intentOf(ask);
  const heads = OPEN[intent];
  const head = call(facts) + heads[turn % heads.length]!;
  const body = ground(facts, turn);
  return {
    text: [head, body].filter(Boolean).join(' '),
    ask: asks[turn % asks.length]!,
  };
}

/** 손님이 앉자마자 신령이 먼저 거는 말 */
export function opening(spiritId: string, facts: TalkFacts): ScriptedReply {
  const p = PERSONAS[spiritId];
  // 첫 인사에서 「민수님」이라 부르고 다음 줄에서 「민수야」로 바꾸면
  // 한 사람이 말하는 것으로 안 들린다. 처음부터 끝까지 같은 호칭을 쓴다
  const who = facts.eight
    ? `${call(facts)}여덟 글자는 봤다. ${facts.eight}.`
    : call(facts).replace(/, $/, '.');
  return { text: [who, p?.opener ?? ''].filter(Boolean).join(' '), ask: '' };
}

/**
 * 공짜 세 번이 끝났을 때 하는 말.
 *
 * 여기서 값을 말하지 않는다. 값은 상품 화면에 있고, 그건 아래 칸에 이미
 * 깔려 있다. 신령은 「여기서부터는 제대로 봐야 한다」까지만 말한다.
 */
export function closing(spiritId: string, facts: TalkFacts): string {
  return `${call(facts)}여기까지는 여덟 글자만 보고 한 말이야. `
    + '더 들어가려면 네 것을 처음부터 끝까지 훑어야 해. 아래에서 골라 보렴.';
}
