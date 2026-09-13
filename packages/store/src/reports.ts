/**
 * 리포트 본문 저장 (Postgres).
 *
 * 두 가지 일을 겸한다.
 *
 * 1. **전달** — 손님이 나중에 다시 열람한다. 메모리에만 두면 재시작 시 사라진다.
 * 2. **캐시** — 같은 입력이면 같은 글을 재사용해 모델 호출을 아낀다.
 *    Opus 5는 `temperature`를 받지 않으므로, 같은 사람이 같은 명식을 두 번
 *    조회했을 때 글이 달라지지 않게 만드는 장치가 이 캐시뿐이다.
 */

import pg from 'pg';

export class PostgresReportStore {
  private pool: pg.Pool;
  constructor(pool: pg.Pool) { this.pool = pool; }

  async get(orderId: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ body: string }>(
      'SELECT body FROM reports WHERE order_id = $1', [orderId]);
    return rows.length ? rows[0].body : null;
  }

  async set(orderId: string, inputHash: string, body: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO reports (order_id, input_hash, body, created_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (order_id) DO UPDATE SET body = EXCLUDED.body`,
      [orderId, inputHash, body]);
  }

  async delete(orderId: string): Promise<void> {
    await this.pool.query('DELETE FROM reports WHERE order_id = $1', [orderId]);
  }

  /**
   * 같은 입력으로 이미 쓴 글이 있으면 가져온다.
   *
   * 주문을 가리지 않는 이유: 손님이 달라도 명식·모델·프롬프트가 같으면
   * 결과가 같아야 한다. 그게 이 서비스가 "같은 사주를 두 번 물으면
   * 다른 말이 나온다"는 소리를 듣지 않는 방법이다.
   */
  async findByInputHash(inputHash: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ body: string }>(
      'SELECT body FROM reports WHERE input_hash = $1 ORDER BY created_at LIMIT 1', [inputHash]);
    return rows.length ? rows[0].body : null;
  }
}
