import pg from 'pg';
import { COUNT_MIN_ORDER_KRW } from '../../commerce/src/index.ts';

export interface InviteRecord {
  code: string;
  ownerEmail: string;
  createdAt: string;
}

export interface InviteUseRecord {
  id: string;
  code: string;
  invitedEmail: string;
  orderId: string;
  counted: boolean;
  createdAt: string;
}

export interface RewardRecord {
  id: string;
  ownerEmail: string;
  tier: number;
  kind: string;
  status: '신청' | '내줌' | '거절';
  expiresAt: string | null;
  createdAt: string;
  grantedAt: string | null;
}

export interface ReferralStore {
  createInvite(code: string, ownerEmail: string): Promise<void>;
  getInvite(code: string): Promise<InviteRecord | null>;
  getInviteByEmail(email: string): Promise<InviteRecord | null>;
  hasUsedInvite(email: string): Promise<boolean>;
  recordInviteUse(use: { id: string; code: string; invitedEmail: string; orderId: string; amountKrw: number }): Promise<void>;
  rollbackInviteCount(orderId: string): Promise<void>;
  getReferralCount(ownerEmail: string): Promise<number>;
  getRewards(ownerEmail: string): Promise<RewardRecord[]>;
  applyReward(ownerEmail: string, tier: number, kind: string, status?: '신청' | '내줌' | '거절', expiresAt?: string | null): Promise<RewardRecord>;
  listRewardRequests(): Promise<RewardRecord[]>;
  reviewReward(id: string, status: '내줌' | '거절'): Promise<void>;
  listTopReferrers(): Promise<{ email: string; count: number }[]>;
}

export class PostgresReferralStore implements ReferralStore {
  pool: pg.Pool;
  constructor(pool: pg.Pool) { this.pool = pool; }

  async createInvite(code: string, ownerEmail: string): Promise<void> {
    const norm = ownerEmail.trim().toLowerCase();
    await this.pool.query(
      `INSERT INTO invites (code, owner_email, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (code) DO NOTHING`,
      [code, norm]
    );
  }

  async getInvite(code: string): Promise<InviteRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT code, owner_email AS "ownerEmail", created_at::text AS "createdAt"
       FROM invites WHERE code = $1`,
      [code.trim().toLowerCase()]
    );
    return rows[0] ?? null;
  }

  async getInviteByEmail(email: string): Promise<InviteRecord | null> {
    const norm = email.trim().toLowerCase();
    const { rows } = await this.pool.query(
      `SELECT code, owner_email AS "ownerEmail", created_at::text AS "createdAt"
       FROM invites WHERE owner_email = $1`,
      [norm]
    );
    return rows[0] ?? null;
  }

  async hasUsedInvite(email: string): Promise<boolean> {
    const norm = email.trim().toLowerCase();
    const { rows } = await this.pool.query(
      `SELECT 1 FROM invite_uses WHERE invited_email = $1 LIMIT 1`,
      [norm]
    );
    return rows.length > 0;
  }

  async recordInviteUse(use: {
    id: string;
    code: string;
    invitedEmail: string;
    orderId: string;
    amountKrw: number;
  }): Promise<void> {
    const norm = use.invitedEmail.trim().toLowerCase();
    const counted = use.amountKrw >= COUNT_MIN_ORDER_KRW;
    await this.pool.query(
      `INSERT INTO invite_uses (id, code, invited_email, order_id, counted, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (code, invited_email) DO NOTHING`,
      [use.id, use.code.trim().toLowerCase(), norm, use.orderId, counted]
    );
  }

  async rollbackInviteCount(orderId: string): Promise<void> {
    await this.pool.query(
      `UPDATE invite_uses SET counted = false WHERE order_id = $1`,
      [orderId]
    );
  }

  async getReferralCount(ownerEmail: string): Promise<number> {
    const norm = ownerEmail.trim().toLowerCase();
    const { rows } = await this.pool.query(
      `SELECT count(DISTINCT u.invited_email) as cnt
       FROM invite_uses u
       JOIN invites i ON u.code = i.code
       WHERE i.owner_email = $1 AND u.counted = true`,
      [norm]
    );
    return parseInt(rows[0]?.cnt || '0', 10);
  }

  async getRewards(ownerEmail: string): Promise<RewardRecord[]> {
    const norm = ownerEmail.trim().toLowerCase();
    const { rows } = await this.pool.query(
      `SELECT id, owner_email AS "ownerEmail", tier, kind, status,
              expires_at::text AS "expiresAt", created_at::text AS "createdAt", granted_at::text AS "grantedAt"
       FROM rewards WHERE owner_email = $1 ORDER BY tier ASC`,
      [norm]
    );
    return rows;
  }

  async applyReward(
    ownerEmail: string,
    tier: number,
    kind: string,
    status: '신청' | '내줌' | '거절' = '신청',
    expiresAt: string | null = null
  ): Promise<RewardRecord> {
    const norm = ownerEmail.trim().toLowerCase();
    const id = `rew_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const grantedAt = status === '내줌' ? new Date().toISOString() : null;
    const { rows } = await this.pool.query(
      `INSERT INTO rewards (id, owner_email, tier, kind, status, expires_at, created_at, granted_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
       ON CONFLICT (owner_email, tier) DO UPDATE
       SET kind = EXCLUDED.kind, status = EXCLUDED.status, expires_at = EXCLUDED.expires_at, granted_at = EXCLUDED.granted_at
       RETURNING id, owner_email AS "ownerEmail", tier, kind, status,
                 expires_at::text AS "expiresAt", created_at::text AS "createdAt", granted_at::text AS "grantedAt"`,
      [id, norm, tier, kind, status, expiresAt, grantedAt]
    );
    return rows[0];
  }

  async listRewardRequests(): Promise<RewardRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT id, owner_email AS "ownerEmail", tier, kind, status,
              expires_at::text AS "expiresAt", created_at::text AS "createdAt", granted_at::text AS "grantedAt"
       FROM rewards WHERE status = '신청' ORDER BY created_at ASC`
    );
    return rows;
  }

  async reviewReward(id: string, status: '내줌' | '거절'): Promise<void> {
    const grantedAt = status === '내줌' ? new Date().toISOString() : null;
    await this.pool.query(
      `UPDATE rewards SET status = $1, granted_at = $2 WHERE id = $3`,
      [status, grantedAt, id]
    );
  }

  async listTopReferrers(): Promise<{ email: string; count: number }[]> {
    const { rows } = await this.pool.query(
      `SELECT i.owner_email as email, count(DISTINCT u.invited_email)::int as count
       FROM invites i
       JOIN invite_uses u ON i.code = u.code
       WHERE u.counted = true
       GROUP BY i.owner_email
       ORDER BY count DESC`
    );
    return rows;
  }
}

export class MemoryReferralStore implements ReferralStore {
  private invites = new Map<string, InviteRecord>(); // code -> record
  private inviteUses: InviteUseRecord[] = [];
  private rewards = new Map<string, RewardRecord>(); // `${email}:${tier}` -> record

  async createInvite(code: string, ownerEmail: string): Promise<void> {
    const norm = ownerEmail.trim().toLowerCase();
    const c = code.trim().toLowerCase();
    if (!this.invites.has(c)) {
      this.invites.set(c, { code: c, ownerEmail: norm, createdAt: new Date().toISOString() });
    }
  }

  async getInvite(code: string): Promise<InviteRecord | null> {
    return this.invites.get(code.trim().toLowerCase()) ?? null;
  }

  async getInviteByEmail(email: string): Promise<InviteRecord | null> {
    const norm = email.trim().toLowerCase();
    for (const inv of this.invites.values()) {
      if (inv.ownerEmail === norm) return inv;
    }
    return null;
  }

  async hasUsedInvite(email: string): Promise<boolean> {
    const norm = email.trim().toLowerCase();
    return this.inviteUses.some((u) => u.invitedEmail === norm);
  }

  async recordInviteUse(use: {
    id: string;
    code: string;
    invitedEmail: string;
    orderId: string;
    amountKrw: number;
  }): Promise<void> {
    const norm = use.invitedEmail.trim().toLowerCase();
    const c = use.code.trim().toLowerCase();
    if (this.inviteUses.some((u) => u.code === c && u.invitedEmail === norm)) {
      return;
    }
    const counted = use.amountKrw >= COUNT_MIN_ORDER_KRW;
    this.inviteUses.push({
      id: use.id,
      code: c,
      invitedEmail: norm,
      orderId: use.orderId,
      counted,
      createdAt: new Date().toISOString(),
    });
  }

  async rollbackInviteCount(orderId: string): Promise<void> {
    for (const u of this.inviteUses) {
      if (u.orderId === orderId) {
        u.counted = false;
      }
    }
  }

  async getReferralCount(ownerEmail: string): Promise<number> {
    const norm = ownerEmail.trim().toLowerCase();
    const codes = new Set(
      Array.from(this.invites.values())
        .filter((i) => i.ownerEmail === norm)
        .map((i) => i.code)
    );
    const countedEmails = new Set(
      this.inviteUses
        .filter((u) => codes.has(u.code) && u.counted)
        .map((u) => u.invitedEmail)
    );
    return countedEmails.size;
  }

  async getRewards(ownerEmail: string): Promise<RewardRecord[]> {
    const norm = ownerEmail.trim().toLowerCase();
    return Array.from(this.rewards.values())
      .filter((r) => r.ownerEmail === norm)
      .sort((a, b) => a.tier - b.tier);
  }

  async applyReward(
    ownerEmail: string,
    tier: number,
    kind: string,
    status: '신청' | '내줌' | '거절' = '신청',
    expiresAt: string | null = null
  ): Promise<RewardRecord> {
    const norm = ownerEmail.trim().toLowerCase();
    const key = `${norm}:${tier}`;
    const id = `rew_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const grantedAt = status === '내줌' ? new Date().toISOString() : null;
    const rec: RewardRecord = {
      id,
      ownerEmail: norm,
      tier,
      kind,
      status,
      expiresAt,
      createdAt: new Date().toISOString(),
      grantedAt,
    };
    this.rewards.set(key, rec);
    return rec;
  }

  async listRewardRequests(): Promise<RewardRecord[]> {
    return Array.from(this.rewards.values())
      .filter((r) => r.status === '신청')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async reviewReward(id: string, status: '내줌' | '거절'): Promise<void> {
    for (const r of this.rewards.values()) {
      if (r.id === id) {
        r.status = status;
        if (status === '내줌') r.grantedAt = new Date().toISOString();
      }
    }
  }

  async listTopReferrers(): Promise<{ email: string; count: number }[]> {
    const map = new Map<string, Set<string>>(); // ownerEmail -> set of invited emails
    for (const inv of this.invites.values()) {
      if (!map.has(inv.ownerEmail)) map.set(inv.ownerEmail, new Set());
    }
    for (const u of this.inviteUses) {
      if (!u.counted) continue;
      const inv = this.invites.get(u.code);
      if (inv) {
        if (!map.has(inv.ownerEmail)) map.set(inv.ownerEmail, new Set());
        map.get(inv.ownerEmail)!.add(u.invitedEmail);
      }
    }
    return Array.from(map.entries())
      .map(([email, set]) => ({ email, count: set.size }))
      .sort((a, b) => b.count - a.count);
  }
}
