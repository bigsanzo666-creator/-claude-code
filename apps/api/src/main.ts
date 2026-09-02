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
import {
  findProductImages, strayImages, ALL_PRODUCT_IDS,
  findSpiritImages, straySpiritImages, ALL_SPIRIT_IDS,
} from './images.ts';
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

// 결제창은 상점 정보와 API 비밀이 **모두** 있을 때만 켠다.
// 셋 중 하나라도 없으면 버튼을 띄우지 않는다 — 눌러봤자 실패할 버튼이다.
const payable = Boolean(apiSecret && storeId && channelKey);

/**
 * 저장소를 고른다.
 *
 * 규칙이 둘이고, 둘 다 "무엇이 더 나쁜 사고인가"로 정해진다.
 *
 * **결제가 켜져 있으면 DB 없이는 뜨지 않는다.** 메모리 저장소로 결제를 받으면
 * 재시작 한 번에 "돈은 나갔는데 주문이 없다"가 되고, 그건 되돌릴 수 없다.
 * 안 뜨는 편이 낫다.
 *
 * **결제가 꺼져 있으면 DB에 못 붙어도 뜬다.** 심사 대기 중에는 파는 것이 없어서
 * 주문이 사라져도 잃을 것이 없는 반면, 사이트가 내려가면 심사자가 열었을 때
 * 접속 불가로 반려된다. 이쪽이 더 큰 손해다.
 *
 * 처음에는 이 구분 없이 `await migrate()` 를 그냥 두었는데, DB가 준비되기 전에
 * 배포가 돌면 서버가 기동 중에 멈춰 **사이트 전체가 내려갔다.** 약관 페이지까지
 * 같이 죽는다. 저장소 하나 때문에 사이트가 죽는 구조여서는 안 된다.
 */
const databaseUrl = process.env.DATABASE_URL;
let orders: OrderStore = new MemoryOrderStore();
let reportStore: ReportBox | null = null;
let storeKind = '메모리 (재시작하면 주문이 사라집니다)';

if (databaseUrl) {
  try {
    const pool = createPool(databaseUrl);
    // 기동을 무한정 붙잡지 않는다. 못 붙으면 빨리 알고 다음으로 넘어가야 한다
    await Promise.race([
      migrate(pool),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('데이터베이스 응답이 20초 안에 오지 않았습니다.')), 20_000)),
    ]);
    orders = new PostgresOrderStore(pool);
    reportStore = new PostgresReportStore(pool);
    storeKind = 'Postgres';
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (payable) {
      console.error(`[api] 결제가 켜져 있는데 데이터베이스에 붙지 못했습니다: ${reason}`);
      console.error('      메모리 저장소로 결제를 받으면 재시작 시 주문이 사라집니다 — 뜨지 않습니다.');
      process.exit(1);
    }
    console.error(`[api] 데이터베이스에 붙지 못했습니다: ${reason}`);
    console.warn('[api] 결제가 꺼져 있으므로 메모리 저장소로 뜹니다. 사이트는 정상 동작합니다.');
    storeKind = `메모리 (DB 연결 실패: ${reason})`;
  }
}

if (payable && !databaseUrl) {
  console.error('[api] 결제가 켜져 있는데 DATABASE_URL 이 없습니다.');
  console.error('      메모리 저장소로는 재시작 시 주문이 사라집니다 — 결제를 켠 채로는 뜨지 않습니다.');
  process.exit(1);
}

console.log('[api] 기동 상태');
console.log(`  결제      ${payable ? '켜짐' : '꺼짐 (포트원 설정 없음)'}`);
console.log(`  리포트    ${hasModelKey ? '켜짐' : '꺼짐 (API 키 없음)'}`);
console.log(`  저장소    ${storeKind}`);
console.log(`  사업자정보 ${missing.length ? `미입력 ${missing.length}건` : '완비'}`);

// 그림은 있으면 붙고 없으면 안 붙는다. 몇 장이 붙었는지는 눈으로 확인할 수 있어야 한다
const productImages = findProductImages();
const strays = strayImages();
console.log(`  상품그림  ${productImages.size} / ${ALL_PRODUCT_IDS.length}장`);
if (strays.length) {
  console.warn(`  ⚠ 이름이 카탈로그와 맞지 않는 그림 ${strays.length}개: ${strays.join(', ')}`);
}
// 신령 얼굴. 없는 얼굴은 한자 도장으로 나가므로 몇 장이든 화면은 정상이다
const spiritImages = findSpiritImages();
const spiritStrays = straySpiritImages();
console.log(`  신령얼굴  ${spiritImages.size} / ${ALL_SPIRIT_IDS.length}장`);
if (spiritStrays.length) {
  console.warn(`  ⚠ 이름이 신령과 맞지 않는 그림 ${spiritStrays.length}개: ${spiritStrays.join(', ')}`);
}
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
  images: productImages,
  spiritImages,
  orders,
  reportStore,
  generate: hasModelKey
    ? async ({ kind, data, subject }) => generateReport({ kind: kind as any, data, subject }, { cache })
    : standbyGenerate,
});
