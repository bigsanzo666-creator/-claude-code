/**
 * 사업자 신원 정보.
 *
 * 근거: 전자상거래 등에서의 소비자보호에 관한 법률 제10조 —
 * 사이버몰 운영자는 상호·대표자·주소·전화번호·전자우편주소·사업자등록번호를
 * 소비자가 알아보기 쉬운 곳에 표시해야 한다.
 *
 * 실무적으로 더 중요한 이유는 따로 있다. **PG 심사는 이 정보를 신청서와
 * 글자 단위로 대조한다.** 상호가 한 글자라도 다르거나, 사업자등록번호가
 * 없거나, 전화번호가 신청서와 다르면 그 자리에서 반려된다.
 * 그래서 값은 코드에 박지 않고 환경변수로 받는다 — 신청서를 고칠 때마다
 * 배포를 다시 하지 않기 위해서다.
 *
 * 값이 비면 화면에 `[미입력: 상호]` 같은 표시가 그대로 남는다. 조용히 빈칸으로
 * 나가는 것보다 눈에 띄게 틀린 편이 낫다 — 빈칸은 심사 반려 사유이고,
 * 반려는 되돌리는 데 며칠이 든다.
 */

export interface BusinessInfo {
  /** 서비스(사이트) 이름. 상호와 다를 수 있다 */
  serviceName: string;
  /** 서비스 대표 주소. PG 계약이 이 URL 기준으로 진행된다 */
  serviceUrl: string;
  /** 사업자등록증상의 상호 */
  companyName: string;
  /** 대표자 성명 */
  representative: string;
  /** 사업자등록번호 (000-00-00000) */
  registrationNumber: string;
  /** 통신판매업 신고번호. 신고 전이면 빈 값 */
  mailOrderNumber: string;
  /** 사업장 소재지 */
  address: string;
  /** 고객센터 전화번호 */
  phone: string;
  /**
   * 유선전화번호.
   *
   * 카드사 등록심사가 하단 필수정보로 **유선전화번호**를 본다. 휴대폰만 적어두면
   * 걸릴 수 있고, 걸리면 재신청이라 2주가 다시 간다.
   * 없으면 고객센터 번호로 대신 표시한다 — 빈칸으로 두는 것보다 낫다.
   */
  landline: string;
  /** 고객센터 이메일 */
  email: string;
  /** 개인정보 보호책임자 성명 */
  privacyOfficer: string;
  /** 호스팅 제공자 */
  hostingProvider: string;
}

/** 화면에 반드시 나가야 하는 항목과 사람이 읽을 이름 */
const REQUIRED: Array<[keyof BusinessInfo, string]> = [
  ['serviceName', '서비스 이름'],
  ['serviceUrl', '서비스 주소'],
  ['companyName', '상호'],
  ['representative', '대표자'],
  ['registrationNumber', '사업자등록번호'],
  ['address', '사업장 주소'],
  ['phone', '고객센터 전화'],
  ['email', '고객센터 이메일'],
  ['privacyOfficer', '개인정보 보호책임자'],
];

/**
 * 통신판매업 신고번호는 별도로 본다.
 *
 * 신고는 PG 계약보다 늦게 끝나는 것이 정상이다 (PG 심사 7~10 영업일,
 * 통신판매업 신고 1~2주). 그래서 이것만 없는 상태는 "미완성"이지
 * "잘못"이 아니다 — 열기 전까지만 채우면 된다.
 */
export const MAIL_ORDER_LABEL = '통신판매업 신고번호';

const EMPTY: BusinessInfo = {
  serviceName: '', serviceUrl: '', companyName: '', representative: '',
  registrationNumber: '', mailOrderNumber: '', address: '', phone: '',
  landline: '', email: '', privacyOfficer: '', hostingProvider: '',
};

/** 환경변수에서 읽는다. 없는 값은 빈 문자열로 남는다 */
export function loadBusinessInfo(env: Record<string, string | undefined> = process.env): BusinessInfo {
  const get = (key: string) => (env[key] ?? '').trim();
  return {
    serviceName: get('SITE_NAME'),
    serviceUrl: get('SITE_URL'),
    companyName: get('BIZ_COMPANY'),
    representative: get('BIZ_REPRESENTATIVE'),
    registrationNumber: get('BIZ_REG_NUMBER'),
    mailOrderNumber: get('BIZ_MAIL_ORDER_NUMBER'),
    address: get('BIZ_ADDRESS'),
    phone: get('BIZ_PHONE'),
    landline: get('BIZ_LANDLINE'),
    email: get('BIZ_EMAIL'),
    privacyOfficer: get('BIZ_PRIVACY_OFFICER') || get('BIZ_REPRESENTATIVE'),
    hostingProvider: get('BIZ_HOSTING') || '자체 호스팅',
  };
}

/** 아직 못 채운 필수 항목의 사람 이름. 서버 기동 시 경고로 찍는다 */
export function missingFields(info: BusinessInfo): string[] {
  const missing = REQUIRED.filter(([key]) => !info[key]).map(([, label]) => label);
  if (!info.mailOrderNumber) missing.push(`${MAIL_ORDER_LABEL} (오픈 전까지)`);
  return missing;
}

/** 결제를 켜도 되는 상태인가. 통신판매업 신고번호까지 포함해서 본다 */
export function isComplete(info: BusinessInfo): boolean {
  return missingFields(info).length === 0;
}

/** 사업자등록번호 형식 검사. 국세청 체크섬까지 본다 */
export function isValidRegistrationNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 10) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * weights[i];
  sum += Math.floor((Number(digits[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(digits[9]);
}

/** 빈 값을 눈에 띄게 표시한다 */
export function show(info: BusinessInfo, key: keyof BusinessInfo, label: string): string {
  return info[key] || `[미입력: ${label}]`;
}

export const EMPTY_BUSINESS_INFO = EMPTY;
