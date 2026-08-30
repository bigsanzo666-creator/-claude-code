/**
 * 서버 기동.
 *
 *   PORTONE_API_SECRET=... ANTHROPIC_API_KEY=... npm start --prefix apps/api
 *
 * 두 비밀은 서버에만 둔다. 브라우저로 내려가면 그 즉시 사고다.
 *
 * 비밀이 없어도 서버는 뜬다 — PG 심사 대기 중에는 사이트가 열려 있어야 하고,
 * 그때는 아직 발급받은 비밀이 없기 때문이다. 대신 무엇이 꺼져 있는지
 * 기동 로그에 분명히 남긴다.
 */

import { PortOneGateway } from '../../../packages/commerce/src/index.ts';
import { generateReport, MemoryReportCache } from '../../../packages/report/src/index.ts';
import { loadBusinessInfo, missingFields } from '../../../packages/site-policy/src/index.ts';
import { createPool, migrate, PostgresOrderStore, PostgresReportStore } from '../../../packages/store/src/index.ts';
import { MemoryOrderStore, startApi, type OrderStore, type ReportBox } from './server.ts';
import { StandbyGateway, standbyGenerate } from './standby.ts';

const apiSecret = process.env.PORTONE_API_SECRET;
const hasModelKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const storeId = process.env.PORTONE_STORE_ID;
const channelKey = process.env.PORTONE_CHANNEL_KEY;

/**
 * 사업자 정보는 있으면 붙이고 없으면 경고만 한다.
 *
 * 죽이지 않는 이유는 개발 중에도 서버가 떠야 하기 때문이고,
 * 경고를 남기는 이유는 이게 비어 있으면 PG 심사에서 반려되기 때문이다.
 */
const business = loadBusinessInfo();
const missing = missingFields(business);

const cache = new MemoryReportCache();

/**
 * 저장소를 고른다.
 *
 * `DATABASE_URL`이 없으면 메모리 구현으로 뜬다 — 개발 중에도 서버가 떠야 하고,
 * 심사 대기 중에는 파는 것이 없으므로 주문이 사라져도 잃을 것이 없다.
 *
 * **결제가 켜진 채로 메모리 구현이 돌아가는 것만은 막는다.** 그 조합에서
 * 서버가 한 번 재시작되면 "돈은 나갔는데 주문이 없다"가 되고, 그건 되돌릴 수 없다.
 * 그래서 그 경우에는 뜨지 않고 죽는다 — 조용히 굴러가는 것보다 낫다.
 */
const databaseUrl = process.env.DATABASE_URL;
let orders: OrderStore = new MemoryOrderStore();
let reportStore: ReportBox | null = null;

if (databaseUrl) {
  const pool = createPool(databaseUrl);
  await migrate(pool);
  orders = new PostgresOrderStore(pool);
  reportStore = new PostgresReportStore(pool);
}

// 결제창은 상점 정보와 API 비밀이 **모두** 있을 때만 켠다.
// 셋 중 하나라도 없으면 버튼을 띄우지 않는다 — 눌러봤자 실패할 버튼이다.
const payable = Boolean(apiSecret && storeId && channelKey);

if (payable && !databaseUrl) {
  console.error('[api] 결제가 켜져 있는데 DATABASE_URL 이 없습니다.');
  console.error('      메모리 저장소로는 재시작 시 주문이 사라집니다 — 결제를 켠 채로는 뜨지 않습니다.');
  process.exit(1);
}

console.log('[api] 기동 상태');
console.log(`  결제      ${payable ? '켜짐' : '꺼짐 (포트원 설정 없음)'}`);
console.log(`  리포트    ${hasModelKey ? '켜짐' : '꺼짐 (API 키 없음)'}`);
console.log(`  저장소    ${databaseUrl ? 'Postgres' : '메모리 (재시작하면 주문이 사라집니다)'}`);
console.log(`  사업자정보 ${missing.length ? `미입력 ${missing.length}건` : '완비'}`);
if (missing.length) {
  console.warn(`[api] 심사 전에 채울 것: ${missing.join(', ')}`);
}
if (!payable) {
  console.warn('[api] 심사 대기 모드로 뜹니다. 무료 풀이와 정책 페이지는 정상 동작합니다.');
}

startApi({
  gateway: payable ? new PortOneGateway({ apiSecret: apiSecret! }) : new StandbyGateway(),
  checkout: payable ? { storeId: storeId!, channelKey: channelKey! } : undefined,
  business,
  orders,
  reportStore,
  generate: hasModelKey
    ? async ({ kind, data, subject }) => generateReport({ kind: kind as any, data, subject }, { cache })
    : standbyGenerate,
});
