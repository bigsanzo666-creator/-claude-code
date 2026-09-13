/**
 * robots.txt 와 sitemap.xml.
 *
 * 검색엔진에 주소를 등록해도 **무엇을 긁어야 하는지 알려 주지 않으면** 수집이
 * 한참 걸린다. 우리는 값을 받지 않는 무료 판(택일·만세력)으로 손님을 데려오는
 * 장사라 검색 유입이 곧 매출이다. 그래서 이 두 파일이 사치가 아니다.
 *
 * ## 무엇을 넣지 않는가
 *
 * 주문·리포트처럼 사람마다 다른 주소는 넣지 않는다. 남의 주문서가 검색에
 * 걸리면 안 되기 때문이다. 넣는 것은 **누가 봐도 같은 화면**뿐이다.
 */

import { type BusinessInfo } from './business.ts';
import { CATALOG } from '../../commerce/src/catalog.ts';

function base(info: BusinessInfo): string {
  return (info.serviceUrl || '').trim().replace(/\/+$/, '');
}

/** 어느 것을 얼마나 자주 다시 보러 오라고 할지 */
const PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  // 택일은 아무도 자동으로 안 해 주는 자리다. 여기로 들어온 손님이 나머지를 본다
  { path: '/pick', changefreq: 'weekly', priority: '0.9' },
  { path: '/products', changefreq: 'weekly', priority: '0.8' },
  { path: '/terms', changefreq: 'yearly', priority: '0.2' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.2' },
  { path: '/refund', changefreq: 'yearly', priority: '0.2' },
];

export function renderRobots(info: BusinessInfo): string {
  const root = base(info);
  const lines = [
    'User-agent: *',
    'Allow: /',
    // 주문과 리포트는 사람마다 다르다. 긁어 가면 안 된다
    'Disallow: /api/',
    '',
  ];
  if (root) lines.push(`Sitemap: ${root}/sitemap.xml`, '');
  return lines.join('\n');
}

export function renderSitemap(info: BusinessInfo): string {
  const root = base(info);
  const today = new Date().toISOString().slice(0, 10);
  // 상품마다 낱개 페이지가 있다. 사람들은 「사주」가 아니라 「재물운 사주」로 찾는다
  const products = Object.values(CATALOG).map((p) => ({
    path: `/products/${encodeURIComponent(p.id)}`, changefreq: 'monthly', priority: '0.6',
  }));
  const all = [...PAGES, ...products];
  const urls = all.map(({ path, changefreq, priority }) => `  <url>
    <loc>${root}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
