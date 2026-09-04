/**
 * 약관·개인정보처리방침·환불정책 문서.
 *
 * PG 심사에서 실제로 열어보는 세 페이지다. 없으면 반려된다.
 * 내용은 우리 코드가 실제로 하는 일과 일치해야 한다 — 특히 환불 조항은
 * `packages/commerce/src/refund.ts` 의 판정 로직과 같은 말을 해야 한다.
 * 둘이 어긋나면 약관 위반이 되므로, 상수는 그쪽에서 가져다 쓴다.
 *
 * 이 문서는 법률 자문이 아니다. 오픈 전에 반드시 검토를 받을 것.
 */

import { WITHDRAWAL_WINDOW_DAYS, REFUND_DUE_BUSINESS_DAYS } from '../../commerce/src/refund.ts';
import { type BusinessInfo, show } from './business.ts';

/** 문서가 바뀔 때마다 올린다. 시행일과 함께 화면에 찍힌다 */
export const POLICY_VERSION = '1.1';
export const POLICY_EFFECTIVE_DATE = '2026-09-01';

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/**
 * 하단 사업자 정보.
 *
 * 모든 페이지에 같은 내용이 나가야 한다 — 결제 페이지에만 있고 첫 화면에 없으면
 * "알아보기 쉬운 곳에 표시"로 보지 않는다.
 */
export function renderFooter(info: BusinessInfo): string {
  const rows: Array<[string, string]> = [
    ['상호', show(info, 'companyName', '상호')],
    // 카드사 심사가 「대표」라는 직책 표기를 요구한다 (예: 대표:홍길동)
    ['대표', show(info, 'representative', '대표자')],
    ['사업자등록번호', show(info, 'registrationNumber', '사업자등록번호')],
    ['통신판매업 신고', info.mailOrderNumber || '신고 진행 중'],
    ['주소', show(info, 'address', '사업장 주소')],
    // 유선전화가 있으면 그렇게, 없으면 휴대폰을 「연락처」로 적는다.
    // 휴대폰 번호에 「유선전화」라는 이름을 붙이는 것은 사실과 다르고, 번호를 보면
    // 심사자가 바로 안다. KG이니시스는 하단 필수정보를 「연락처(휴대폰 또는
    // 일반전화)」로 적어 두었다 — 있는 그대로 쓰는 편이 안전하다.
    info.landline
      ? ['유선전화', info.landline]
      : ['연락처', show(info, 'phone', '전화')],
    ['고객센터', `${show(info, 'phone', '전화')} · ${show(info, 'email', '이메일')}`],
    ['개인정보 보호책임자', show(info, 'privacyOfficer', '개인정보 보호책임자')],
    ['호스팅 제공', info.hostingProvider],
  ];
  const items = rows.map(([k, v]) => `<span><b>${esc(k)}</b> ${esc(v)}</span>`).join('\n      ');
  return `<footer class="biz">
  <nav class="biz-links">
    <a href="/products">판매 상품</a>
    <a href="/terms">이용약관</a>
    <a href="/privacy"><b>개인정보처리방침</b></a>
    <a href="/refund">취소·환불 정책</a>
  </nav>
  <div class="biz-rows">
      ${items}
  </div>
  <p class="biz-note">${esc(show(info, 'serviceName', '서비스 이름'))}에서 제공하는 사주·관상·손금 해석은
  전통 명리 이론에 근거한 참고 자료이며, 의료·법률·투자 판단의 근거가 아닙니다.</p>
</footer>`;
}

const CSS = `
/* 정책 페이지도 본 화면과 같은 한지 한 벌이다. 여기만 검게 뒤집히면 딴 집 같다 */
:root{color-scheme:light;
  --fg:#1B2A45;--muted:#525C72;--line:#EBE4D6;--bg:#F4EFE3;--accent:#96742F}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.75 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:24px;margin:0 0 4px}
.meta{color:var(--muted);font-size:13px;margin:0 0 28px}
h2{font-size:17px;margin:32px 0 8px;padding-top:16px;border-top:1px solid var(--line)}
p,li{margin:8px 0}
ul,ol{padding-left:22px}
a{color:var(--accent)}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
th{background:color-mix(in srgb,var(--line) 40%,transparent);white-space:nowrap}
.wrap{overflow-x:auto}
.biz{max-width:720px;margin:0 auto;padding:20px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px}
.biz-links{display:flex;gap:14px;margin-bottom:10px}
.biz-rows{display:flex;flex-wrap:wrap;gap:4px 14px}
.biz-rows b{font-weight:600;color:var(--fg)}
.biz-note{margin-top:10px}
`;

/** 한 장짜리 정책 문서를 완성된 HTML 문서로 만든다 */
export function renderPolicyPage(title: string, bodyHtml: string, info: BusinessInfo): string {
  const site = show(info, 'serviceName', '서비스 이름');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(site)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>${esc(title)}</h1>
<p class="meta">${esc(site)} · 제${POLICY_VERSION}판 · 시행일 ${POLICY_EFFECTIVE_DATE}</p>
${bodyHtml}
</main>
${renderFooter(info)}
</body>
</html>`;
}

export function renderTerms(info: BusinessInfo): string {
  const site = esc(show(info, 'serviceName', '서비스 이름'));
  const body = `
<h2>제1조 (목적)</h2>
<p>이 약관은 ${site}(이하 "회사")가 제공하는 사주·궁합·관상·손금 해석 서비스(이하 "서비스")의
이용 조건과 절차, 회사와 이용자의 권리·의무를 정하는 것을 목적으로 합니다.</p>

<h2>제2조 (서비스의 성격)</h2>
<ol>
<li>서비스가 제공하는 해석은 전통 명리 이론과 관상·수상 이론에 근거한 <b>참고용 콘텐츠</b>입니다.</li>
<li>회사는 해석 내용이 이용자의 미래를 예측하거나 특정 결과를 보장한다고 표시하지 않으며,
이용자는 이를 의료·법률·투자·고용 등 중요한 의사결정의 근거로 삼아서는 안 됩니다.</li>
<li>회사는 특정 상품 구매, 개명, 이사, 택일 등을 조건으로 하는 별도의 유료 상담이나
부적·기도 등의 판매를 하지 않습니다.</li>
</ol>

<h2>제3조 (회원가입 없는 이용)</h2>
<p>서비스의 무료 해석은 회원가입 없이 이용할 수 있습니다. 유료 리포트는 결제 시
주문번호가 발급되며, 이용자는 그 주문번호로 리포트 열람과 환불 요청을 할 수 있습니다.</p>

<h2>제4조 (유료 서비스와 대금)</h2>
<ol>
<li>유료 리포트의 종류와 가격은 결제 화면에 표시하며, 표시 금액은 부가가치세를 포함합니다.</li>
<li>결제 금액은 회사 서버가 상품 정보를 기준으로 확정하며, 이용자 단말이 보낸 금액을 그대로 사용하지 않습니다.</li>
<li>회사는 결제대행사에 결제 사실과 금액을 직접 확인한 뒤에만 리포트를 생성합니다.</li>
</ol>

<h2>제5조 (콘텐츠 제공 시점)</h2>
<p>유료 리포트는 결제 확인 직후 생성되어 즉시 열람할 수 있습니다.
회사는 결제 전에 리포트의 일부를 미리보기로 제공하여, 이용자가 구매 여부를
판단할 수 있도록 합니다.</p>

<h2>제6조 (청약철회)</h2>
<p>청약철회와 환불에 관한 사항은 <a href="/refund">취소·환불 정책</a>에서 정합니다.
해당 정책은 이 약관의 일부를 구성합니다.</p>

<h2>제7조 (이용자의 의무)</h2>
<ul>
<li>이용자는 타인의 생년월일·사진 등 개인정보를 본인의 동의 없이 입력해서는 안 됩니다.
궁합 등 2인 이상의 정보를 입력하는 경우, 상대방의 동의를 받았음을 전제로 합니다.</li>
<li>이용자는 서비스가 생성한 리포트를 개인적 용도로 이용할 수 있으며,
회사의 사전 동의 없이 이를 재판매하거나 상업적으로 배포할 수 없습니다.</li>
</ul>

<h2>제8조 (회사의 면책)</h2>
<ol>
<li>회사는 천재지변, 정전, 결제대행사·통신사의 장애 등 회사의 통제를 벗어난 사유로
서비스를 제공하지 못한 데 대하여 책임을 지지 않습니다. 다만 그 기간의 유료 이용분은 환불합니다.</li>
<li>회사는 제2조에 따른 참고용 콘텐츠의 성격 범위에서 책임을 지며,
이용자가 해석을 근거로 내린 판단의 결과에 대해서는 책임을 지지 않습니다.</li>
<li>회사의 고의 또는 중대한 과실로 인한 손해에 대해서는 이 조의 면책이 적용되지 않습니다.</li>
</ol>

<h2>제9조 (약관의 변경)</h2>
<p>회사는 약관을 변경할 수 있으며, 변경 시 시행일 7일 전(이용자에게 불리한 변경은 30일 전)부터
서비스 화면에 공지합니다. 이미 결제된 건에는 결제 당시의 약관을 적용합니다.</p>

<h2>제10조 (분쟁의 해결)</h2>
<p>서비스 이용과 관련한 분쟁은 소비자기본법에 따른 분쟁조정기구의 조정을 신청할 수 있습니다.
소송이 제기되는 경우 관할은 민사소송법에 따릅니다.</p>

<h2>부칙</h2>
<p>이 약관은 ${POLICY_EFFECTIVE_DATE}부터 시행합니다.</p>`;
  return renderPolicyPage('이용약관', body, info);
}

export function renderPrivacy(info: BusinessInfo): string {
  const site = esc(show(info, 'serviceName', '서비스 이름'));
  const officer = esc(show(info, 'privacyOfficer', '개인정보 보호책임자'));
  const email = esc(show(info, 'email', '이메일'));
  const phone = esc(show(info, 'phone', '전화'));
  const body = `
<p>${site}(이하 "회사")는 개인정보 보호법 제30조에 따라 이용자의 개인정보를 보호하고
관련 고충을 신속히 처리하기 위하여 다음의 처리방침을 둡니다.</p>

<h2>1. 수집하는 항목과 목적</h2>
<div class="wrap"><table>
<tr><th>구분</th><th>항목</th><th>목적</th><th>보유기간</th></tr>
<tr><td>해석 입력값</td><td>생년월일, 태어난 시각, 성별, 출생지(경도), 이름(선택)</td>
<td>사주 산출과 리포트 생성</td><td>결제 건은 5년, 무료 이용은 저장하지 않음</td></tr>
<tr><td>관상·손금</td><td>이용자가 직접 선택한 이목구비·손금 특징값</td>
<td>관상·손금 해석</td><td>결제 건은 5년, 무료 이용은 저장하지 않음</td></tr>
<tr><td>결제</td><td>주문번호, 결제금액, 결제수단, 결제·환불 일시</td>
<td>대금 결제, 환불 처리, 분쟁 대응</td><td>5년 (전자상거래법 제6조)</td></tr>
<tr><td>연락처 <b>(선택)</b></td><td>이메일 주소</td>
<td>리포트 결과 전달 · 문의 응대</td><td>동의 철회 시까지</td></tr>
<tr><td>광고 수신 <b>(선택)</b></td><td>이메일 주소, 수신 동의 여부·시각</td>
<td>신규 리포트·이벤트 안내</td><td>수신거부 시까지</td></tr>
<tr><td>문의</td><td>이메일 주소, 문의 내용</td><td>고객 응대</td><td>3년 (전자상거래법 제6조)</td></tr>
</table></div>

<h2>2. 사진을 서버에 보내지 않는 이유</h2>
<p>관상·손금 기능은 이용자 단말에서 사진의 특징값만 추출하고, <b>사진 원본은 회사 서버로
전송하지 않습니다.</b> 회사가 보관하는 것은 "코끝이 둥근 편" 같은 등급값뿐이며,
얼굴 이미지나 생체인식정보는 수집·보관하지 않습니다.</p>

<h2>3. 무료 이용 시 저장하지 않음</h2>
<p>무료 해석은 입력값을 처리한 즉시 폐기하며 저장하지 않습니다.
유료 리포트는 이용자가 나중에 다시 열람하고 환불을 요청할 수 있어야 하므로,
주문번호와 함께 위 표의 기간 동안 보관합니다.</p>

<h2>4. 광고성 정보 수신과 수신거부</h2>
<p>회사는 정보통신망 이용촉진 및 정보보호 등에 관한 법률 제50조에 따라,
<b>영리목적의 광고성 정보를 보내기 전에 별도의 수신 동의를 받습니다.</b></p>
<ul>
<li>리포트 결과를 받기 위한 동의와 광고 수신 동의는 <b>별개로 받으며</b>,
결과 전달에만 동의하신 경우 광고성 정보를 보내지 않습니다.</li>
<li>광고 수신 동의는 선택 사항이며, 동의하지 않아도 서비스 이용에 제한이 없습니다.</li>
<li>모든 광고성 메일에는 수신거부 방법을 함께 안내하며,
수신거부 즉시 발송을 중단합니다.</li>
<li>수신거부 사실은 별도로 보관합니다. 거부하신 분께 다시 발송하지 않기 위해서이며,
이 기록은 광고 발송에 사용되지 않습니다.</li>
</ul>

<h2>5. 제3자 제공과 처리위탁</h2>
<p>회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 서비스 제공을 위해
아래 업무를 위탁합니다.</p>
<div class="wrap"><table>
<tr><th>수탁자</th><th>위탁 업무</th><th>제공 항목</th></tr>
<tr><td>주식회사 코리아포트원</td><td>결제 처리 및 결제수단 인증</td><td>주문번호, 결제금액</td></tr>
<tr><td>Anthropic PBC (미국)</td><td>리포트 문장 생성</td><td>사주 산출 결과(십신·오행 등 해석값), 이름(입력한 경우)</td></tr>
</table></div>
<p>Anthropic PBC 로는 생년월일·연락처가 아닌 <b>산출된 해석값</b>이 전달되며,
전송 시점에 처리되고 모델 학습에 사용되지 않습니다.
이용자는 국외 이전을 거부할 수 있으나, 이 경우 유료 리포트를 이용할 수 없습니다.</p>

<h2>6. 이용자의 권리</h2>
<p>이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요구할 수 있습니다.
주문번호와 함께 아래 연락처로 요청하시면 지체 없이 처리합니다.
다만 전자상거래법에 따라 보존 의무가 있는 결제 기록은 보존 기간이 지난 뒤 삭제됩니다.</p>

<h2>7. 파기</h2>
<p>보유 기간이 지난 개인정보는 지체 없이 파기합니다. 전자적 파일은 복구할 수 없는 방법으로
삭제하고, 출력물이 있는 경우 분쇄하거나 소각합니다.</p>

<h2>8. 안전성 확보 조치</h2>
<ul>
<li>모든 통신 구간에 HTTPS를 적용합니다.</li>
<li>결제대행사 API 비밀키와 리포트 생성 API 키는 서버에만 두며, 브라우저로 내려보내지 않습니다.</li>
<li>개인정보에 접근할 수 있는 인원을 최소한으로 제한합니다.</li>
</ul>

<h2>9. 쿠키</h2>
<p>회사는 광고·행태정보 수집 목적의 쿠키를 사용하지 않습니다.
이용자가 결제 중인 주문을 이어서 볼 수 있도록 하는 최소한의 저장만 이용자 브라우저에 남습니다.</p>

<h2>10. 개인정보 보호책임자</h2>
<p>성명: ${officer}<br>연락처: ${phone} · ${email}</p>
<p>개인정보 침해에 대한 신고·상담이 필요하시면 개인정보침해신고센터(국번없이 118),
대검찰청 사이버수사과(1301), 경찰청 사이버수사국(182)에 문의하실 수 있습니다.</p>

<h2>11. 처리방침의 변경</h2>
<p>이 방침은 ${POLICY_EFFECTIVE_DATE}부터 시행합니다. 내용이 변경되는 경우
시행 7일 전부터 서비스 화면에 공지합니다.</p>`;
  return renderPolicyPage('개인정보처리방침', body, info);
}

export function renderRefund(info: BusinessInfo): string {
  const email = esc(show(info, 'email', '이메일'));
  const phone = esc(show(info, 'phone', '전화'));
  const body = `
<p>이 정책은 전자상거래 등에서의 소비자보호에 관한 법률 제17조·제18조에 따릅니다.
법령보다 이용자에게 불리한 내용은 효력이 없습니다.</p>

<h2>1. 청약철회 기간</h2>
<p>유료 리포트 결제일부터 <b>${WITHDRAWAL_WINDOW_DAYS}일</b> 이내에 청약철회를 하실 수 있습니다.</p>

<h2>2. 열람한 리포트의 처리</h2>
<p>디지털콘텐츠는 제공이 시작되면 청약철회가 제한될 수 있습니다.
다만 회사가 <b>다음 두 가지를 모두 이행한 경우에만</b> 그 제한을 적용합니다.</p>
<ol>
<li>결제 화면에서 "열람 시 청약철회가 제한된다"는 사실을 명확히 고지했을 것</li>
<li>결제 전에 리포트 일부를 미리보기로 제공했을 것</li>
</ol>
<p>둘 중 하나라도 이행하지 않았다면, 리포트를 이미 열람하셨더라도 환불해 드립니다.
판단이 애매한 경우는 이용자에게 유리하게 처리합니다.</p>

<h2>3. 언제나 전액 환불되는 경우</h2>
<ul>
<li>결제는 되었으나 리포트가 생성되지 않은 경우</li>
<li>리포트를 한 번도 열람하지 않은 경우 (제1항 기간 내)</li>
<li>표시·광고 내용과 다르거나 계약 내용과 다르게 이행된 경우
— 이 경우 공급받은 날부터 3개월 이내, 그 사실을 안 날부터 30일 이내</li>
<li>회사의 시스템 오류로 같은 내용이 중복 결제된 경우</li>
</ul>

<h2>4. 환급 기한</h2>
<p>청약철회를 접수한 날부터 <b>${REFUND_DUE_BUSINESS_DAYS} 영업일</b> 이내에 대금을 환급합니다.
신용카드 결제는 회사가 결제대행사에 취소를 요청한 뒤 카드사의 처리 일정에 따라
승인 취소가 반영되며, 이 기간은 카드사마다 다릅니다.</p>

<h2>5. 신청 방법</h2>
<p>결제 시 발급된 <b>주문번호</b>와 함께 ${email} 또는 ${phone} 으로 요청하시면 됩니다.
서비스 화면의 주문 조회에서 직접 환불을 요청하실 수도 있습니다.</p>

<h2>6. 회사가 하지 않는 것</h2>
<ul>
<li>환불 수수료를 별도로 받지 않습니다.</li>
<li>"해석 결과가 마음에 들지 않는다"는 이유만으로 환불을 거절하지 않습니다.
제2항의 요건을 회사가 지키지 못했다면 그대로 환불합니다.</li>
</ul>

<h2>부칙</h2>
<p>이 정책은 ${POLICY_EFFECTIVE_DATE}부터 시행합니다.</p>`;
  return renderPolicyPage('취소·환불 정책', body, info);
}
