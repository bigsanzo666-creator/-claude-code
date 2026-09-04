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
  renderProducts, renderProductsPage, renderProductPage, renderHero, renderTryHeading,
  LANDING_CSS, PRODUCTS_CSS, FONT_LINK,
  SPIRITS, PITCH, spiritOf, renderSpiritRow, renderSpiritHead, renderSpiritPitch, SPIRITS_CSS,
  renderSocialHead, HOME_TITLE, HOME_DESCRIPTION, FALLBACK_NAME,
  renderGate, GATE_CSS, GATE_SCRIPT, sceneUrl,
  renderStage, STAGE_CSS, STAGE_SCRIPT,
  renderWhy, WHY_CSS, LAYERS, CLAIMS,
} from './src/index.ts';
import { CATALOG, CATEGORIES } from '../commerce/src/catalog.ts';
import { PACKAGES, bundleMath } from '../commerce/src/packages.ts';
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
  // 정책 페이지만 검게 뒤집히면 딴 집처럼 보인다. 본 화면과 같은 한지 한 벌이다
  check(`${name}: 밝은 쪽 하나로 못 박는다`,
    html.includes('color-scheme:light') && !html.includes('prefers-color-scheme:dark'));
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

// 그림은 있는 것만 붙는다. 21장을 다 기다리지 않고 나온 것부터 올릴 수 있어야 하고,
// 빠진 자리에 빈 네모가 남으면 그림이 없느니만 못하다
check('그림이 없으면 img 태그를 아예 안 그린다', !renderProducts(false).includes('<img'));
const oneImage = renderProducts(false, new Set(['wealth-report']));
check('그림이 있는 상품에만 썸네일이 붙는다',
  (oneImage.match(/<img/g) ?? []).length === 1
  && oneImage.includes('src="/img/products/wealth-report"'));
check('썸네일 alt는 비어 있다 — 바로 옆에 이름이 글자로 있다',
  oneImage.includes('class="pr-thumb" src="/img/products/wealth-report" alt=""'));
check('상세 페이지도 그림이 있을 때만 크게 건다',
  !renderProductPage(CATALOG['wealth-report'], full, false, '').includes('<img')
  && renderProductPage(CATALOG['wealth-report'], full, false, '', new Set(['wealth-report']))
       .includes('class="pd-hero"'));

// 갈래 제목이 질문이어야 눌린다. 「연애」로는 안 눌린다
for (const c of CATEGORIES) {
  check(`갈래 제목이 질문으로 나온다: ${c.question}`, off.includes(c.question));
}
// 갈래 제목과 똑같은 질문을 카드에도 또 적으면 같은 문장을 두 번 읽힌다
const groupQuestions = new Set(CATEGORIES.map((c) => c.question));
check('상품마다 후킹 질문이 붙는다',
  Object.values(CATALOG).every((p) => off.includes(p.hook)));
check('갈래 제목과 겹치는 질문은 카드에서 한 번만 나온다',
  [...groupQuestions].every((q) => (off.split(q).length - 1) <= 1));

// 묶음 — 정가를 지어내지 않는다
for (const pack of Object.values(PACKAGES)) {
  const m = bundleMath(pack.id);
  check(`${pack.name}: 묶음가 표시`, off.includes(m.bundleKrw.toLocaleString('ko-KR')));
  check(`${pack.name}: 따로 사는 합계도 함께 표시`, off.includes(m.individualKrw.toLocaleString('ko-KR')));
}
check('추천 배지는 하나뿐', (off.match(/pr-badge/g) ?? []).length === 1);
check('지어낸 정가가 아님을 밝힌다', off.includes('판매한 적 없는 정가를 지어내'));

// 받을 내용을 못 박아야 손님도 심사자도 결제 전에 안다
check('교차검증 상품의 포함 내용 명시',
  off.includes('일치하는 것') && off.includes('엇갈리는 것') && off.includes('하나만 말하는 것'));
check('무료 구간이 있다는 사실을 밝힌다', off.includes('결제 없이 이용'));

const page = renderProductsPage(full, false, renderFooter(full));
check('상품 전용 페이지가 완성된 문서', page.startsWith('<!doctype html>') && page.trimEnd().endsWith('</html>'));
check('상품 전용 페이지에 사업자 정보 동반', page.includes('220-81-62517'));
check('상품 전용 페이지 제목', page.includes('<title>사주보다 — 판매 상품과 가격</title>'));

// 카톡에 링크를 붙이면 이 조각이 카드가 된다. 여기가 첫 화면 제목보다 먼저 읽힌다
{
  const home = renderSocialHead(full, {
    title: HOME_TITLE, description: HOME_DESCRIPTION, path: '/', image: true,
  });
  check('링크 이름이 사람 말이다',
    home.includes(`<title>사주보다 — ${HOME_TITLE}</title>`) && !home.includes('명식'));
  check('카톡 카드에 이름·설명·그림이 다 실린다',
    ['og:title', 'og:description', 'og:image', 'og:url'].every((k) => home.includes(k)));
  check('주소를 통째로 적는다 — 카카오톡은 반쪽 주소를 못 읽는다',
    home.includes('content="https://example.kr/img/hero"')
    && home.includes('content="https://example.kr/"'));
  check('그림이 없으면 그림 태그를 안 내보낸다',
    !renderSocialHead(full, { title: 'ㄱ', description: 'ㄴ' }).includes('og:image'));
  // 사업자 정보가 비었을 때 「[미입력: 서비스 이름]」이 카톡에 뜨면 그게 더 큰 사고다
  const bare = renderSocialHead(empty, { title: HOME_TITLE, description: HOME_DESCRIPTION });
  check('사업자 정보가 비어도 카톡에 미입력이라고 안 뜬다', !bare.includes('미입력'));
  check('이름이 비면 우리 이름으로 대신한다', bare.includes(FALLBACK_NAME));
  check('주소가 비면 주소 태그를 아예 안 내보낸다',
    !bare.includes('og:url') && !bare.includes('canonical'));
}

section('10. 첫 화면');
{
  const hero = renderHero(full, false);
  check('브랜드 이름이 맨 위에 나온다', hero.includes('사주보다'));
  check('서버가 HTML로 그린다 — 검색엔진과 심사 검사기가 본다', hero.includes('<h1>'));
  check('무료 구간으로 가는 버튼', hero.includes('href="#try"') && hero.includes('무료'));

  // 없는 실적을 만들지 않는다. 경쟁사의 「누적 30,000명」「97% 만족」은 우리에게 없다
  for (const banned of ['누적', '만족', '명이 선택', '1위', '최고']) {
    check(`없는 실적을 내걸지 않는다: ${banned}`, !hero.includes(banned));
  }
  // 대신 실제로 가진 것을 내건다
  check('세 갈래 대조를 내건다', hero.includes('세 갈래'));
  check('절기를 직접 계산한다는 사실', hero.includes('천문 계산'));
  check('근거를 단다는 원칙', hero.includes('근거'));

  // 개발자용 문구가 손님 화면에 남아 있으면 안 된다
  for (const jargon of ['VSOP87', '급수', '명식 해석', '만세력 · 명식']) {
    check(`손님 화면에 개발 용어가 없다: ${jargon}`, !hero.includes(jargon));
  }

  // 폰이 기준이다. 좁은 화면 스타일을 먼저 쓰고 넓은 화면은 min-width 로 덧붙인다
  check('모바일이 기준 — 좁은 화면이 기본값',
    renderHero(full, true).length > 0
    && LANDING_CSS.includes('@media (min-width:760px)')
    && !LANDING_CSS.includes('max-width:760px'));
  check('폭에 상한이 있다 — 넓은 화면에서 글줄이 늘어지지 않는다',
    PRODUCTS_CSS.includes('max-width:1080px'));
  // 글씨는 두 벌만. 한 페이지에 명조 두 벌이 돌면 어디는 나눔명조, 어디는 시스템 명조로 뜬다
  check('제목 글씨는 실제로 받아 오는 것만 쓴다',
    PRODUCTS_CSS.includes('--nb-serif:"Nanum Myeongjo"') && FONT_LINK.includes('Nanum+Myeongjo'));
  check('본문 글씨도 실제로 받아 오는 것만 쓴다',
    PRODUCTS_CSS.includes('--nb-sans:"IBM Plex Sans KR"') && FONT_LINK.includes('IBM+Plex+Sans+KR'));
  check('로고가 인장보다 크다', LANDING_CSS.includes('.lp-name{font-family:var(--nb-serif);font-size:20px')
    && LANDING_CSS.includes('.lp-seal{width:26px'));

  // 폰을 어둡게 쓰는 손님에게 이 집이 통째로 검은 화면이 되고 있었다.
  // 사주를 보러 온 사람에게 어두운 화면을 내미는 것은 파는 물건과도 안 맞는다
  check('색은 한지 한 벌뿐이다',
    PRODUCTS_CSS.includes('color-scheme:light')
    && !PRODUCTS_CSS.includes('prefers-color-scheme:dark')
    && !LANDING_CSS.includes('prefers-color-scheme:dark')
    && !STAGE_CSS.includes('prefers-color-scheme:dark'));
  check('종이색이 한 단계 밝다', PRODUCTS_CSS.includes('--nb-paper:#F4EFE3'));

  // 그림이 없으면 배경을 걸지 않는다 — 회색 네모를 남기지 않는 것은 상품 그림과 같은 규칙이다
  check('첫 화면 그림이 있으면 배경으로 깐다', renderHero(full, true, true).includes('url(/img/hero)'));
  check('첫 화면 그림이 없으면 걸지 않는다', !renderHero(full, true, false).includes('/img/hero'));

  // 영상은 그림을 늦추면 안 된다. 그림이 먼저 뜨고 영상은 뒤에서 받아 겹친다
  const withVideo = renderHero(full, true, true, true);
  check('영상이 있으면 그림 위에 겹친다', withVideo.includes('class="lp-vid"'));
  check('영상은 미리 받지 않는다', withVideo.includes('preload="none"'));
  check('영상에 소리가 없다', withVideo.includes('muted'));
  check('영상이 없으면 아무것도 안 붙는다', !renderHero(full, true, true, false).includes('lp-vid'));
  check('그림이 없으면 영상도 붙지 않는다', !renderHero(full, true, false, true).includes('lp-vid'));
  check('데이터 절약 모드에서는 받지 않는다', withVideo.includes('saveData'));
  // 잘리는 것은 위쪽이어야 한다. 아래쪽 물결이 이 그림의 핵심이다
  check('잘릴 때는 아래를 붙든다',
    LANDING_CSS.includes('center bottom/cover') && LANDING_CSS.includes('object-position:center bottom'));
  // 그림이 화면을 다 먹으면 무슨 파는 곳인지 모르는 채로 스크롤부터 해야 한다
  check('첫 화면에 글자가 함께 보인다', LANDING_CSS.includes('.lp-shot{position:relative;width:100%;height:46vh'));
  check('넓은 화면에서도 영상이 나간다', !withVideo.includes('innerWidth'));
  check('움직임 줄이기를 켠 손님에게는 틀지 않는다',
    withVideo.includes('prefers-reduced-motion'));

  const heading = renderTryHeading();
  check('무료 구간 앞에 안내가 붙는다', heading.includes('id="try"') && heading.includes('무료'));
  check('결제 없이 된다고 분명히 밝힌다', heading.includes('결제 없이'));
}

section('9. 신령 — 칸마다 주인이 있는가');
{
  // 설명만 있는 가게는 누구나 만든다. 갈래마다 말을 거는 신령이 있어야 한다
  check('갈래 일곱이 전부 주인이 있다',
    CATEGORIES.every((c) => spiritOf(c.key) !== null),
    CATEGORIES.filter((c) => !spiritOf(c.key)).map((c) => c.key).join(','));
  check('한 갈래에 신령이 둘이지 않다',
    new Set(SPIRITS.map((s) => s.keeps)).size === SPIRITS.length);
  check('신령 아이디가 겹치지 않는다',
    new Set(SPIRITS.map((s) => s.id)).size === SPIRITS.length);
  // 소리 내어 읽었을 때 다른 뜻으로 들리면 안 된다 (실신령 → 「실신」)
  check('이름이 나쁜 말로 안 들린다',
    SPIRITS.every((s) => !/^(실|사|망|병)신령$/.test(s.name)));
  // 이름을 바꿔도 이미 올려 둔 그림 파일은 옛 이름이다
  check('옛 이름을 기억해 둔다',
    SPIRITS.filter((s) => s.aka?.length).length === 6);
  // 얼굴 그림은 나중에 붙는다. 그동안 빈 네모가 남으면 안 그리느니만 못하다
  check('그림이 없어도 얼굴 자리가 도장으로 찬다',
    SPIRITS.every((s) => s.seal.length === 1));

  // 스물한 개 전부 신령이 할 말이 있어야 한다. 하나라도 비면 그 칸은 다시 표가 된다
  const noPitch = Object.keys(CATALOG).filter((id) => !PITCH[id]);
  check('상품마다 신령의 말이 있다', noPitch.length === 0, noPitch.join(','));
  // 「봐 드립니다」로 끝나는 안내문은 신령의 말이 아니다
  check('신령은 안내문처럼 말하지 않는다',
    Object.values(PITCH).every((t) => !t.includes('드립니다')));
  check('신령의 말이 서로 다르다',
    new Set(Object.values(PITCH)).size === Object.keys(PITCH).length);

  const row = renderSpiritRow();
  check('첫 화면에 신령 일곱이 다 선다',
    SPIRITS.every((s) => row.includes(s.name)));
  check('신령 소개에 맡은 칸이 적힌다',
    SPIRITS.every((s) => row.includes(`>${s.keeps}<`)));

  // 신령은 제 터에 선다. 터 그림이 없으면 종이색 바탕에 그대로 선다
  const onGround = renderSpiritHead(SPIRITS[0]!, '질문', new Set(), new Set(['flower']));
  check('신령이 제 터 위에 선다',
    onGround.includes('sp-here') && onGround.includes('--nb-place:url(/img/scene/flower)'));
  check('터 이름을 함께 적는다', onGround.includes('꽃터'));
  check('터 그림이 없으면 배경을 걸지 않는다',
    !renderSpiritHead(SPIRITS[0]!, '질문').includes('--nb-place:url'));
  check('터도 천천히 움직인다', SPIRITS_CSS.includes('nbDrift'));
  check('터 위 글자가 읽히도록 베일을 깐다', SPIRITS_CSS.includes('.sp-here .sp-veil'));

  const head = renderSpiritHead(SPIRITS[0]!, CATEGORIES[0]!.question);
  check('갈래 머리에서 신령이 질문을 던진다',
    head.includes(CATEGORIES[0]!.question) && head.includes(SPIRITS[0]!.greet));

  const pitch = renderSpiritPitch(SPIRITS[0]!, 'charm-report');
  check('상품 페이지에서 신령이 말을 건다', pitch.includes(PITCH['charm-report']!));
  check('없는 상품에는 말없이 넘어간다', renderSpiritPitch(SPIRITS[0]!, 'no-such-product') === '');

  // 그림 구도가 제각각으로 들어온다. 그림을 다시 뽑는 대신 잘라 내는 값을 고친다
  const moon = SPIRITS.find((s) => s.id === 'moon')!;
  const cut = renderSpiritRow(new Set(['moon']));
  check('얼굴을 어디서 잘라 낼지 그림마다 따로 정할 수 있다',
    cut.includes(`--sp-zoom:${moon.crop!.zoom}`) && cut.includes(`--sp-down:${moon.crop!.down}`));
  const plain = { ...moon, id: 'plain', crop: undefined };
  check('정하지 않은 신령은 기본값으로 나간다',
    !renderSpiritHead(plain, '질문', new Set(['plain'])).includes('--sp-zoom'));

  // 얼굴 그림이 들어오면 도장 대신 그림이 나가야 한다
  const withFace = renderSpiritRow(new Set(['flower']));
  check('그림이 있는 신령은 그림으로 나간다', withFace.includes('/img/spirits/flower'));
  check('그림이 없는 신령은 도장으로 남는다', withFace.includes('sp-seal'));

  // 신령이 다른 색으로 오면 같은 집 사람으로 안 보인다
  check('신령도 같은 색을 쓴다',
    !/#[0-9A-Fa-f]{3,6}/.test(SPIRITS_CSS.replace(/#131A26/g, '')));
  check('신령 스타일이 모든 화면에 실린다', PRODUCTS_CSS.includes('.sp-face'));

  // 목록에서 만난 얼굴을 상세에서 다시 만나야 같은 사람이 파는 것이 된다
  const detail = renderProductPage(CATALOG['charm-report']!, full, false, '');
  check('상품 상세에도 그 갈래 신령이 나온다',
    detail.includes('도화신령') && detail.includes(PITCH['charm-report']!));
  const list = renderProducts(false);
  check('상품 목록의 갈래마다 신령이 선다',
    SPIRITS.every((s) => list.includes(s.name)));

  // 첫 화면에서 값부터 보이면 손님이 물러선다. 심사가 보는 가격표에는 그대로 남는다
  const quiet = renderProducts(false, undefined, undefined, false);
  check('값을 끄면 첫 화면에 값이 안 나온다',
    !quiet.includes('19,900원') && !quiet.includes('부가세 포함'));
  check('값을 끄면 묶음도 빠진다', !quiet.includes('따로 사면'));
  check('값을 꺼도 가격표로 가는 길은 남는다', quiet.includes('href="/products"'));
  check('값을 켜면 그대로 다 나온다',
    list.includes('19,900원') && list.includes('따로 사면'));
}

section('10. 들어가는 길 — 전체 화면');
{
  const st = renderStage(full, new Set(['path', 'gate', 'world', 'flower']),
    { walk: true, open: true, walkWebm: true, openWebm: true }, new Set(['flower']));
  // 길 · 문 · 열림 · 신령계 · 신령 하나의 판. 스크롤은 글을 읽을 때부터다
  for (const id of ['stWalk', 'stGate', 'stOpen', 'stWorld', 'stSp-flower']) {
    check(`${id} 장면이 있다`, st.includes(`id="${id}"`));
  }
  // 숫자를 박아 두면 신령이 늘 때마다 여기부터 깨진다. 신령 수를 따라간다
  check('신령마다 저마다 판을 갖는다', (st.match(/id="stSp-/g) ?? []).length === SPIRITS.length);
  // 격자로 늘어놓으면 그냥 목록이다. 배경 그림 위에 자리마다 세운다
  check('신령이 배경 그림 위 자리마다 선다',
    (st.match(/class="wd-pin"/g) ?? []).length === SPIRITS.length);
  check('신령마다 자리가 다르다',
    new Set((st.match(/left:[0-9.]+%;top:[0-9.]+%/g) ?? [])).size === SPIRITS.length);
  // 위는 제목이, 아래는 무료 사주가 차지한다. 그 사이에만 세워야 안 겹친다
  check('제목·무료 사주와 겹치지 않는다',
    (st.match(/top:([0-9.]+)%/g) ?? []).every((t) => {
      const y = Number(t.slice(4, -1));
      return y >= 10 && y <= 74;
    }));
  check('신령계에서 무료 사주를 먼저 건다', st.includes('id="stFree"') && st.includes('무료'));
  // 아직 뭘 봐 주는지도 모르는 사람에게 계산부터 시키면 물러선다
  check('고르는 화면에는 값이 없다', !/[0-9],[0-9]{3}원/.test(st));
  check('신령 판에서 상품으로 이어진다', st.includes('href="/products/charm-report"'));
  // 덮개이지 대문이 아니다 — 카드사 심사와 검색엔진이 아래를 봐야 한다
  check('자바스크립트가 꺼져 있으면 안 뜬다', st.includes('id="stage" hidden'));
  check('밝히지 않고 둘러볼 수 있다', st.includes('id="stSkip"'));
  // 누르자마자 화면을 통째로 넘기면, 손님은 뭘 봐 주는 곳인지도 모르고
  // 들어갔다가 아니면 뒤로 나와야 한다. 그 한 번에 손님을 잃는다
  check('신령을 누르면 그 자리에서 먼저 말을 건다',
    (st.match(/class="wd-peek"/g) ?? []).length === SPIRITS.length);
  check('신령마다 봐 주는 것을 손님 말로 적어 둔다', st.includes('이런 것을 봐 준다'));
  // 끝까지 내려온 손님에게 갈 곳을 준다. 막히면 위로 되짚어 올라가다 그냥 나간다
  check('판 맨 아래에도 나가는 길이 있다',
    (st.match(/class="sp-back" data-back="1"/g) ?? []).length === SPIRITS.length);
  // 칸 하나가 화면을 다 먹으면 넷을 보는 데 네 번을 넘겨야 한다. 그건 고르는 게 아니라 스크롤이다
  check('고르는 칸은 그림을 옆에 작게 둔다',
    STAGE_CSS.includes('.sp-item{display:grid;grid-template-columns:96px 1fr'));
  check('이름이 그림 밑으로 흘러내리지 않는다', st.includes('class="sp-text"'));
  check('그 판에서 들어갈 수도, 다른 신령을 볼 수도 있다',
    st.includes('data-peek-go="mountain"') && st.includes('data-peek-x="1"'));
  // 뒤로가기가 판만 닫지 않고 신령계까지 나가 버리면 손님이 길을 잃는다
  check('뒤로가기 한 번은 그 판만 닫는다',
    STAGE_SCRIPT.includes('if(peeking){ closePeek(); return; }'));
  check('덮개가 떠 있는 동안 뒤는 안 움직인다', STAGE_CSS.includes('body.st-locked{overflow:hidden}'));
  // 폰에서 주소창이 접혔다 펴질 때 100vh 는 화면 아래가 잘린다
  // 걸어오는 영상은 첫 화면에서 바로 보인다. 자바스크립트를 기다리면
  // 그림 한 장만 보고 넘어가는 손님이 생긴다
  check('걸어오는 영상은 저 혼자 튼다',
    /id="stWalkVid"[^>]*autoplay/.test(st) && /id="stWalkVid"[^>]*preload="auto"/.test(st));
  check('걸어오는 영상 주소가 화면에 박혀 있다',
    st.includes('src="/video/gate-walk" type="video/mp4"'));
  // 문 여는 영상은 나중에 쓴다. 첫 화면을 늦출 이유가 없다
  check('문 여는 영상은 미리 받지 않는다', /id="stOpenVid"[^>]*preload="none"/.test(st));
  check('영상에 소리가 없다', (st.match(/class="st-vid"[^>]*muted/g) ?? []).length === 2);
  check('데이터 절약 모드에서는 걸어오는 영상을 버린다',
    STAGE_SCRIPT.includes("walk.removeAttribute('autoplay')")
    && STAGE_SCRIPT.includes('walk.removeChild(walk.firstChild)'));
  // mp4 를 못 여는 브라우저에는 영상이 아예 없는 것과 똑같이 보인다
  check('영상을 두 벌로 건다',
    st.includes('src="/video/gate-walk.webm" type="video/webm"')
    && st.includes('src="/video/gate-open.webm" type="video/webm"'));
  check('영상이 없으면 자리도 안 만든다',
    !renderStage(full, new Set(['gate'])).includes('st-vid'));
  check('그림이 없으면 배경을 걸지 않는다',
    !renderStage(full).includes('--st-shot:url'));
  // 계산은 만세력 조각이 한다. 두 곳에서 계산하면 언젠가 두 값이 달라진다.
  // 덮개는 **제 손으로 세지 않고** 그 조각을 불러 쓴다
  check('덮개는 밝힌 것을 아래 칸으로 옮겨 담는다', STAGE_SCRIPT.includes("put('date',date)"));
  check('사주는 만세력 조각을 불러서 낸다',
    STAGE_SCRIPT.includes('MS.calculate({date:date,time:hour||null})')
    && STAGE_SCRIPT.includes('MS.analyze(ms)'));
  check('덮개가 제 손으로 간지를 세지 않는다',
    !/갑을병정|자축인묘|sexagenary|60갑자/.test(STAGE_SCRIPT));
  // 생년월일은 신령에게 보내지 않는다. 신령이 말하는 데 필요한 것은
  // 「무슨 날에 태어났는가」가 아니라 「그래서 어떤 사람인가」다
  check('생년월일을 서버로 보내지 않는다',
    /post\(\{spirit:id,facts:facts\(\)/.test(STAGE_SCRIPT)
    && !/JSON\.stringify\([^)]*date:/.test(STAGE_SCRIPT));
  // 영상이 안 받아졌다고 넘겨 버리면 좋은 영상이 폰에서는 거의 안 보인다.
  // 그림을 먼저 깔고 단추를 준다 — 기다리는 사람도 없고 화질을 깎을 이유도 없다
  check('영상을 기다리느라 손님을 붙들지 않는다', st.includes('id="stGo"'));
  check('안 받아졌다고 장면을 넘겨 버리지도 않는다',
    !STAGE_SCRIPT.includes('if(!walkReady)toGate()'));
  check('문 여는 영상은 오래 걸리면 기다리지 않는다', STAGE_SCRIPT.includes('setTimeout(once,'));
  // 「화면 움직임 줄이기」는 윈도우·맥에서 흔하게 켜져 있다. 그걸로 영상을
  // 버리면 크롬이든 엣지든 그림 한 장만 뜬다 — 제일 중요한 장면이 통째로 사라진다.
  // 이 영상은 장식이 아니라 내용이다
  check('움직임을 꺼 뒀다고 영상을 버리지 않는다',
    !STAGE_SCRIPT.includes("var calm=matchMedia('(prefers-reduced-motion: reduce)')"));
  check('영상을 버리는 것은 데이터를 아낄 때뿐이다',
    STAGE_SCRIPT.includes("var thin=!!(c&&(c.saveData||/2g/.test(c.effectiveType||'')));"));
  // 저 혼자 도는 장식은 그때 멈춘다
  check('떠다니는 신령 표는 그때 멈춘다',
    STAGE_CSS.includes('@media (prefers-reduced-motion:reduce){ .wd-pin{animation:none} }'));

  // 폰에서 뒤로가기는 제일 많이 누르는 단추다. 우리 화면은 주소가 안 바뀌므로
  // 그냥 두면 한 번에 사이트가 꺼진다 — 잘못 눌러 들어온 손님이 그대로 나간다
  check('뒤로가기가 앞 장면으로 되돌아간다',
    STAGE_SCRIPT.includes("addEventListener('popstate'") && STAGE_SCRIPT.includes('back.pop()'));
  check('첫 뒤로가기가 사이트를 닫지 않게 자리를 깔아 둔다',
    STAGE_SCRIPT.includes("history.pushState({nb:0}"));
  check('되돌아갈 곳이 없을 때에만 나가겠냐고 묻는다',
    /if\(back\.length\)[\s\S]{0,320}ask\(true\)/.test(STAGE_SCRIPT));
  check('나가겠냐고 묻는 창이 있다', st.includes('id="stLeave"') && st.includes('나가시겠습니까'));
  check('머무를 길과 나갈 길이 다 있다',
    st.includes('id="stStay"') && st.includes('id="stLeaveGo"'));
  // 붙잡는 것은 한 번이면 족하다. 정말 나가겠다는 손님을 두 번 막지 않는다
  check('정말 나가겠다면 막지 않는다', STAGE_SCRIPT.includes('history.back()'));
  // 이미 본 영상을 또 보여 주는 것은 되돌아가는 것이 아니라 붙잡는 것이다
  check('들어오는 영상으로는 되돌아가지 않는다', STAGE_SCRIPT.includes("here!=='stWalk'"));
}

section('11. 문 — 신령계 들어가는 곳');
{
  const gate = renderGate(full, new Set(['gate']));
  check('문에서 이름·태어난 날·태어난 시를 받는다',
    ['gateName', 'gateDate', 'gateHour'].every((id) => gate.includes(`id="${id}"`)));
  check('태어난 시를 12지지로 고르게 한다', gate.includes('인시') && gate.includes('해시'));
  check('시간을 몰라도 된다고 알린다', gate.includes('시간을 몰라도 됩니다'));
  // 「정보를 입력하세요」와 「이름을 밝히시오」는 다른 화면이다
  check('입장 의식처럼 말한다', gate.includes('밝히셔야') && gate.includes('문을 엽니다'));
  check('밝힌 것을 어디로도 보내지 않는다고 못 박는다',
    gate.includes('어디로도 보내지 않고'));
  // 막아 두면 카드사 심사가 상품과 가격을 못 본다
  check('문을 잠그지 않는다 — 둘러보기가 남아 있다',
    gate.includes('href="#products"') && gate.includes('둘러보기'));
  check('문 그림이 있으면 배경으로 깐다', gate.includes(`--nb-gate:url(${sceneUrl('gate')})`));
  check('문 그림이 없으면 걸지 않는다', !renderGate(full).includes('--nb-gate:url'));

  // 계산은 만세력 조각이 한다. 두 곳에서 계산하면 언젠가 두 값이 달라진다
  check('문은 계산하지 않고 아래 칸에 옮겨 담기만 한다',
    GATE_SCRIPT.includes("put('date',date)")
    && !/calculate|analyze|manseryeok/i.test(GATE_SCRIPT));
  check('옮겨 담은 뒤 다시 그리게 한다', GATE_SCRIPT.includes("new Event('change'"));
  check('시각을 모르면 모름으로 표시한다', GATE_SCRIPT.includes('notime'));

  // 청월당이 쓰는 그 느낌 — 그림이 천천히 다가오고 글자가 아래에서 올라온다
  check('그림이 천천히 움직인다', GATE_CSS.includes('@keyframes nbDrift'));
  // 배경이 움직이는 것은 영상이 아니라 CSS 다. 무게가 0이라 폰이 버벅이지 않는다
  check('움직이는 배경은 영상이 아니다',
    GATE_CSS.includes('.gate-bg{') && !gate.includes('class="gate-bg"><video'));

  // 문 여는 장면은 밝힌 뒤에만 튼다. 첫 화면을 늦추면 안 된다
  const withOpen = renderGate(full, new Set(['gate']), true);
  check('문 여는 영상 자리가 생긴다', withOpen.includes('id="gateOpenVid"'));
  check('문 여는 영상은 처음엔 감춰져 있다', withOpen.includes('id="gateOpen" hidden'));
  check('문 여는 영상을 미리 받지 않는다', withOpen.includes('preload="none"'));
  check('문 여는 영상에 소리가 없다', /id="gateOpenVid"[^>]*muted/.test(withOpen));
  check('영상이 없으면 자리도 안 만든다', !renderGate(full, new Set(['gate'])).includes('gateOpen'));
  // 이름을 치는 동안 뒤에서 받아 두면 누를 때 기다림이 0이다
  check('이름 치는 동안 뒤에서 받아 둔다', GATE_SCRIPT.includes("requestIdleCallback(pull"));
  // 못 틀거나 오래 걸리면 손님을 문 앞에 세워 두지 않는다
  check('영상이 안 되면 그냥 들어간다',
    GATE_SCRIPT.includes("addEventListener('error',once") && GATE_SCRIPT.includes('setTimeout(once,'));
  check('움직임을 꺼 둔 손님에게는 틀지 않는다',
    /prefers-reduced-motion[\s\S]{0,80}\{enter\(\);return;\}/.test(GATE_SCRIPT));
  check('글자가 아래에서 올라온다', GATE_CSS.includes('.nb-rise') && gate.includes('nb-rise'));
  check('한 번 올라온 것은 다시 안 내려간다', GATE_SCRIPT.includes('unobserve'));
  // 어지럼증 때문에 움직임을 꺼 둔 손님에게는 아무것도 움직이지 않는다
  check('움직임 줄이기를 켠 손님은 움직임이 없다',
    GATE_CSS.includes('prefers-reduced-motion') && GATE_SCRIPT.includes('prefers-reduced-motion'));
  check('그때도 글자는 보인다', /prefers-reduced-motion[\s\S]{0,200}\.nb-rise\{opacity:1/.test(GATE_CSS));
}


// ─── 「왜 늘봄이냐」 판 ────────────────────────────────────────
{
  section('왜 늘봄이냐');

  const why = renderWhy();
  const store = renderProducts(true);
  const st = renderStage(full, new Set(['world']));

  check('상품 페이지에 판이 실린다', store.includes('class="why"'));
  check('신령 판에도 한 벌 실린다', st.includes('id="stWhy"'));

  // 신령이 여덟이어도 글은 한 벌이면 된다. 여덟 벌이면 페이지만 무거워진다
  check('신령이 여덟이어도 판은 한 벌',
    (st.match(/class="why"/g) ?? []).length === 1,
    `${(st.match(/class="why"/g) ?? []).length}벌`);
  check('풀이를 펼칠 때 복사해 넣는다', STAGE_SCRIPT.includes("getElementById('stWhy')"));

  // 계산과 서술의 경계가 이 판의 알맹이다. 그 경계가 흐려지면 자랑이 거짓말이 된다
  check('네 층이 다 있다', LAYERS.length === 4);
  check('계산은 규칙이 한다', LAYERS.slice(0, 3).every((l) => l.by === '규칙'));
  check('모델은 마지막 한 층만 맡는다',
    LAYERS.filter((l) => l.by === 'AI').length === 1 && LAYERS[3].by === 'AI');

  // 이 판은 파는 자리가 아니라 의심에 답하는 자리다
  check('값을 말하지 않는다', !/[0-9],[0-9]{3}원|원<\/|가격/.test(why));
  check('상품 이름을 팔지 않는다',
    !Object.values(CATALOG).some((p) => why.includes(p.name)));

  // 적어 둔 자랑은 코드가 실제로 하는 것이어야 한다
  const body = CLAIMS.map((c) => c.head + c.body).join(' ');
  check('절기를 계산한다는 말이 있다', body.includes('절기') && body.includes('오차'));
  check('진태양시로 시주를 세운다는 말이 있다',
    body.includes('진태양시') && body.includes('서머타임'));
  check('셋을 겹쳐 본다는 말이 있다', body.includes('엇갈림') || body.includes('엇갈리는'));
  check('사진이 안 나간다는 말이 있다',
    body.includes('기기 밖으로 나가지 않습니다') && body.includes('서버로 보내지 않'));

  // 「반드시」, 「100%」 같은 말은 이 판에서도 쓰지 않는다
  check('단정하는 말을 안 쓴다', !/반드시|100%|절대적/.test(why));

  check('판의 CSS가 상품 묶음에 실린다', PRODUCTS_CSS.includes('.why-stack'));
  check('넓은 화면에서 두 칸으로 눕는다',
    /min-width:760px[\s\S]{0,400}\.why-grid\{grid-template-columns:1fr 1fr/.test(WHY_CSS));
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} · 실패 ${failed}`);
if (failed) { console.log(failures.map((f) => `  - ${f}`).join('\n')); process.exit(1); }
