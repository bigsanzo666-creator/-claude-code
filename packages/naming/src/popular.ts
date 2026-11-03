/**
 * 요즘 많이 쓰는 이름.
 *
 * ## 왜 이게 있어야 하는가
 *
 * 「안 겹치게」 상품을 149,000원에 팔면서 **요즘 인기 이름 자료가 한 줄도
 * 없었다.** 상세페이지에는 「요즘 많이 쓰는 이름과 겹치는지 따로 알려
 * 드립니다」라고 적혀 있었다. 못 주는 것을 팔고 있었던 것이다.
 *
 * ## 무엇을 근거로 하는가
 *
 * 대법원 전자가족관계등록시스템이 내는 **전국 출생신고 이름 통계**다.
 * 대법원 화면은 조회 기간에 제한이 있어 해마다 정리해 공개하는 자료를
 * 옮겨 왔고, **어디서 언제 가져왔는지를 자료 파일에 적어 두었다.**
 *
 * 우리가 쓰는 것은 **순위**다. 건수는 집계 시점에 따라 조금씩 갈리지만
 * 순위는 자료들 사이에 크게 다르지 않다.
 *
 * ## 지어내지 않는다
 *
 * 온전한 해만 넣는다. 반쪽짜리 목록을 넣으면 **50위인 이름을 「순위에
 * 없다」고 말하게 된다.** 그건 손님에게 거짓을 주는 것이다.
 *
 * 그리고 이 자료는 **부르는 이름(한글)** 기준이다. 한자까지 같은지는
 * 이 자료로 알 수 없고, 그래서 그렇게 말하지 않는다.
 */

import { readFileSync } from 'node:fs';

interface Entry { rank: number; name: string; count: number }
interface Book {
  출처: string;
  출처설명: string;
  받은날: string;
  해: Record<string, { 남: Entry[]; 여: Entry[] }>;
}

const BOOK: Book = JSON.parse(
  readFileSync(new URL('../data/popular.json', import.meta.url), 'utf8'),
);

export type NameGender = '남' | '여';

/** 얼마나 흔한가. 순위 구간으로만 가른다 — 지어낸 눈금이 아니다 */
export type Commonness = '아주 흔합니다' | '흔합니다' | '더러 있습니다' | '순위에 없습니다';

function bandOf(rank: number | null): Commonness {
  if (rank === null) return '순위에 없습니다';
  if (rank <= 20) return '아주 흔합니다';
  if (rank <= 50) return '흔합니다';
  return '더러 있습니다';
}

export interface Popularity {
  name: string;
  gender: NameGender;
  /** 해마다의 순위. 그 해 100위 안에 없으면 null */
  byYear: { year: string; rank: number | null; count: number | null }[];
  /** 살펴본 해 가운데 제일 높이 오른 순위 */
  bestRank: number | null;
  band: Commonness;
  /** 손님에게 그대로 나갈 한 줄 */
  say: string;
}

/**
 * 이 이름이 요즘 얼마나 쓰이는가.
 *
 * 없다고 「좋은 이름」이라고 말하지 않는다. **흔한지 아닌지**만 말한다.
 * 흔한 것이 나쁜 것도 아니다 — 부모가 정할 일이다.
 */
export function popularityOf(name: string, gender: NameGender): Popularity {
  const key = name.replace(/\s+/g, '');
  const years = Object.keys(BOOK.해).sort();
  const byYear = years.map((year) => {
    const hit = BOOK.해[year][gender].find((e) => e.name === key);
    return { year, rank: hit ? hit.rank : null, count: hit ? hit.count : null };
  });
  const ranks = byYear.map((y) => y.rank).filter((r): r is number => r !== null);
  const bestRank = ranks.length ? Math.min(...ranks) : null;
  const band = bandOf(bestRank);

  const shown = byYear.filter((y) => y.rank !== null)
    .map((y) => `${y.year}년 ${y.rank}위`).join(', ');
  /* 말은 손으로 적는다. 글자를 잘라 붙이면 「더러 있은 편입니다」가 나간다 */
  const TAIL: Record<Commonness, string> = {
    '아주 흔합니다': '요즘 이름 가운데 아주 흔한 축입니다. 반에 같은 이름이 있을 수 있습니다.',
    '흔합니다': '요즘 이름 가운데 흔한 편입니다.',
    '더러 있습니다': '아주 흔하지는 않지만 더러 보이는 이름입니다.',
    '순위에 없습니다': '',
  };
  const say = bestRank === null
    ? `${key} — 살펴본 해(${years.join('·')})의 출생신고 100위 안에 들지 않았습니다.`
    : `${key} — ${shown}. ${TAIL[band]}`;

  return { name: key, gender, byYear, bestRank, band, say };
}

/** 어느 자료를, 언제 받은 것인지. 화면에 그대로 밝힌다 */
export function popularitySource(): { 출처: string; 설명: string; 받은날: string; 해: string[] } {
  return {
    출처: BOOK.출처,
    설명: BOOK.출처설명,
    받은날: BOOK.받은날,
    해: Object.keys(BOOK.해).sort(),
  };
}

/** 그 해 그 성별의 100위 목록. 「이런 이름들이 흔합니다」로 보여 줄 때 쓴다 */
export function popularList(year: string, gender: NameGender): Entry[] {
  return BOOK.해[year]?.[gender] ?? [];
}

/** 자료에 몇 해치가 들어 있는가. 비어 있으면 상품이 그 약속을 하면 안 된다 */
export function popularYears(): string[] {
  return Object.keys(BOOK.해).sort();
}
