/**
 * 열쇠가 있을 때 신령이 말하는 법.
 *
 * 대본(`scripted.ts`)은 손님의 물음을 크게 갈래로만 나눈다. 그래서 답이
 * 늘 그럴듯하지만, 손님이 쓴 **그 문장**에 답하지는 못한다. 상담처럼
 * 느껴지려면 손님이 쓴 말을 받아서 답해야 한다.
 *
 * 여기서 지키는 것은 리포트와 같다 — **모델은 판단하지 않고 문장만 만든다.**
 * 사주 계산은 이미 끝나서 사실로 들어오고, 모델은 그 사실을 신령의 말투로
 * 옮기고 되물을 뿐이다.
 *
 * 값은 여기서 말하지 않는다. 상품과 값은 아래 칸에 이미 있고, 신령이
 * 값을 부르기 시작하면 그때부터 상담이 아니라 호객이다.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { type TalkFacts, plainGod, plainElement } from './facts.ts';
import { PERSONAS } from './persona.ts';
import { spiritById } from './persona.ts';
import { FREE_TURNS } from './guard.ts';

/** 받침이 있으면 「을」, 없으면 「를」. 조사가 틀리면 사람이 쓴 글로 안 읽힌다 */
function objectMark(word: string): string {
  const last = word.codePointAt(word.length - 1) ?? 0;
  if (last < 0xac00 || last > 0xd7a3) return '를';
  return (last - 0xac00) % 28 === 0 ? '를' : '을';
}

/**
 * 상담은 짧고 여러 번이다. 리포트처럼 길게 쓸 일이 없으므로 오퍼스를
 * 쓸 이유도 없다. 답 한 번이 200자 남짓이라 원가가 얼마 안 든다.
 */
export const TALK_MODEL = 'claude-sonnet-5';
export const TALK_MAX_TOKENS = 400;

export interface TalkTurn {
  who: 'guest' | 'spirit';
  text: string;
}

export function buildSystem(spiritId: string, facts: TalkFacts): string {
  const sp = spiritById(spiritId);
  const p = PERSONAS[spiritId];
  if (!sp || !p) throw new Error(`모르는 신령입니다: ${spiritId}`);

  return `너는 「${sp.name}」이다. 한국의 사주 사이트 「늘봄사주」의 신령계에 살고,
${sp.keeps} 이야기를 맡는다. 손에는 ${sp.holds}${objectMark(sp.holds)} 들고 있다.

말투: ${p.voice}

# 반드시 지킬 것

1. **여덟 살이 알아듣는 말만 쓴다.** 사주 용어(십신·용신·신살)를 그대로 쓰지 않는다.
   써야 하면 바로 뒤에 쉬운 말을 붙인다.
2. **답하고 반드시 하나를 되묻는다.** 되묻지 않으면 상담이 아니라 안내문이다.
   되묻는 말은 마지막 줄에 따로 놓는다.
3. **아래 「손님에 대해 아는 것」에 없는 사실을 지어내지 않는다.**
   생년월일·직업·사는 곳을 아는 척하지 않는다. 손님이 말한 것만 안다.
4. **점괘를 단정하지 않는다.** 「반드시 된다」, 「그 사람은 돌아온다」처럼
   말하지 않는다. 기운이 어느 쪽으로 기우는지까지만 말한다.
5. **몸(병)·죽음·투자·법으로 다투는 일은 답하지 않는다.** 그건 신령이 볼
   자리가 아니라고 말하고, 네가 볼 수 있는 것으로 되돌린다.
6. **값이나 상품 이름을 말하지 않는다.** 그건 화면 아래에 이미 있다.
7. 세 문장을 넘기지 않는다. 되묻는 말은 따로 한 줄.

# 손님에 대해 아는 것

${facts.name ? `- 이름: ${facts.name}` : '- 이름을 밝히지 않았다'}
${facts.eight ? `- 사주 여덟 글자: ${facts.eight}` : ''}
${facts.dayStem ? `- 자기 자신을 가리키는 글자(일간): ${facts.dayStem} (${facts.dayElement})` : ''}
- 힘의 방향: ${facts.strong ? '제 힘으로 미는 쪽(신강)' : '기대는 쪽(신약)'}
${facts.topGod ? `- 제일 두꺼운 힘: ${facts.topGod} — 쉬운 말로 「${plainGod(facts.topGod)}」` : ''}
${facts.lackGod ? `- 제일 얇은 힘: ${facts.lackGod} — 쉬운 말로 「${plainGod(facts.lackGod)}」` : ''}
${facts.topElement ? `- 제일 많은 기운: ${facts.topElement} — 「${plainElement(facts.topElement)}」` : ''}
${facts.lackElement ? `- 비어 있는 기운: ${facts.lackElement} — 「${plainElement(facts.lackElement)}」` : ''}
- 태어난 시: ${facts.timeKnown ? '안다' : '모른다. 시주 이야기는 하지 않는다'}

# 내보내는 모양

답을 먼저 쓰고, 마지막 줄에 되묻는 말 하나만 이렇게 쓴다.

되묻기: <되묻는 말 한 줄>`;
}

export interface ModelReply {
  text: string;
  ask: string;
}

/** 마지막 줄의 「되묻기:」를 떼어 따로 담는다. 없으면 답만 돌려준다 */
export function splitAsk(raw: string): ModelReply {
  const m = raw.match(/(^|\n)\s*되묻기\s*[:：]\s*([^\n]+)\s*$/);
  if (!m) return { text: raw.trim(), ask: '' };
  return { text: raw.slice(0, m.index).trim(), ask: m[2]!.trim() };
}

export interface AskOptions {
  client?: Anthropic;
  model?: string;
}

/**
 * 모델 꾸러미는 **쓸 때 불러온다.**
 *
 * 맨 위에서 불러오면, 꾸러미가 이미지에 안 들어간 날 **서버가 아예 안 뜬다.**
 * 상담 하나 때문에 약관 페이지까지 같이 죽는 것이다 — 전에 `pg` 로 똑같은
 * 사고를 한 번 냈다. 여기서 실패하면 대본이 받으면 그만이다.
 */
async function loadSdk(): Promise<new () => Anthropic> {
  const mod = await import('@anthropic-ai/sdk');
  return (mod.default ?? mod) as unknown as new () => Anthropic;
}

export async function modelReply(
  spiritId: string, facts: TalkFacts, history: TalkTurn[], options: AskOptions = {},
): Promise<ModelReply> {
  const client = options.client ?? new (await loadSdk())();
  // 대화가 길어져도 원가가 늘지 않게, 공짜 구간만큼만 들고 간다
  const kept = history.slice(-(FREE_TURNS * 2));
  const res = await client.messages.create({
    model: options.model ?? TALK_MODEL,
    max_tokens: TALK_MAX_TOKENS,
    // 신령의 성격은 손님이 바뀌어도 그대로다. 앞부분이 캐시에 걸린다
    system: [{ type: 'text', text: buildSystem(spiritId, facts), cache_control: { type: 'ephemeral' } }],
    messages: kept.map((t) => ({
      role: t.who === 'guest' ? ('user' as const) : ('assistant' as const),
      content: t.text,
    })),
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text).join('\n');
  return splitAsk(text);
}
