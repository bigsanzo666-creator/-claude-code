import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CATALOG,
  CATEGORIES,
  HOLIDAY_INCLUDED_MEMBERS,
  HOLIDAY_EXTRA_MEMBER_KRW,
  HOLIDAY_MAX_MEMBERS,
  UPSELL_PROMO_HOURS,
  UPSELL_PROMO_RATE,
  UPSELL_AFTER_RATE,
  UPSELL_PROMO_PERCENT,
  UPSELL_AFTER_PERCENT,
  isLaunchSale,
} from '../src/catalog.ts';
import { PACKAGES, bundleMath } from '../src/packages.ts';
import { cutPrice } from '../src/orderable.ts';
import {
  INVITE_DISCOUNT_KRW,
  INVITE_MIN_ORDER_KRW,
  INVITE_REWARD_DAYS,
} from '../src/referral.ts';

export const PASS_DURATION_DAYS = INVITE_REWARD_DAYS;
export const PASS_MAX_USES = 6;

function krw(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

export function buildPriceSheetMarkdown(): string {
  const launchActive = isLaunchSale();
  const lines: string[] = [];

  lines.push('# 늘봄사주 현재 가격표');
  lines.push('');
  lines.push('> 이 문서는 `packages/commerce/scripts/price-sheet.ts`가 `packages/commerce/src/catalog.ts`를 읽어 자동 생성한 가격표입니다. 숫자를 손으로 고치지 마십시오.');
  lines.push('');

  // 1. 기념가 여부와 기간
  lines.push('## 1. 기념가 상태 및 기간');
  lines.push('');
  lines.push('| 항목 | 현재 값 |');
  lines.push('| :--- | :--- |');
  lines.push(`| 기념가 적용 여부 | **${launchActive ? '켜짐 (기념가 적용 중)' : '꺼짐 (정가 적용 중)'}** |`);
  lines.push('| 오픈 기념가 기간 | ~ 2026-11-01 00:00 (한국 시각) 종료 |');
  lines.push('');

  // 2. 이용권 및 소개 코드 할인 규칙
  lines.push('## 2. 월운세·오늘의 운세 및 소개 코드(벗의 증표) 규칙');
  lines.push('');
  lines.push('| 항목 | 가격 / 금액 | 기간 / 횟수 / 적용 조건 |');
  lines.push('| :--- | :--- | :--- |');
  lines.push(`| 월운세 (` + '`month-report`' + `) | **${krw(CATALOG['month-report'].priceKrw)}** | 이용권 기간 **${PASS_DURATION_DAYS}일**, 최대 **${PASS_MAX_USES}회** 열람 |`);
  lines.push(`| 오늘의 운세 (` + '`daily-report`' + `) | **${krw(CATALOG['daily-report'].priceKrw)}** | 소개 보답 무료 이용권 기간 **${INVITE_REWARD_DAYS}일**, 최대 **${PASS_MAX_USES}회** 열람 |`);
  lines.push(`| 소개 코드 할인 (벗의 증표) | **${krw(INVITE_DISCOUNT_KRW)} 할인** | **${krw(INVITE_MIN_ORDER_KRW)} 이상** 주문에만 적용 (${krw(INVITE_MIN_ORDER_KRW)} 미만 주문 제외) |`);
  lines.push(`| 리포트 끝 이어사기 할인 | **${UPSELL_PROMO_HOURS}시간 안 ${UPSELL_PROMO_PERCENT}%** / **지난 뒤 ${UPSELL_AFTER_PERCENT}%** | 원가에서 할인 후 끝자리 900원 내림 (` + '`cutPrice`' + `) |`);
  lines.push('');

  // 3. 단품 34종 가격표 + 이어사기 가격
  lines.push('## 3. 단품 가격표 및 리포트 끝 이어사기 가격 (34종)');
  lines.push('');
  lines.push(`| 갈래 | 상품 ID | 상품 이름 | 현재 가격 | 이어사기 (${UPSELL_PROMO_HOURS}시간 안) | 이어사기 (${UPSELL_PROMO_HOURS}시간 후) | 비고 |`);
  lines.push('| :--- | :--- | :--- | ---: | ---: | ---: | :--- |');

  for (const cat of CATEGORIES) {
    const items = Object.values(CATALOG).filter((p) => p.category === cat.key);
    for (const p of items) {
      const promoKrw = cutPrice(p.priceKrw, UPSELL_PROMO_RATE);
      const afterKrw = cutPrice(p.priceKrw, UPSELL_AFTER_RATE);
      const note =
        p.id === 'family-holiday-report'
          ? `기본 ${HOLIDAY_INCLUDED_MEMBERS}인 포함, 추가 1인당 +${krw(HOLIDAY_EXTRA_MEMBER_KRW)} (최대 ${HOLIDAY_MAX_MEMBERS}인)`
          : p.priceKrw < INVITE_MIN_ORDER_KRW
            ? '2만원 미만 (소개 할인 제외)'
            : '';
      lines.push(
        `| ${p.category} | \`${p.id}\` | ${p.name} | **${krw(p.priceKrw)}** | ${krw(promoKrw)} | ${krw(afterKrw)} | ${note} |`,
      );
    }
  }
  lines.push('');

  // 4. 묶음 상품 16종 가격표
  lines.push('## 4. 묶음 상품 가격표 (16종)');
  lines.push('');
  lines.push('| 묶음 ID | 묶음 이름 | 구성 상품 | 따로 사면 합계 | 현재 묶음 가격 | 절약 금액 (절약률) |');
  lines.push('| :--- | :--- | :--- | ---: | ---: | ---: |');

  for (const pack of Object.values(PACKAGES)) {
    const math = bundleMath(pack.id);
    const memberNames = pack.members.map((m) => CATALOG[m].name).join(' + ');
    lines.push(
      `| \`${pack.id}\` | ${pack.name} | ${memberNames} | ${krw(math.individualKrw)} | **${krw(pack.priceKrw)}** | ${krw(math.savedKrw)} (${math.percent}%) |`,
    );
  }
  lines.push('');

  return lines.join('\n');
}

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '../../../docs/price-sheet.md');

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(dirname(outPath), { recursive: true });
  const md = buildPriceSheetMarkdown();
  writeFileSync(outPath, md, 'utf8');
  console.log(`✅ 가격표 생성 완료: ${outPath}`);
}
