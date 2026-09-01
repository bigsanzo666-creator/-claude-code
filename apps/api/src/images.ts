/**
 * 상품 그림 찾기.
 *
 * `apps/api/public/products/` 에 상품 아이디로 저장된 그림을 기동할 때 한 번
 * 훑는다. 그림은 배포 때만 바뀌므로 요청마다 디스크를 뒤질 이유가 없다.
 *
 * **없는 그림은 없는 대로 둔다.** 21장을 다 기다리지 않고 나온 것부터 붙일 수
 * 있어야 하고, 빠진 자리에 빈 네모가 남으면 안 그리느니만 못하다.
 *
 * 확장자를 URL에 넣지 않는 이유: 그록이 jpg를 줄지 png를 줄지 webp를 줄지
 * 모른다. 주소는 `/img/products/<상품아이디>` 하나로 두고 실제 파일이
 * 무엇인지는 여기서만 안다.
 */

import { readdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG, type ProductId } from '../../../packages/commerce/src/index.ts';

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

export interface ProductImage {
  /** 디스크상의 절대 경로 */
  path: string;
  /** Content-Type 헤더에 그대로 넣는 값 */
  type: string;
}

/**
 * 한글 파일 이름.
 *
 * 한국 사람이 한국에서 한국 손님에게 팔 물건이다. 영어 아이디로 파일 이름을
 * 맞추라는 건 프로그램 사정을 사람에게 떠넘기는 것이다. 그래서 프로그램이
 * 한글을 알아듣는다.
 *
 * 아이디로 저장해도 되고, 카탈로그의 상품 이름 그대로 저장해도 되고,
 * 아래 짧은 이름으로 저장해도 된다. 셋 다 같은 자리에 붙는다.
 */
const KOREAN_NAMES: Record<string, string> = {
  '매력': 'charm-report',
  '솔로탈출': 'single-report',
  '결혼시기': 'marriage-timing-report',
  '재회': 'reunion-report',
  '궁합': 'compat-report',
  '썸궁합': 'crush-compat-report',
  '우리아이': 'child-report',
  '자녀진로': 'child-aptitude-report',
  '부모자식': 'parent-child-report',
  '노후': 'latelife-report',
  '사주종합': 'saju-report',
  '삼합': 'cross-report',
  '재능운': 'expression-report',
  '사람운': 'peers-report',
  '귀인운': 'helper-report',
  '돈그릇': 'wealth-report',
  '출세운': 'career-report',
  '공부운': 'learning-report',
  '오늘운세': 'daily-report',
  '신년운세': 'newyear-report',
  '이동운': 'travel-report',
};

/** 띄어쓰기·밑줄·유니코드 조합 차이를 지운다 — 「돈 그릇」도 「돈그릇」으로 본다 */
const squash = (s: string) => s.normalize('NFC').replace(/[\s_-]+/g, '');

/** 파일 이름 하나를 상품 아이디로 옮긴다. 못 알아들으면 빈 문자열 */
export function toProductId(fileBase: string): string {
  if (fileBase in CATALOG) return fileBase;

  const key = squash(fileBase);
  for (const [korean, id] of Object.entries(KOREAN_NAMES)) {
    if (squash(korean) === key) return id;
  }
  // 카탈로그에 적힌 상품 이름 그대로 저장한 경우
  for (const [id, product] of Object.entries(CATALOG)) {
    if (squash((product as { name: string }).name) === key) return id;
  }
  return '';
}

export const IMAGE_DIR = join(
  dirname(fileURLToPath(import.meta.url)), '..', 'public', 'products',
);

/**
 * 폴더를 훑어 **카탈로그에 있는 상품의** 그림만 골라 담는다.
 *
 * 카탈로그와 대조하는 것이 곧 보안이다. 요청으로 들어온 문자열이 아니라
 * 우리가 아는 상품 아이디로만 표를 만들기 때문에, 어떤 요청이 와도
 * 이 표 밖의 파일은 나갈 수 없다 — 경로 조작이 성립하지 않는다.
 */
export function findProductImages(dir: string = IMAGE_DIR): Map<string, ProductImage> {
  const found = new Map<string, ProductImage>();
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found; // 폴더가 아직 없다 — 그림 없이 간다
  }
  for (const name of entries) {
    const ext = extname(name).toLowerCase();
    const type = TYPES[ext];
    if (!type) continue;
    const id = toProductId(name.slice(0, -ext.length));
    if (!id) continue;           // 이름을 못 알아들은 파일은 조용히 무시한다
    if (found.has(id)) continue; // 같은 상품에 둘이면 먼저 것을 쓴다
    found.set(id, { path: join(dir, name), type });
  }
  return found;
}

/** 카탈로그에 없는 이름으로 저장된 파일 — 사장님이 오타 냈을 때 기동 로그로 알려준다 */
export function strayImages(dir: string = IMAGE_DIR): string[] {
  try {
    return readdirSync(dir)
      .filter((n) => TYPES[extname(n).toLowerCase()])
      .filter((n) => !toProductId(n.slice(0, -extname(n).length)));
  } catch {
    return [];
  }
}

export const ALL_PRODUCT_IDS = Object.keys(CATALOG) as ProductId[];
