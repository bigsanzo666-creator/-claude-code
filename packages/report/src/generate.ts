/**
 * 리포트 생성 — 유일하게 모델을 호출하는 파일.
 *
 * 이 파일 밖의 모든 계산은 결정론이다. 여기서만 모델이 개입하고,
 * 그것도 판단이 아니라 문장화에만 개입한다.
 *
 * 무료 구간은 이 파일을 거치지 않는다. 그래서 트래픽이 늘어도 원가가 늘지 않는다.
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, buildUserMessage, PROMPT_VERSION, type ReportInput } from './prompt.ts';
import { cacheKey, estimateCostKrw, type CachedReport, type ReportCache } from './cache.ts';

/**
 * effort 기본값을 medium으로 둔 근거:
 *
 * 리포트 하나가 출력 3천 토큰이라고 보면 25달러/1M 기준 약 0.075달러(≈105원),
 * 입력까지 합쳐 150원 안팎이다. 판매가를 15,000원으로 잡으면 원가율 1%다.
 * 조사에서 세운 기준(판매가의 10% 이하)에 여유가 크므로, low로 아끼기보다
 * 문장 품질을 사는 편이 낫다. high 이상은 이 작업(판단이 아닌 서술)에 과하다.
 */
export const DEFAULT_MODEL = 'claude-opus-5';
export const DEFAULT_EFFORT = 'medium';

export interface GenerateOptions {
  cache?: ReportCache;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  client?: Anthropic;
  /** 캐시를 무시하고 새로 만든다. 프롬프트를 손볼 때만 쓴다 */
  force?: boolean;
}

export interface GenerateResult extends CachedReport {
  fromCache: boolean;
  costKrw: number;
}

export class ReportRefusedError extends Error {
  readonly category: string | null;
  readonly explanation: string | null;

  constructor(category: string | null, explanation: string | null) {
    super(`리포트 생성이 거절되었습니다 (${category ?? '사유 미상'})`);
    this.name = 'ReportRefusedError';
    this.category = category;
    this.explanation = explanation;
  }
}

export async function generateReport(
  input: ReportInput,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const effort = options.effort ?? DEFAULT_EFFORT;
  const key = cacheKey({ input, model, effort });

  if (options.cache && !options.force) {
    const hit = await options.cache.get(key);
    if (hit) return { ...hit, fromCache: true, costKrw: 0 };
  }

  const client = options.client ?? new Anthropic();

  // 스트리밍을 쓰는 이유: 적응형 사고가 켜져 있으면 출력 토큰이 늘어날 수 있고,
  // 큰 max_tokens로 논스트리밍 요청을 보내면 HTTP 타임아웃에 걸릴 수 있다.
  const stream = client.beta.messages.stream({
    model,
    max_tokens: 12000,
    // 시스템 프롬프트는 입력과 무관하게 고정이라 캐시가 걸린다.
    // 사용자 데이터는 이 뒤에 오므로 프리픽스가 깨지지 않는다.
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(input.kind),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildUserMessage(input) }],
    thinking: { type: 'adaptive' },
    output_config: { effort },
    // Opus 5 권장 설정. 정책상 거절이 나면 같은 요청을 대체 모델로 이어 처리한다.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });

  const response = await stream.finalMessage();

  // content를 읽기 전에 반드시 확인한다. 거절은 예외가 아니라 200으로 돌아온다.
  if (response.stop_reason === 'refusal') {
    const details = response.stop_details;
    throw new ReportRefusedError(
      details && 'category' in details ? (details.category as string | null) : null,
      details && 'explanation' in details ? (details.explanation as string | null) : null,
    );
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) throw new Error('리포트 본문이 비어 있습니다.');

  const usage = {
    inputTokens: response.usage.input_tokens ?? 0,
    outputTokens: response.usage.output_tokens ?? 0,
    cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
  };

  const record: CachedReport = {
    text,
    model: response.model,
    promptVersion: PROMPT_VERSION,
    usage,
    createdAt: new Date().toISOString(),
  };

  if (options.cache) await options.cache.set(key, record);

  return { ...record, fromCache: false, costKrw: estimateCostKrw(usage) };
}
