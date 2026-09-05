/**
 * 스키마.
 *
 * 마이그레이션 도구를 쓰지 않는 이유: 테이블이 둘이고, 배포가 컨테이너 재시작
 * 하나다. 도구를 얹으면 그 도구의 상태를 또 관리해야 한다.
 * 테이블이 늘거나 컬럼을 바꿔야 할 때가 오면 그때 도구를 들인다.
 *
 * 대신 **기동할 때마다 안전하게 다시 실행할 수 있게** 짠다 (IF NOT EXISTS).
 * 서버가 여러 대로 늘어도 동시에 실행돼서 깨지지 않아야 한다.
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS orders (
  id                TEXT PRIMARY KEY,
  product_id        TEXT        NOT NULL,
  amount_krw        INTEGER     NOT NULL,
  status            TEXT        NOT NULL,
  input_hash        TEXT        NOT NULL,
  payment_id        TEXT,
  notice_given      BOOLEAN     NOT NULL,
  preview_provided  BOOLEAN     NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL,
  paid_at           TIMESTAMPTZ,
  viewed_at         TIMESTAMPTZ,
  refunded_at       TIMESTAMPTZ,
  failure_reason    TEXT,
  -- 어떤 풀이에 대한 주문인지. 환불·재발급 때 다시 계산하려면 필요하다
  reading           JSONB
);

-- 결제 확인은 PG가 준 결제 식별자로 주문을 되찾는 일이 잦다
CREATE INDEX IF NOT EXISTS orders_payment_id_idx ON orders (payment_id);
-- 정산·분쟁 대응에서 기간으로 훑는다
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at);

CREATE TABLE IF NOT EXISTS reports (
  order_id    TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  -- 리포트 캐시 키. 같은 입력이면 같은 글을 재사용해 모델 호출을 아낀다
  input_hash  TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS reports_input_hash_idx ON reports (input_hash);
`;

/** 연락처는 주문과 수명이 다르다 (동의 철회 전까지). 그래서 파일을 나눴다 */
export { CONTACTS_SQL } from './contacts.ts';

/**
 * 보관 기간.
 *
 * 전자상거래법 제6조와 시행령에 따라 계약·청약철회 기록은 5년,
 * 소비자 불만·분쟁 처리 기록은 3년 보존한다.
 * 개인정보처리방침에 적어둔 기간과 같아야 한다 — 다르면 그 자체가 방침 위반이다.
 */
export const RETENTION_YEARS = 5;

/**
 * 보관 기간이 지난 주문을 지우는 문장.
 *
 * 자동으로 돌리지 않는다. 지우는 일은 되돌릴 수 없으므로 사람이 확인하고
 * 실행해야 한다. 여기 두는 이유는 "언젠가 지워야 한다"를 코드에 남기기 위해서다.
 */
export const PURGE_SQL = `
DELETE FROM orders
 WHERE created_at < now() - INTERVAL '${RETENTION_YEARS} years'
`;
