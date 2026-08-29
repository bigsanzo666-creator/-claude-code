/**
 * 만세력 뷰어 빌드.
 *
 * 엔진을 단일 IIFE로 번들해서 HTML 템플릿의 /*__ENGINE__*\/ 자리에 끼워 넣는다.
 * 결과물은 외부 요청이 전혀 없는 파일 하나 — 생년월일이 브라우저 밖으로 나가지 않는다.
 *
 *   node apps/manse-viewer/build.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const scratch = mkdtempSync(join(tmpdir(), 'manse-'));
const bundlePath = join(scratch, 'engine.js');

execFileSync('npx', [
  '--yes', 'esbuild@0.24.0',
  '--bundle', join(here, 'entry.ts'),
  '--format=iife', '--global-name=MS', '--minify', '--target=es2020',
  `--outfile=${bundlePath}`,
], { stdio: 'inherit' });

const template = readFileSync(join(here, 'index.template.html'), 'utf8');
const engine = readFileSync(bundlePath, 'utf8');

const PLACEHOLDER = '/*__ENGINE__*/';
if (!template.includes(PLACEHOLDER)) {
  throw new Error(`템플릿에서 ${PLACEHOLDER} 를 찾지 못했습니다.`);
}

const outPath = join(here, 'index.html');
writeFileSync(outPath, template.replace(PLACEHOLDER, engine));
console.log(`${outPath} — ${(readFileSync(outPath).length / 1024).toFixed(1)}KB`);
