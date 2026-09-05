/**
 * 카톡·문자에 링크를 붙였을 때 보이는 이름과 설명.
 *
 * 지금까지 첫 화면에는 `<title>` 이 아예 없었다. 그래서 브라우저와 카카오톡이
 * 화면 아래쪽 만세력 조각에 달린 **개발자용 제목**을 주워다 썼다 —
 * 「만세력 명식 해석」. 손님은 그게 무슨 말인지 모른다.
 *
 * 링크를 붙이는 곳이 곧 우리 간판이다. 카톡에 붙였을 때 보이는 한 줄이
 * 첫 화면 제목보다 먼저 읽힌다.
 *
 * 세 가지를 지킨다.
 *
 * **1. 사람 말로 쓴다.** 「명식」「간지」 같은 말은 여기 넣지 않는다.
 * **2. 주소를 통째로 적는다.** 카카오톡은 `/img/hero` 같은 반쪽 주소를 못 읽는다.
 * **3. 없는 값은 아예 안 내보낸다.** 사업자 정보가 비어 있을 때
 *    「[미입력: 서비스 이름]」이 카톡에 뜨면 그게 더 큰 사고다.
 */

import { type BusinessInfo } from './business.ts';

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/** 사업자 정보가 비어 있어도 손님에게 보일 수 있는 이름 */
export const FALLBACK_NAME = '늘봄사주';

export function siteName(info: BusinessInfo): string {
  return (info.serviceName || '').trim() || FALLBACK_NAME;
}

/** 카톡에 뜨는 한 줄. 여기가 우리 간판이다 */
export const HOME_TITLE = '사주·관상·손금을 한 자리에서';

export const HOME_DESCRIPTION =
  '생년월일만 넣으면 사주 여덟 글자와 풀이가 바로 나옵니다. '
  + '얼굴 사진으로 관상까지 재 드립니다. 결제 없이 보실 수 있습니다.';

export interface SocialOptions {
  /** 「늘봄사주」 뒤에 붙는 한 줄 */
  title: string;
  /** 카톡 카드에 작게 깔리는 설명 */
  description: string;
  /** `/products` 처럼 슬래시로 시작하는 주소. 첫 화면은 `/` */
  path?: string;
  /** 카드에 그림을 걸지 — 첫 화면 그림이 있을 때만 참 */
  image?: boolean;
}

/**
 * `<head>` 에 넣을 조각.
 *
 * `<title>` 까지 여기서 만든다. 화면마다 따로 적으면 언젠가 한 곳이 빠지고,
 * 빠진 그 화면이 하필 손님이 링크로 받는 화면이다.
 */
export function renderSocialHead(info: BusinessInfo, o: SocialOptions): string {
  const name = siteName(info);
  // 가운뎃점은 제목 안에서 이미 쓰고 있다. 이름과 한 줄은 줄표로 가른다
  const full = `${name} — ${o.title}`;
  const base = (info.serviceUrl || '').trim().replace(/\/+$/, '');
  const url = base ? `${base}${o.path ?? '/'}` : '';
  const image = o.image && base ? `${base}/img/hero` : '';

  const tag = (property: string, content: string) =>
    content ? `<meta property="${property}" content="${esc(content)}">` : '';

  return [
    `<title>${esc(full)}</title>`,
    `<meta name="description" content="${esc(o.description)}">`,
    tag('og:type', 'website'),
    tag('og:site_name', name),
    tag('og:title', full),
    tag('og:description', o.description),
    tag('og:url', url),
    tag('og:image', image),
    image ? '<meta property="og:image:width" content="816">' : '',
    image ? '<meta property="og:image:height" content="1104">' : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(full)}">`,
    `<meta name="twitter:description" content="${esc(o.description)}">`,
    image ? `<meta name="twitter:image" content="${esc(image)}">` : '',
    url ? `<link rel="canonical" href="${esc(url)}">` : '',
  ].filter(Boolean).join('\n');
}
