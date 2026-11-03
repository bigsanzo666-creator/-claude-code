/**
 * 심사 대기 모드.
 *
 * PG 계약이 나기 전에도 사이트는 떠 있어야 한다 — 심사자가 주소를 직접 열어보고,
 * 약관·환불정책·사업자정보가 있는지 확인하기 때문이다. 그런데 그 시점에는
 * 아직 포트원 API 비밀도, 결제 채널도 없다.
 *
 * 그래서 비밀이 없으면 죽는 대신, **결제와 리포트만 꺼진 채로 뜬다.**
 * 무료 풀이와 정책 페이지는 그대로 돈다.
 *
 * 꺼진 기능을 조용히 성공시키지 않고 반드시 예외를 던지는 이유는,
 * 설정 누락이 "결제는 됐는데 리포트가 안 나온다" 같은 형태로 나타나면
 * 그때는 이미 돈이 오간 뒤이기 때문이다. 실패하려면 일찍, 시끄럽게 실패해야 한다.
 */

import type { PaymentGateway } from '../../../packages/commerce/src/index.ts';

const REASON = '결제 기능이 아직 켜지지 않았습니다. (PG 심사 대기 중)';

export class StandbyGateway implements PaymentGateway {
  readonly name = 'standby';
  async getPayment(): Promise<never> { throw new Error(REASON); }
  async cancelPayment(): Promise<never> { throw new Error(REASON); }
}

export async function standbyGenerate(): Promise<never> {
  throw new Error('리포트 생성이 아직 켜지지 않았습니다. (API 키 미설정)');
}
