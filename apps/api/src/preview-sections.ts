/**
 * 손님 자료에서 나온 세 대목을 결제 전에 보여 준다.
 * 글 전체를 흐리면 읽을 수 없어서, 결론을 가르는 짧은 말만 가린다.
 */
export interface MaskedPart { text: string; hidden: boolean }
export interface PreviewSection { title: string; parts: MaskedPart[] }

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
};

/** 표시가 있으면 그 안에서, 없으면 날짜·숫자·방향·간지·할 일에서 한 말을 고른다. */
export function maskPreviewText(input: string): MaskedPart[] {
  const source = input.replace(/\[\[가림:([\s\S]*?)\]\]/g, '$1').trim();
  if (!source) return [];
  const limit = Math.max(1, Math.floor([...source].length * 0.3));
  const marked = /\[\[가림:([\s\S]*?)\]\]/.exec(input);
  const markedAt = marked ? input.slice(0, marked.index).replace(/\[\[가림:([\s\S]*?)\]\]/g, '$1').length : -1;
  const search = marked?.[1] || source;
  const choices = [
    /\d{4}년|\d{1,2}월(?:\s*\d{1,2}일)?|\d{1,2}일|\d+(?:\.\d+)?%|\d+(?:\.\d+)?점|\d+개|\d+해/,
    /[가-힣]+(?:쪽|방향)|동쪽|서쪽|남쪽|북쪽/,
    /[갑을병정무기경신임계][자축인묘진사오미신유술해](?:년|월|일)?/,
    /[가-힣]{2,8}(?=하(?:십시오|시면))/,
    /[가-힣]{2,8}|[A-Za-z]{2,12}/,
  ];
  let hit: RegExpExecArray | null = null;
  for (const pattern of choices) {
    hit = pattern.exec(search);
    if (hit) break;
  }
  const offset = marked ? markedAt : 0;
  const start = hit ? offset + hit.index : Math.max(0, source.length - Math.min(limit, 2));
  const length = Math.min(hit?.[0].length || 2, limit);
  return [
    { text: source.slice(0, start), hidden: false },
    { text: source.slice(start, start + length), hidden: true },
    { text: source.slice(start + length), hidden: false },
  ].filter((part) => part.text);
}

/** 세 대목 모두 실제 계산 결과에 있는 문장을 사용한다. */
export function previewSections(productId: string, contents: string[], points: Array<{ text: string; basis: string }> = []): PreviewSection[] {
  const facts = contents.filter((line) => line && !line.startsWith('[맛보기 점사]'))
    .filter((line) => !/^주의할 점 \d+가지$/.test(line));
  const lines = facts.length >= 3 ? facts : [
    ...facts,
    ...points.map((point) => `${point.text} 근거: ${point.basis}`),
  ];
  const safe = lines.length ? lines : ['이 상품에서 살필 내용을 계산하고 있습니다.'];
  const picks = [0, Math.floor((safe.length - 1) / 2), safe.length - 1];
  const titles = CHAPTERS[productId] || [
    safe[picks[0]].split(/[—:]/)[0].slice(0, 24),
    safe[picks[1]].split(/[—:]/)[0].slice(0, 24),
    safe[picks[2]].split(/[—:]/)[0].slice(0, 24),
  ];
  function prose(raw: string): string {
    const line = raw.replace(/\*\*/g, '').trim();
    const score = /^종합 상성 (\d+)점 — (.+)$/.exec(line);
    if (score) return `두 분의 여덟 글자를 맞대어 보니, 종합 상성은 ${score[1]}점이며 ${score[2]}에 해당합니다.`;
    const axis = /^(.+?): (.+?) \((\d+)점\)$/.exec(line);
    if (axis) return `${axis[1]} 자리를 살펴보니 ${axis[2]}입니다. 이 자리의 점수는 ${axis[3]}점입니다.`;
    if (/[.!?。]$/.test(line)) return line;
    return `손님의 자료에서 나온 결과를 살펴보니 ${line}입니다.`;
  }
  return picks.map((index, i) => ({
    title: titles[i],
    parts: maskPreviewText(prose(safe[index])),
  }));
}
