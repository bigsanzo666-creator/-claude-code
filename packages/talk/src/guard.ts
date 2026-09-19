/**
 * 신령이 넘지 않는 선.
 *
 * 사주를 보러 온 사람이 「이 병 낫나요」, 「이 주식 사도 되나요」를 묻는 일은
 * 반드시 생긴다. 그때 신령이 답하면 그건 점이 아니라 **의료 상담이고 투자
 * 권유다.** 우리는 그 자격이 없고, 그 답이 틀리면 사람이 다친다.
 *
 * 그래서 그런 물음은 답을 피하는 것이 아니라 **답할 수 없다고 말하고**,
 * 신령이 볼 수 있는 것으로 되돌린다.
 */

export type Block = 'medical' | 'death' | 'invest' | 'legal' | 'harm' | null;

const RULES: { kind: Exclude<Block, null>; words: RegExp; say: string }[] = [
  {
    kind: 'harm',
    words: /죽고\s*싶|자살|목숨을\s*끊|살기\s*싫/,
    say: '그 말은 내가 받을 수 있는 말이 아니야. 지금 바로 사람한테 말해 주렴. '
      + '자살예방상담전화 109번, 밤에도 사람이 받는다. 나는 여기서 기다리마.',
  },
  {
    kind: 'medical',
    words: /암|수술|병원|진단|약을|우울증|치료|낫나|아픈\s*데/,
    say: '몸은 내가 볼 자리가 아니야. 그건 의사한테 물어야 해. '
      + '나는 마음이 어디로 기우는지까지만 본다.',
  },
  {
    kind: 'death',
    words: /언제\s*죽|수명|명이\s*짧|얼마나\s*사/,
    say: '사람의 끝을 말하는 신령은 없어. 그건 아무도 모르고, 안다고 하는 쪽이 거짓이야.',
  },
  {
    kind: 'invest',
    words: /주식|코인|비트|부동산\s*살|투자|로또|복권|매수|매도/,
    say: '어디에 돈을 넣으라는 말은 못 해. 그건 점이 아니라 남의 돈을 거는 일이야. '
      + '대신 네 돈그릇이 지금 어떤 모양인지는 봐 줄 수 있다.',
  },
  {
    kind: 'legal',
    words: /소송|고소|재판|변호사|합의금/,
    say: '법으로 다투는 일은 변호사한테 물어야 해. 나는 그 일로 네 마음이 어떻게 되는지만 본다.',
  },
];

export function blockOf(text: string): { kind: Block; say: string } {
  for (const r of RULES) {
    if (r.words.test(text)) return { kind: r.kind, say: r.say };
  }
  return { kind: null, say: '' };
}

/** 손님이 보낸 글. 길면 자르고, 태그 글자는 지운다 */
export const MAX_ASK = 300;

export function cleanAsk(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_ASK);
}

/**
 * 공짜로 주고받는 횟수.
 *
 * 세 번이다. 한 번이면 상담이 아니고, 열 번이면 살 이유가 없어진다.
 * 세 번째 답 끝에서 신령이 「여기서부터는 제대로 봐야 한다」고 말한다.
 */
export const FREE_TURNS = 3;
