/**
 * 손님 자료에서 나온 세 대목을 결제 전에 보여 준다.
 * 글 전체를 흐리면 읽을 수 없어서, 결론을 가르는 짧은 말만 가린다.
 */
export interface MaskedPart { text: string; hidden: boolean }
export interface PreviewSection {
  title: string;
  /** 큰 글씨 쉬운 말. 가린 낱말이 여기에 비치지 않게 고른다 */
  lead?: string;
  parts: MaskedPart[];
  /** 명리 용어 */
  term?: string;
  /** 어느 글자에서 나온 말인지 */
  basis?: string;
}

const CHAPTERS: Record<string, [string, string, string]> = {
  'saju-report': ['타고난 바탕', '지금 흐름', '앞으로의 길'],
  'compat-report': ['맞는 자리', '부딪히는 자리', '함께할 때 살필 점'],
  'crush-compat-report': ['서로 끌리는 자리', '다르게 느끼는 자리', '다가갈 때 살필 점'],
  'reunion-report': ['두 사람의 바탕', '지금의 거리', '다시 닿을 때 살필 점'],
  'parent-child-report': ['부모와 아이의 바탕', '닮은 자리와 다른 자리', '함께할 때 살필 점'],
  'cross-report': ['세 갈래가 같은 말', '엇갈리는 자리', '살펴볼 길'],
  'face-palm-report': ['얼굴과 손이 같은 말', '엇갈리는 자리', '살펴볼 길'],
  'saju-face-report': ['사주와 얼굴이 같은 말', '엇갈리는 자리', '살펴볼 길'],
  'saju-palm-report': ['사주와 손이 같은 말', '엇갈리는 자리', '살펴볼 길'],
  'naming-report': ['아이의 바탕', '채워야 할 기운', '이름에 담을 글자'],
  'naming-plus-report': ['아이의 바탕', '채워야 할 기운', '이름에 담을 글자'],
  'pick-report': ['후보 날의 바탕', '서로 견준 결과', '고를 때 살필 점'],
  'marriage-pick-report': ['두 사람과 날의 바탕', '서로 견준 결과', '고를 때 살필 점'],
  'family-holiday-report': ['함께 볼 가족', '연휴의 흐름', '서로 맞물리는 자리'],
  'charm-report': ['매력이 나오는 자리', '사람들이 먼저 보는 것', '더 살릴 자리'],
  'single-report': ['지금의 바탕', '만남이 드는 때', '움직일 때 살필 점'],
  'marriage-timing-report': ['내 바탕', '혼인 기운이 드는 때', '정할 때 살필 점'],
  'letgo-report': ['지금 마음의 바탕', '가라앉는 흐름', '먼저 놓을 것'],
  'child-report': ['아이의 바탕', '지금 자라는 흐름', '키울 때 살필 점'],
  'child-aptitude-report': ['아이의 바탕', '잘 맞는 길', '고를 때 살필 점'],
  'latelife-report': ['타고난 바탕', '말년에 드는 흐름', '미리 챌 것'],
  'expression-report': ['타고난 재능', '지금 쓰이는 자리', '더 키울 길'],
  'peers-report': ['사람을 끄는 바탕', '지금 드는 인연', '사귈 때 살필 점'],
  'helper-report': ['도움을 받는 바탕', '귀인이 드는 때', '찾아갈 자리'],
  'wealth-report': ['타고난 돈그릇', '지금 도는 재물 흐름', '담을 때 살필 점'],
  'career-report': ['타고난 그릇', '지금 오르는 흐름', '나설 때 살필 점'],
  'learning-report': ['머리와 문서의 바탕', '지금 드는 흐름', '붙일 때 살필 점'],
  'month-report': ['이 달의 바탕', '달 안의 흐름', '이 달 살필 점'],
  'daily-report': ['오늘의 바탕', '오늘의 흐름', '오늘 살필 점'],
  'newyear-report': ['올해의 바탕', '해의 흐름', '올해 살필 점'],
  'exam-report': ['시험에 쓰는 바탕', '합격 기운이 드는 때', '준비할 때 살필 점'],
  'admission-report': ['아이의 바탕', '진학 기운이 드는 때', '고를 때 살필 점'],
  'job-report': ['일에 쓰는 바탕', '취업 기운이 드는 때', '넣을 때 살필 점'],
  'travel-report': ['움직임의 바탕', '나가는 기운이 드는 때', '떠날 때 살필 점'],
};

/*
 * 터진 뒤에 적은 것 (2026-10-05): 대목 이름이 없는 상품은 점사 제목을 24자로
 * 잘라 대목 이름으로 썼다. 그래서 같은 말이 큰 글씨로 두 번 찍혔다.
 * 이름이 없으면 이것을 쓴다.
 */
const 기본대목: [string, string, string] = ['타고난 바탕', '지금 흐름', '앞으로의 길'];

/*
 * 터진 뒤에 적은 것 (2026-10-05): 가릴 낱말을 「가장 먼저 눈에 띄는 한글 덩어리」로
 * 고르니 「손님의」가 가려졌다. 가려야 할 것은 결론을 가르는 말이고,
 * 조사·군더더기는 가려도 손님이 잃는 것이 없다. 가려 봐야 감출 것이 없는 말은
 * 아래 목록에 둔다.
 */
const 가리지않는말 = new Set([
  '손님', '손님의', '손님은', '손님께', '그리고', '하지만', '그래서', '그러나', '또한',
  '자료', '결과', '내용', '리포트', '여기', '거기', '이것', '그것', '지금', '정말',
  '때문', '경우', '모두', '전부', '함께', '다시', '가장', '조금', '많이', '아주',
  /* 터진 뒤에 적은 것 (2026-10-05): 「글자」가 가려졌다. 가려도 감출 것이 없다 */
  '글자', '자리', '기운', '명식', '사주', '것이', '것은', '쪽이', '때는',
  '있습니다', '없습니다', '합니다', '됩니다', '입니다', '드립니다', '보입니다',
]);

/** 글자 수. 한글·한자를 한 글자로 센다 */
const 길이 = (s: string) => [...s].length;

/**
 * 결론을 가르는 낱말 하나를 고른다.
 *
 * ① 날짜·점수·방향·간지처럼 **그 자체가 답인 것**을 먼저 고른다.
 * ② 없으면 마지막 마디(결론이 놓이는 자리)에서 가장 긴 알맹이 낱말을 고른다.
 * ③ 큰 글씨에 이미 적힌 말은 고르지 않는다. 가려도 위에서 다 보이면 가린 것이 아니다.
 */
function 고른다(source: string, 피할말: string): { index: number; length: number } | null {
  const 쓸만한가 = (말: string) => 길이(말) >= 2 && !가리지않는말.has(말)
    && !/니다$/.test(말) && !피할말.includes(말);

  /* ① 그 자체가 답인 것 — 날짜·점수·방향·간지 */
  const 답인것 = [
    /\d{4}년|\d{1,2}월(?:\s*\d{1,2}일)?|\d{1,2}일|\d+(?:\.\d+)?%|\d+(?:\.\d+)?점|\d+개|\d+해/,
    /[가-힣]+(?:쪽|방향)|동쪽|서쪽|남쪽|북쪽/,
    /[갑을병정무기경신임계][자축인묘진사오미신유술해](?:년|월|일)?/,
  ];
  for (const pattern of 답인것) {
    const hit = pattern.exec(source);
    if (hit) return { index: 길이(source.slice(0, hit.index)), length: 길이(hit[0]) };
  }

  /*
   * ② 끝 서술어가 받는 알맹이 — 「…실타래가 풀립니다」의 실타래.
   * 결론은 문장 끝에 오고, 그 앞에 조사를 달고 서 있다. 거기를 가린다.
   */
  const 조사붙은말 = /([가-힣]{2,6})(?=(?:을|를|이|가)[\s,])/g;
  const 모음: Array<{ index: number; length: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = 조사붙은말.exec(source)) !== null) {
    if (쓸만한가(m[1])) 모음.push({ index: 길이(source.slice(0, m.index)), length: 길이(m[1]) });
  }
  if (모음.length > 0) return 모음[모음.length - 1];

  /* ③ 마지막 마디에서 가장 긴 알맹이 */
  const 쉼표 = Math.max(source.lastIndexOf(', '), source.lastIndexOf('며 '), source.lastIndexOf('면 '));
  for (const 시작 of (쉼표 > 0 ? [쉼표, 0] : [0])) {
    const 마디 = source.slice(시작);
    const 후보: Array<{ index: number; length: number }> = [];
    const 낱말 = /[가-힣]{2,}/g;
    let w: RegExpExecArray | null;
    while ((w = 낱말.exec(마디)) !== null) {
      const 자른말 = [...w[0]].slice(0, 6).join('');
      if (!쓸만한가(w[0])) continue;
      후보.push({ index: 길이(source.slice(0, 시작 + w.index)), length: 길이(자른말) });
    }
    if (후보.length > 0) {
      후보.sort((a, b) => (b.length - a.length) || (b.index - a.index));
      return 후보[0];
    }
  }
  return null;
}

/** 표시가 있으면 그 안에서, 없으면 규칙으로 결론 낱말 하나를 가린다. */
export function maskPreviewText(input: string, 피할말 = ''): MaskedPart[] {
  const source = input.replace(/\[\[가림:([\s\S]*?)\]\]/g, '$1').trim();
  if (!source) return [];
  const limit = Math.max(1, Math.floor(길이(source) * 0.3));
  const marked = /\[\[가림:([\s\S]*?)\]\]/.exec(input);
  const markedAt = marked ? 길이(input.slice(0, marked.index).replace(/\[\[가림:([\s\S]*?)\]\]/g, '$1')) : -1;

  let start: number;
  let length: number;
  if (marked) {
    /*
     * 터진 뒤에 적은 것 (2026-10-05): 표시한 자리가 30%를 넘으면 잘라야 하는데,
     * 그냥 자르면 「2027년 남」처럼 낱말이 반 토막 난다. 낱말 경계에서 끊는다.
     */
    start = markedAt;
    const 표시 = marked[1];
    if (길이(표시) <= limit) length = 길이(표시);
    else {
      const 잘린 = [...표시].slice(0, limit).join('');
      const 경계 = 잘린.lastIndexOf(' ');
      length = 길이(경계 > 0 ? 잘린.slice(0, 경계) : 잘린);
    }
  } else {
    const 골랐다 = 고른다(source, 피할말);
    start = 골랐다 ? 골랐다.index : Math.max(0, 길이(source) - Math.min(limit, 2));
    length = Math.min(골랐다 ? 골랐다.length : 2, limit);
  }
  const 글자 = [...source];
  return [
    { text: 글자.slice(0, start).join(''), hidden: false },
    { text: 글자.slice(start, start + length).join(''), hidden: true },
    { text: 글자.slice(start + length).join(''), hidden: false },
  ].filter((part) => part.text);
}

/*
 * 터진 뒤에 적은 것 (2026-10-05): 차례 줄을 문장 틀에 억지로 끼우니
 * 「…적습니다입니다」, 「무난하다입니다」 같은 말이 손님 눈에 나갔다.
 * 사람이 쓴 문장은 룰 엔진이 이미 내놓는다 — 그것을 그대로 쓴다.
 */
function 문장으로(raw: string): string {
  const line = raw.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const score = /^종합 상성 (\d+)점 — (.+)$/.exec(line);
  if (score) return `두 분의 여덟 글자를 맞대어 보니 종합 상성은 ${score[1]}점, ${score[2]}에 해당합니다.`;
  const axis = /^(.+?): (.+?) \((\d+)점\)$/.exec(line);
  if (axis) return `${axis[1]}: ${axis[2]}. 이 자리의 점수는 ${axis[3]}점입니다.`;
  if (/[.!?。]$/.test(line)) return line;
  return `${line}.`;
}

/** 세 대목 모두 실제 계산 결과에 있는 문장을 사용한다. */
export function previewSections(
  productId: string,
  contents: string[],
  points: Array<{ text: string; basis: string; title?: string; term?: string }> = [],
): PreviewSection[] {
  const titles = CHAPTERS[productId] || 기본대목;

  /* 룰 엔진이 내놓은 점사가 있으면 그것이 가장 좋은 글이다 */
  if (points.length >= 3) {
    return points.slice(0, 3).map((point, i) => {
      const lead = (point.title || '').trim();
      const title = titles[i];
      return {
        title,
        lead: lead && lead !== title ? lead : undefined,
        parts: maskPreviewText(문장으로(point.text), `${title} ${lead}`),
        term: point.term || undefined,
        basis: (point.basis || '').trim() || undefined,
      };
    });
  }

  const facts = contents.filter((line) => line && !line.startsWith('[맛보기 점사]'))
    .filter((line) => !/^주의할 점 \d+가지$/.test(line));
  const lines = facts.length >= 3 ? facts : [...facts, ...points.map((point) => point.text)];
  const safe = lines.length ? lines : ['이 상품에서 살필 내용을 계산하고 있습니다.'];
  const picks = [0, Math.floor((safe.length - 1) / 2), safe.length - 1];
  return picks.map((index, i) => {
    const title = titles[i];
    return { title, parts: maskPreviewText(문장으로(safe[index]), title) };
  });
}
