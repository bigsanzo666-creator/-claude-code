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
import { SPIRITS } from '../../../packages/site-policy/src/spirits.ts';

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
  '마음정리': 'letgo-report',
  '얼굴과손': 'face-palm-report',
  '사주손금': 'saju-palm-report',
  '사주관상': 'saju-face-report',
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

/** 첫 화면 그림의 파일 이름. 상품 아이디가 아니므로 목록에서는 걸러진다 */
export const HERO_NAME = 'site-hero';

/** 첫 화면 영상의 파일 이름 */
export const HERO_VIDEO_NAME = 'hero';

const VIDEO_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

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
      .filter((n) => !(n.slice(0, -extname(n).length) === HERO_VIDEO_NAME && VIDEO_TYPES[extname(n).toLowerCase()]))
      .filter((n) => n.slice(0, -extname(n).length) !== HERO_NAME)
      .filter((n) => !toProductId(n.slice(0, -extname(n).length)));
  } catch {
    return [];
  }
}

/**
 * 첫 화면에 깔 그림.
 *
 * 상품이 아니므로 카탈로그에 없다. 이름을 `site-hero` 로 고정해 두고 그 파일만
 * 찾는다 — 상품 그림과 같은 폴더를 쓰되 섞이지는 않는다.
 *
 * **없으면 없는 대로 둔다.** 화면은 종이색 바탕으로 뜬다.
 */
export function findHeroImage(dir: string = IMAGE_DIR): ProductImage | null {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return null; }
  for (const name of entries) {
    const ext = extname(name).toLowerCase();
    const type = TYPES[ext];
    if (type && name.slice(0, -ext.length) === HERO_NAME) return { path: join(dir, name), type };
  }
  return null;
}

/**
 * 첫 화면에 트는 영상.
 *
 * 그림과 마찬가지로 **없으면 없는 대로 둔다.** 영상이 없으면 산 그림이 그대로
 * 남고, 화면은 아무것도 달라지지 않는다.
 *
 * 영상은 첫 화면을 늦추면 안 된다. 그래서 서버는 파일을 알려 주기만 하고,
 * 언제 받을지는 화면이 정한다 — 그림이 먼저 뜬 뒤에 뒤에서 받는다.
 */
export function findHeroVideo(dir: string = IMAGE_DIR): ProductImage | null {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return null; }
  for (const name of entries) {
    const ext = extname(name).toLowerCase();
    const type = VIDEO_TYPES[ext];
    if (type && name.slice(0, -ext.length) === HERO_VIDEO_NAME) return { path: join(dir, name), type };
  }
  return null;
}

/**
 * 신령 얼굴 그림.
 *
 * 상품 그림과 폴더를 따로 쓴다 — 신령은 파는 물건이 아니라 파는 사람이고,
 * 상품 폴더에 섞이면 「이름이 틀린 파일」로 잡힌다.
 *
 * 파일 이름은 신령의 영문 아이디다: `flower.jpg`, `mountain.png` …
 * **없으면 없는 대로 둔다.** 그림이 없는 신령은 화면에서 한자 도장으로 나온다.
 */
export const SPIRIT_DIR = join(
  dirname(fileURLToPath(import.meta.url)), '..', 'public', 'spirits',
);

/** 신령 아이디로 이름을 받는다. 한글 이름으로 저장해도 알아듣는다 */
const SPIRIT_BY_NAME = new Map<string, string>(
  SPIRITS.flatMap((s) => [
    [squash(s.id), s.id],
    [squash(s.name), s.id],
    // 이름을 바꿔도 이미 올려 둔 그림은 옛 이름이다. 그것까지 알아듣는다
    ...(s.aka ?? []).map((a) => [squash(a), s.id]),
  ] as [string, string][]),
);

export function findSpiritImages(dir: string = SPIRIT_DIR): Map<string, ProductImage> {
  const found = new Map<string, ProductImage>();
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return found; }
  for (const name of entries) {
    const ext = extname(name).toLowerCase();
    const type = TYPES[ext];
    if (!type) continue;
    const id = SPIRIT_BY_NAME.get(squash(name.slice(0, -ext.length)));
    if (!id || found.has(id)) continue;
    found.set(id, { path: join(dir, name), type });
  }
  return found;
}

/** 신령 폴더에 있는데 이름을 못 알아들은 파일 — 기동 로그로 알려준다 */
export function straySpiritImages(dir: string = SPIRIT_DIR): string[] {
  try {
    return readdirSync(dir)
      .filter((n) => TYPES[extname(n).toLowerCase()])
      .filter((n) => !SPIRIT_BY_NAME.has(squash(n.slice(0, -extname(n).length))));
  } catch {
    return [];
  }
}

export const ALL_SPIRIT_IDS = SPIRITS.map((s) => s.id);

/**
 * 신령계 배경 그림.
 *
 * 신령 얼굴과 또 다른 폴더를 쓴다. 얼굴은 사람이고 이것은 장소다 —
 * 한 폴더에 섞으면 「이름이 틀린 파일」로 잡힌다.
 *
 * 문 하나(`gate`), 전체 풍경 하나(`world`), 그리고 신령마다 자기 터.
 * **없으면 없는 대로 둔다.** 배경이 없는 자리는 종이색으로 남는다.
 */
export const SCENE_DIR = join(
  dirname(fileURLToPath(import.meta.url)), '..', 'public', 'scene',
);

/** 장소 아이디와 한글 이름. 한글로 저장해도 영어로 저장해도 알아듣는다 */
export const SCENES: Record<string, string> = {
  gate: '문',
  world: '신령계',
  path: '산길',
  ...Object.fromEntries(SPIRITS.map((s) => [s.id, s.place])),
};

/**
 * 한 장소를 여러 이름으로 부를 수 있다.
 *
 * 사장님이 파일을 어떤 이름으로 저장하실지 프로그램이 정할 일이 아니다.
 * 뜻이 같으면 다 알아듣는다.
 */
const SCENE_ALIASES: Record<string, string[]> = {
  world: ['신령계장소', '신령계지도', '신령계배경'],
  path: ['길', '산길배경'],
  gate: ['대문', '돌문'],
};

const SCENE_BY_NAME = new Map<string, string>(
  Object.entries(SCENES).flatMap(([id, korean]) =>
    [
      [squash(id), id],
      [squash(korean), id],
      ...(SCENE_ALIASES[id] ?? []).map((a) => [squash(a), id]),
    ] as [string, string][]),
);

export function findSceneImages(dir: string = SCENE_DIR): Map<string, ProductImage> {
  const found = new Map<string, ProductImage>();
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return found; }
  for (const name of entries) {
    const ext = extname(name).toLowerCase();
    const type = TYPES[ext];
    if (!type) continue;
    const id = SCENE_BY_NAME.get(squash(name.slice(0, -ext.length)));
    if (!id || found.has(id)) continue;
    found.set(id, { path: join(dir, name), type });
  }
  return found;
}

/** 장소 폴더에 있는데 이름을 못 알아들은 파일 — 기동 로그로 알려준다 */
export function straySceneImages(dir: string = SCENE_DIR): string[] {
  try {
    return readdirSync(dir)
      .filter((n) => TYPES[extname(n).toLowerCase()])
      .filter((n) => !SCENE_BY_NAME.has(squash(n.slice(0, -extname(n).length))));
  } catch {
    return [];
  }
}

export const ALL_SCENE_IDS = Object.keys(SCENES);

/**
 * 문이 열리는 영상.
 *
 * 손님이 이름을 밝힌 **뒤에** 튼다. 이미 행동한 다음이라 몇 초 기다려도
 * 답답하지 않다 — 오히려 문이 열리는 것이 상처럼 느껴진다.
 *
 * 그래서 첫 화면을 늦추지 않는다. 손님이 이름을 치는 동안 뒤에서 미리 받아
 * 두면 기다림이 0이 된다.
 *
 * **없으면 없는 대로 둔다.** 영상이 없으면 지금처럼 바로 결과로 내려간다.
 */
export const GATE_VIDEO_NAMES = ['gate-open', '문열림'];

/** 풍신령이 손을 잡고 문까지 데려가는 장면 */
export const WALK_VIDEO_NAMES = ['walk', '문으로'];

/**
 * 같은 장면을 mp4 와 webm 두 벌로 찾는다.
 *
 * 브라우저마다 알아듣는 영상이 다르다. mp4(H.264) 를 못 여는 브라우저가
 * 아직 있고, 그런 손님에게는 **영상이 없는 것과 똑같이 보인다** —
 * 그림 한 장이 가만히 있는 화면. 두 벌을 다 걸어 두면 브라우저가
 * 제가 아는 쪽을 골라 튼다. 받는 것은 고른 한 벌뿐이다.
 */
function findVideo(dir: string, names: string[], ext = '.mp4'): ProductImage | null {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return null; }
  const want = names.map(squash);
  const type = VIDEO_TYPES[ext];
  if (!type) return null;
  for (const name of entries) {
    const got = extname(name).toLowerCase();
    if (got !== ext) continue;
    if (want.includes(squash(name.slice(0, -got.length)))) {
      return { path: join(dir, name), type };
    }
  }
  return null;
}

export function findWalkVideo(dir: string = SCENE_DIR): ProductImage | null {
  return findVideo(dir, WALK_VIDEO_NAMES);
}

export function findWalkWebm(dir: string = SCENE_DIR): ProductImage | null {
  return findVideo(dir, WALK_VIDEO_NAMES, '.webm');
}

export function findGateVideo(dir: string = SCENE_DIR): ProductImage | null {
  return findVideo(dir, GATE_VIDEO_NAMES);
}

export function findGateWebm(dir: string = SCENE_DIR): ProductImage | null {
  return findVideo(dir, GATE_VIDEO_NAMES, '.webm');
}

export const ALL_PRODUCT_IDS = Object.keys(CATALOG) as ProductId[];
