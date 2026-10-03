/**
 * 주문 완료 안내 메일 발송 조각.
 *
 * 외부 라이브러리(nodemailer 등) 없이 Node.js 내장 fetch로 Resend HTTP API를 직접 호출한다.
 * 광고성 정보는 일절 포함하지 않으며, 주문 거래 정보(주문번호, 상품명, 열람 주소, 환불 규정, 사업자 정보)만 발송한다.
 */

import { WITHDRAWAL_WINDOW_DAYS } from '../../../packages/commerce/src/refund.ts';
import { loadBusinessInfo } from '../../../packages/site-policy/src/business.ts';

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c] || c));
}

/** 메일 발송 기능이 켜져 있는지 확인 */
export function mailReady(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0);
}

export interface SendOrderMailArgs {
  to: string;
  orderId: string;
  productName: string;
}

export interface SendOrderMailResult {
  sent: boolean;
  reason?: string;
}

/**
 * Resend API 1회 발송 시도
 */
async function sendOnce(
  payload: Record<string, unknown>,
  apiKey: string,
): Promise<{ ok: boolean; status: number; reason?: string; rawResponse?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const resText = await res.text().catch(() => '');
    const cleanText = resText.replace(/re_[A-Za-z0-9]+/g, '[REDACTED]');
    console.log(`[메일] 답 ${res.status} ${cleanText.slice(0, 200)}`);

    if (res.ok) {
      return { ok: true, status: res.status, rawResponse: cleanText };
    }

    return {
      ok: false,
      status: res.status,
      reason: `HTTP ${res.status}${cleanText ? `: ${cleanText}` : ''}`,
      rawResponse: cleanText,
    };
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    const msg = err instanceof Error ? err.message : String(err);
    const cleanMsg = msg.replace(/re_[A-Za-z0-9]+/g, '[REDACTED]');
    const reason = isTimeout ? '응답 시간 초과 (15초)' : `네트워크 오류 (${cleanMsg})`;
    console.log(`[메일] 답 0 ${cleanMsg.slice(0, 200)}`);
    return { ok: false, status: 0, reason, rawResponse: reason };
  }
}

export interface SendReportMailArgs extends SendOrderMailArgs {
  /** 리포트 전문. **열람한 뒤에만** 넘긴다 */
  reportText: string;
}

/**
 * 리포트 **전문**을 메일로 보낸다.
 *
 * 결제 직후가 아니라 **손님이 리포트를 연 뒤에만** 부른다. 결제 직후에 전문을
 * 보내면 「열람하지 않으면 환불」이라는 약속과 어긋난다 — 메일로 글이 나간
 * 순간 열람을 안 했다고 할 수 없기 때문이다. 연 뒤라면 이미 환불이 제한된
 * 시점이라 약속과 어긋나지 않고, 손님은 메일함에 글을 그대로 갖게 된다.
 *
 * 절대 예외를 throw 하지 않는다. 메일이 실패해도 리포트는 이미 보여 준 뒤다.
 */
export async function sendReportMail(args: SendReportMailArgs): Promise<SendOrderMailResult> {
  try {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) return { sent: false, reason: '열쇠 없음' };

    const to = (args?.to || '').trim();
    if (!to || !to.includes('@')) return { sent: false, reason: '주소 없음' };

    const orderId = (args?.orderId || '').trim();
    const productName = (args?.productName || '').trim();
    const reportText = (args?.reportText || '').trim();
    if (!orderId || !productName || !reportText) return { sent: false, reason: '주문 정보 부족' };

    const from = (process.env.MAIL_FROM || '').trim() || 'Neulbom Saju <no-reply@neulbomsaju.co.kr>';
    const siteUrl = (process.env.SITE_URL || '').trim().replace(/\/+$/, '') || 'https://neulbomsaju.co.kr';
    const orderUrl = `${siteUrl}/order/${encodeURIComponent(orderId)}`;
    const biz = loadBusinessInfo();
    const contact = biz.landline || biz.phone || biz.email || '';

    // 글을 그대로 옮긴다. 「[[가림:…]]」 같은 표시는 메일에 나가지 않게 벗긴다
    const 본문 = reportText
      .replace(/\[\[가림:([\s\S]*?)\]\]/g, '$1')
      .split(/\n{2,}/)
      .map((para) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.85;color:#1d1d1f;white-space:pre-wrap;">${esc(para.trim())}</p>`)
      .join('');

    const subject = `[늘봄사주] ${productName} 리포트입니다`;
    const html = `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>[늘봄사주] ${esc(productName)}</title></head>
<body style="margin:0;padding:24px 16px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1d1d1f;line-height:1.7;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e5ea;border-radius:12px;padding:32px 24px;">
    <h1 style="font-size:20px;font-weight:700;margin:0 0 6px;color:#111111;">${esc(productName)}</h1>
    <p style="margin:0 0 24px;font-size:13px;color:#86868b;">주문 번호 ${esc(orderId)}</p>
    ${본문}
    <div style="border-top:1px solid #e5e5ea;padding-top:16px;margin:24px 0 0;font-size:13px;color:#86868b;line-height:1.6;">
      <p style="margin:0 0 12px;">사이트에서도 언제든 다시 보실 수 있습니다 — <a href="${orderUrl}" style="color:#0066cc;">${orderUrl}</a></p>
      <p style="margin:0 0 12px;">리포트 전문을 열람하신 뒤에는 청약철회가 제한됩니다.</p>
      <p style="margin:0;font-size:12px;color:#a1a1a6;">
        ${esc(biz.companyName)} | 대표: ${esc(biz.representative)} | 사업자등록번호: ${esc(biz.registrationNumber)}${contact ? ` | 연락처: ${esc(contact)}` : ''}
      </p>
    </div>
  </div>
</body>
</html>`;

    const payload = { from, to: [to], subject, html };
    console.log(`[메일] 보내려 함 ${orderId} → ${to} (from=${from})`);
    const firstTry = await sendOnce(payload, apiKey);
    if (firstTry.ok) return { sent: true };
    if (firstTry.status >= 400 && firstTry.status < 500) return { sent: false, reason: firstTry.reason };
    console.log(`[메일] 보내려 함 ${orderId} → ${to} (from=${from}) [재시도]`);
    const secondTry = await sendOnce(payload, apiKey);
    if (secondTry.ok) return { sent: true };
    return { sent: false, reason: secondTry.reason || firstTry.reason };
  } catch {
    return { sent: false, reason: '예기치 못한 발송 실패' };
  }
}

/**
 * 결제 완료 후 손님에게 리포트 열람 주소를 메일로 발송한다.
 * 절대 예외를 throw하지 않는다.
 */
export async function sendOrderMail(args: SendOrderMailArgs): Promise<SendOrderMailResult> {
  try {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) {
      return { sent: false, reason: '열쇠 없음' };
    }

    const to = (args?.to || '').trim();
    if (!to || !to.includes('@')) {
      return { sent: false, reason: '주소 없음' };
    }

    const orderId = (args?.orderId || '').trim();
    const productName = (args?.productName || '').trim();
    if (!orderId || !productName) {
      return { sent: false, reason: '주문 정보 부족' };
    }

    const from = (process.env.MAIL_FROM || '').trim() || 'Neulbom Saju <no-reply@neulbomsaju.co.kr>';
    const siteUrl = (process.env.SITE_URL || '').trim().replace(/\/+$/, '') || 'https://neulbomsaju.co.kr';
    const orderUrl = `${siteUrl}/order/${encodeURIComponent(orderId)}`;

    const biz = loadBusinessInfo();
    const contact = biz.landline || biz.phone || biz.email || '';

    const subject = `[늘봄사주] ${productName} 리포트를 보실 수 있습니다`;

    const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>[늘봄사주] ${esc(productName)} 리포트 안내</title>
</head>
<body style="margin:0;padding:24px 16px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1d1d1f;line-height:1.7;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5ea;border-radius:12px;padding:32px 24px;">
    <h1 style="font-size:20px;font-weight:700;margin:0 0 16px;color:#111111;">[늘봄사주] 결제가 완료되었습니다</h1>
    <p style="font-size:15px;margin:0 0 20px;">결제가 끝났습니다. 아래 주소에서 리포트를 보실 수 있습니다.</p>
    
    <div style="background:#fbfbfd;border:1px solid #e5e5ea;border-radius:8px;padding:16px;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:14px;color:#6e6e73;">주문 상품: <strong style="color:#1d1d1f;">${esc(productName)}</strong></p>
      <p style="margin:0 0 12px;font-size:14px;color:#6e6e73;">주문 번호: <span style="font-family:monospace;color:#1d1d1f;">${esc(orderId)}</span></p>
      <div style="margin-top:12px;">
        <a href="${orderUrl}" style="display:inline-block;padding:12px 20px;background:#242426;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">리포트 바로보기</a>
      </div>
      <p style="margin:12px 0 0;font-size:13px;color:#86868b;word-break:break-all;">
        접속 주소: <a href="${orderUrl}" style="color:#0066cc;">${orderUrl}</a>
      </p>
    </div>

    <p style="font-size:14px;color:#515154;margin:0 0 16px;">
      이 메일을 지우지 마시고 두시면 언제든 다시 보실 수 있습니다.
    </p>

    <div style="border-top:1px solid #e5e5ea;padding-top:16px;margin:24px 0 0;font-size:13px;color:#86868b;line-height:1.6;">
      <p style="margin:0 0 12px;">
        결제 후 ${WITHDRAWAL_WINDOW_DAYS}일 이내이고 리포트를 열람하지 않으셨다면 전액 돌려드립니다. 리포트 전문을 열람하신 뒤에는 청약철회가 제한됩니다.
      </p>
      <p style="margin:0;font-size:12px;color:#a1a1a6;">
        ${esc(biz.companyName)} | 대표: ${esc(biz.representative)} | 사업자등록번호: ${esc(biz.registrationNumber)}${contact ? ` | 연락처: ${esc(contact)}` : ''}
      </p>
    </div>
  </div>
</body>
</html>`;

    const payload = {
      from,
      to: [to],
      subject,
      html,
    };

    console.log(`[메일] 보내려 함 ${orderId} → ${to} (from=${from})`);
    const firstTry = await sendOnce(payload, apiKey);
    if (firstTry.ok) {
      return { sent: true };
    }

    // 400~499 클라이언트 오류는 재시도하지 않음
    if (firstTry.status >= 400 && firstTry.status < 500) {
      return { sent: false, reason: firstTry.reason };
    }

    // 일시적 네트워크 오류나 5xx 서버 오류는 1회만 재시도
    console.log(`[메일] 보내려 함 ${orderId} → ${to} (from=${from}) [재시도]`);
    const secondTry = await sendOnce(payload, apiKey);
    if (secondTry.ok) {
      return { sent: true };
    }

    return { sent: false, reason: secondTry.reason || firstTry.reason };
  } catch (err: unknown) {
    return { sent: false, reason: '예기치 못한 발송 실패' };
  }
}

export interface SendTestMailArgs {
  to: string;
  from?: string;
}

export interface SendTestMailResult {
  sent: boolean;
  status: number;
  from: string;
  hasKey: boolean;
  keyLength: number;
  response: string;
  reason?: string;
}

/**
 * 주인 점검용 시험 메일 발송 (/admin/mail-check 에서 호출)
 */
export async function sendTestMail(args: SendTestMailArgs): Promise<SendTestMailResult> {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const hasKey = apiKey.length > 0;
  const keyLength = apiKey.length;
  const from = (args?.from || process.env.MAIL_FROM || '').trim() || 'Neulbom Saju <no-reply@neulbomsaju.co.kr>';
  const to = (args?.to || '').trim();

  if (!hasKey) {
    return {
      sent: false,
      status: 0,
      from,
      hasKey: false,
      keyLength: 0,
      response: '',
      reason: '열쇠 없음 (RESEND_API_KEY 미설정)',
    };
  }

  if (!to || !to.includes('@')) {
    return {
      sent: false,
      status: 0,
      from,
      hasKey: true,
      keyLength,
      response: '',
      reason: '주소 없음',
    };
  }

  console.log(`[메일] 보내려 함 test → ${to} (from=${from})`);

  const payload = {
    from,
    to: [to],
    subject: '[늘봄사주] 메일 발송 시험',
    html: '<!doctype html><html lang="ko"><body><p>늘봄사주 메일 점검 시험 발송입니다.</p></body></html>',
  };

  const result = await sendOnce(payload, apiKey);
  return {
    sent: result.ok,
    status: result.status,
    from,
    hasKey: true,
    keyLength,
    response: result.rawResponse || '',
    reason: result.reason,
  };
}
