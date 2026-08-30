/**
 * 정책 문서 검증.
 *
 * 여기서 보는 것은 "글이 예쁜가"가 아니라 **심사에서 반려될 구멍이 있는가**다.
 * 사업자 정보가 빠진 채로 배포되는 것, 약관과 환불 로직이 서로 다른 말을 하는 것,
 * 이 둘이 실제로 돈과 시간을 태우는 사고다.
 */

import {
  loadBusinessInfo, missingFields, isComplete, isValidRegistrationNumber,
  renderFooter, renderTerms, renderPrivacy, renderRefund, POLICY_EFFECTIVE_DATE,
  renderProducts, renderProductsPage, bundleSaving,
} from './src/index.ts';
import { CATALOG } from '../commerce/src/catalog.ts';
import { WITHDRAWAL_WINDOW_DAYS, REFUND_DUE_BUSINESS_DAYS } from '../commerce/src/refund.ts';

let passed = 0, failed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n${t}\n${'─'.repeat(60)}`); }

const FULL = {
  SITE_NAME: '사주보다', SITE_URL: 'https://example.kr',
  BIZ_COMPANY: '주식회사 예시', BIZ_REPRESENTATIVE: '홍길동',
  BIZ_REG_NUMBER: '220-81-62517', BIZ_MAIL_ORDER_NUMBER: '2026-서울강남-00001',
  BIZ_ADDRESS: '서울특별시 강남구 테헤란로 1', BIZ_PHONE: '02-0000-0000',
  BIZ_EMAIL: 'help@example.kr', BIZ_PRIVACY_OFFICER: '홍길동',
};

section('1. 사업자 정보 로딩');
const full = loadBusinessInfo(FULL);
check('환경변수를 다 채우면 누락 없음', missingFields(full).length === 0, missingFields(full).join(','));
check('다 채우면 오픈 가능 판정', isComplete(full));

const empty = loadBusinessInfo({});
check('빈 환경에서 필수 항목을 모두 잡아낸다', missingFields(empty).length === 10, `${missingFields(empty).length}개`);
check('빈 환경은 오픈 불가 판정', !isComplete(empty));
check('보호책임자는 대표자로 기본 지정', loadBusinessInfo({ BIZ_REPRESENTATIVE: '김철수' }).privacyOfficer === '김철수');
check('호스팅 기본값이 있다', empty.hostingProvider === '자체 호스팅');

const noMailOrder = loadBusinessInfo({ ...FULL, BIZ_MAIL_ORDER_NUMBER: '' });
check('통신판매업 신고번호만 빠지면 그 항목만 남는다',
  missingFields(noMailOrder).length === 1 && missingFields(noMailOrder)[0].startsWith('통신판매업'));

section('2. 사업자등록번호 체크섬');
check('실재 형식의 유효 번호를 통과', isValidRegistrationNumber('220-81-62517'));
check('하이픈 없이도 판정', isValidRegistrationNumber('2208162517'));
check('체크디지트가 틀리면 거부', !isValidRegistrationNumber('220-81-62518'));
check('자릿수가 모자라면 거부', !isValidRegistrationNumber('220-81-6251'));
check('123-45-67890 같은 가짜를 거부', !isValidRegistrationNumber('123-45-67890'));

section('3. 하단 사업자 정보 표시');
const footer = renderFooter(full);
for (const value of ['주식회사 예시', '홍길동', '220-81-62517', '2026-서울강남-00001', 'help@example.kr']) {
  check(`푸터에 ${value} 노출`, footer.includes(value));
}
for (const href of ['/products', '/terms', '/privacy', '/refund']) {
  check(`푸터에 ${href} 링크`, footer.includes(`href="${href}"`));
}
const emptyFooter = renderFooter(empty);
check('빈 값은 조용히 넘어가지 않고 표시된다', emptyFooter.includes('[미입력: 상호]'));
check('신고 전에는 "신고 진행 중"으로 표시', emptyFooter.includes('신고 진행 중'));

section('4. 세 문서의 형식');
const pages: Array<[string, string]> = [
  ['이용약관', renderTerms(full)],
  ['개인정보처리방침', renderPrivacy(full)],
  ['취소·환불 정책', renderRefund(full)],
];
for (const [name, html] of pages) {
  check(`${name}: 완성된 HTML 문서`, html.startsWith('<!doctype html>') && html.trimEnd().endsWith('</html>'));
  check(`${name}: 제목에 서비스 이름`, html.includes(`<title>${name} · 사주보다</title>`));
  check(`${name}: 사업자 정보 동반`, html.includes('220-81-62517'));
  check(`${name}: 시행일 표시`, html.includes(POLICY_EFFECTIVE_DATE));
  check(`${name}: 개정판 번호 표시`, html.includes('제1.1판'));
  check(`${name}: 다크 모드 대응`, html.includes('prefers-color-scheme'));
}

section('5. 약관과 환불 로직의 일치');
const refund = renderRefund(full);
check('청약철회 기간이 코드 상수와 같다', refund.includes(`<b>${WITHDRAWAL_WINDOW_DAYS}일</b>`));
check('환급 기한이 코드 상수와 같다', refund.includes(`<b>${REFUND_DUE_BUSINESS_DAYS} 영업일</b>`));
check('고지+미리보기 두 요건을 모두 명시', refund.includes('고지했을 것') && refund.includes('미리보기로 제공했을 것'));
check('둘 중 하나라도 빠지면 환불한다고 약속', refund.includes('열람하셨더라도 환불'));
check('애매하면 소비자에게 유리하게 처리한다고 명시', refund.includes('이용자에게 유리하게'));
check('환불 수수료를 받지 않는다고 명시', refund.includes('환불 수수료를 별도로 받지 않습니다'));

section('6. 개인정보처리방침의 사실 확인');
const privacy = renderPrivacy(full);
check('사진 원본을 보내지 않는다는 사실을 명시', privacy.includes('사진 원본은 회사 서버로'));
check('국외 이전(Anthropic)을 고지', privacy.includes('Anthropic PBC'));
check('결제 위탁(포트원)을 고지', privacy.includes('코리아포트원'));
check('무료 이용은 저장하지 않는다고 명시', privacy.includes('저장하지 않습니다'));
check('보호책임자 연락처가 들어간다', privacy.includes('help@example.kr') && privacy.includes('02-0000-0000'));
check('광고 쿠키를 쓰지 않는다고 명시', privacy.includes('행태정보'));
// 코드가 하는 일과 방침이 다르면 그 자체가 방침 위반이다
check('이메일 수집 항목을 표에 밝힌다', privacy.includes('연락처 <b>(선택)</b>'));
check('광고 수신 동의를 별도로 받는다고 명시', privacy.includes('별도의 수신 동의'));
check('두 동의가 별개임을 명시', privacy.includes('별개로 받으며'));
check('동의 안 해도 이용에 제한 없음을 명시', privacy.includes('제한이 없습니다'));
check('수신거부 방법 안내를 약속', privacy.includes('수신거부 방법을 함께 안내'));
check('거부 기록을 광고에 쓰지 않는다고 명시', privacy.includes('광고 발송에 사용되지 않습니다'));
check('절 번호가 이어진다', privacy.includes('<h2>11. 처리방침의 변경</h2>'));

section('7. 이용약관의 사실 확인');
const terms = renderTerms(full);
check('참고용 콘텐츠임을 명시', terms.includes('참고용 콘텐츠'));
check('부적·기도 판매를 하지 않는다고 명시', terms.includes('부적'));
check('금액을 서버가 정한다고 명시', terms.includes('서버가 상품 정보를 기준으로 확정'));
check('타인 정보 입력에 동의가 필요하다고 명시', terms.includes('상대방의 동의'));
check('환불 정책을 약관의 일부로 편입', terms.includes('href="/refund"') && terms.includes('약관의 일부'));
check('중과실 면책 배제 조항이 있다', terms.includes('중대한 과실'));

section('8. HTML 이스케이프');
const nasty = loadBusinessInfo({ ...FULL, BIZ_COMPANY: '<script>alert(1)</script>' });
const nastyFooter = renderFooter(nasty);
check('상호에 태그가 들어가도 실행되지 않는다',
  !nastyFooter.includes('<script>alert') && nastyFooter.includes('&lt;script&gt;'));

section('9. 상품·가격 안내 (PG 심사의 「상품 등록 유무」)');

for (const ready of [true, false]) {
  const html = renderProducts(ready);
  const label = ready ? '결제 켜짐' : '결제 꺼짐';
  for (const p of Object.values(CATALOG)) {
    check(`${label}: ${p.name} 노출`, html.includes(p.name));
    check(`${label}: ${p.priceKrw.toLocaleString('ko-KR')}원 표시`,
      html.includes(`${p.priceKrw.toLocaleString('ko-KR')}원`));
  }
  check(`${label}: 부가세 포함 명시`, html.includes('부가세 포함'));
  check(`${label}: 청약철회 안내와 환불정책 링크`,
    html.includes('청약철회') && html.includes('href="/refund"'));
}

// 심사를 통과해야 결제가 켜지는데 결제가 켜져야 가격이 보이면 영원히 통과 못 한다
const off = renderProducts(false);
check('결제가 꺼져 있어도 가격이 보인다', off.includes('19,900원'));
check('결제가 꺼져 있으면 준비 중이라고 알린다', off.includes('결제 준비 중'));
check('결제가 켜지면 준비 중 문구가 사라진다', !renderProducts(true).includes('결제 준비 중'));

const saving = bundleSaving();
check('묶음 할인 근거가 카탈로그 합계와 맞는다',
  saving.individual === CATALOG['saju-report'].priceKrw + CATALOG['compat-report'].priceKrw
  && saving.bundle === CATALOG['cross-report'].priceKrw, `${saving.individual} → ${saving.bundle}`);
check('절약률이 계산된다', saving.percent === 20, `${saving.percent}%`);
check('개별 합산가가 화면에 나온다', off.includes('24,800원'));

// 받을 내용을 못 박아야 손님도 심사자도 결제 전에 안다
check('교차검증 상품의 포함 내용 명시',
  off.includes('일치하는 것') && off.includes('엇갈리는 것') && off.includes('하나만 말하는 것'));
check('무료 구간이 있다는 사실을 밝힌다', off.includes('결제 없이 이용'));

const page = renderProductsPage(full, false, renderFooter(full));
check('상품 전용 페이지가 완성된 문서', page.startsWith('<!doctype html>') && page.trimEnd().endsWith('</html>'));
check('상품 전용 페이지에 사업자 정보 동반', page.includes('220-81-62517'));
check('상품 전용 페이지 제목', page.includes('<title>판매 상품과 가격 · 사주보다</title>'));

console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} · 실패 ${failed}`);
if (failed) { console.log(failures.map((f) => `  - ${f}`).join('\n')); process.exit(1); }
