/**
 * 연락처 수집.
 *
 * 왜 필요한가: 전환율이 3%라면 **97%가 그냥 나간다.** 이메일이 없으면 그 97%는
 * 영영 끝이고, 있으면 광고비 없이 다시 닿을 수 있다. 신년운세가 나왔을 때,
 * 안 사고 나간 사람에게 미리보기를 남겨뒀을 때, 재구매를 권할 때.
 *
 * 다만 이건 개인정보다. 그냥 받으면 안 된다.
 *
 * **동의를 두 개로 나눈다.**
 * - `serviceConsent` — 결과를 받아보기 위한 수집·이용 동의 (개인정보보호법 제15조)
 * - `marketingConsent` — 영리목적 광고성 정보 수신 동의 (정보통신망법 제50조)
 *
 * 하나로 뭉뚱그리면 위법이다. "결과 받기"에 동의했다고 광고를 보내면 안 된다.
 * 그래서 두 값을 따로 저장하고, 광고 발송은 두 번째만 본다.
 *
 * 동의한 시각도 남긴다. 분쟁이 생겼을 때 "언제 동의받았는가"를 대지 못하면
 * 동의가 없었던 것과 같다.
 */

import pg from 'pg';

export const CONTACTS_SQL = `
CREATE TABLE IF NOT EXISTS contacts (
  email               TEXT PRIMARY KEY,
  -- 결과 전달을 위한 수집·이용 동의 (개인정보보호법 제15조)
  service_consent     BOOLEAN     NOT NULL,
  service_consent_at  TIMESTAMPTZ,
  -- 광고성 정보 수신 동의 (정보통신망법 제50조). 별개로 받는다
  marketing_consent   BOOLEAN     NOT NULL DEFAULT false,
  marketing_consent_at TIMESTAMPTZ,
  -- 수신거부. 거부하면 광고 동의를 즉시 내린다
  unsubscribed_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS contacts_marketing_idx
  ON contacts (marketing_consent) WHERE unsubscribed_at IS NULL;
`;

export interface Contact {
  email: string;
  serviceConsent: boolean;
  serviceConsentAt: string | null;
  marketingConsent: boolean;
  marketingConsentAt: string | null;
  unsubscribedAt: string | null;
}

type Row = {
  email: string;
  service_consent: boolean; service_consent_at: Date | null;
  marketing_consent: boolean; marketing_consent_at: Date | null;
  unsubscribed_at: Date | null;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toContact(r: Row): Contact {
  return {
    email: r.email,
    serviceConsent: r.service_consent,
    serviceConsentAt: iso(r.service_consent_at),
    marketingConsent: r.marketing_consent,
    marketingConsentAt: iso(r.marketing_consent_at),
    unsubscribedAt: iso(r.unsubscribed_at),
  };
}

/**
 * 이메일 형식 검사.
 *
 * 엄밀한 RFC 검증을 하지 않는 이유: 정규식으로 완벽히 걸러낼 수 없고,
 * 지나치게 엄격하면 멀쩡한 주소를 거부한다. 여기서는 명백한 오타만 막고
 * 진짜 확인은 메일이 도달하는지로 한다.
 */
export function isPlausibleEmail(value: string): boolean {
  const v = value.trim();
  if (v.length < 5 || v.length > 254) return false;
  if (/\s/.test(v)) return false;
  const at = v.indexOf('@');
  if (at < 1 || at !== v.lastIndexOf('@')) return false;
  const domain = v.slice(at + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

export class PostgresContactStore {
  private pool: pg.Pool;
  constructor(pool: pg.Pool) { this.pool = pool; }

  async get(email: string): Promise<Contact | null> {
    const { rows } = await this.pool.query<Row>(
      'SELECT * FROM contacts WHERE email = $1', [normalize(email)]);
    return rows.length ? toContact(rows[0]) : null;
  }

  /**
   * 저장한다.
   *
   * 동의는 **올라가기만 하고 저절로 내려가지 않는다.** 같은 사람이 두 번째
   * 방문에서 광고 동의를 안 했다고 이전 동의가 취소되는 것은 아니기 때문이다.
   * 내리는 길은 수신거부 하나뿐이다 — 그래야 "동의한 적 없다"는 분쟁에서
   * 기록으로 답할 수 있다.
   */
  async upsert(input: {
    email: string; serviceConsent: boolean; marketingConsent: boolean;
  }): Promise<Contact> {
    if (!input.serviceConsent) {
      throw new Error('결과 전달을 위한 수집·이용 동의가 필요합니다.');
    }
    const email = normalize(input.email);
    if (!isPlausibleEmail(email)) throw new Error(`이메일 형식이 아닙니다: ${input.email}`);

    const { rows } = await this.pool.query<Row>(
      `INSERT INTO contacts (
         email, service_consent, service_consent_at,
         marketing_consent, marketing_consent_at, created_at, updated_at
       ) VALUES ($1, true, now(), $2, CASE WHEN $2 THEN now() END, now(), now())
       ON CONFLICT (email) DO UPDATE SET
         marketing_consent = contacts.marketing_consent OR EXCLUDED.marketing_consent,
         marketing_consent_at = CASE
           WHEN contacts.marketing_consent THEN contacts.marketing_consent_at
           WHEN EXCLUDED.marketing_consent THEN now()
           ELSE contacts.marketing_consent_at END,
         updated_at = now()
       RETURNING *`,
      [email, input.marketingConsent]);
    return toContact(rows[0]);
  }

  /**
   * 수신거부.
   *
   * 광고 동의를 내리되 연락처 자체는 지우지 않는다 — 지워버리면 같은 사람이
   * 다시 수집됐을 때 거부한 사실을 모른다. 거부 기록이 남아야 거부가 지켜진다.
   */
  async unsubscribe(email: string): Promise<void> {
    await this.pool.query(
      `UPDATE contacts
          SET marketing_consent = false, unsubscribed_at = now(), updated_at = now()
        WHERE email = $1`, [normalize(email)]);
  }

  /** 광고를 보내도 되는 사람만. 발송 코드는 반드시 이걸 거쳐야 한다 */
  async marketingRecipients(): Promise<string[]> {
    const { rows } = await this.pool.query<{ email: string }>(
      `SELECT email FROM contacts
        WHERE marketing_consent = true AND unsubscribed_at IS NULL
        ORDER BY created_at`);
    return rows.map((r) => r.email);
  }
}

/** 대소문자와 앞뒤 공백만 정리한다. 그 이상 손대면 남의 주소를 바꾸는 것이다 */
function normalize(email: string): string {
  return email.trim().toLowerCase();
}
