/**
 * 리포트 전문 메일의 **모양**.
 *
 * 사장님 결정 (2026-11-25): 비싼 리포트 다섯 개(작명·작명 플러스·제왕절개 택일·
 * 혼인 택일·삼합)는 「감정서」처럼 표와 그림이 든 메일로, 나머지는 같은 표지에
 * 풀이 전문만 담은 가벼운 판으로 보낸다.
 *
 * ## 지키는 것
 *
 * - **숫자는 규칙 엔진에서만 꺼낸다.** 리포트를 지을 때 쓰는 같은 함수
 *   (`buildPayload`, `pickDays` …)를 다시 부른다. 메일과 글이 다른 숫자를 말하면
 *   그 순간 신뢰가 끝난다.
 * - **메일은 아무것도 막지 않는다.** 표 하나를 그리다 실패하면 그 칸만 빼고,
 *   전부 실패하면 가벼운 판으로 보낸다. 이 파일의 바깥 함수는 throw 하지 않는다.
 * - **메일 프로그램은 그림을 못 그린다.** 지메일·네이버 메일은 SVG·웹 글꼴·
 *   flex·grid 를 버린다. 그래서 전부 표(table)와 글자 안 스타일로만 짠다.
 */

import { CATALOG, type ProductId } from '../../../packages/commerce/src/index.ts';
import { calculate } from '../../../packages/manseryeok/src/index.ts';
import { analyze, pickDays, bestPerDay, mergeHours, slotSpan } from '../../../packages/saju-rules/src/index.ts';
import { hanja as 한자, readFrames, koreanHanjaMeaning, hanjaLegalReading } from '../../../packages/naming/src/index.ts';
import { buildPayload, sajuBundle, type ReadingRequest } from './payload.ts';

/** 표와 그림이 든 메일로 보내는 상품 */
export const PREMIUM_MAIL_PRODUCTS: readonly ProductId[] = [
  'naming-report', 'naming-plus-report', 'pick-report', 'marriage-pick-report', 'cross-report',
] as const;

export function isPremiumMail(productId: string | undefined): boolean {
  return Boolean(productId) && (PREMIUM_MAIL_PRODUCTS as readonly string[]).includes(productId!);
}

// ── 색과 글꼴 ───────────────────────────────────────────────
const NAVY = '#1E2A4A';
const GOLD = '#B08D57';
const SEAL = '#B23A2E';
const MUTE = '#8A7F6C';
const LINE = '#E4DACA';
const PAPER = '#F7F2E8';
const INK = '#1F2433';
const SERIF = "'Noto Serif KR','Nanum Myeongjo','AppleMyungjo','Batang',serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";

const EL: Record<string, { fg: string; bg: string; say: string; hj: string }> = {
  목: { fg: '#2F7D4F', bg: '#E6F2EA', say: '나무', hj: '木' },
  화: { fg: '#C2412D', bg: '#FBE9E5', say: '불', hj: '火' },
  토: { fg: '#B0812A', bg: '#F7EFDC', say: '흙', hj: '土' },
  금: { fg: '#6B7280', bg: '#EEF0F3', say: '쇠', hj: '金' },
  수: { fg: '#2B5C9E', bg: '#E5EEF9', say: '물', hj: '水' },
};

const COVER_HANJA: Partial<Record<ProductId, { kicker: string; hanja: string }>> = {
  'pick-report': { kicker: '擇日 鑑定書', hanja: '擇 日 鑑 定 書' },
  'marriage-pick-report': { kicker: '婚姻 擇日', hanja: '婚 姻 擇 日' },
  'naming-report': { kicker: '作名 鑑定書', hanja: '作 名 鑑 定 書' },
  'naming-plus-report': { kicker: '作名 鑑定書', hanja: '作 名 鑑 定 書' },
  'cross-report': { kicker: '三合 鑑定書', hanja: '三 合 鑑 定 書' },
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const WD = '일월화수목금토';
function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WD[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()] ?? '';
}
function monthDay(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일`;
}
function hourShort(time: string): string {
  const h = Number(time.slice(0, 2));
  return `${h > 12 ? h - 12 : h}시대`;
}

// ── 조각 ─────────────────────────────────────────────────────
function seal(size: number): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" width="${size}" height="${size}" style="border:3px solid ${SEAL};border-radius:8px;color:${SEAL};font-family:${SERIF};font-weight:700;font-size:${Math.round(size * 0.27)}px;line-height:1.1;background:#F7E6E2;">늘봄<br>鑑定</td></tr></table>`;
}

function section(title: string, hanja: string, sub: string, body: string): string {
  return `<tr><td style="padding:30px 22px 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-family:${SERIF};font-size:20px;font-weight:700;color:${INK};">${esc(title)} <span style="font-size:12px;color:${GOLD};letter-spacing:2px;font-weight:400;">${esc(hanja)}</span></td></tr>
${sub ? `<tr><td style="font-family:${SANS};font-size:13px;color:${MUTE};padding:4px 0 14px;">${esc(sub)}</td></tr>` : '<tr><td style="padding:0 0 12px;"></td></tr>'}</table>${body}</td></tr>`;
}

function card(inner: string, pad = '16px'): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${LINE};border-radius:14px;"><tr><td style="padding:${pad};">${inner}</td></tr></table>`;
}

function bar(pct: number, color: string, h = 10): string {
  const w = Math.max(2, Math.min(100, Math.round(pct)));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="${w}%" style="background:${color};height:${h}px;border-radius:${h / 2}px;font-size:0;line-height:0;">&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

function chip(text: string): string {
  return `<span style="display:inline-block;font-family:${SANS};font-size:11px;color:${MUTE};background:#F6F1E6;padding:3px 9px;border-radius:5px;">${esc(text)}</span>`;
}

/** 네 기둥 표. 「태어난 날」이 그 사람 자신이라 테를 두른다 */
function pillarsTable(ms: ReturnType<typeof calculate>): string {
  const cols: { title: string; p: any; me: boolean }[] = [
    { title: '태어난 시', p: (ms as any).hour, me: false },
    { title: '태어난 날', p: (ms as any).day, me: true },
    { title: '태어난 달', p: (ms as any).month, me: false },
    { title: '태어난 해', p: (ms as any).year, me: false },
  ];
  const head = cols.map((c) => `<td align="center" style="font-family:${SANS};font-size:11px;color:${c.me ? SEAL : MUTE};font-weight:${c.me ? 700 : 400};">${c.title}</td>`).join('');
  const cell = (p: any, part: 'stem' | 'branch', me: boolean) => {
    if (!p) return `<td align="center" width="25%" style="background:#F3EEE4;border-radius:10px;font-family:${SANS};font-size:11px;color:${MUTE};padding:14px 0;">모름</td>`;
    const el = EL[p.element?.[part]] ?? EL['토']!;
    const ch = part === 'stem' ? p.stemHanja : p.branchHanja;
    const ko = part === 'stem' ? p.stem : p.branch;
    return `<td align="center" width="25%" style="background:${el.bg};color:${el.fg};border:2px solid ${me ? el.fg : el.bg};border-radius:10px;padding:9px 0 7px;"><div style="font-family:${SERIF};font-size:28px;font-weight:700;line-height:1.15;">${esc(ch)}</div><div style="font-family:${SANS};font-size:11px;">${esc(ko)} · ${el.say}</div></td>`;
  };
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="5"><tr>${head}</tr>
<tr>${cols.map((c) => cell(c.p, 'stem', c.me)).join('')}</tr>
<tr>${cols.map((c) => cell(c.p, 'branch', c.me)).join('')}</tr></table>`;
}

/** 다섯 기운 막대 (메일은 원 그래프를 못 그린다) */
function elementsCard(elements: { element: string; weight: number }[]): string {
  const max = Math.max(...elements.map((e) => e.weight), 1);
  const rows = elements.map((e) => {
    const el = EL[e.element] ?? EL['토']!;
    return `<tr><td width="70" style="font-family:${SANS};font-size:13px;color:${INK};padding:5px 0;white-space:nowrap;">${el.say} <span style="font-size:11px;color:${MUTE};">${esc(e.element)}${el.hj}</span></td>
<td style="padding:5px 8px;">${bar((e.weight / max) * 100, el.fg, 12)}</td>
<td width="50" align="right" style="font-family:${SANS};font-size:13px;font-weight:700;color:${INK};">${esc(e.weight)}%</td></tr>`;
  }).join('');
  const empty = elements.filter((e) => e.weight <= 0).map((e) => EL[e.element]?.say ?? e.element);
  const note = empty.length
    ? `아예 비어 있는 기운: <b style="color:${NAVY};">${esc(empty.join('·'))}</b>`
    : `아예 빈 기운은 <b style="color:${NAVY};">없습니다.</b>`;
  return card(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<div style="font-family:${SANS};font-size:12px;color:${MUTE};margin-top:8px;">${note}</div>`, '12px 14px');
}

function reasonCards(items: { big: string; small?: string; basis?: string }[]): string {
  return items.map((r, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${LINE};border-left:4px solid ${GOLD};border-radius:10px;margin-bottom:8px;"><tr>
<td width="34" valign="top" align="center" style="font-family:${SERIF};font-size:19px;font-weight:700;color:${GOLD};padding:13px 0;">${i + 1}</td>
<td style="padding:13px 14px 13px 0;font-family:${SANS};"><div style="font-size:15px;font-weight:700;color:${INK};line-height:1.5;">${esc(r.big)}</div>${r.small ? `<div style="font-size:12px;color:${NAVY};margin-top:3px;">${esc(r.small)}</div>` : ''}${r.basis ? `<div style="margin-top:6px;">${chip(`근거 · ${r.basis}`)}</div>` : ''}</td></tr></table>`).join('');
}

function rankRow(mark: string, title: string, sub: string, score: string, band: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${LINE};border-radius:10px;margin-top:6px;"><tr>
<td width="40" align="center" style="font-family:${SERIF};font-size:20px;color:${GOLD};padding:12px 0;">${mark}</td>
<td style="font-family:${SANS};padding:12px 0;"><div style="font-size:15px;font-weight:700;color:${INK};">${esc(title)}</div>${sub ? `<div style="font-size:13px;color:${MUTE};">${esc(sub)}</div>` : ''}</td>
<td align="right" style="padding:12px 14px;font-family:${SANS};"><div style="font-family:${SERIF};font-size:19px;font-weight:700;color:${NAVY};">${esc(score)}</div><div style="font-size:12px;color:${MUTE};">${esc(band)}</div></td></tr></table>`;
}

const MARKS = ['①', '②', '③', '④', '⑤'];

/** 풀이 전문. 모델이 쓴 글을 **고치지 않고** 옮기되, 근거 줄과 굵은 글씨만 모양을 낸다 */
export function reportBodyHtml(reportText: string): string {
  const clean = reportText.replace(/\[\[가림:([\s\S]*?)\]\]/g, '$1').trim();
  const paras = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const bold = (s: string) => s.replace(/\*\*(.+?)\*\*/g, `<b style="color:${NAVY};">$1</b>`);
  let out = '';
  for (const para of paras) {
    const lines = para.split('\n');
    const rest: string[] = [];
    const tags: string[] = [];
    for (const line of lines) {
      const t = line.trim();
      if (/^근거\s*·/.test(t)) tags.push(t);
      else rest.push(line);
    }
    if (rest.length) {
      const first = rest[0]!.trim();
      if (rest.length === 1 && /^#{1,4}\s+/.test(first)) {
        out += `<div style="font-family:${SERIF};font-size:18px;font-weight:700;color:${NAVY};margin:8px 0 12px;">${esc(first.replace(/^#{1,4}\s+/, ''))}</div>`;
      } else if (rest.length === 1 && /^\*\*[^*]+\*\*$/.test(first)) {
        out += `<div style="font-family:${SERIF};font-size:17px;font-weight:700;color:${NAVY};margin:6px 0 10px;border-left:3px solid ${GOLD};padding-left:10px;">${esc(first.slice(2, -2))}</div>`;
      } else if (/^전문\s*·/.test(first)) {
        out += `<p style="margin:0 0 14px;font-family:${SANS};font-size:12px;line-height:1.7;color:${NAVY};background:#F3F0E8;border-radius:8px;padding:8px 10px;">${bold(esc(rest.join('\n'))).replace(/\n/g, '<br>')}</p>`;
      } else {
        out += `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.9;color:#2A2A2A;">${bold(esc(rest.join('\n'))).replace(/\n/g, '<br>')}</p>`;
      }
    }
    for (const t of tags) out += `<div style="margin:-6px 0 18px;">${chip(t)}</div>`;
  }
  return card(out, '20px 18px 4px');
}

// ── 상품별 감정 칸 ─────────────────────────────────────────────
interface Built { sections: string[]; coverRows: [string, string][]; preheader?: string }

/** 70점 이상이 상위 몇 %인지 — `pick.ts` 의 BANDS 주석에 적힌 분포 그대로 */
function pickTopShare(total: number): string | null {
  if (total >= 70) return '상위 2.5%';
  if (total >= 62) return '상위 12%';
  if (total >= 52) return '상위 34%';
  return null;
}
function pickColor(total: number): [string, string] {
  if (total >= 70) return [NAVY, '#ffffff'];
  if (total >= 62) return ['#3E5687', '#ffffff'];
  if (total >= 52) return ['#9BAACB', NAVY];
  if (total >= 38) return ['#DCE2EE', '#5B6478'];
  return ['#F1ECE3', '#9A8F7E'];
}

function buildPick(reading: ReadingRequest): Built {
  const payload = buildPayload(reading) as { data: any };
  const dates: string[] = payload.data.후보날;
  const times: string[] = reading.pick!.times;
  const longitude = reading.pick!.longitude;
  // 리포트를 지을 때와 **같은 함수, 같은 값**으로 다시 잰다
  const all = pickDays({ dates, times, longitude });
  /*
   * 순위는 리포트 글과 **같은 묶음**으로 센다. 글은 붙어 있는 시간대를 하나로
   * 묶은(mergeHours) 순위를 받으므로, 메일이 낱칸 순위를 쓰면 1순위가 달라질 수 있다.
   */
  const ranked = mergeHours(all);
  const top = ranked.slice(0, 3);
  const t1 = top[0]!;
  const span = (g: (typeof ranked)[number]) => slotSpan(g.time, g.untilTime);
  const sections: string[] = [];

  const gap = top[1] ? Math.round((t1.total - top[1].total) * 10) / 10 : null;
  const share = pickTopShare(t1.total);
  const hero = card(`<div style="text-align:center;font-family:${SANS};">
<span style="display:inline-block;background:${NAVY};color:#F3EAD7;font-size:12px;padding:4px 12px;border-radius:99px;">1순위</span>
<div style="font-family:${SERIF};font-size:28px;font-weight:700;color:${NAVY};margin:12px 0 2px;">${monthDay(t1.date)} ${weekday(t1.date)}요일</div>
<div style="font-size:17px;font-weight:700;color:${INK};">${esc(span(t1))}</div>
<div style="font-family:${SERIF};font-size:40px;font-weight:700;color:${NAVY};margin:14px 0 0;line-height:1;">${esc(t1.total)}<span style="font-size:14px;color:${MUTE};font-family:${SANS};font-weight:400;"> 점</span></div>
<div style="margin:12px 0 4px;">${bar((t1.total / 83) * 100, NAVY)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-family:${SANS};font-size:11px;color:${MUTE};">0</td><td align="right" style="font-family:${SANS};font-size:11px;color:${MUTE};">가장 높게 나오는 자리 82.7</td></tr></table>
<span style="display:inline-block;margin-top:8px;color:${SEAL};font-weight:700;border:1px solid ${SEAL};padding:2px 10px;border-radius:6px;font-size:13px;">${esc(t1.band)}${share ? ` · ${share}` : ''}</span>
${gap !== null && gap < 1 ? `<div style="text-align:left;font-size:13px;color:#5B5446;line-height:1.7;margin:14px 0 0;background:#FBF8F1;border-radius:10px;padding:12px;">2순위와 ${gap}점 차이라 <b>사실상 붙어 있습니다.</b> 병원 사정이 편한 쪽으로 고르셔도 됩니다.</div>` : ''}
</div>`, '22px 18px');
  sections.push(section('한눈에 보는 결론', '結論', `${all.length}칸을 모두 재어 가장 앞선 자리입니다`,
    hero + top.map((s, i) => rankRow(MARKS[i]!, `${monthDay(s.date)} (${weekday(s.date)})`, span(s), String(s.total), s.band)).join('')));

  // 후보 표 — 칸이 너무 많으면 휴대폰에서 읽을 수 없어 날마다 최고 하나로 줄인다
  const rankOf = new Map<string, number>();
  top.forEach((g, i) => {
    for (const s of all) {
      if (s.date === g.date && g.times.includes(s.time)) rankOf.set(`${s.date} ${s.time}`, i);
    }
  });
  if (times.length <= 6 && dates.length <= 31) {
    const cell = new Map(all.map((s) => [`${s.date} ${s.time}`, s]));
    const head = times.map((t) => `<td align="center" style="font-family:${SANS};font-size:11px;color:${MUTE};padding:0 0 4px;">${hourShort(t)}</td>`).join('');
    const rows = dates.map((d) => `<tr><td style="font-family:${SANS};font-size:12px;color:${INK};white-space:nowrap;padding-right:4px;">${monthDay(d)} <span style="color:${MUTE};">${weekday(d)}</span></td>${times.map((t) => {
      const s = cell.get(`${d} ${t}`);
      if (!s) return '<td></td>';
      const [bg, fg] = pickColor(s.total);
      const r = rankOf.get(`${d} ${t}`);
      const mark = r !== undefined ? `<span style="color:${bg === NAVY ? '#E8D3A8' : GOLD};font-size:11px;"> ${MARKS[r]}</span>` : '';
      return `<td align="center" style="background:${bg};color:${fg};border:2px solid ${r !== undefined ? GOLD : bg};border-radius:6px;font-family:${SANS};font-size:13px;font-weight:700;padding:7px 0;">${Math.round(s.total)}${mark}</td>`;
    }).join('')}</tr>`).join('');
    const legend = ([[NAVY, '아주 좋음 70+'], ['#3E5687', '좋음 62+'], ['#9BAACB', '무난 52+'], ['#DCE2EE', '아쉬움 38+'], ['#F1ECE3', '피하는 게 나음']] as const)
      .map(([c, n]) => `<span style="white-space:nowrap;"><span style="display:inline-block;width:10px;height:10px;background:${c};border-radius:3px;vertical-align:-1px;"></span> ${n}</span>`).join(' &nbsp; ');
    sections.push(section(`후보 ${all.length}칸 한눈에`, '全數', '진할수록 좋은 자리입니다. 금테가 1~3순위',
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="3"><tr><td></td>${head}</tr>${rows}</table>
<div style="font-family:${SANS};font-size:11px;color:${MUTE};line-height:1.9;margin-top:8px;">${legend}</div>`));
  } else {
    const best = bestPerDay(all).slice(0, 14);
    sections.push(section('날마다 가장 좋은 때', '全數', `${dates.length}일을 모두 재어 날마다 가장 앞선 시간만 모았습니다`,
      card(best.map((s) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="96" style="font-family:${SANS};font-size:13px;color:${INK};padding:6px 0;white-space:nowrap;">${monthDay(s.date)} <span style="color:${MUTE};">${weekday(s.date)}</span></td>
<td style="padding:6px 8px;">${bar((s.total / 83) * 100, pickColor(s.total)[0], 12)}</td>
<td width="44" align="right" style="font-family:${SANS};font-size:13px;font-weight:700;color:${INK};">${Math.round(s.total)}</td></tr></table>`).join(''), '12px 14px')));
  }

  const ms = calculate({ date: t1.date, time: t1.time, longitude });
  const an = analyze(ms);
  sections.push(section('1순위에 태어나면', '四柱', '아이가 갖게 될 여덟 글자입니다',
    pillarsTable(ms) + `<div style="font-family:${SANS};font-size:12px;color:${MUTE};line-height:1.6;margin-top:6px;">붉은 테가 아이 자신입니다. 해와 달은 그 기간에 이미 정해져 있고, 고를 수 있는 것은 날과 시 두 기둥입니다.</div>`));
  sections.push(section('다섯 기운의 균형', '五行', '한쪽이 너무 크거나 아예 빈 기운이 없는지 봅니다', elementsCard(an.elements)));
  sections.push(section('왜 1순위인가', '根據', '규칙으로 잰 결과를 그대로 옮겼습니다',
    reasonCards(t1.says.map((s) => ({ big: s, basis: `여덟 글자 ${t1.eight}` })))));
  sections.push(section('점수 읽는 법', '尺度', '',
    card(`<div style="font-family:${SANS};font-size:13px;line-height:1.75;color:${INK};">이 점수는 100점 만점 성적표가 아니라 <b>후보끼리 견주는 눈금</b>입니다. 여덟 글자 중 해와 달은 이미 정해져 있어 고를 수 있는 것은 절반뿐이라, 100점은 나오지 않습니다. 2026~2030년 낮 시간을 모두 재 보면 가장 높은 자리가 82.7점이고, <b>70점 이상은 상위 2.5%</b>입니다.</div>`)));
  sections.push(`<tr><td style="padding:22px 22px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${SEAL};border-radius:12px;background:#FBF1EE;"><tr><td style="padding:14px 16px;font-family:${SANS};font-size:13px;line-height:1.7;color:#5B2A22;"><b style="color:${SEAL};">몸이 먼저입니다.</b> 이 감정은 의사가 이미 된다고 한 날짜 안에서 고른 것입니다. 수술 날짜와 시각은 반드시 담당 의사의 판단을 따라 주세요.</td></tr></table></td></tr>`);

  const range = (reading as any).range;
  return {
    sections,
    coverRows: [
      ['후보 기간', range?.from && range?.to ? `${range.from} ~ ${range.to}` : `${dates[0]} ~ ${dates[dates.length - 1]}`],
      ['살펴본 칸', `${dates.length}일 × ${times.length}시간대 = ${all.length}칸`],
      ...(reading.pick?.place ? [['태어날 곳', reading.pick.place] as [string, string]] : []),
    ],
    preheader: `1순위는 ${monthDay(t1.date)} ${span(t1)}, ${t1.total}점입니다.`,
  };
}

// ── 혼인 택일 ───────────────────────────────────────────────
function marriageColor(score: number): string {
  if (score >= 80) return NAVY;
  if (score >= 65) return '#3E5687';
  if (score >= 50) return '#9BAACB';
  if (score >= 35) return '#DCE2EE';
  return '#E9D8D2';
}

function buildMarriage(reading: ReadingRequest): Built {
  const payload = buildPayload(reading) as { data: any };
  const d = payload.data;
  const best: any[] = d.제일좋은날 ?? [];
  const all: any[] = d.순위 ?? [];
  const avoid: any[] = d.피할날 ?? [];
  const b1 = best[0];
  if (!b1) throw new Error('혼인 택일 결과가 비었습니다');
  const sections: string[] = [];

  const hero = card(`<div style="text-align:center;font-family:${SANS};">
<span style="display:inline-block;background:${NAVY};color:#F3EAD7;font-size:12px;padding:4px 12px;border-radius:99px;">가장 좋은 날</span>
<div style="font-family:${SERIF};font-size:28px;font-weight:700;color:${NAVY};margin:12px 0 2px;">${monthDay(b1.날)} ${weekday(b1.날)}요일</div>
<div style="font-size:14px;color:${MUTE};">${esc(b1.날.slice(0, 4))}년 · ${esc(b1.여덟글자)}</div>
<div style="font-family:${SERIF};font-size:40px;font-weight:700;color:${NAVY};margin:14px 0 0;line-height:1;">${esc(b1.점수)}<span style="font-size:14px;color:${MUTE};font-family:${SANS};font-weight:400;"> 점</span></div>
<div style="margin:12px 0 4px;">${bar(Number(b1.점수), NAVY)}</div>
<span style="display:inline-block;margin-top:8px;color:${SEAL};font-weight:700;border:1px solid ${SEAL};padding:2px 10px;border-radius:6px;font-size:13px;">${esc(b1.등급)}</span>
</div>`, '22px 18px');
  sections.push(section('한눈에 보는 결론', '結論', `${all.length}일을 모두 견주어 가장 앞선 날입니다`,
    hero + best.slice(0, 5).map((x, i) => rankRow(MARKS[i]!, `${monthDay(x.날)} (${weekday(x.날)})`, x.여덟글자, String(x.점수), x.등급)).join('')));

  // 기간 안 날들이 어느 눈금에 몇 날씩 있는지
  const bands = ['아주 좋음', '좋음', '무난함', '아쉬움', '피하는 것이 좋음'];
  const colors = [NAVY, '#3E5687', '#9BAACB', '#DCE2EE', '#E9D8D2'];
  const counts = bands.map((b) => all.filter((x) => x.등급 === b).length);
  const maxCount = Math.max(...counts, 1);
  sections.push(section('기간 안의 날들', '全數', `${all.length}일이 어느 눈금에 몇 날씩 있는지입니다`,
    card(bands.map((b, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="104" style="font-family:${SANS};font-size:13px;color:${INK};padding:6px 0;white-space:nowrap;">${b}</td>
<td style="padding:6px 8px;">${bar((counts[i]! / maxCount) * 100, colors[i]!, 12)}</td>
<td width="40" align="right" style="font-family:${SANS};font-size:13px;font-weight:700;color:${INK};">${counts[i]}일</td></tr></table>`).join(''), '12px 14px')));

  const groom = sajuBundle(reading.birth);
  const bride = sajuBundle(reading.partner);
  sections.push(section('두 분의 여덟 글자', '四柱', '날을 고를 때 견준 두 분의 사주입니다',
    `<div style="font-family:${SANS};font-size:13px;font-weight:700;color:${NAVY};margin:0 0 4px;">신랑</div>${pillarsTable(groom.ms)}
<div style="font-family:${SANS};font-size:13px;font-weight:700;color:${NAVY};margin:14px 0 4px;">신부</div>${pillarsTable(bride.ms)}`));
  sections.push(section('왜 이 날인가', '根據', '규칙으로 잰 결과를 그대로 옮겼습니다',
    reasonCards((b1.까닭 as string[]).map((s) => ({ big: s, basis: `그날 ${b1.여덟글자}` })))));
  if (avoid.length) {
    sections.push(section('피하시면 좋은 날', '避日', '부딪힘이 강하거나 점수가 낮은 날입니다',
      card(avoid.slice(0, 6).map((x) => `<div style="font-family:${SANS};padding:7px 0;border-bottom:1px dashed ${LINE};"><b style="font-size:14px;color:${INK};">${monthDay(x.날)} (${weekday(x.날)})</b> <span style="font-size:12px;color:${MUTE};">${esc(x.점수)}점</span>${x.까닭?.[0] ? `<div style="font-size:12px;color:#5B5446;margin-top:2px;">${esc(x.까닭[0])}</div>` : ''}</div>`).join(''), '6px 14px')));
  }
  sections.push(section('점수 읽는 법', '尺度', '',
    card(`<div style="font-family:${SANS};font-size:13px;line-height:1.75;color:${INK};">이 점수는 100점 만점 성적표가 아니라 <b>주신 기간 안에서 서로 견주는 눈금</b>입니다. 80점 이상이면 두 분의 글자와 부딪힘 없이 어울리는 날, 65점 이상이면 순탄한 날입니다.</div>`)));
  return {
    sections,
    coverRows: [
      ['보신 기간', `${d.기간?.시작 ?? ''} ~ ${d.기간?.끝 ?? ''}`],
      ['견준 날', `${all.length}일`],
    ],
    preheader: `가장 좋은 날은 ${monthDay(b1.날)}(${weekday(b1.날)}), ${b1.점수}점입니다.`,
  };
}

// ── 작명 ─────────────────────────────────────────────────────
/**
 * 글에서 지어 드린 이름을 찾는다.
 *
 * 이름은 모델이 고르지만, 그 이름의 **획수와 네 격은 여기서 다시 잰다.** 글이 무엇을
 * 말했든 메일의 표는 규칙 엔진의 숫자다. 찾은 이름의 한자를 하나라도 모르면 그 이름은
 * 표에 싣지 않는다 — 모르는 것을 그럴듯하게 채우지 않는다.
 */
export function namesFromText(reportText: string, surname?: string): { hangul: string; hanja: string }[] {
  const out: { hangul: string; hanja: string }[] = [];
  const seen = new Set<string>();
  const re = /([가-힣]{2,4})\s*[(（]?\s*([一-鿿]{2,4})/g;
  for (const m of reportText.matchAll(re)) {
    const hangul = m[1]!;
    const hj = m[2]!;
    if ([...hangul].length !== [...hj].length) continue;
    if (surname && !hangul.startsWith(surname)) continue;
    const key = `${hangul}${hj}`;
    if (seen.has(key)) continue;
    const chars = [...hj];
    const sounds = [...hangul];
    if (!chars.every((c) => 한자(c))) continue;
    if (!chars.slice(1).every((c, i) => hanjaLegalReading(c, sounds[i + 1]!))) continue;
    seen.add(key);
    out.push({ hangul, hanja: hj });
    if (out.length >= 5) break;
  }
  return out;
}

function verdictColor(v: string): string {
  return v === '길' ? '#2F7D4F' : v === '흉' ? SEAL : '#B0812A';
}

function buildNaming(reading: ReadingRequest, reportText: string): Built {
  const payload = buildPayload(reading) as { data: any };
  const d = payload.data;
  const sections: string[] = [];
  const dated = Boolean(reading.child?.date) && !d.사주는보지않았음;
  const surname: string = d.적어주신것?.성 ?? reading.name?.surname ?? '';
  const surnameHangul = /[가-힣]/.test(surname) ? surname : '';
  const names = namesFromText(reportText, surnameHangul || undefined);

  if (names.length) {
    const cards = names.map((n, idx) => {
      const chars = [...n.hanja];
      const sounds = [...n.hangul];
      const strokes = chars.map((c) => 한자(c)!.strokes);
      const f = readFrames([strokes[0]!], strokes.slice(1));
      const charRows = chars.map((c, i) => {
        const h = 한자(c)!;
        const el = h.element ? EL[h.element] : undefined;
        /*
         * 뜻풀이 자료는 「물이름 연」처럼 훈과 음을 같이 적는데, 소리가 둘인 글자는
         * 다른 소리로 적혀 있을 때가 있다(沇 연/윤). 「윤」으로 지은 이름에 「연」이
         * 찍히면 안 되므로 훈만 쓴다. 소리는 바로 앞에 굵게 있다.
         */
        const mean = (koreanHanjaMeaning(c) || '').replace(/\s+[가-힣]$/, '');
        return `<tr><td width="44" align="center" style="font-family:${SERIF};font-size:24px;font-weight:700;color:${NAVY};padding:6px 0;">${esc(c)}</td>
<td style="font-family:${SANS};font-size:13px;color:${INK};padding:6px 4px;"><b>${esc(sounds[i])}</b> <span style="color:${MUTE};">${esc(mean)}</span></td>
<td width="44" align="right" style="font-family:${SANS};font-size:12px;color:${MUTE};">${h.strokes}획</td>
<td width="56" align="right">${el ? `<span style="display:inline-block;font-family:${SANS};font-size:11px;color:${el.fg};background:${el.bg};padding:2px 7px;border-radius:5px;">${el.say} ${el.hj}</span>` : ''}</td></tr>`;
      }).join('');
      const frames = ([['초년운', f.won, f.wonN], ['청년운', f.hyeong, f.hyeongN], ['장년운', f.i, f.iN], ['전체운', f.jeong, f.jeongN]] as const)
        .map(([k, n, info]) => `<td align="center" width="25%" style="background:#FBF8F1;border-radius:8px;padding:8px 0;font-family:${SANS};"><div style="font-size:11px;color:${MUTE};">${k}</div><div style="font-family:${SERIF};font-size:18px;font-weight:700;color:${INK};">${n}</div><div style="font-size:11px;font-weight:700;color:${verdictColor(info.verdict)};">${esc(info.verdict)} · ${esc(info.name)}</div></td>`).join('');
      return card(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-family:${SERIF};font-size:13px;color:${GOLD};">${MARKS[idx]}</td>
<td align="right" style="font-family:${SANS};font-size:11px;color:${f.allGood ? '#2F7D4F' : '#B0812A'};font-weight:700;">${f.allGood ? '네 격 모두 길' : '네 격 중 일부 보통'}</td></tr></table>
<div style="font-family:${SERIF};font-size:28px;font-weight:700;color:${NAVY};margin:4px 0 0;">${esc(n.hangul)} <span style="font-size:22px;color:${INK};">${esc(n.hanja)}</span></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px dashed ${LINE};">${charRows}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="4" style="margin-top:6px;"><tr>${frames}</tr></table>`, '14px 16px') + '<div style="height:8px;line-height:8px;">&nbsp;</div>';
    }).join('');
    sections.push(section('지어 드린 이름', '作名', '획수와 네 격은 규칙으로 다시 잰 값입니다', cards));
  }

  const asked = d.적어주신것 ?? {};
  sections.push(section('적어 주신 것', '依賴', '주문하실 때 적어 주신 그대로입니다',
    card(`<div style="font-family:${SANS};font-size:14px;line-height:2;color:${INK};">
<span style="color:${MUTE};">성</span>&nbsp;&nbsp; ${esc(asked.성 ?? surname)}<br>
<span style="color:${MUTE};">꼭 넣을 글자</span>&nbsp;&nbsp; ${asked.꼭_넣을_글자 ? `${esc(asked.꼭_넣을_글자.글자)} (${esc(asked.꼭_넣을_글자.자리)} 자리)` : '없음'}<br>
<span style="color:${MUTE};">피할 글자</span>&nbsp;&nbsp; ${asked.피할_글자?.length ? esc(asked.피할_글자.join(', ')) : '없음'}</div>`)));

  if (dated) {
    const bundle = sajuBundle(reading.child);
    const want: string[] = d.채워야할기운?.오행 ?? [];
    const avoidEl: string[] = d.채워야할기운?.덜어낼기운?.오행 ?? [];
    const chips = (els: string[]) => els.map((e) => {
      const c = EL[e];
      return c ? `<span style="display:inline-block;font-family:${SANS};font-size:13px;font-weight:700;color:${c.fg};background:${c.bg};padding:4px 10px;border-radius:6px;margin:0 4px 4px 0;">${c.say} ${c.hj}</span>` : '';
    }).join('');
    sections.push(section('아이의 여덟 글자', '四柱', d.예정일 ? '출산 예정일로 세운 것입니다' : '이름의 결을 정한 바탕입니다', pillarsTable(bundle.ms)));
    sections.push(section('다섯 기운의 균형', '五行', '', elementsCard(bundle.an.elements)));
    sections.push(section('이름으로 채운 기운', '補完', '', card(`<div style="font-family:${SANS};font-size:13px;color:${MUTE};margin-bottom:6px;">채워 준 기운</div>${want.length ? chips(want) : `<span style="font-family:${SANS};font-size:13px;color:${INK};">한쪽으로 크게 보탤 기운 없이 고른 편입니다</span>`}
<div style="font-family:${SANS};font-size:13px;color:${MUTE};margin:10px 0 6px;">덜어 준 기운</div>${avoidEl.length ? chips(avoidEl) : `<span style="font-family:${SANS};font-size:13px;color:${INK};">특별히 덜어낼 기운은 없습니다</span>`}`)));
  } else {
    sections.push(section('이렇게 지었습니다', '作名', '', card(`<div style="font-family:${SANS};font-size:13px;line-height:1.75;color:${INK};">아이의 태어난 날을 받지 못해, <b>성과 이름 획수의 길한 짝, 한자의 뜻, 부르는 소리, 대법원 인명용 한자</b>만으로 지었습니다. 아이가 태어나 날짜를 알게 되시면 그때 다시 봐 드릴 수 있습니다.</div>`)));
  }
  return {
    sections,
    coverRows: [
      ['성', surname],
      ...(names.length ? [['지어 드린 이름', `${names.length}개`] as [string, string]] : []),
    ],
    preheader: names.length ? `지어 드린 이름: ${names.map((n) => n.hangul).join(' · ')}` : undefined,
  };
}

// ── 삼합 ─────────────────────────────────────────────────────
function buildCross(reading: ReadingRequest): Built {
  const payload = buildPayload(reading) as { data: any };
  const d = payload.data;
  const cv = d.교차검증;
  if (!cv?.comparisons?.length) throw new Error('교차검증 결과가 비었습니다');
  const sources: string[] = d.보는_갈래 ?? [];
  const sections: string[] = [];
  const tally = [
    ['일치', cv.agreed?.length ?? 0, '#2F7D4F'],
    ['엇갈림', cv.conflicted?.length ?? 0, SEAL],
    ['한쪽만', cv.soloOnly?.length ?? 0, '#B0812A'],
  ] as const;
  sections.push(section('한눈에 보는 결론', '結論', `${sources.join(' · ')}를 ${cv.comparisons.length}개 축으로 맞대었습니다`,
    card(`<table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>${tally.map(([k, n, c]) => `<td align="center" width="33%" style="background:#FBF8F1;border-radius:10px;padding:12px 0;font-family:${SANS};"><div style="font-family:${SERIF};font-size:28px;font-weight:700;color:${c};">${n}</div><div style="font-size:12px;color:${MUTE};">${k}</div></td>`).join('')}</tr></table>
${cv.summary ? `<div style="font-family:${SANS};font-size:13px;line-height:1.75;color:${INK};margin-top:10px;">${esc(cv.summary)}</div>` : ''}`)));

  const vColor = (v: string) => (v === '일치' ? '#2F7D4F' : v === '엇갈림' ? SEAL : v === '단독' ? '#B0812A' : MUTE);
  const rows = cv.comparisons.map((c: any) => {
    const cells = sources.map((src) => {
      const r = c.readings?.find((x: any) => x.source === src);
      return `<td align="center" style="font-family:${SANS};font-size:12px;color:${INK};padding:8px 2px;border-top:1px dashed ${LINE};">${r ? esc(r.label) : `<span style="color:${MUTE};">—</span>`}</td>`;
    }).join('');
    return `<tr><td style="font-family:${SANS};font-size:13px;font-weight:700;color:${INK};padding:8px 0;border-top:1px dashed ${LINE};white-space:nowrap;">${esc(c.axis)}</td>${cells}<td align="right" style="padding:8px 0;border-top:1px dashed ${LINE};"><span style="display:inline-block;font-family:${SANS};font-size:11px;font-weight:700;color:${vColor(c.verdict)};">${esc(c.verdict)}</span></td></tr>`;
  }).join('');
  sections.push(section('축마다 맞대 보기', '對照', '같은 축을 갈래마다 어떻게 보는지입니다',
    card(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td></td>${sources.map((s) => `<td align="center" style="font-family:${SANS};font-size:11px;color:${MUTE};padding-bottom:4px;">${esc(s)}</td>`).join('')}<td></td></tr>${rows}</table>`, '12px 14px')));

  if (sources.includes('사주') && reading.birth?.date) {
    const bundle = sajuBundle(reading.birth);
    sections.push(section('타고난 여덟 글자', '四柱', '사주 갈래의 바탕입니다', pillarsTable(bundle.ms)));
    sections.push(section('다섯 기운의 균형', '五行', '', elementsCard(bundle.an.elements)));
  }
  if (cv.disclaimer) {
    sections.push(`<tr><td style="padding:18px 22px 0;font-family:${SANS};font-size:12px;color:${MUTE};line-height:1.7;">${esc(cv.disclaimer)}</td></tr>`);
  }
  return {
    sections,
    coverRows: [['맞대 본 갈래', sources.join(' · ')]],
    preheader: `일치 ${tally[0][1]} · 엇갈림 ${tally[1][1]} · 한쪽만 ${tally[2][1]}`,
  };
}

function buildPremium(productId: ProductId, reading: ReadingRequest, reportText: string): Built | null {
  if (productId === 'pick-report') return buildPick(reading);
  if (productId === 'marriage-pick-report') return buildMarriage(reading);
  if (productId === 'naming-report' || productId === 'naming-plus-report') return buildNaming(reading, reportText);
  if (productId === 'cross-report') return buildCross(reading);
  return null;
}

// ── 바깥 ─────────────────────────────────────────────────────
export interface ReportMailInput {
  productId?: string;
  productName: string;
  orderId: string;
  reportText: string;
  reading?: unknown;
  /** 메일 아래쪽 단추·안내. 작명서 단추처럼 mail.ts 가 정한다 */
  actionsHtml: string;
  /** 청약철회 안내·사업자 정보 */
  footerHtml: string;
  issuedAt?: Date;
}

export interface ReportMailOutput {
  html: string;
  /** 표와 그림이 든 판으로 나갔는가 */
  premium: boolean;
  /** 표를 그리다 실패했으면 그 까닭 (가벼운 판으로 대신 나간다) */
  fellBack?: string;
}

/** 절대 throw 하지 않는다. 무엇이 틀려도 최소한 풀이 전문은 나간다 */
export function renderReportMail(input: ReportMailInput): ReportMailOutput {
  const productId = input.productId as ProductId | undefined;
  let built: Built | null = null;
  let fellBack: string | undefined;
  if (productId && isPremiumMail(productId) && input.reading) {
    try {
      built = buildPremium(productId, { ...(input.reading as ReadingRequest), productId }, input.reportText);
    } catch (e) {
      built = null;
      fellBack = e instanceof Error ? e.message : String(e);
    }
  }
  const premium = Boolean(built);
  const cover = (productId && COVER_HANJA[productId]) || { kicker: '鑑定書', hanja: '鑑 定 書' };
  const product = productId ? CATALOG[productId] : undefined;
  const title = input.productName || product?.name || '사주 리포트';
  const issued = input.issuedAt ?? new Date();
  const kst = new Date(issued.getTime() + 9 * 3600_000);
  const issuedText = `${kst.getUTCFullYear()}. ${kst.getUTCMonth() + 1}. ${kst.getUTCDate()}`;
  const who = (input.reading as any)?.birth?.name?.trim?.();
  const rows: [string, string][] = [
    ...(who && !premium ? [['받는 분', `${who} 님`] as [string, string]] : []),
    ...(built?.coverRows ?? []),
    ['주문번호', input.orderId],
  ];
  const coverRowsHtml = rows.map(([k, v]) => `<span style="color:#A9A08C;">${esc(k)}</span>&nbsp;&nbsp; ${esc(v)}`).join('<br>');
  const preheader = built?.preheader ?? `${title} 풀이 전문을 보내 드립니다.`;

  const body = [
    ...(built?.sections ?? []),
    section('풀이 전문', '全文', premium ? '늘봄이 이 감정을 글로 풀어 드립니다' : '', reportBodyHtml(input.reportText)),
  ].join('\n');

  const html = `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>[늘봄사주] ${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#E9E2D4;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E9E2D4;"><tr><td align="center" style="padding:16px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${PAPER};border-radius:6px;">
<tr><td style="background:${NAVY};padding:14px;border-radius:6px 6px 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #6E6650;"><tr><td style="padding:28px 20px 24px;">
<div style="font-family:${SANS};font-size:11px;letter-spacing:4px;color:${GOLD};">NEULBOM · ${esc(cover.kicker)}</div>
<div style="font-family:${SERIF};font-size:${title.length > 14 ? 22 : title.length > 9 ? 26 : 32}px;font-weight:700;color:#F3EAD7;line-height:1.3;margin:12px 0 6px;">${esc(title)}</div>
<div style="font-family:${SERIF};font-size:14px;letter-spacing:8px;color:#CDB88F;">${esc(cover.hanja)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;"><tr>
<td valign="bottom" style="font-family:${SANS};font-size:13px;color:#F3EAD7;line-height:1.9;">${coverRowsHtml}</td>
<td width="64" valign="bottom" align="right">${seal(60)}</td></tr></table>
</td></tr></table></td></tr>
${body}
<tr><td align="center" style="padding:26px 22px 0;font-family:${SANS};">${input.actionsHtml}</td></tr>
<tr><td style="padding:28px 22px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};"><tr>
<td style="padding-top:16px;font-family:${SANS};font-size:11px;color:${MUTE};line-height:1.7;">발행 ${issuedText} · 늘봄사주<br>${input.footerHtml}</td>
<td width="52" align="right" valign="top" style="padding-top:16px;">${seal(46)}</td></tr></table></td></tr>
</table></td></tr></table>
</body>
</html>`;
  return { html, premium, ...(fellBack ? { fellBack } : {}) };
}
