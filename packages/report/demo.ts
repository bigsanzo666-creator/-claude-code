/**
 * 실제 리포트를 하나 만들어 보는 스크립트.
 *
 *   ANTHROPIC_API_KEY=... node --experimental-strip-types packages/report/demo.ts
 *   ANTHROPIC_API_KEY=... node --experimental-strip-types packages/report/demo.ts 1990-05-15 14:30 남
 *
 * **이 스크립트는 모델을 호출하므로 돈이 든다.** 한 건에 150원 안팎이다.
 * verify.ts와 달리 CI에 넣지 말 것.
 */

import { calculate } from '../manseryeok/src/index.ts';
import { analyze, calculateDaeun, currentDaeun, annualLuck } from '../saju-rules/src/index.ts';
import { generateReport, MemoryReportCache } from './src/index.ts';

const [date = '1990-05-15', time = '14:30', gender = '남'] = process.argv.slice(2);

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error('ANTHROPIC_API_KEY 가 필요합니다. (또는 ant auth login)');
  process.exit(1);
}

const ms = calculate({ date, time });
const an = analyze(ms);
const daeun = calculateDaeun(ms, gender as '남' | '여', an.yongsin);
const nowYear = new Date().getFullYear();
const age = nowYear - ms.meta.solarYear;

// 모델에 넘기는 것은 룰 엔진의 결과 그대로다. 우리가 고르거나 요약하지 않는다.
const data = {
  명식: {
    연주: `${ms.year.stem}${ms.year.branch}`,
    월주: `${ms.month.stem}${ms.month.branch}`,
    일주: `${ms.day.stem}${ms.day.branch}`,
    시주: ms.hour ? `${ms.hour.stem}${ms.hour.branch}` : null,
  },
  일간: an.dayMaster,
  기둥별_십신: an.pillars,
  십신_비중: an.strength.scores,
  없는_십신: an.missingGroups,
  오행: an.elements,
  강약: an.strength,
  용신: an.yongsin,
  관계: an.relations,
  신살: an.sinsal,
  두드러진_특징: an.highlights,
  대운: { 방향: daeun.direction, 근거: daeun.basis, 현재: currentDaeun(daeun, age), 전체: daeun.periods },
  세운: annualLuck(ms, an.yongsin, nowYear, 5),
};

console.log(`\n입력: ${date} ${time} ${gender}`);
console.log(`명식: ${data.명식.연주} ${data.명식.월주} ${data.명식.일주} ${data.명식.시주 ?? '—'}`);
console.log(`데이터 크기: ${JSON.stringify(data).length.toLocaleString()}자\n`);
console.log('─'.repeat(60));

const cache = new MemoryReportCache();
const started = Date.now();
const result = await generateReport({ kind: '사주', data, subject: '이 분' }, { cache });

console.log(result.text);
console.log('─'.repeat(60));
console.log(
  `\n모델 ${result.model} · ${((Date.now() - started) / 1000).toFixed(1)}초\n` +
  `토큰 입력 ${result.usage.inputTokens.toLocaleString()} ` +
  `(캐시 ${result.usage.cachedInputTokens.toLocaleString()}) / ` +
  `출력 ${result.usage.outputTokens.toLocaleString()}\n` +
  `원가 약 ${result.costKrw}원 — 판매가 15,000원 기준 ${((result.costKrw / 15000) * 100).toFixed(2)}%`,
);

// 두 번째 호출은 캐시에서 나와야 한다. 같은 명식이면 같은 문장이라는 뜻이다.
const again = await generateReport({ kind: '사주', data, subject: '이 분' }, { cache });
console.log(`\n같은 입력 재요청: ${again.fromCache ? '캐시 적중 — 동일한 문장' : '캐시 실패!'} (원가 ${again.costKrw}원)`);
