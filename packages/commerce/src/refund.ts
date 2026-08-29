/**
 * 환불(청약철회) 판정.
 *
 * 근거: 전자상거래 등에서의 소비자보호에 관한 법률 제17조.
 *
 * 핵심은 조사 단계에서 확인한 이 지점이다 —
 * **디지털콘텐츠는 제공이 개시되면 청약철회를 제한할 수 있지만,
 * 사업자가 "철회 불가 사실을 표시"하고 "시험 사용 상품을 제공"하지 않았다면
 * 그 제한을 주장할 수 없다.**
 *
 * 그래서 주문에 `noticeGiven`과 `previewProvided`를 남긴다.
 * 결제 화면에서 그 두 가지를 하지 않았다면, 열람 후에도 환불해줘야 한다.
 *
 * 애매한 경우는 전부 소비자에게 유리하게 판정한다. 분쟁에서 사업자가 지는 쪽이
 * 기본값이고, 실제로 그렇게 설계하는 편이 장기적으로 싸게 먹힌다.
 *
 * 이 파일은 법률 자문이 아니다. 오픈 전에 반드시 별도 검토를 받을 것.
 */

import { josa } from '../../korean/src/index.ts';
import type { Order } from './orders.ts';

/** 청약철회 기간 (일). 법 제17조 제1항 */
export const WITHDRAWAL_WINDOW_DAYS = 7;
/** 환급 기한 (영업일). 용역·디지털콘텐츠는 반환할 물건이 없으므로 철회일 기준 */
export const REFUND_DUE_BUSINESS_DAYS = 3;

export interface RefundVerdict {
  refundable: boolean;
  /** 사용자에게 보여줄 사유 */
  reason: string;
  /** 어떤 규정에 따른 판단인지 */
  basis: string;
  /** 환불 가능할 때, 환급을 마쳐야 하는 기한 */
  refundDueBy: string | null;
}

/**
 * 영업일 더하기. 주말만 제외한다.
 *
 * 공휴일은 반영하지 않았다 — 매년 바뀌는 데이터를 코드에 박으면 반드시 낡는다.
 * 실제로는 공휴일만큼 기한이 늘어나므로, 이 값보다 빨리 환급하면 안전하다.
 */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}

export function assessRefund(order: Order, now = new Date()): RefundVerdict {
  const due = () => addBusinessDays(now, REFUND_DUE_BUSINESS_DAYS).toISOString();

  if (order.status === 'refunded') {
    return {
      refundable: false,
      reason: '이미 환불된 주문입니다.',
      basis: '중복 환불 방지',
      refundDueBy: null,
    };
  }

  if (!order.paidAt) {
    return {
      refundable: false,
      reason: '결제가 완료되지 않은 주문입니다. 환불할 금액이 없습니다.',
      basis: '결제 미완료',
      refundDueBy: null,
    };
  }

  // 아직 열람하지 않았다 = 디지털콘텐츠 제공이 개시되지 않았다
  if (!order.viewedAt) {
    const deadline = new Date(order.paidAt);
    deadline.setUTCDate(deadline.getUTCDate() + WITHDRAWAL_WINDOW_DAYS);

    if (now <= deadline) {
      return {
        refundable: true,
        reason: '아직 리포트를 열람하지 않으셨습니다. 전액 환불해 드립니다.',
        basis: `전자상거래법 제17조 제1항 — 결제일로부터 ${WITHDRAWAL_WINDOW_DAYS}일 이내 청약철회`,
        refundDueBy: due(),
      };
    }
    return {
      refundable: false,
      reason: `결제일로부터 ${WITHDRAWAL_WINDOW_DAYS}일이 지나 청약철회 기간이 끝났습니다.`,
      basis: '전자상거래법 제17조 제1항 — 청약철회 기간 경과',
      refundDueBy: null,
    };
  }

  // 열람했다. 이제 우리가 제한을 주장할 자격이 있는지 본다
  const missing: string[] = [];
  if (!order.noticeGiven) missing.push('청약철회 제한 고지');
  if (!order.previewProvided) missing.push('미리보기 제공');

  if (missing.length > 0) {
    return {
      refundable: true,
      reason:
        `결제 과정에서 ${josa(missing.join(', '), '이')} 이루어지지 않았습니다. ` +
        '열람하셨더라도 환불해 드립니다.',
      basis:
        '전자상거래법 제17조 — 철회 불가 사실의 표시와 시험 사용 상품 제공이 없으면 ' +
        '사업자는 청약철회 제한을 주장할 수 없다',
      refundDueBy: due(),
    };
  }

  return {
    refundable: false,
    reason:
      '리포트 전문을 이미 열람하셨습니다. ' +
      '결제 전에 청약철회가 제한된다는 점을 안내드렸고 미리보기도 제공해 드렸습니다.',
    basis: '전자상거래법 제17조 제2항 — 디지털콘텐츠의 제공이 개시된 경우',
    refundDueBy: null,
  };
}

/**
 * 결제 화면에 반드시 띄워야 하는 고지 문구.
 *
 * 이 문구를 띄우지 않으면 열람 후 환불을 거절할 수 없다.
 * 문구만 띄우는 것으로는 부족하고 미리보기도 함께 제공해야 한다 —
 * 둘 다 있어야 제한을 주장할 수 있다.
 */
export const WITHDRAWAL_NOTICE = [
  '이 상품은 디지털콘텐츠입니다.',
  `결제 후 ${WITHDRAWAL_WINDOW_DAYS}일 이내이고 리포트를 열람하지 않으셨다면 언제든 전액 환불해 드립니다.`,
  '리포트 전문을 열람하신 뒤에는 청약철회가 제한됩니다.',
  '구매를 결정하시기 전에 아래 미리보기를 먼저 읽어보십시오.',
].join(' ');

/** 환불 요청을 받았을 때 사용자에게 안내할 처리 기한 문구 */
export function refundNotice(verdict: RefundVerdict): string {
  if (!verdict.refundable) return verdict.reason;
  return (
    `${verdict.reason} 환불은 요청일로부터 ${REFUND_DUE_BUSINESS_DAYS}영업일 이내에 처리됩니다.`
  );
}
