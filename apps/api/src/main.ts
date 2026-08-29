/**
 * 서버 기동.
 *
 *   PORTONE_API_SECRET=... ANTHROPIC_API_KEY=... npm start --prefix apps/api
 *
 * 두 비밀은 서버에만 둔다. 브라우저로 내려가면 그 즉시 사고다.
 */

import { PortOneGateway } from '../../../packages/commerce/src/index.ts';
import { generateReport, MemoryReportCache } from '../../../packages/report/src/index.ts';
import { loadBusinessInfo, missingFields } from '../../../packages/site-policy/src/index.ts';
import { MemoryOrderStore, startApi } from './server.ts';

const apiSecret = process.env.PORTONE_API_SECRET;
if (!apiSecret) {
  console.error('PORTONE_API_SECRET 이 필요합니다.');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error('ANTHROPIC_API_KEY 가 필요합니다.');
  process.exit(1);
}

const cache = new MemoryReportCache();

/**
 * 사업자 정보는 있으면 붙이고 없으면 경고만 한다.
 *
 * 죽이지 않는 이유는 개발 중에도 서버가 떠야 하기 때문이고,
 * 경고를 남기는 이유는 이게 비어 있으면 PG 심사에서 반려되기 때문이다.
 */
const business = loadBusinessInfo();
const missing = missingFields(business);
if (missing.length) {
  console.warn(`[api] 사업자 정보 미입력 ${missing.length}건 — 심사 전에 채울 것: ${missing.join(', ')}`);
}

const storeId = process.env.PORTONE_STORE_ID;
const channelKey = process.env.PORTONE_CHANNEL_KEY;
if (!storeId || !channelKey) {
  console.warn('[api] PORTONE_STORE_ID / PORTONE_CHANNEL_KEY 가 없습니다. 결제 버튼이 비활성 상태로 뜹니다.');
}

startApi({
  gateway: new PortOneGateway({ apiSecret }),
  checkout: storeId && channelKey ? { storeId, channelKey } : undefined,
  business,
  // 배포 전에 Postgres 구현체로 바꿀 것. 지금은 프로세스가 죽으면 주문이 사라진다
  orders: new MemoryOrderStore(),
  generate: async ({ kind, data, subject }) =>
    generateReport({ kind: kind as any, data, subject }, { cache }),
});
