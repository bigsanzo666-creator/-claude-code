/**
 * 저장소 검증 — **진짜 Postgres에 대고** 돌린다.
 *
 * 가짜 드라이버로 SQL 문자열만 대조하는 검증은 여기서 의미가 없다.
 * 우리가 확인하려는 것이 SQL을 만들었는가가 아니라, **재시작을 넘어
 * 주문이 살아남는가**이기 때문이다. 그건 진짜 DB만 답할 수 있다.
 *
 *   DATABASE_URL=postgres://... node --experimental-strip-types verify.ts
 *
 * DATABASE_URL이 없으면 건너뛴다 (실패가 아니다).
 */

import { createPool, migrate, PostgresOrderStore, PostgresReportStore, RETENTION_YEARS } from './src/index.ts';
import { createOrder, markPending, markPaid, markFulfilled, markViewed, refundOrder,
         hasEntitlement, CATALOG, FakeGateway } from '../commerce/src/index.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('DATABASE_URL 이 없어 건너뜁니다. (실패가 아닙니다)');
  console.log('  예: DATABASE_URL=postgres://postgres@/saju?host=/tmp&port=55432 node --experimental-strip-types verify.ts');
  process.exit(0);
}

let passed = 0, failed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n${t}\n${'─'.repeat(60)}`); }

const pool = createPool(url);
await pool.query('DROP TABLE IF EXISTS reports, orders CASCADE');

section('1. 스키마');
await migrate(pool);
check('마이그레이션 실행', true);
await migrate(pool);
check('두 번 실행해도 깨지지 않는다 (여러 대로 늘어도 안전)', true);

const tables = await pool.query<{ table_name: string }>(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
check('orders·reports 두 테이블', tables.rows.map((r) => r.table_name).join(',') === 'orders,reports',
  tables.rows.map((r) => r.table_name).join(','));

const idx = await pool.query<{ indexname: string }>(
  `SELECT indexname FROM pg_indexes WHERE tablename IN ('orders','reports') ORDER BY 1`);
check('결제 식별자 색인', idx.rows.some((r) => r.indexname === 'orders_payment_id_idx'));
check('입력 해시 색인', idx.rows.some((r) => r.indexname === 'reports_input_hash_idx'));

section('2. 주문이 재시작을 넘어 살아남는가');
const orders = new PostgresOrderStore(pool);
const reading = { productId: 'cross-report', birth: { date: '1990-05-15', name: '민수' } };
const made = createOrder({
  id: 'ord_test_1', productId: 'cross-report', inputHash: 'hash-abc',
  noticeGiven: true, previewProvided: true,
});
await orders.save({ ...made, reading });

// 연결을 완전히 끊었다가 새로 연다 = 서버 재시작과 같은 상황
await pool.query('DISCARD ALL');
const pool2 = createPool(url);
const orders2 = new PostgresOrderStore(pool2);
const back = await orders2.get('ord_test_1');

check('다른 연결에서 주문을 되찾는다', back !== null);
check('금액이 카탈로그 값 그대로', back?.amountKrw === CATALOG['cross-report'].priceKrw, `${back?.amountKrw}원`);
check('상태 보존', back?.status === 'created');
check('청약철회 고지 여부 보존', back?.noticeGiven === true);
check('미리보기 제공 여부 보존', back?.previewProvided === true);
check('입력 해시 보존', back?.inputHash === 'hash-abc');
check('풀이 내용(JSON)이 통째로 보존', (back as any)?.reading?.birth?.name === '민수');
check('없는 주문은 null', (await orders2.get('ord_nope')) === null);

section('3. 상태 전이가 저장된다');
const pending = markPending(back!, 'pay_001');
await orders2.save({ ...pending, reading });
check('pending 저장', (await orders2.get('ord_test_1'))?.status === 'pending');

const paid = markPaid(pending, CATALOG['cross-report'].priceKrw);
await orders2.save({ ...paid, reading });
const afterPaid = await orders2.get('ord_test_1');
check('paid 저장', afterPaid?.status === 'paid');
check('결제 시각 기록', afterPaid?.paidAt !== null);
check('결제 식별자 기록', afterPaid?.paymentId === 'pay_001');
check('결제 식별자로 되찾기', (await orders2.findByPaymentId('pay_001'))?.id === 'ord_test_1');

const done = markFulfilled(afterPaid!);
await orders2.save({ ...done, reading });
const viewed = markViewed((await orders2.get('ord_test_1'))!);
await orders2.save({ ...viewed, reading });
const afterViewed = await orders2.get('ord_test_1');
check('열람 시각 기록 (청약철회 제한의 기준점)', afterViewed?.viewedAt !== null);
check('열람 후에도 이용권 유지', hasEntitlement(afterViewed!, 'hash-abc'));
check('다른 명식으로는 이용권 없음', !hasEntitlement(afterViewed!, 'hash-다른것'));

section('4. 리포트 본문');
const reports = new PostgresReportStore(pool2);
await reports.set('ord_test_1', 'hash-abc', '첫 문단입니다.\n\n두 번째 문단입니다.');
check('본문 저장·조회', (await reports.get('ord_test_1'))?.startsWith('첫 문단'));
check('같은 입력 해시로 재사용 (모델 호출 절약)',
  (await reports.findByInputHash('hash-abc'))?.startsWith('첫 문단'));
check('없는 해시는 null', (await reports.findByInputHash('hash-없음')) === null);

await reports.set('ord_test_1', 'hash-abc', '고쳐 쓴 본문');
check('같은 주문에 두 번 써도 깨지지 않는다', (await reports.get('ord_test_1')) === '고쳐 쓴 본문');

section('5. 환불');

/*
 * 열람까지 끝난 주문(ord_test_1)은 환불되지 않는다 — 고지도 했고 미리보기도
 * 줬으므로 전자상거래법 제17조의 제한이 적용된다. 그건 `packages/commerce`가
 * 이미 검증하는 규칙이므로, 여기서는 **환불이 저장되는가**만 본다.
 * 그래서 열람하지 않은 주문을 따로 만든다.
 */
const gateway = new FakeGateway();
const price = CATALOG['cross-report'].priceKrw;
gateway.put({ paymentId: 'pay_002', status: 'paid', amountKrw: price, orderName: '교차검증', raw: {} });

const second = createOrder({
  id: 'ord_test_2', productId: 'cross-report', inputHash: 'hash-def',
  noticeGiven: true, previewProvided: true,
});
const secondDone = markFulfilled(markPaid(markPending(second, 'pay_002'), price));
await orders2.save({ ...secondDone, reading });
await reports.set('ord_test_2', 'hash-def', '두 번째 주문의 본문');
check('열람 전 주문은 이용권이 있다', hasEntitlement(secondDone, 'hash-def'));

const outcome = await refundOrder(secondDone, gateway);
await orders2.save({ ...outcome.order, reading });
const refunded = await orders2.get('ord_test_2');
check('환불 상태 저장', refunded?.status === 'refunded');
check('환불 시각 기록', refunded?.refundedAt !== null);
check('전액 환불', outcome.cancelledAmountKrw === price, `${outcome.cancelledAmountKrw}원`);
check('환불 후 이용권 소멸', !hasEntitlement(refunded!, 'hash-def'));

// 늦게 도착한 웹훅이 환불된 주문을 되살리는 사고를 막는다
await orders2.save({ ...secondDone, reading });
check('환불된 주문은 되돌아가지 않는다', (await orders2.get('ord_test_2'))?.status === 'refunded');

await reports.delete('ord_test_2');
check('환불 시 본문 삭제', (await reports.get('ord_test_2')) === null);
check('다른 주문의 본문은 남아 있다', (await reports.get('ord_test_1')) === '고쳐 쓴 본문');

// 열람이 끝난 주문은 저장 계층이 아니라 규칙이 막는다
const viewedOrder = await orders2.get('ord_test_1');
let refused = '';
try { await refundOrder(viewedOrder!, gateway); } catch (e) { refused = (e as Error).message; }
check('열람한 주문의 환불은 규칙이 거부한다', refused.includes('환불할 수 없는'), refused.slice(0, 40) + '…');

section('6. 보관 기간');
check(`전자상거래법 제6조에 맞춘 ${RETENTION_YEARS}년`, RETENTION_YEARS === 5);
const cascade = await pool2.query<{ count: string }>(
  `SELECT count(*) FROM information_schema.referential_constraints
    WHERE delete_rule = 'CASCADE'`);
check('주문을 지우면 리포트도 함께 지워진다', Number(cascade.rows[0].count) >= 1);

await pool.end(); await pool2.end();
console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} · 실패 ${failed}  ·  진짜 Postgres에 대고 검증`);
if (failed) { console.log(failures.map((f) => `  - ${f}`).join('\n')); process.exit(1); }
console.log('전부 통과.');
