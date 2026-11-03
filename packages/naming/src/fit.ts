/**
 * 이름에 쓸 만한 글자인가.
 *
 * 획수와 오행만 보면 「金枯燁」 같은 이름이 나온다. 획수는 맞고 오행도 맞지만
 * 枯 는 「마르다·시들다」다. 기계는 획수를 세지 뜻을 읽지 않는다.
 *
 * 그래서 뜻으로 한 번 더 거른다. 우리 한자표는 글자마다 영어 뜻을 갖고 있어
 * (유니코드가 주는 값이다) 거기서 낱말을 본다.
 *
 * ## 이 방법의 한계를 먼저 적는다
 *
 * 낱말로 거르는 것이라 완벽하지 않다. 「淚 tears」는 걸리지만 뜻이 미묘하게
 * 나쁜 글자는 새어 나온다. 그래서 이것은 **마지막 판정이 아니라 초벌**이다.
 * 최종으로 다섯을 고르는 것은 글을 쓰는 쪽이고, 거기서 한 번 더 걸린다.
 *
 * 반대로 좋은 뜻을 앞세우는 것도 같은 방식이다. 밝다·아름답다·어질다 같은
 * 낱말이 들어 있으면 앞으로 당긴다.
 *
 * ## 낱말은 낱말째로 맞춘다
 *
 * 글자 안쪽까지 맞추면 「eastward」가 「war」에 걸려 東이 못 쓰는 글자가 된다.
 * 그래서 **낱말이 시작하는 자리에서만** 맞춘다. 세 글자 이하인 낱말은 아예
 * 통째로 같아야 한다 — 「rat」이 「rather」에, 「beg」가 「begin」에 걸리기
 * 때문이다.
 */

/** 이름에 쓰면 안 되는 뜻 */
const BAD = [
  // 죽음과 병
  'death', 'dead', 'die', 'dying', 'corpse', 'tomb', 'grave', 'funeral', 'mourn',
  'bury', 'coffin', 'disease', 'sick', 'illness', 'plague', 'ulcer', 'tumor',
  'swelling', 'scab', 'wart', 'leprosy', 'paralysis', 'blind', 'deaf', 'dumb',
  'lame', 'cripple', 'deform', 'dwarf', 'insane', 'mad', 'idiot', 'sickness',
  // 재앙
  'disaster', 'calamity', 'catastrophe', 'ruin', 'destroy', 'collapse', 'perish',
  'famine', 'drought', 'flood', 'plunder', 'oppress',
  // 나쁜 마음
  'evil', 'wicked', 'cruel', 'hate', 'hatred', 'anger', 'rage', 'resent',
  'sorrow', 'grief', 'sad', 'sadness', 'weep', 'cry', 'lament', 'tear',
  'fear', 'dread', 'terror',
  'anxious', 'worry', 'regret', 'shame', 'humiliat', 'jealous', 'greed',
  'arrogant', 'lazy', 'idle', 'stupid', 'foolish', 'deceit', 'deceive', 'false',
  'lie', 'cheat', 'betray', 'slander', 'quarrel', 'dispute', 'curse',
  // 싸움
  'kill', 'murder', 'slay', 'war', 'warfare', 'battle', 'weapon', 'sword',
  'arrow', 'spear', 'wound', 'injure', 'stab', 'whip', 'torture', 'punish',
  'prison', 'exile', 'slave', 'thief', 'steal', 'rob', 'robber', 'bandit',
  // 가난과 더러움
  'poor', 'poverty', 'beg', 'beggar', 'debt', 'filthy', 'dirty', 'impure', 'pollut',
  'stink', 'rotten', 'decay', 'mold', 'dung', 'urine', 'vomit', 'mud', 'dust',
  'waste', 'garbage', 'ugly',
  // 시들고 스러지는 것
  'wither', 'dried out', 'barren', 'empty', 'hollow', 'vain', 'lose', 'defeat',
  'fail', 'fall', 'sink', 'drown', 'weak', 'tired', 'weary',
  'painful', 'ache', 'bitter', 'sour', 'gloom', 'dark',
  // 이름에 넣지 않는 것들
  'widow', 'orphan', 'concubine', 'prostitut', 'ghost', 'demon', 'devil',
  'worm', 'maggot', 'louse', 'flea', 'rat', 'snake', 'toad', 'beast',
] as const;

/** 이름에 좋은 뜻 */
const GOOD = [
  // 밝음
  'bright', 'light', 'shine', 'shining', 'luminous', 'brilliant', 'radiant',
  'glow', 'dawn', 'morning', 'sunlight', 'clear', 'crystal',
  // 아름다움
  'beautiful', 'pretty', 'elegant', 'graceful', 'lovely', 'fine', 'splendid',
  'magnificent', 'gorgeous',
  // 사람됨
  'virtue', 'virtuous', 'wisdom', 'wise', 'intelligent', 'clever', 'talent',
  'good', 'kind', 'benevolen', 'gentle', 'humane', 'sincere', 'honest',
  'upright', 'noble', 'brave', 'courage', 'firm', 'steadfast', 'diligent',
  // 이룸
  'prosper', 'flourish', 'thrive', 'abundant', 'rich', 'achieve', 'accomplish',
  'success', 'glory', 'honor', 'fame', 'rise', 'grow', 'begin', 'new',
  // 귀한 것
  'jade', 'gem', 'jewel', 'pearl', 'gold', 'treasure', 'precious', 'valuable',
  // 복
  'auspicious', 'felicit', 'blessing', 'fortune', 'lucky', 'happy', 'joy', 'joyful',
  'peace', 'calm', 'tranquil', 'harmony', 'gentle',
  // 자연
  'pine', 'bamboo', 'orchid', 'plum', 'flower', 'fragran', 'spring', 'dew',
  'cloud', 'star', 'sun', 'moon', 'sky', 'heaven', 'sea', 'river', 'mountain',
  'phoenix', 'dragon', 'crane',
  // 크고 오램
  'great', 'grand', 'vast', 'deep', 'wide', 'tall', 'high', 'eternal',
  'forever', 'lasting', 'long',
] as const;

/**
 * 낱말이 시작하는 자리에서 맞춘다.
 *
 * 세 글자 이하는 통째로 같아야 하고, 네 글자부터는 앞이 같으면 맞는 것으로
 * 본다 — 「sick」이 「sickness」를, 「pollut」이 「polluted」를 잡아야 하기
 * 때문이다.
 */
function matcher(words: readonly string[]): RegExp {
  const exact = words.filter((w) => w.length <= 3).map(esc);
  const prefix = words.filter((w) => w.length > 3).map(esc);
  const parts: string[] = [];
  if (exact.length) parts.push(`(?:${exact.join('|')})\\b`);
  if (prefix.length) parts.push(`(?:${prefix.join('|')})`);
  return new RegExp(`\\b(?:${parts.join('|')})`, 'i');
}

function esc(w: string): string {
  return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const BAD_RE = matcher(BAD);
const GOOD_RE = matcher(GOOD);

/** 뜻이 나빠서 이름에 못 쓰는 글자인가 */
export function meaningBad(meaning: string): boolean {
  return BAD_RE.test(meaning);
}

/** 뜻이 좋아 앞세울 글자인가 */
export function meaningGood(meaning: string): boolean {
  return GOOD_RE.test(meaning) && !BAD_RE.test(meaning);
}
