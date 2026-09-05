/**
 * 신령의 답 한 번 — 대본과 모델을 한 문으로 묶는다.
 *
 * 화면과 서버는 이 함수 하나만 부른다. 열쇠가 있으면 모델이 답하고,
 * 없거나 모델이 막히면 대본이 답한다. **어느 쪽이든 손님은 답을 받는다.**
 * 빈 화면을 보는 일은 없다.
 */

import { type TalkFacts } from './facts.ts';
import { blockOf, FREE_TURNS } from './guard.ts';
import { scriptedReply, opening, closing } from './scripted.ts';
import { modelReply, type TalkTurn, type AskOptions } from './model.ts';

export interface TalkResult {
  text: string;
  /** 신령이 되묻는 말. 없을 수도 있다 */
  ask: string;
  /** 아직 남은 공짜 횟수 */
  left: number;
  /** 공짜가 끝나 상품으로 넘길 때 붙는 말 */
  close: string;
  /** 모델이 답했는가. 로그와 검증에서만 쓴다 */
  byModel: boolean;
}

export interface TalkRequest {
  spiritId: string;
  facts: TalkFacts;
  /** 손님이 방금 쓴 글 */
  ask: string;
  /** 지금까지 주고받은 것. 신령이 앞말을 기억하게 한다 */
  history: TalkTurn[];
  /** 손님이 몇 번째로 묻는가. 0부터 */
  turn: number;
}

export interface TalkDeps extends AskOptions {
  /** 열쇠가 없으면 false. 그때는 대본만 쓴다 */
  useModel?: boolean;
  /** 오늘 이미 몇 번 모델을 불렀는가. 한도를 넘으면 대본으로 내려간다 */
  overBudget?: boolean;
}

export { opening, FREE_TURNS };

export async function talk(req: TalkRequest, deps: TalkDeps = {}): Promise<TalkResult> {
  const turn = Math.max(0, Math.floor(req.turn));
  const left = Math.max(0, FREE_TURNS - turn - 1);
  const close = left === 0 ? closing(req.spiritId, req.facts) : '';

  // 넘지 않는 선이 먼저다. 모델을 부르기 전에 막는다 —
  // 부르고 나서 막으면 이미 돈이 나갔고, 답이 새어 나올 수도 있다
  const block = blockOf(req.ask);
  if (block.kind) {
    return { text: block.say, ask: '', left, close, byModel: false };
  }

  if (deps.useModel && !deps.overBudget) {
    try {
      const got = await modelReply(req.spiritId, req.facts,
        [...req.history, { who: 'guest', text: req.ask }], deps);
      if (got.text) return { ...got, left, close, byModel: true };
    } catch {
      // 모델이 막히면 손님을 기다리게 두지 않는다. 대본이 받는다
    }
  }

  const said = scriptedReply(req.spiritId, req.facts, req.ask, turn);
  return { ...said, left, close, byModel: false };
}
