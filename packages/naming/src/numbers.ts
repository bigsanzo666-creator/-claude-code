/**
 * 수리성명학 — 획수로 네 격을 세우고 길흉을 본다.
 *
 * 작명소가 내주는 종이의 절반이 이 계산이다. 이름 석 자의 **획수**만 있으면
 * 네 숫자가 나오고, 그 숫자를 81수 표에 넣어 길한지 흉한지를 본다.
 *
 * ## 감수를 받아야 하는 표다
 *
 * 아래 `EIGHTY_ONE` 은 널리 쓰이는 81수 표를 옮긴 것이다. **손님에게 값을 받고
 * 내보내기 전에 원전과 대조해야 한다.** 유파에 따라 반길(半吉)로 보는 수가
 * 갈리므로 `verdict` 에 `중` 을 따로 두었고, 어느 쪽으로 보았는지 화면에 적는다.
 *
 * 검증에는 실제 작명소가 2024년에 발행한 작명서 한 장을 쓴다. 거기 적힌
 * 네 격(25·16·23·32)과 그 이름이 우리 표와 맞는지 본다 — 표를 옮기다 틀리면
 * 거기서 걸린다.
 *
 * ## 획수는 원획법으로 센다
 *
 * 성명학의 획수는 옥편의 부수 원획을 따른다. 삼수변(氵)은 물 수(水) 넉 획으로,
 * 초두(艹)는 풀 초(艸) 여섯 획으로 센다. **이 파일은 획수를 세지 않는다** —
 * 획수는 한자 표에서 오고, 여기서는 받은 숫자로 격만 세운다.
 */

export type Verdict = '길' | '중' | '흉';

export interface Number81 {
  n: number;
  /** 격 이름. 「안전격」 같은 것 */
  name: string;
  verdict: Verdict;
  /** 그 수를 한 줄로 */
  say: string;
}

/**
 * 81수.
 *
 * `중` 은 유파가 갈리는 수다. 한쪽에서는 길하다 하고 다른 쪽에서는 흉하다 한다.
 * 갈리는 것을 갈린다고 적는 편이 한쪽을 골라 단정하는 것보다 정직하다.
 */
export const EIGHTY_ONE: readonly Number81[] = [
  { n: 1, name: '태초격', verdict: '길', say: '처음 여는 수. 홀로 서서 시작한다' },
  { n: 2, name: '분리격', verdict: '흉', say: '갈라지는 수. 힘이 둘로 쪼개진다' },
  { n: 3, name: '명예격', verdict: '길', say: '이름이 서는 수. 밖으로 드러난다' },
  { n: 4, name: '부정격', verdict: '흉', say: '자리가 흔들리는 수' },
  { n: 5, name: '성공격', verdict: '길', say: '고르게 서는 수. 안팎이 맞는다' },
  { n: 6, name: '계승격', verdict: '길', say: '물려받아 잇는 수' },
  { n: 7, name: '독립격', verdict: '길', say: '제 힘으로 미는 수. 단단하다' },
  { n: 8, name: '개물격', verdict: '길', say: '뚫고 나가는 수. 참고 이룬다' },
  { n: 9, name: '궁박격', verdict: '흉', say: '재주는 있으나 때가 안 맞는 수' },
  { n: 10, name: '공허격', verdict: '흉', say: '비어 있는 수' },
  { n: 11, name: '흥가격', verdict: '길', say: '집을 일으키는 수' },
  { n: 12, name: '박약격', verdict: '흉', say: '뜻은 큰데 힘이 모자라는 수' },
  { n: 13, name: '지모격', verdict: '길', say: '머리로 푸는 수' },
  { n: 14, name: '이산격', verdict: '흉', say: '흩어지는 수' },
  { n: 15, name: '통솔격', verdict: '길', say: '사람을 거느리는 수. 덕이 있다' },
  { n: 16, name: '덕망격', verdict: '길', say: '두터운 덕으로 재물이 따르는 수' },
  { n: 17, name: '건창격', verdict: '길', say: '굽히지 않고 뻗는 수' },
  { n: 18, name: '발전격', verdict: '길', say: '뜻을 세워 이루는 수' },
  { n: 19, name: '고난격', verdict: '흉', say: '재주가 있어도 막히는 수' },
  { n: 20, name: '허망격', verdict: '흉', say: '애써도 남지 않는 수' },
  { n: 21, name: '두령격', verdict: '길', say: '우두머리가 되는 수' },
  { n: 22, name: '중절격', verdict: '흉', say: '가다가 끊기는 수' },
  { n: 23, name: '공명격', verdict: '길', say: '몸을 열어 이름을 얻는 수' },
  { n: 24, name: '입신격', verdict: '길', say: '맨손으로 일구는 수' },
  { n: 25, name: '안전격', verdict: '길', say: '순풍에 나아가는 수. 재물과 복이 든다' },
  { n: 26, name: '영웅격', verdict: '중', say: '크게 흔들리며 크게 이루는 수. 유파가 갈린다' },
  { n: 27, name: '중단격', verdict: '흉', say: '중간에 꺾이는 수' },
  { n: 28, name: '파란격', verdict: '흉', say: '물결이 잦은 수' },
  { n: 29, name: '성공격', verdict: '길', say: '지혜로 넓히는 수' },
  { n: 30, name: '부몽격', verdict: '중', say: '크게 얻거나 크게 잃는 수. 유파가 갈린다' },
  { n: 31, name: '융창격', verdict: '길', say: '자라 오르는 수. 안팎이 함께 선다' },
  { n: 32, name: '요행격', verdict: '길', say: '뜻밖의 복이 드는 수. 기운이 왕성하다' },
  { n: 33, name: '승천격', verdict: '길', say: '올라가는 수. 기세가 세다' },
  { n: 34, name: '변란격', verdict: '흉', say: '뒤집히는 수' },
  { n: 35, name: '평범격', verdict: '길', say: '조용히 이루는 수. 글과 예술에 맞는다' },
  { n: 36, name: '의협격', verdict: '중', say: '남을 위하다 제가 상하는 수. 유파가 갈린다' },
  { n: 37, name: '인덕격', verdict: '길', say: '홀로 서서 덕을 쌓는 수' },
  { n: 38, name: '복덕격', verdict: '중', say: '재주로 이름을 얻는 수. 유파가 갈린다' },
  { n: 39, name: '장성격', verdict: '길', say: '오래 쌓아 크게 되는 수' },
  { n: 40, name: '무상격', verdict: '흉', say: '오르내림이 심한 수' },
  { n: 41, name: '대공격', verdict: '길', say: '크게 이루는 수. 덕과 재주가 함께 간다' },
  { n: 42, name: '고행격', verdict: '흉', say: '넓게 벌이나 깊지 않은 수' },
  { n: 43, name: '산재격', verdict: '흉', say: '모은 것이 새는 수' },
  { n: 44, name: '마장격', verdict: '흉', say: '가로막히는 수' },
  { n: 45, name: '대지격', verdict: '길', say: '큰 뜻이 통하는 수' },
  { n: 46, name: '미운격', verdict: '흉', say: '뜻이 있어도 힘이 안 따르는 수' },
  { n: 47, name: '출세격', verdict: '길', say: '꽃이 피는 수. 복이 두텁다' },
  { n: 48, name: '유덕격', verdict: '길', say: '지혜와 덕으로 남을 돕는 수' },
  { n: 49, name: '변화격', verdict: '흉', say: '길흉이 자주 바뀌는 수' },
  { n: 50, name: '부몽격', verdict: '흉', say: '한 번 이루고 한 번 잃는 수' },
  { n: 51, name: '길흉격', verdict: '흉', say: '먼저 성하고 나중에 쇠하는 수' },
  { n: 52, name: '통달격', verdict: '길', say: '멀리 내다보는 수' },
  { n: 53, name: '내허격', verdict: '흉', say: '겉은 좋으나 속이 빈 수' },
  { n: 54, name: '무공격', verdict: '흉', say: '애써도 공이 없는 수' },
  { n: 55, name: '미달격', verdict: '흉', say: '겉으로는 성하나 속이 무른 수' },
  { n: 56, name: '한탄격', verdict: '흉', say: '뜻을 못 펴는 수' },
  { n: 57, name: '봉시격', verdict: '길', say: '한 번 꺾이고 다시 서는 수' },
  { n: 58, name: '후영격', verdict: '흉', say: '먼저 고생하고 나중에 얻는 수' },
  { n: 59, name: '재화격', verdict: '흉', say: '참을 힘이 모자라는 수' },
  { n: 60, name: '동요격', verdict: '흉', say: '뿌리가 흔들리는 수' },
  { n: 61, name: '영화격', verdict: '길', say: '이름과 재물이 함께 오는 수' },
  { n: 62, name: '고독격', verdict: '흉', say: '안팎이 어긋나는 수' },
  { n: 63, name: '순성격', verdict: '길', say: '순하게 자라는 수' },
  { n: 64, name: '침체격', verdict: '흉', say: '가라앉는 수' },
  { n: 65, name: '휘양격', verdict: '길', say: '오래 가는 수. 집안이 편하다' },
  { n: 66, name: '우매격', verdict: '흉', say: '안팎이 다 어두운 수' },
  { n: 67, name: '천복격', verdict: '길', say: '길이 열리는 수' },
  { n: 68, name: '흥가격', verdict: '길', say: '뜻을 세워 집을 일으키는 수' },
  { n: 69, name: '종말격', verdict: '흉', say: '머무르지 못하는 수' },
  { n: 70, name: '적막격', verdict: '흉', say: '비고 쓸쓸한 수' },
  { n: 71, name: '만달격', verdict: '흉', say: '뜻은 있으나 늦는 수' },
  { n: 72, name: '상반격', verdict: '흉', say: '길과 흉이 반씩인 수' },
  { n: 73, name: '평길격', verdict: '흉', say: '뜻만 크고 손에 남지 않는 수' },
  { n: 74, name: '우매격', verdict: '흉', say: '쓸 데를 못 찾는 수' },
  { n: 75, name: '정수격', verdict: '흉', say: '지키면 되고 나서면 안 되는 수' },
  { n: 76, name: '이산격', verdict: '흉', say: '안이 무너지는 수' },
  { n: 77, name: '전후격', verdict: '흉', say: '반은 길하고 반은 흉한 수' },
  { n: 78, name: '선길격', verdict: '흉', say: '먼저 길하고 나중에 흉한 수' },
  { n: 79, name: '종극격', verdict: '흉', say: '끝에 이르러 힘이 다한 수' },
  { n: 80, name: '종결격', verdict: '흉', say: '거두어들이는 수' },
  { n: 81, name: '환원격', verdict: '길', say: '하나로 돌아가는 수. 다시 시작한다' },
] as const;

const BY_N = new Map(EIGHTY_ONE.map((x) => [x.n, x]));

/**
 * 81을 넘는 수는 81을 빼서 다시 본다.
 *
 * 획수 합이 81을 넘으면 82는 1, 83은 2로 돌아간다. 81수가 한 바퀴이기 때문이다.
 */
export function number81(total: number): Number81 {
  if (!Number.isInteger(total) || total < 1) throw new Error(`획수가 올바르지 않습니다: ${total}`);
  let n = total;
  while (n > 81) n -= 81;
  return BY_N.get(n)!;
}

export interface FourFrames {
  /** 원격(元格) — 이름 글자끼리. 어린 시절과 바탕으로 본다 */
  won: number;
  /** 형격(亨格) — 성 + 이름 첫 글자. 한창때와 사람됨으로 본다 */
  hyeong: number;
  /** 이격(利格) — 성 + 이름 끝 글자. 바깥에서 얻는 것으로 본다 */
  i: number;
  /** 정격(貞格) — 전부. 한 평생을 아우르는 것으로 본다 */
  jeong: number;
}

export interface FrameRead extends FourFrames {
  wonN: Number81;
  hyeongN: Number81;
  iN: Number81;
  jeongN: Number81;
  /** 네 격이 다 길한가 */
  allGood: boolean;
  /** 홀짝이 섞였는가. 다 홀수거나 다 짝수면 안 좋게 본다 */
  yinYangMixed: boolean;
}

/**
 * 네 격을 세운다.
 *
 * 이름이 한 글자면 없는 자리에 **가성수(假成數) 1**을 넣는다. 자리를 비워 두면
 * 격이 서지 않기 때문인데, 이것도 유파가 갈리는 자리라 화면에 적는다.
 *
 * @param surname 성의 획수. 두 자 성(남궁·선우)이면 두 개
 * @param given   이름의 획수. 한 자면 하나, 두 자면 둘
 */
export function fourFrames(surname: number[], given: number[]): FourFrames {
  if (!surname.length) throw new Error('성의 획수가 필요합니다.');
  if (!given.length) throw new Error('이름의 획수가 필요합니다.');
  const s = surname.reduce((a, b) => a + b, 0);
  // 이름이 한 자면 가성수 1을 붙여 자리를 채운다
  const g = given.length === 1 ? [...given, 1] : given;
  return {
    won: g.reduce((a, b) => a + b, 0),
    hyeong: s + g[0],
    i: s + g[g.length - 1],
    jeong: s + given.reduce((a, b) => a + b, 0),
  };
}

/** 네 격을 세우고 길흉까지 붙인다 */
export function readFrames(surname: number[], given: number[]): FrameRead {
  const f = fourFrames(surname, given);
  const all = [...surname, ...given];
  const odd = all.filter((n) => n % 2 === 1).length;
  return {
    ...f,
    wonN: number81(f.won),
    hyeongN: number81(f.hyeong),
    iN: number81(f.i),
    jeongN: number81(f.jeong),
    allGood: [f.won, f.hyeong, f.i, f.jeong].every((n) => number81(n).verdict === '길'),
    // 다 홀수(양)거나 다 짝수(음)면 치우친 것으로 본다
    yinYangMixed: odd > 0 && odd < all.length,
  };
}

/**
 * 성과 끝 글자가 정해졌을 때, **가운데 글자의 획수 후보**를 찾는다.
 *
 * 돌림자를 쓰는 집이 많다. 형이 「준희」면 동생도 「○희」로 가고 싶어 하는데,
 * 그러면 성과 끝 글자가 이미 고정이라 고를 수 있는 것은 가운데 획수뿐이다.
 * 그 획수를 먼저 좁혀 두면 한자를 훨씬 적게 뒤져도 된다.
 */
export function middleStrokeCandidates(
  surname: number[], lastStroke: number, max = 30,
): { stroke: number; frames: FrameRead }[] {
  const out: { stroke: number; frames: FrameRead }[] = [];
  for (let stroke = 1; stroke <= max; stroke++) {
    const frames = readFrames(surname, [stroke, lastStroke]);
    if (frames.allGood) out.push({ stroke, frames });
  }
  return out;
}
