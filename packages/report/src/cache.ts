/**
 * 리포트 캐시.
 *
 * 캐시는 여기서 비용 절감 장치가 아니라 **일관성 장치**다.
 *
 * Opus 5는 `temperature`를 받지 않는다(400). 즉 샘플링을 눌러서 같은 답을
 * 강제하는 방법이 없다. 같은 명식에 언제나 같은 리포트가 나오게 하려면
 * 결과를 저장해두고 재사용하는 수밖에 없다.
 *
 * 조사에서 확인한 불만 중 하나가 "물어볼 때마다 답이 다르다"였다.
 * 판단은 이미 룰 엔진이 결정론으로 끝냈으니, 문장까지 고정되면
 * 사용자 입장에서는 서비스 전체가 일관돼 보인다.
 */

import { createHash } from 'node:crypto';
import { canonicalize, PROMPT_VERSION, type ReportInput } from './prompt.ts';

export interface CacheKeyParts {
  input: ReportInput;
  model: string;
  effort: string;
}

/**
 * 캐시 키.
 *
 * 프롬프트 버전과 모델·effort까지 넣는 이유: 이 중 하나라도 바뀌면 결과 문장이
 * 달라지는데, 키가 같으면 옛 문장이 계속 나간다. 조용히 틀리는 쪽이 제일 나쁘다.
 */
export function cacheKey({ input, model, effort }: CacheKeyParts): string {
  const material = canonicalize({
    promptVersion: PROMPT_VERSION,
    model,
    effort,
    kind: input.kind,
    subject: input.subject ?? null,
    data: input.data,
  });
  return createHash('sha256').update(material).digest('hex');
}

export interface CachedReport {
  text: string;
  model: string;
  promptVersion: string;
  /** 이 리포트를 만드는 데 든 토큰. 원가 추적용 */
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
  createdAt: string;
}

export interface ReportCache {
  get(key: string): Promise<CachedReport | null>;
  set(key: string, value: CachedReport): Promise<void>;
}

/**
 * 메모리 캐시. 개발과 테스트용이다.
 *
 * 실서비스에서는 Postgres에 두어야 한다 — 프로세스가 죽으면 사라지는 캐시는
 * 일관성을 보장하지 못하고, 이미 판 리포트를 다시 만들면 원가가 두 번 든다.
 */
export class MemoryReportCache implements ReportCache {
  private store = new Map<string, CachedReport>();

  async get(key: string): Promise<CachedReport | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: CachedReport): Promise<void> {
    this.store.set(key, value);
  }

  get size(): number {
    return this.store.size;
  }
}

/** 토큰 사용량 → 원가(원). 판매가 대비 몇 %인지 바로 볼 수 있게 한다. */
export function estimateCostKrw(
  usage: CachedReport['usage'],
  rates = { inputPerMTokUsd: 5, outputPerMTokUsd: 25, cachedInputPerMTokUsd: 0.5, usdKrw: 1400 },
): number {
  const usd =
    (usage.inputTokens / 1e6) * rates.inputPerMTokUsd +
    (usage.cachedInputTokens / 1e6) * rates.cachedInputPerMTokUsd +
    (usage.outputTokens / 1e6) * rates.outputPerMTokUsd;
  return Math.round(usd * rates.usdKrw * 100) / 100;
}
