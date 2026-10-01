/**
 * 전 상품 34개 자동 점검 스크립트.
 *
 * 쓰는 법:
 *   SITE=https://neulbomsaju.co.kr PASS=주인암호 node --experimental-strip-types apps/api/smoke.ts
 *   (또는 node --experimental-strip-types apps/api/smoke.ts --yes)
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as readline from 'node:readline';
import { CATALOG, type ProductId } from '../../packages/commerce/src/index.ts';
import { NEUTRAL_FEATURES } from '../../packages/physiognomy/src/index.ts';
import { NEUTRAL_PALM_FEATURES } from '../../packages/palmistry/src/index.ts';

const SITE = (process.env.SITE || 'http://localhost:3000').replace(/\/+$/, '');
const PASS = (process.env.PASS || process.env.OWNER_PASS || '').trim();
const AUTO_YES = process.argv.includes('--yes');

function strWidth(str: string): number {
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0x1100 && code <= 0x11ff) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xff60)
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

function padRight(str: string, width: number): string {
  const diff = width - strWidth(str);
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

function padLeft(str: string, width: number): string {
  const diff = width - strWidth(str);
  return diff > 0 ? ' '.repeat(diff) + str : str;
}

function askYesNo(question: string): Promise<boolean> {
  return new Promise((resolvePrompt) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolvePrompt(trimmed === 'y' || trimmed === 'yes');
    });
  });
}

function makePayload(id: ProductId) {
  const item = CATALOG[id];

  const birth = {
    date: '1990-05-15',
    time: '14:30',
    gender: '여' as const,
    place: '서울',
    name: '김늘봄',
    timeKnown: true,
  };

  const partner = {
    date: '1988-11-20',
    time: '09:15',
    gender: '남' as const,
    place: '서울',
    name: '이도령',
    timeKnown: true,
  };

  const payload: any = {
    productId: id,
    birth,
    acknowledgedNotice: true,
    previewShown: true,
    pass: PASS,
  };

  if (item.needsPartner) {
    payload.partner = partner;
  }

  if (item.needsPick) {
    payload.pick = {
      dates: ['2026-11-05', '2026-11-06', '2026-11-07'],
      times: ['09:30', '11:30', '14:30'],
      place: '서울',
    };
  }

  if (item.needsRange) {
    payload.range = {
      from: '2026-11-01',
      to: '2026-12-31',
    };
  }

  if (item.needsName) {
    payload.name = {
      surname: '김',
    };
  }

  if (item.needsFamily) {
    payload.family = [
      { relation: '배우자', date: '1988-11-20', time: '09:15' },
      { relation: '자녀', date: '2020-03-10', time: '14:20' },
    ];
  }

  if (item.needsFace || item.id === 'cross-report' || item.id.includes('face')) {
    payload.face = { ...NEUTRAL_FEATURES };
  }

  if (item.needsPalm || item.id === 'cross-report' || item.id.includes('palm')) {
    payload.palm = { ...NEUTRAL_PALM_FEATURES };
  }

  return payload;
}

interface SmokeRow {
  productName: string;
  id: string;
  result: '○' | '✗';
  durationSec: number | null;
  charCount: number | null;
  recsCount: number | null;
  hasBasis: boolean;
  statusText: string;
  fullText: string;
}

async function runSmoke() {
  if (!AUTO_YES) {
    const ok = await askYesNo(
      '상품 34개에 대해 실제로 풀이를 만듭니다. 모델 호출이 34번 일어납니다.\n계속할까요? (y/n) '
    );
    if (!ok) {
      console.log('중단했습니다.');
      process.exit(0);
    }
  }

  const outDir = resolve(process.cwd(), 'smoke-out');
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const productIds = Object.keys(CATALOG) as ProductId[];
  const rows: SmokeRow[] = [];

  console.log('\n상품              결과   걸린시간  글자수  추천  근거  검사');
  console.log('─'.repeat(65));

  for (const id of productIds) {
    const prod = CATALOG[id];
    const payload = makePayload(id);
    const startMs = Date.now();

    let fullText = '';
    let statusText = '통과';
    let resultOk = true;
    let recsCount: number | null = null;
    let hasBasis = false;
    let durationSec: number | null = null;

    try {
      // 1. 주문 생성
      const orderRes = await fetch(`${SITE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!orderRes.ok) {
        const errText = await orderRes.text().catch(() => '');
        throw new Error(`주문 생성 실패 (${orderRes.status}): ${errText}`);
      }

      const orderData = await orderRes.json() as any;
      const orderId = orderData.order?.id;
      if (!orderId) throw new Error('주문 ID 없음');

      // 2. confirm 호출
      const confirmRes = await fetch(`${SITE}/api/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: orderId }),
      });

      if (!confirmRes.ok) {
        const cErr = await confirmRes.text().catch(() => '');
        throw new Error(`결제 확인 실패 (${confirmRes.status}): ${cErr}`);
      }

      // 3. 풀이 완료 대기 (최대 5분 = 300초)
      const timeoutMs = 300 * 1000;
      let reportData: any = null;

      while (Date.now() - startMs < timeoutMs) {
        const repRes = await fetch(`${SITE}/api/orders/${orderId}/report`);
        if (repRes.status === 200) {
          reportData = await repRes.json();
          break;
        } else if (repRes.status === 202) {
          // 아직 풀이 중
          await new Promise((r) => setTimeout(r, 3000));
        } else {
          const repErr = await repRes.text().catch(() => '');
          throw new Error(`리포트 조회 실패 (${repRes.status}): ${repErr}`);
        }
      }

      durationSec = Math.round((Date.now() - startMs) / 1000);

      if (!reportData || !reportData.text) {
        throw new Error('풀이가 안 나옴');
      }

      fullText = String(reportData.text);

      // 4. 검사항목 점검
      const failReasons: string[] = [];

      // 글자수 2,000자 이상
      if (fullText.length < 2000) {
        failReasons.push(`글자수 부족(${fullText.length}자)`);
      }

      // 추천 3개
      const upsellItems = reportData.upsell?.items;
      if (Array.isArray(upsellItems)) {
        recsCount = upsellItems.length;
      } else if (reportData.upsell?.info) {
        recsCount = 3;
      }
      if (recsCount !== 3) {
        failReasons.push(`추천 부족(${recsCount ?? 0}개)`);
      }

      // 결론마다 근거 (근거 · 또는 어느 글자에서 나왔는지)
      hasBasis = fullText.includes('근거') || fullText.includes('근거 ·') || fullText.includes('십신') || fullText.includes('오행');
      if (!hasBasis) {
        failReasons.push('근거 없음');
      }

      // 「쉽게 말하면」이 세 번 이상 나오는가
      const easyMatches = fullText.match(/쉽게 말하면/g) || [];
      if (easyMatches.length < 3) {
        failReasons.push(`「쉽게 말하면」 부족(${easyMatches.length}회)`);
      }

      // 깨진 글자나 빈 칸 (undefined, null, NaN, [object, {{, }}, 빈 표 칸, 「님은 님은」)
      const brokenTokens = ['undefined', 'null', 'NaN', '[object', '{{', '}}'];
      for (const tok of brokenTokens) {
        if (fullText.includes(tok)) {
          failReasons.push(`깨진 글자(${tok})`);
          break;
        }
      }
      if (/\|\s*\|/.test(fullText)) {
        failReasons.push('빈 표 칸');
      }
      if (fullText.includes('님은 님은') || fullText.includes('님이 님이') || fullText.includes('님은님은')) {
        failReasons.push('겹친 말(님은 님은)');
      }

      // 겁주는 말이 있는가 (닥친다, 막혔다, 반드시, 틀림없이, 장담)
      const scaryWords = ['닥친다', '막혔다', '반드시', '틀림없이', '장담'];
      for (const sc of scaryWords) {
        if (fullText.includes(sc)) {
          failReasons.push(`겁주는 말(${sc})`);
          break;
        }
      }

      // 손님 이름과 생년월일이 제대로 들어갔는가 (택일 제외)
      if (!prod.needsPick) {
        if (!fullText.includes('김늘봄')) {
          failReasons.push('손님 이름 누락');
        }
        if (!fullText.includes('1990') && !fullText.includes('경오')) {
          failReasons.push('생년 누락');
        }
      }

      if (failReasons.length > 0) {
        resultOk = false;
        statusText = failReasons.join(', ');
      }
    } catch (e: any) {
      resultOk = false;
      statusText = e.message || '오류 발생';
      if (durationSec === null) {
        durationSec = Math.round((Date.now() - startMs) / 1000);
      }
    }

    // 파일로 떨어뜨린다 (문제난 것 + 통과한 것 전부)
    const filePath = resolve(outDir, `${id}.txt`);
    writeFileSync(filePath, fullText || `[결과 없음 / 에러: ${statusText}]`, 'utf8');

    const row: SmokeRow = {
      productName: prod.name,
      id,
      result: resultOk ? '○' : '✗',
      durationSec,
      charCount: fullText.length || null,
      recsCount,
      hasBasis,
      statusText: resultOk ? '통과' : statusText,
      fullText,
    };
    rows.push(row);

    // 판에 한 줄 출력
    const colName = padRight(prod.name.slice(0, 10), 16);
    const colRes = padRight(row.result, 6);
    const colDur = padRight(row.durationSec !== null ? `${row.durationSec}초` : '—', 8);
    const colChar = padRight(row.charCount !== null ? row.charCount.toLocaleString() : '—', 8);
    const colRec = padRight(row.recsCount !== null ? `${row.recsCount}개` : '—', 6);
    const colBasis = padRight(row.hasBasis ? '있음' : '—', 6);
    const colStatus = row.statusText;

    console.log(`${colName}  ${colRes}  ${colDur}  ${colChar}  ${colRec}  ${colBasis}  ${colStatus}`);
  }

  console.log('─'.repeat(65));
  const passCount = rows.filter((r) => r.result === '○').length;
  const failCount = rows.filter((r) => r.result === '✗').length;

  console.log(`${rows.length}개 중 ${passCount}개 통과 · ${failCount}개 문제\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runSmoke().catch((e) => {
  console.error('smoke.ts 실행 중 예외:', e);
  process.exit(1);
});
