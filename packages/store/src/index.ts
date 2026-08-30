/**
 * 저장 계층 진입점.
 *
 * `DATABASE_URL`이 있으면 Postgres, 없으면 호출하는 쪽이 메모리 구현을 쓴다.
 * 개발 중에도 서버가 떠야 하므로 없다고 죽이지 않는다 — 다만 결제를 켠 채로
 * 메모리 구현이 돌아가는 일만은 막아야 한다. 그 판단은 `apps/api/src/main.ts`에서 한다.
 */

import pg from 'pg';
import { SCHEMA_SQL } from './schema.ts';
import { CONTACTS_SQL } from './contacts.ts';

export * from './schema.ts';
export * from './orders.ts';
export * from './reports.ts';
export * from './contacts.ts';

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString,
    // 렌더의 관리형 Postgres는 TLS를 쓰지만 인증서 체인이 사설이다.
    // 로컬(localhost)에서는 TLS 자체가 없으므로 끈다.
    ssl: /localhost|127\.0\.0\.1|\/tmp/.test(connectionString) ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

/** 기동 시 한 번. 여러 번 실행해도 안전하다 */
export async function migrate(pool: pg.Pool): Promise<void> {
  await pool.query(SCHEMA_SQL);
  await pool.query(CONTACTS_SQL);
}
