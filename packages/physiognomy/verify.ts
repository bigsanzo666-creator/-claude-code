/**
 * 관상 검증.
 *
 * 사진에서 재는 자(尺)가 제대로 만들어졌는지 본다. 여기서 보는 것은
 * **사진 없이도 확인할 수 있는 것들**이다 — 사진 크기가 달라져도 같은 값이
 * 나오는가, 얼굴이 돌아가 있으면 재기를 멈추는가, 넓은 이마를 넓다고 하는가.
 *
 * 진짜 얼굴 사진으로 맞추는 일은 브라우저에서 해야 하고, 그것은 이 파일이
 * 할 수 있는 일이 아니다. 다만 **자가 휘어 있으면** 사진을 아무리 잘 찍어도
 * 소용없으므로, 자부터 편다.
 */

import { readFace } from './src/rules.ts';
import {
  LM, NEEDED, measureFace, faceRatios, faceShapeOf, yawOf, hasNeeded,
  CUTS, YAW_LIMIT, type Point, type FaceRatios,
} from './src/measure.ts';
import { NEUTRAL_FEATURES, FEATURE_LABEL } from './src/features.ts';

let passed = 0, failed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`); }
}
function section(t: string) { console.log(`\n${t}\n${'─'.repeat(60)}`); }

/**
 * 시험용 얼굴.
 *
 * 사진이 없으므로 점을 직접 놓는다. 기본값은 어느 쪽으로도 치우치지 않은
 * 얼굴이고, `tweak` 으로 한 군데씩 옮겨 가며 그 값만 달라지는지 본다.
 */
interface Dial {
  width: number; length: number;
  forehead: number; cheek: number; jaw: number;
  browGap: number; eyeW: number; eyeH: number; interocular: number;
  noseLen: number; noseWing: number;
  mouth: number; lip: number;
  shift: number; scale: number; offset: number;
}

const BASE: Dial = {
  width: 1, length: 1.36,
  forehead: 0.77, cheek: 0.92, jaw: 0.79,
  browGap: 0.165, eyeW: 0.24, eyeH: 0.042, interocular: 0.30,
  noseLen: 0.29, noseWing: 0.285,
  mouth: 0.395, lip: 0.26,
  shift: 0, scale: 1, offset: 0,
};

function face(over: Partial<Dial> = {}): Point[] {
  const d = { ...BASE, ...over };
  const w = d.width, h = d.length * d.width;
  const pts: Point[] = new Array(478).fill(null).map(() => ({ x: 0, y: 0 }));
  const put = (i: number, x: number, y: number) => {
    pts[i] = { x: (0.5 + x) * d.scale + d.offset, y: (0.5 + y) * d.scale + d.offset };
  };
  const io = d.interocular * w;

  put(LM.crown, 0, -h / 2);
  put(LM.chin, 0, h / 2);
  put(LM.faceL, -w / 2, 0);
  put(LM.faceR, w / 2, 0);
  put(LM.templeL, -d.forehead * w / 2, -h * 0.3);
  put(LM.templeR, d.forehead * w / 2, -h * 0.3);
  put(LM.cheekL, -d.cheek * w / 2, h * 0.02);
  put(LM.cheekR, d.cheek * w / 2, h * 0.02);
  put(LM.jawL, -d.jaw * w / 2, h * 0.22);
  put(LM.jawR, d.jaw * w / 2, h * 0.22);

  // 눈. 얼굴이 돌아간 것을 흉내 내려고 두 눈을 통째로 옆으로 민다
  const eyeY = -h * 0.10, s = d.shift * w;
  put(LM.eyeLIn, -io / 2 + s, eyeY);
  put(LM.eyeRIn, io / 2 + s, eyeY);
  put(LM.eyeLOut, -io / 2 - d.eyeW * w + s, eyeY);
  put(LM.eyeROut, io / 2 + d.eyeW * w + s, eyeY);
  put(LM.eyeLTop, -io / 2 - d.eyeW * w / 2 + s, eyeY - d.eyeH * w / 2);
  put(LM.eyeLBot, -io / 2 - d.eyeW * w / 2 + s, eyeY + d.eyeH * w / 2);
  put(LM.eyeRTop, io / 2 + d.eyeW * w / 2 + s, eyeY - d.eyeH * w / 2);
  put(LM.eyeRBot, io / 2 + d.eyeW * w / 2 + s, eyeY + d.eyeH * w / 2);

  const browY = eyeY - h * 0.06;
  put(LM.browLTop, -io / 2 - d.eyeW * w / 2, browY - d.browGap * io / 2);
  put(LM.browLBot, -io / 2 - d.eyeW * w / 2, browY + d.browGap * io / 2);
  put(LM.browRTop, io / 2 + d.eyeW * w / 2, browY - d.browGap * io / 2);
  put(LM.browRBot, io / 2 + d.eyeW * w / 2, browY + d.browGap * io / 2);

  put(LM.noseTop, 0, eyeY);
  put(LM.noseTip, 0, eyeY + d.noseLen * h);
  put(LM.noseWingL, -d.noseWing * w / 2, eyeY + d.noseLen * h);
  put(LM.noseWingR, d.noseWing * w / 2, eyeY + d.noseLen * h);

  const mouthY = h * 0.22, mw = d.mouth * w, lh = d.lip * mw;
  put(LM.mouthL, -mw / 2, mouthY);
  put(LM.mouthR, mw / 2, mouthY);
  put(LM.lipTop, 0, mouthY - lh / 2);
  put(LM.lipTopIn, 0, mouthY);
  put(LM.lipBotIn, 0, mouthY);
  put(LM.lipBot, 0, mouthY + lh / 2);
  return pts;
}

section('1. 재는 자가 서 있는가');
{
  const base = face();
  check('시험용 얼굴에 필요한 점이 다 있다', hasNeeded(base));
  check('점 하나가 비면 재지 않는다', !hasNeeded(
    base.map((p, i) => (i === LM.chin ? undefined : p)) as Point[]));

  const m = measureFace(base);
  check('치우치지 않은 얼굴은 아홉 값이 모두 보통',
    (Object.keys(FEATURE_LABEL) as (keyof typeof FEATURE_LABEL)[])
      .every((k) => m.features[k] === 'mid'),
    (Object.keys(FEATURE_LABEL) as (keyof typeof FEATURE_LABEL)[])
      .filter((k) => m.features[k] !== 'mid').join(','));
  check('경계값이 아홉 가지 다 있다', Object.keys(CUTS).length === 9);
}

section('2. 사진 크기가 달라져도 같은 값이 나오는가');
{
  // 픽셀로 재면 사진마다 값이 달라진다. 비율만 쓰는지 확인한다
  const near = measureFace(face());
  const far = measureFace(face({ scale: 0.4, offset: 0.2 }));
  const keys = Object.keys(near.ratios) as (keyof FaceRatios)[];
  check('멀리서 찍어도 비율이 같다',
    keys.every((k) => Math.abs(near.ratios[k] - far.ratios[k]) < 1e-9));
  check('멀리서 찍어도 아홉 값이 같다',
    JSON.stringify(near.features) === JSON.stringify(far.features));
}

section('3. 한 군데를 바꾸면 그 값만 바뀌는가');
{
  const base = measureFace(face()).features;
  const only = (over: Partial<Dial>, key: keyof typeof base, want: string) => {
    const got = measureFace(face(over)).features;
    const changed = (Object.keys(got) as (keyof typeof got)[]).filter((k) => got[k] !== base[k]);
    check(`${FEATURE_LABEL[key as keyof typeof FEATURE_LABEL] ?? key} 만 바뀐다`,
      got[key] === want && changed.every((k) => k === key || k === 'faceShape'),
      `바뀐 것: ${changed.join(',')}`);
  };
  only({ forehead: 0.90 }, 'foreheadWidth', 'high');
  only({ forehead: 0.62 }, 'foreheadWidth', 'low');
  only({ browGap: 0.28 }, 'browThickness', 'high');
  only({ browGap: 0.08 }, 'browThickness', 'low');
  only({ eyeH: 0.070 }, 'eyeSize', 'high');
  only({ eyeH: 0.024 }, 'eyeSize', 'low');
  only({ noseLen: 0.36 }, 'noseBridge', 'high');
  only({ noseLen: 0.20 }, 'noseBridge', 'low');
  only({ noseWing: 0.35 }, 'noseWing', 'high');
  only({ noseWing: 0.20 }, 'noseWing', 'low');
  only({ mouth: 0.50 }, 'mouthSize', 'high');
  only({ mouth: 0.30 }, 'mouthSize', 'low');
  only({ lip: 0.38 }, 'lipThickness', 'high');
  only({ lip: 0.16 }, 'lipThickness', 'low');
  only({ jaw: 0.94 }, 'jawDevelopment', 'high');
  only({ jaw: 0.68 }, 'jawDevelopment', 'low');
  only({ cheek: 0.99 }, 'cheekbone', 'high');
  only({ cheek: 0.80 }, 'cheekbone', 'low');
}

section('4. 얼굴형');
{
  const shape = (over: Partial<Dial>) => faceShapeOf(faceRatios(face(over)));
  check('길면 긴형', shape({ length: 1.60 }) === 'long');
  check('짧고 둥글면 둥근형', shape({ length: 1.18 }) === 'round');
  check('턱이 넓고 짧으면 둥근형', shape({ jaw: 0.92, length: 1.25 }) === 'round');
  check('턱이 넓고 길면 각진형', shape({ jaw: 0.92, length: 1.40 }) === 'square');
  check('이마가 넓고 턱이 좁으면 역삼각형',
    shape({ forehead: 0.95, cheek: 0.90, jaw: 0.62 }) === 'heart');
  check('그 밖은 계란형', shape({}) === 'oval');
}

section('5. 못 재는 사진은 재지 않는다');
{
  // 옆으로 돌린 얼굴은 한쪽이 짧게 찍혀 값이 다 틀어진다. 억지로 내밀면
  // 손님은 그것이 틀린 줄 모르고 결과를 믿는다
  check('정면은 돌아간 정도가 0에 가깝다', yawOf(face()) < 0.01);
  check('옆으로 돌면 커진다', yawOf(face({ shift: 0.12 })) > YAW_LIMIT);

  let msg = '';
  try { measureFace(face({ shift: 0.12 })); } catch (e) { msg = (e as Error).message; }
  check('많이 돌아간 사진은 멈춘다', msg.includes('정면'));
  check('멈출 때 무엇을 하라고 알려 준다', msg.includes('다시'));

  msg = '';
  try { measureFace(face().map(() => ({ x: 0.5, y: 0.5 }))); } catch (e) { msg = (e as Error).message; }
  check('점이 한자리에 뭉치면 멈춘다', msg.length > 0);

  msg = '';
  try { measureFace([]); } catch (e) { msg = (e as Error).message; }
  check('점이 아예 없으면 멈춘다', msg.includes('얼굴'));
}

section('6. 잰 값이 풀이로 이어지는가');
{
  // 사진으로 잰 값이 지금 쓰는 관상 풀이에 그대로 들어가야 한다.
  // 여기서 모양이 어긋나면 사진으로 재는 의미가 없다
  const m = measureFace(face({ forehead: 0.90, jaw: 0.94, eyeH: 0.070 }));
  const reading = readFace(m.features);
  check('잰 값으로 바로 풀이가 나온다', reading.notes.length > 0 && reading.highlights.length > 0);
  check('손으로 고른 값과 같은 모양이다',
    Object.keys(m.features).sort().join() === Object.keys(NEUTRAL_FEATURES).sort().join());
  check('쓰는 점 번호가 겹치지 않는다', NEEDED.length === new Set(NEEDED).size);
  check('점 번호가 468개 안에 있다', NEEDED.every((i) => i >= 0 && i < 468));
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`통과 ${passed} · 실패 ${failed}`);
if (failed) { console.log(failures.map((f) => `  - ${f}`).join('\n')); process.exit(1); }
