/** 뷰어 번들 진입점 — 브라우저에 노출할 API만 모은다. */
export { calculate, formatMyeongsik } from '../../packages/manseryeok/src/index.ts';
export {
  analyze, GOD_MEANING,
  calculateDaeun, currentDaeun, annualLuck, dailyLuck,
} from '../../packages/saju-rules/src/index.ts';
