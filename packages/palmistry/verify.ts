/**
 * 손금 검증.
 *
 * 사진에서 손을 재는 자가 제대로 만들어졌는지 본다. 사진 없이도 확인할 수
 * 있는 것들 — 사진 크기가 달라져도 같은 값이 나오는가, 비스듬한 손을
 * 걸러내는가, 네모난 손을 네모나다고 하는가.
 *
 * 실제 손 사진으로 맞추는 일은 브라우저에서 해야 한다. 다만 **자가 휘어
 * 있으면** 사진을 아무리 잘 찍어도 소용없으므로, 자부터 편다.
 */

import { readPalm } from './src/rules.ts';
import {
  HL, HAND_NEEDED, measureHand, handRatios, handShapeOf, palmQuad, hasHandPoints,
  HAND_CUTS, EVEN_LIMIT, type Point,
} from './src/measure.ts';
import { NEUTRAL_PALM_FEATURES, HAND_SHAPE_LABEL } from './src/features.ts';
import { PATHS, tracePath, detectSimian, readPalmLines, LINE_CUTS, type GrayImage } from './src/lines.ts';

let passed = 0, failed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n${t}\n${'─'.repeat(60)}`); }

/**
 * 시험용 손.
 *
 * 사진이 없으므로 점을 직접 놓는다. `palm` 은 손바닥이 얼마나 긴가,
 * `finger` 는 손가락이 얼마나 긴가다. 손바닥 너비를 1로 놓고 잰다.
 */
interface Dial {
  palm: number; finger: number; thumb: number;
  /** 새끼손가락만 짧게 만들어 비스듬한 손을 흉내 낸다 */
  pinky: number;
  scale: number; offset: number; turn: number;
}
const BASE: Dial = { palm: 1.10, finger: 0.85, thumb: 0.62, pinky: 0.86, scale: 1, offset: 0, turn: 0 };

function hand(over: Partial<Dial> = {}): Point[] {
  const d = { ...BASE, ...over };
  const pts: Point[] = new Array(21).fill(null).map(() => ({ x: 0, y: 0 }));
  const put = (i: number, x: number, y: number) => {
    // 손 전체를 돌려도 비율은 그대로여야 한다
    const c = Math.cos(d.turn), s = Math.sin(d.turn);
    pts[i] = {
      x: (0.5 + (x * c - y * s)) * d.scale + d.offset,
      y: (0.5 + (x * s + y * c)) * d.scale + d.offset,
    };
  };
  const w = 1, L = d.palm;                       // 손바닥 너비 1, 길이 L
  put(HL.wrist, 0, 0);
  put(HL.indexMcp, -w / 2, -L);
  put(HL.pinkyMcp, w / 2, -L);
  put(HL.middleMcp, 0, -L);
  put(HL.ringMcp, w / 6, -L);
  put(HL.thumbCmc, -w / 2, -L * 0.25);
  put(HL.thumbTip, -w * 0.9, -L * 0.25 - d.thumb * L);
  const f = d.finger * L;
  put(HL.indexTip, -w / 2, -L - f * 0.94);
  put(HL.middleTip, 0, -L - f);
  put(HL.ringTip, w / 6, -L - f * 0.93);
  put(HL.pinkyTip, w / 2, -L - f * d.pinky);
  return pts;
}

section('1. 재는 자가 서 있는가');
{
  const base = hand();
  check('시험용 손에 필요한 점이 다 있다', hasHandPoints(base));
  check('점 하나가 비면 재지 않는다', !hasHandPoints(
    base.map((p, i) => (i === HL.wrist ? undefined : p)) as Point[]));
  const m = measureHand(base);
  check('손 모양이 다섯 가지 안에서 나온다', m.shape in HAND_SHAPE_LABEL);
  check('손바닥 네 귀퉁이를 잡아 준다', m.quad.length === 4);
}

section('2. 사진 크기·기울기가 달라져도 같은 값이 나오는가');
{
  const near = measureHand(hand());
  const far = measureHand(hand({ scale: 0.4, offset: 0.2 }));
  const tilt = measureHand(hand({ turn: 0.5 }));
  check('멀리서 찍어도 비율이 같다',
    Math.abs(near.ratios.palm - far.ratios.palm) < 1e-9
    && Math.abs(near.ratios.finger - far.ratios.finger) < 1e-9);
  check('손을 돌려 찍어도 비율이 같다',
    Math.abs(near.ratios.palm - tilt.ratios.palm) < 1e-9
    && near.shape === tilt.shape);
}

section('3. 오행 다섯 가지');
{
  const shape = (over: Partial<Dial>) => handShapeOf(handRatios(hand(over)));
  // 손바닥이 긴가 네모난가 · 손가락이 긴가 짧은가. 그 둘로 넷이 갈린다
  check('손바닥 길고 손가락 길면 목형', shape({ palm: 1.35, finger: 1.02 }) === '목형');
  check('손바닥 길고 손가락 짧으면 화형', shape({ palm: 1.35, finger: 0.68 }) === '화형');
  check('손바닥 네모나고 손가락 길면 금형', shape({ palm: 0.92, finger: 1.02 }) === '금형');
  check('손바닥 네모나고 손가락 짧으면 토형', shape({ palm: 0.92, finger: 0.68 }) === '토형');
  // 어느 쪽도 뚜렷하지 않은 손. 전통에서 수형은 각이 없는 손이다
  check('둘 다 뚜렷하지 않으면 수형', shape({}) === '수형');
  check('경계값이 두 가지다', Object.keys(HAND_CUTS).length === 2);
}

section('4. 못 재는 사진은 재지 않는다');
{
  // 손을 비스듬히 찍으면 손바닥이 찌그러져 보여 재는 값이 다 틀어진다
  let msg = '';
  try { measureHand(hand({ pinky: 0.2 })); } catch (e) { msg = (e as Error).message; }
  check('비스듬한 손은 멈춘다', msg.includes('정면'));
  check('멈출 때 무엇을 하라고 알려 준다', msg.includes('펴서'));
  check('고른 손은 통과한다', handRatios(hand()).even > EVEN_LIMIT);

  msg = '';
  try { measureHand(hand().map(() => ({ x: 0.5, y: 0.5 }))); } catch (e) { msg = (e as Error).message; }
  check('점이 한자리에 뭉치면 멈춘다', msg.length > 0);

  msg = '';
  try { measureHand([]); } catch (e) { msg = (e as Error).message; }
  check('점이 아예 없으면 멈춘다', msg.includes('손'));
}

section('5. 손바닥 도려내기');
{
  // 손금 선을 재려면 손바닥을 반듯하게 펴야 한다. 그 네모를 잡아 두는 단계다
  const q = palmQuad(hand());
  const side = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  check('네모가 손바닥 크기와 맞는다',
    Math.abs(side(q[0], q[1]) - 1) < 1e-9 && Math.abs(side(q[1], q[2]) - BASE.palm) < 1e-9);
  check('네모가 찌그러지지 않는다',
    Math.abs(side(q[0], q[1]) - side(q[3], q[2])) < 1e-9);
  // 손을 돌려 찍어도 네모는 손을 따라 돈다
  const turned = palmQuad(hand({ turn: 0.7 }));
  check('손을 돌리면 네모도 같이 돈다',
    Math.abs(side(turned[0], turned[1]) - side(q[0], q[1])) < 1e-9);
}

section('6. 잰 값이 풀이로 이어지는가');
{
  const m = measureHand(hand({ palm: 1.35, finger: 1.02 }));
  const features = { ...NEUTRAL_PALM_FEATURES, handShape: m.shape };
  const reading = readPalm(features);
  check('잰 손 모양으로 바로 풀이가 나온다', reading.notes.length > 0);
  check('손으로 고른 값과 같은 모양이다',
    Object.keys(features).sort().join() === Object.keys(NEUTRAL_PALM_FEATURES).sort().join());
  check('쓰는 점 번호가 겹치지 않는다', HAND_NEEDED.length === new Set(HAND_NEEDED).size);
  check('점 번호가 21개 안에 있다', HAND_NEEDED.every((i) => i >= 0 && i < 21));
}


/**
 * 손금 선을 시험할 때 쓰는 그림.
 *
 * 실제 사진이 없으니 흑백 격자를 손으로 그린다. `identityQuad` 는 그림
 * 전체를 그대로 손바닥으로 본다 — 그래야 `PATHS` 의 (u, v) 값이 곧 그림
 * 위 자리(0~1)와 같아서, 어디에 줄을 그었는지 손으로 확인하기 쉽다.
 */
function blank(size: number, base = 210): GrayImage {
  return { width: size, height: size, data: new Float64Array(size * size).fill(base) };
}
const identityQuad: [Point, Point, Point, Point] =
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

/** (u, v) 자리에 두께 있는 검은 줄을 긋는다. `frac` 은 전체 길이 중 몇 %까지 그을지 */
function drawLine(
  img: GrayImage, path: readonly (readonly [number, number])[],
  opts: { dark?: number; thick?: number; frac?: number } = {},
): void {
  const dark = opts.dark ?? 60, thick = opts.thick ?? 0.012, frac = opts.frac ?? 1;
  const steps = 400;
  for (let i = 0; i <= steps * frac; i++) {
    const t = i / steps;
    const seg = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
    const local = t * (path.length - 1) - seg;
    const [u0, v0] = path[seg]!, [u1, v1] = path[seg + 1]!;
    const u = u0 + (u1 - u0) * local, v = v0 + (v1 - v0) * local;
    const cx = u * img.width, cy = v * img.height;
    const r = Math.round(thick * img.width);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = Math.round(cx + dx), y = Math.round(cy + dy);
        if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
        (img.data as Float64Array)[y * img.width + x] = dark;
      }
    }
  }
}

section('7. 빈 손바닥에는 줄이 없다');
{
  const img = blank(200);
  const life = tracePath(img, identityQuad, PATHS.life);
  check('아무것도 안 그으면 줄이 없다고 본다', life.onFraction < 0.1, `${life.onFraction}`);
  check('짙기도 0에 가깝다', life.avgContrast < LINE_CUTS.depth[0]);
}

section('8. 그은 대로 줄을 찾는다');
{
  const img = blank(200);
  drawLine(img, PATHS.head, { dark: 40, thick: 0.02 });
  const head = tracePath(img, identityQuad, PATHS.head);
  check('그은 자리에서 줄을 찾는다', head.onFraction > 0.8, `${head.onFraction}`);
  check('짙게 그으면 짙다고 본다', head.avgContrast > LINE_CUTS.depth[1]);

  const img2 = blank(200);
  drawLine(img2, PATHS.head, { dark: 190, thick: 0.02 });  // 배경(210)과 살짝만 다르다
  const faint = tracePath(img2, identityQuad, PATHS.head);
  check('옅게 그으면 짙게 그은 것보다 흐릿하다', faint.avgContrast < head.avgContrast);
  check('옅게 그으면 「짙다」로 안 본다',
    faint.avgContrast < LINE_CUTS.depth[1], `${faint.avgContrast}`);
}

section('9. 반만 그으면 짧다고 본다');
{
  const img = blank(200);
  drawLine(img, PATHS.life, { dark: 40, thick: 0.02, frac: 0.4 });
  const life = tracePath(img, identityQuad, PATHS.life);
  check('반만 그으면 짧다고 본다',
    life.onFraction < LINE_CUTS.length[1], `${life.onFraction}`);

  const img2 = blank(200);
  drawLine(img2, PATHS.life, { dark: 40, thick: 0.02, frac: 1 });
  const full = tracePath(img2, identityQuad, PATHS.life);
  check('끝까지 그으면 길다고 본다', full.onFraction > life.onFraction);
}

section('10. 막쥔손금 — 두 선이 붙었는가');
{
  const apart = blank(200);
  drawLine(apart, PATHS.heart, { dark: 40, thick: 0.02 });
  drawLine(apart, PATHS.head, { dark: 40, thick: 0.02 });
  check('두 선 사이가 떠 있으면 막쥔손금이 아니다',
    detectSimian(apart, identityQuad) === false);

  // 감정선·두뇌선 사이(0.20~0.28)까지 아예 이어 그어 붙인 것처럼 만든다
  const merged = blank(200);
  drawLine(merged, [[0.5, 0.06], [0.5, 0.42]], { dark: 40, thick: 0.02 });
  check('두 자리가 하나로 이어지면 막쥔손금으로 본다',
    detectSimian(merged, identityQuad) === true);
}

section('11. 넷을 한 번에 읽는다');
{
  const img = blank(200);
  drawLine(img, PATHS.life, { dark: 40, thick: 0.02 });
  // path.head 는 꺾은선이 두 토막이다. 0.2 까지만 그으면 첫 토막의 절반도 못 그은 것이다
  drawLine(img, PATHS.head, { dark: 40, thick: 0.02, frac: 0.2 });
  const lines = readPalmLines(img, identityQuad);
  check('그은 생명선은 길다고 나온다', lines.lifeLength !== 'low');
  check('반만 그은 두뇌선은 짧다고 나온다', lines.headLength === 'low');
  check('안 그은 감정선·운명선은 짧다고 나온다',
    lines.heartLength === 'low' && lines.fateClarity === 'low');
  check('손 모양 값과 합쳐진다',
    Object.keys({ ...NEUTRAL_PALM_FEATURES, ...lines }).length
    === Object.keys(NEUTRAL_PALM_FEATURES).length);
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} · 실패 ${failed}`);
if (failed) { console.log(failures.map((f) => `  - ${f}`).join('\n')); process.exit(1); }
