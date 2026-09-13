/**
 * 주문 저장소 (Postgres).
 *
 * 메모리 구현을 이걸로 갈아끼우는 이유는 하나다 — **서버가 재시작되면
 * 주문이 사라지기 때문**이다. 결제가 켜진 상태에서 그 일이 벌어지면
 * "돈은 나갔는데 리포트가 없다"가 된다. 결제를 열기 전에 반드시 끝내야 한다.
 *
 * 저장 계층은 판단하지 않는다. 상태 전이 규칙은 전부 `packages/commerce`에 있고
 * 여기는 읽고 쓰기만 한다. 규칙이 두 곳에 흩어지면 반드시 어긋난다.
 */

import pg from 'pg';
import type { Order, OrderStatus, ProductId } from '../../commerce/src/index.ts';

/** 저장된 주문에는 어떤 풀이였는지가 함께 붙어 다닌다 */
export type StoredOrder = Order & { reading?: unknown };

type Row = {
  id: string; product_id: string; amount_krw: number; status: string;
  input_hash: string; payment_id: string | null;
  notice_given: boolean; preview_provided: boolean;
  created_at: Date; paid_at: Date | null; viewed_at: Date | null;
  refunded_at: Date | null; failure_reason: string | null; reading: unknown;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toOrder(row: Row): StoredOrder {
  const order: StoredOrder = {
    id: row.id,
    productId: row.product_id as ProductId,
    amountKrw: row.amount_krw,
    status: row.status as OrderStatus,
    inputHash: row.input_hash,
    paymentId: row.payment_id,
    noticeGiven: row.notice_given,
    previewProvided: row.preview_provided,
    createdAt: row.created_at.toISOString(),
    paidAt: iso(row.paid_at),
    viewedAt: iso(row.viewed_at),
    refundedAt: iso(row.refunded_at),
    failureReason: row.failure_reason,
  };
  if (row.reading != null) order.reading = row.reading;
  return order;
}

export interface OrderStore {
  get(id: string): Promise<StoredOrder | null>;
  save(order: StoredOrder): Promise<void>;
}

export class PostgresOrderStore implements OrderStore {
  private pool: pg.Pool;
  constructor(pool: pg.Pool) { this.pool = pool; }

  async get(id: string): Promise<StoredOrder | null> {
    const { rows } = await this.pool.query<Row>('SELECT * FROM orders WHERE id = $1', [id]);
    return rows.length ? toOrder(rows[0]) : null;
  }

  /**
   * 통째로 덮어쓴다 (upsert).
   *
   * 부분 수정을 하지 않는 이유: 호출하는 쪽이 이미 전이 함수로 만든
   * **완성된 주문 객체**를 들고 있다. 컬럼별로 쪼개 넣으면 그 객체와
   * 저장된 행이 어긋날 여지가 생긴다.
   *
   * 다만 상태를 되돌리지는 못하게 막는다 — 늦게 도착한 웹훅이 이미 환불된
   * 주문을 결제됨으로 되돌리는 사고가 실제로 일어난다.
   */
  async save(order: StoredOrder): Promise<void> {
    await this.pool.query(
      `INSERT INTO orders (
         id, product_id, amount_krw, status, input_hash, payment_id,
         notice_given, preview_provided, created_at, paid_at, viewed_at,
         refunded_at, failure_reason, reading
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         payment_id = EXCLUDED.payment_id,
         paid_at = EXCLUDED.paid_at,
         viewed_at = EXCLUDED.viewed_at,
         refunded_at = EXCLUDED.refunded_at,
         failure_reason = EXCLUDED.failure_reason,
         reading = COALESCE(EXCLUDED.reading, orders.reading)
       WHERE orders.status <> 'refunded' OR EXCLUDED.status = 'refunded'`,
      [
        order.id, order.productId, order.amountKrw, order.status, order.inputHash,
        order.paymentId, order.noticeGiven, order.previewProvided,
        order.createdAt, order.paidAt, order.viewedAt, order.refundedAt,
        order.failureReason, order.reading == null ? null : JSON.stringify(order.reading),
      ],
    );
  }

  /** 결제 식별자로 되찾기. PG 웹훅은 주문 id가 아니라 이걸 준다 */
  async findByPaymentId(paymentId: string): Promise<StoredOrder | null> {
    const { rows } = await this.pool.query<Row>(
      'SELECT * FROM orders WHERE payment_id = $1 ORDER BY created_at DESC LIMIT 1', [paymentId]);
    return rows.length ? toOrder(rows[0]) : null;
  }
}
