/**
 * 리포트 본문의 수치 및 사실 검증.
 *
 * 모델이 낸 글이 룰 엔진의 계산 결과와 정확히 일치하는지 검사한다.
 * 없는 숫자를 지어내거나 반올림/어림잡거나, 비중이 있는 십신을 0%로 기술하는 것을 잡는다.
 */

export interface FactCheckResult {
  valid: boolean;
  errors: string[];
}

export function extractAllowedPercentages(data: any): Set<number> {
  const allowed = new Set<number>();

  function scan(obj: any) {
    if (!obj) return;
    if (typeof obj === 'string') {
      for (const m of obj.matchAll(/(\d+(?:\.\d+)?)%/g)) {
        allowed.add(Number(m[1]));
      }
      return;
    }
    if (Array.isArray(obj)) {
      for (const it of obj) scan(it);
      return;
    }
    if (typeof obj === 'object') {
      if (typeof obj.weight === 'number') allowed.add(obj.weight);
      if (typeof obj.supportRatio === 'number') allowed.add(obj.supportRatio);
      if (typeof obj.score === 'number' && obj.score <= 100) allowed.add(obj.score);
      if (obj.scores && typeof obj.scores === 'object') {
        for (const v of Object.values(obj.scores)) {
          if (typeof v === 'number') allowed.add(v);
        }
      }
      for (const v of Object.values(obj)) scan(v);
    }
  }
  scan(data);
  return allowed;
}

export function validateReportFacts(text: string, data: any): FactCheckResult {
  const rawErrors: string[] = [];

  // 1. 리포트 글에 나오는 백분율 숫자(\d+(\.\d+)?%)가 전부 자료에 있는 값인지
  const allowedPercentages = extractAllowedPercentages(data);
  const textPercentages = [...text.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]));

  for (const p of textPercentages) {
    if (!allowedPercentages.has(p)) {
      rawErrors.push('자료에 없는 백분율 숫자가 글에 사용되었습니다: ' + p + '%');
    }
  }

  // 2. 리포트 글에 나오는 보정 시각이 자료의 correctedTime 과 같은지
  const meta = data?.계산근거 || data?.나의_계산근거 || data?.손님의_바탕?.계산근거;
  if (meta?.correctedTime) {
    const expected = meta.correctedTime; // 예: "14:14"
    const [expH, expM] = expected.split(':').map((s: string) => String(Number(s)));

    const timeMatches = [
      ...text.matchAll(/(?:진태양시|보정)[^\n]{0,35}?(\d{1,2})시\s*(\d{1,2})분/g),
      ...text.matchAll(/(\d{1,2})시\s*(\d{1,2})분[^\n]{0,35}?(?:진태양시|보정)/g),
      ...text.matchAll(/(?:진태양시|보정)[^\n]{0,35}?(\d{1,2}):(\d{2})/g),
      ...text.matchAll(/(\d{1,2}):(\d{2})[^\n]{0,35}?(?:진태양시|보정)/g),
    ];
    for (const m of timeMatches) {
      const h = String(Number(m[1]));
      const min = String(Number(m[2]));
      if (h !== expH || min !== expM) {
        rawErrors.push('보정 시각이 만세력 자료(' + expected + ')와 일치하지 않습니다: ' + m[1] + '시 ' + m[2] + '분');
      }
    }
  }

  // 3. 없는_십신 에 들어 있지 않은 십신을 「0%」라고 쓰지 않았는지
  //    (자료에 비중 수치가 존재하는데 0%라고 쓰면 오류)
  const tenGods = ['비겁', '식상', '재성', '관성', '인성', '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
  for (const god of tenGods) {
    const zeroRegex = new RegExp(god + '[^\n%]{0,10}?0%|0%[^\n%]{0,10}?' + god, 'g');
    if (zeroRegex.test(text)) {
      const scores = data?.십신_비중 || data?.강약?.scores || data?.나의_강약?.scores;
      if (scores && typeof scores[god] === 'number' && scores[god] > 0) {
        rawErrors.push('자료에 ' + god + ' 비중이 ' + scores[god] + '%로 존재하는데 글에서 0%로 기술되었습니다.');
      }
    }
  }

    // 4. 리포트 글에 자료에 없는 지명이 나오지 않는지 (출생지/진태양시 관련)
  const knownPlaces = ['서울', '인천', '수원', '춘천', '대전', '전주', '광주', '대구', '창원', '울산', '부산', '제주'];
  const dataPlace = data?.출생지 || data?.태어난곳 || data?.계산근거?.place || data?.손님의_바탕?.출생지 || data?.고른곳;
  for (const place of knownPlaces) {
    if (place === dataPlace) continue;
    // 자료에 없는 지명이 '기준', '출생', '태어난' 등의 문맥에서 진태양시/보정과 결합하여 쓰였는지 확인
    const placeRegex = new RegExp(place + '\\s*(?:기준|에서|출생)?(?:[^\n]{0,20})?(?:진태양시|보정시각)', 'g');
    if (placeRegex.test(text)) {
      rawErrors.push('자료에 없는 지명(' + place + ')이 보정 시각 설명에 사용되었습니다.');
    }
  }

  const errors = [...new Set(rawErrors)];
  return {
    valid: errors.length === 0,
    errors,
  };
}
