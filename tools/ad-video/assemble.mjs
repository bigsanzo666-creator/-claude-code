#!/usr/bin/env node
/**
 * 늘봄사주 광고 영상 조립 도구 (BIG-26)
 *
 * 사용법:
 *   1) 소재 폴더 하나 조립:
 *      node tools/ad-video/assemble.mjs tools/ad-video/input/nabi-love-01
 *   2) input/ 안의 모든 소재 폴더 한 번에 조립:
 *      node tools/ad-video/assemble.mjs --all
 *
 * 입력 폴더(예: input/nabi-love-01/) 안의 파일:
 *   - scene1 ~ scene3 (.mp4 또는 .jpg/.jpeg/.png/.webp)
 *   - voice.mp3 또는 voice.wav
 *   - subs.srt
 *   - 선택: bgm.mp3 또는 bgm.wav (목소리 대비 -18dB 자동 믹스)
 *
 * 출력:
 *   - output/<소재코드>.mp4 (1080x1920, 30fps, H.264 + AAC)
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_INPUT_ROOT = join(__dirname, 'input');
const DEFAULT_OUTPUT_ROOT = join(__dirname, 'output');
const FONTS_DIR = join(__dirname, 'fonts');
const FONT_NAME = 'NanumSquareRound ExtraBold';

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;

/**
 * SRT 시간 문자열(00:00:02,500) -> 초(float)
 */
function parseSrtTime(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!m) return 0;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  const ms = Number(m[4].padEnd(3, '0'));
  return hh * 3600 + mm * 60 + ss + ms / 1000;
}

/**
 * 초(float) -> ASS 시간 문자열(H:MM:SS.cc)
 */
function formatAssTime(sec) {
  const clamped = Math.max(0, sec);
  const totalCs = Math.round(clamped * 100);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * 긴 한 줄 자막이 좌우 안전 여백을 넘어가지 않도록 어절 단위로 자동 줄바꿈
 */
function wrapKoreanLines(text, maxCharsPerLine = 13) {
  const rawLines = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out = [];
  for (const line of rawLines) {
    if ([...line].length <= maxCharsPerLine) {
      out.push(line);
      continue;
    }
    const words = line.split(/\s+/);
    let cur = '';
    for (const w of words) {
      const candidate = cur ? `${cur} ${w}` : w;
      if ([...candidate].length <= maxCharsPerLine) {
        cur = candidate;
      } else {
        if (cur) out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
  }
  return out.join('\\N');
}

/**
 * SRT 파일을 읽어 ASS 자막 내용으로 변환한다.
 * - 시작 시각이 2.0초 미만인 첫 자막은 화면 위 1/4 큰 자막(TopHook)으로 배치
 * - 나머지 본문 자막과 마지막 자막(예: 「무료 사주 명식 먼저 보기」)은
 *   릴스·틱톡·쇼츠·클립의 우측 버튼(오른쪽 180px)과 하단 설명란(아래 380px)에
 *   절대 겹치지 않는 안전 영역에 배치
 */
export function convertSrtToAss(srtContent) {
  const blocks = String(srtContent || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n\s*\n/);

  const cues = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const timeLineIdx = lines[0].includes('-->') ? 0 : 1;
    const timeLine = lines[timeLineIdx];
    if (!timeLine || !timeLine.includes('-->')) continue;
    const [startRaw, endRaw] = timeLine.split('-->').map((s) => s.trim());
    const start = parseSrtTime(startRaw);
    const end = parseSrtTime(endRaw);
    const text = lines.slice(timeLineIdx + 1).join('\n').replace(/<[^>]+>/g, '');
    if (end > start && text) {
      cues.push({ start, end, text });
    }
  }

  // ASS 헤더:
  // Alignment 8 = 상단 중앙 (MarginV=340 -> y≈340..480, 화면 위 1/4 자리)
  // Alignment 2 = 하단 중앙 (MarginL=110, MarginR=180, MarginV=380 -> 우측 아이콘/하단 캡션 회피)
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${WIDTH}
PlayResY: ${HEIGHT}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TopHook,${FONT_NAME},74,&H0078D4F0,&H000000FF,&H00140E0A,&H96000000,-1,0,0,0,100,100,0,0,1,6,3,8,110,180,340,1
Style: BottomBody,${FONT_NAME},58,&H00FFFFFF,&H000000FF,&H00140E0A,&H96000000,-1,0,0,0,100,100,0,0,1,5,2,2,110,180,390,1
Style: BottomCta,${FONT_NAME},64,&H006AD4FF,&H000000FF,&H00140E0A,&HB4000000,-1,0,0,0,100,100,0,0,1,6,3,2,110,180,380,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = cues.map((cue, idx) => {
    const isHook = cue.start < 2.0;
    const isLastOrCta = idx === cues.length - 1 || cue.text.includes('무료 사주 명식');
    const style = isHook ? 'TopHook' : (isLastOrCta ? 'BottomCta' : 'BottomBody');
    const maxChars = isHook ? 11 : 13;
    const wrapped = wrapKoreanLines(cue.text, maxChars);
    return `Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},${style},,0,0,0,,${wrapped}`;
  });

  return header + events.join('\n') + '\n';
}

function findSceneFile(folder, index) {
  const exts = ['.mp4', '.mov', '.webm', '.jpg', '.jpeg', '.png', '.webp'];
  for (const ext of exts) {
    const p = join(folder, `scene${index}${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

function findAudioFile(folder, baseName) {
  for (const ext of ['.mp3', '.wav', '.m4a', '.aac']) {
    const p = join(folder, `${baseName}${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

function getAudioDurationSec(audioPath) {
  const out = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath,
  ], { encoding: 'utf8' }).trim();
  const dur = parseFloat(out);
  if (!Number.isFinite(dur) || dur <= 0) {
    throw new Error(`음성 길이를 읽지 못했습니다: ${audioPath}`);
  }
  return dur;
}

function escapeFilterPath(p) {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

/**
 * 소재 폴더 하나를 조립하여 output/<codeName>.mp4 를 만든다.
 */
export function buildAdVideoForFolder(inputDir, outputDir = DEFAULT_OUTPUT_ROOT, bgmDb = -18) {
  const absIn = resolve(inputDir);
  const codeName = basename(absIn);
  const scenes = [1, 2, 3].map((i) => findSceneFile(absIn, i));
  if (scenes.some((s) => !s)) {
    throw new Error(`[${codeName}] scene1 ~ scene3 파일(mp4/jpg/png)이 모두 필요합니다.`);
  }
  const voicePath = findAudioFile(absIn, 'voice');
  if (!voicePath) {
    throw new Error(`[${codeName}] voice.mp3 또는 voice.wav 파일이 필요합니다.`);
  }
  const srtPath = join(absIn, 'subs.srt');
  if (!existsSync(srtPath)) {
    throw new Error(`[${codeName}] subs.srt 자막 파일이 필요합니다.`);
  }
  const bgmPath = findAudioFile(absIn, 'bgm');

  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(resolve(outputDir), `${codeName}.mp4`);

  const totalDuration = getAudioDurationSec(voicePath);
  const totalFrames = Math.max(3, Math.round(totalDuration * FPS));
  const f1 = Math.floor(totalFrames / 3);
  const f2 = Math.floor(totalFrames / 3);
  const f3 = totalFrames - f1 - f2;
  const frameCounts = [f1, f2, f3];

  const srtContent = readFileSync(srtPath, 'utf8');
  const assContent = convertSrtToAss(srtContent);
  const tempAssPath = join(absIn, `.tmp_${codeName}.ass`);
  writeFileSync(tempAssPath, assContent, 'utf8');

  try {
    const args = ['-y'];
    const filterParts = [];

    // 1. 장면 3개 입력 및 9:16 1080x1920 30fps 변환 (이미지일 때는 천천히 확대되는 줌 효과)
    scenes.forEach((scenePath, idx) => {
      const ext = extname(scenePath).toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
      const frames = frameCounts[idx];
      const segSec = (frames / FPS).toFixed(4);

      if (isImage) {
        args.push('-loop', '1', '-t', segSec, '-i', scenePath);
        filterParts.push(
          `[${idx}:v]scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,setsar=1,` +
          `zoompan=z='min(zoom+0.0007,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},` +
          `setsar=1,trim=duration=${segSec},setpts=PTS-STARTPTS,format=yuv420p[v${idx}]`
        );
      } else {
        args.push('-stream_loop', '-1', '-t', segSec, '-i', scenePath);
        filterParts.push(
          `[${idx}:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},` +
          `setsar=1,fps=${FPS},trim=duration=${segSec},setpts=PTS-STARTPTS,format=yuv420p[v${idx}]`
        );
      }
    });

    // 2. 음성 및 선택적 배경음 입력
    args.push('-i', voicePath);
    if (bgmPath) {
      args.push('-stream_loop', '-1', '-t', totalDuration.toFixed(4), '-i', bgmPath);
    }

    // 3. 비디오 연결 + ASS 자막 입히기
    const escapedAss = escapeFilterPath(tempAssPath);
    const escapedFonts = escapeFilterPath(FONTS_DIR);
    filterParts.push(
      `[v0][v1][v2]concat=n=3:v=1:a=0[vcat]`,
      `[vcat]subtitles='${escapedAss}':fontsdir='${escapedFonts}'[vout]`
    );

    // 4. 오디오 필터 (배경음이 있으면 기본 -18dB 로 낮춰 목소리와 합성)
    if (bgmPath) {
      filterParts.push(
        `[3:a]aresample=44100,volume=1.0[avoice]`,
        `[4:a]aresample=44100,volume=${bgmDb}dB[abgm]`,
        `[avoice][abgm]amix=inputs=2:duration=first:dropout_transition=0[aout]`
      );
    } else {
      filterParts.push(`[3:a]aresample=44100[aout]`);
    }

    args.push(
      '-filter_complex', filterParts.join(';'),
      '-map', '[vout]',
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-r', String(FPS),
      '-c:a', 'aac',
      '-b:a', '192k',
      '-t', totalDuration.toFixed(3),
      '-movflags', '+faststart',
      outputPath
    );

    execFileSync('ffmpeg', args, { stdio: 'inherit' });
    console.log(`✅ 완성: ${outputPath} (${totalDuration.toFixed(1)}초, 1080x1920, 30fps)`);
    return { outputPath, durationSec: totalDuration };
  } finally {
    try { unlinkSync(tempAssPath); } catch {}
  }
}

function printHelp() {
  console.log(`사용법:
  node tools/ad-video/assemble.mjs <소재폴더경로> [소재폴더경로2 ...]
  node tools/ad-video/assemble.mjs --all [--input-dir tools/ad-video/input] [--output-dir tools/ad-video/output] [--bgm-db -18]`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const rawArgs = process.argv.slice(2);
  if (!rawArgs.length || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    process.exit(rawArgs.length ? 0 : 1);
  }

  let inputRoot = DEFAULT_INPUT_ROOT;
  let outputRoot = DEFAULT_OUTPUT_ROOT;
  let bgmDb = -18;
  let runAll = false;
  const folders = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === '--all') {
      runAll = true;
    } else if (a === '--input-dir' && rawArgs[i + 1]) {
      inputRoot = rawArgs[++i];
    } else if (a === '--output-dir' && rawArgs[i + 1]) {
      outputRoot = rawArgs[++i];
    } else if (a === '--bgm-db' && rawArgs[i + 1]) {
      bgmDb = Number(rawArgs[++i]);
    } else {
      folders.push(a);
    }
  }

  if (runAll) {
    if (!existsSync(inputRoot)) {
      console.error(`입력 폴더가 없습니다: ${inputRoot}`);
      process.exit(1);
    }
    const entries = readdirSync(inputRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(inputRoot, d.name));
    folders.push(...entries);
  }

  if (!folders.length) {
    console.error('처리할 소재 폴더가 없습니다.');
    printHelp();
    process.exit(1);
  }

  for (const folder of folders) {
    buildAdVideoForFolder(folder, outputRoot, bgmDb);
  }
}
