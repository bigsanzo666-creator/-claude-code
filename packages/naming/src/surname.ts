/**
 * 성씨 표.
 *
 * 손님은 「김」이라고 적지 「金」이라고 적지 않는다. 그런데 김으로 읽는 한자는
 * 인명용 목록에도 여럿이라, 아무거나 집으면 남의 성을 쓴 이름이 나온다.
 *
 * 그래서 **성은 표를 따로 둔다.** 우리나라 성씨는 백 개 남짓이고 그중 쉰 개가
 * 인구의 아홉 할을 덮는다. 여기 없는 성은 손님에게 한자를 직접 받는다 —
 * 짐작으로 채우지 않는다.
 *
 * 한 소리에 여러 성이 있는 것은 그대로 여럿으로 둔다. 「유」는 柳·劉·兪 가 다
 * 있고 이것은 서로 다른 집안이다. 화면에서 손님이 고른다.
 */

export interface Surname {
  /** 한글 성 */
  hangul: string;
  /** 한자 성 */
  char: string;
  /** 무슨 집안인지 알아볼 수 있게 적는다. 같은 소리가 여럿일 때만 쓴다 */
  note?: string;
}

/** 인구 많은 차례로 적었다 */
export const SURNAMES: readonly Surname[] = [
  { hangul: '김', char: '金' },
  { hangul: '이', char: '李' },
  { hangul: '박', char: '朴' },
  { hangul: '최', char: '崔' },
  { hangul: '정', char: '鄭', note: '나라 정' },
  { hangul: '강', char: '姜', note: '성씨 강' },
  { hangul: '조', char: '趙', note: '나라 조' },
  { hangul: '윤', char: '尹' },
  { hangul: '장', char: '張', note: '베풀 장' },
  { hangul: '임', char: '林', note: '수풀 림' },
  { hangul: '한', char: '韓' },
  { hangul: '오', char: '吳' },
  { hangul: '서', char: '徐' },
  { hangul: '신', char: '申', note: '납 신' },
  { hangul: '권', char: '權' },
  { hangul: '황', char: '黃' },
  { hangul: '안', char: '安' },
  { hangul: '송', char: '宋' },
  { hangul: '전', char: '全', note: '온전할 전' },
  { hangul: '홍', char: '洪' },
  { hangul: '유', char: '柳', note: '버들 류' },
  { hangul: '고', char: '高' },
  { hangul: '문', char: '文' },
  { hangul: '양', char: '梁', note: '들보 량' },
  { hangul: '손', char: '孫' },
  { hangul: '배', char: '裵' },
  { hangul: '백', char: '白' },
  { hangul: '허', char: '許' },
  { hangul: '유', char: '劉', note: '묘금도 류' },
  { hangul: '남', char: '南' },
  { hangul: '심', char: '沈' },
  { hangul: '노', char: '盧', note: '성씨 로' },
  { hangul: '정', char: '丁', note: '고무래 정' },
  { hangul: '하', char: '河' },
  { hangul: '곽', char: '郭' },
  { hangul: '성', char: '成' },
  { hangul: '차', char: '車' },
  { hangul: '주', char: '朱', note: '붉을 주' },
  { hangul: '우', char: '禹' },
  { hangul: '구', char: '具', note: '갖출 구' },
  { hangul: '신', char: '辛', note: '매울 신' },
  { hangul: '임', char: '任', note: '맡길 임' },
  { hangul: '나', char: '羅' },
  { hangul: '전', char: '田', note: '밭 전' },
  { hangul: '민', char: '閔' },
  { hangul: '유', char: '兪', note: '인월도 유' },
  { hangul: '진', char: '陳', note: '베풀 진' },
  { hangul: '지', char: '池' },
  { hangul: '엄', char: '嚴' },
  { hangul: '채', char: '蔡' },
  { hangul: '원', char: '元' },
  { hangul: '천', char: '千' },
  { hangul: '방', char: '方', note: '모 방' },
  { hangul: '공', char: '孔' },
  { hangul: '강', char: '康', note: '편안할 강' },
  { hangul: '현', char: '玄' },
  { hangul: '함', char: '咸' },
  { hangul: '변', char: '卞', note: '성씨 변' },
  { hangul: '염', char: '廉' },
  { hangul: '양', char: '楊', note: '버들 양' },
  { hangul: '변', char: '邊', note: '가 변' },
  { hangul: '여', char: '呂' },
  { hangul: '추', char: '秋' },
  { hangul: '노', char: '魯', note: '나라 로' },
  { hangul: '도', char: '都' },
  { hangul: '소', char: '蘇' },
  { hangul: '신', char: '愼', note: '삼갈 신' },
  { hangul: '석', char: '石' },
  { hangul: '선우', char: '鮮于' },
  { hangul: '설', char: '薛' },
  { hangul: '마', char: '馬' },
  { hangul: '길', char: '吉' },
  { hangul: '주', char: '周', note: '두루 주' },
  { hangul: '연', char: '延' },
  { hangul: '방', char: '房', note: '방 방' },
  { hangul: '위', char: '魏' },
  { hangul: '표', char: '表' },
  { hangul: '명', char: '明' },
  { hangul: '기', char: '奇' },
  { hangul: '반', char: '潘' },
  { hangul: '왕', char: '王' },
  { hangul: '금', char: '琴' },
  { hangul: '옥', char: '玉' },
  { hangul: '육', char: '陸' },
  { hangul: '인', char: '印' },
  { hangul: '맹', char: '孟' },
  { hangul: '제', char: '諸' },
  { hangul: '모', char: '牟' },
  { hangul: '장', char: '蔣', note: '성씨 장' },
  { hangul: '남궁', char: '南宮' },
  { hangul: '탁', char: '卓' },
  { hangul: '국', char: '鞠' },
  { hangul: '여', char: '余', note: '나 여' },
  { hangul: '진', char: '秦', note: '나라 진' },
  { hangul: '어', char: '魚' },
  { hangul: '은', char: '殷' },
  { hangul: '편', char: '片' },
  { hangul: '용', char: '龍' },
  { hangul: '구', char: '丘', note: '언덕 구' },
  { hangul: '봉', char: '奉' },
  { hangul: '한', char: '漢', note: '한수 한' },
  { hangul: '경', char: '慶' },
  { hangul: '소', char: '邵', note: '땅이름 소' },
  { hangul: '사', char: '史' },
  { hangul: '단', char: '段' },
  { hangul: '함', char: '涵' },
  { hangul: '팽', char: '彭' },
  { hangul: '승', char: '承' },
  { hangul: '간', char: '簡' },
  { hangul: '상', char: '尙' },
  { hangul: '시', char: '施' },
  { hangul: '황보', char: '皇甫' },
  { hangul: '제갈', char: '諸葛' },
  { hangul: '독고', char: '獨孤' },
  { hangul: '동방', char: '東方' },
  { hangul: '사공', char: '司空' },
] as const;

/** 그 소리로 읽는 성씨들. 「유」면 柳·劉·兪 가 다 나온다 */
export function surnamesByReading(hangul: string): Surname[] {
  const h = hangul.trim();
  return SURNAMES.filter((s) => s.hangul === h);
}

/** 그 한자가 성씨 표에 있는가 */
export function surnameOf(char: string): Surname | null {
  const c = char.trim();
  return SURNAMES.find((s) => s.char === c) ?? null;
}
