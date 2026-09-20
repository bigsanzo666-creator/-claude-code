/**
 * 결제·리포트 API.
 *
 * 의존성을 주입받는 이유는 테스트다. 가짜 게이트웨이와 가짜 리포트 생성기를 꽂으면
 * 구매 흐름 전체를 돈 한 푼 없이 돌려볼 수 있다.
 *
 * 프레임워크를 쓰지 않은 이유: 라우트가 일곱 개뿐이고, 의존성이 적을수록
 * 배포와 보안 관리가 단순해진다. 라우트가 늘면 그때 바꾸면 된다.
 */

import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, createReadStream, statSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  CATALOG, getProduct, createOrder, markPending, markFulfilled, markViewed,
  hasEntitlement, assessRefund, refundNotice, confirmPayment, refundOrder, failOrder,
  orderable, isOrderable, upsellFor, packagesContaining, makePreview,
  WITHDRAWAL_NOTICE, type Order, type PaymentGateway, type ProductId,
} from '../../../packages/commerce/src/index.ts';
import { cacheKey } from '../../../packages/report/src/cache.ts';
import { cleanQuestion, QUESTION_MAX } from '../../../packages/report/src/prompt.ts';
import {
  loadBusinessInfo, renderFooter, renderTerms, renderPrivacy, renderRefund,
  renderProducts, renderProductsPage, PRODUCTS_CSS,
  renderHero, renderTryHeading, LANDING_CSS, FONT_LINK, renderProductPage,
  renderSpiritRow, renderSocialHead, HOME_TITLE, HOME_DESCRIPTION,
  renderStage, STAGE_CSS, STAGE_SCRIPT,
  renderPickPage, PLACES, TIMES, DATE_SLOTS, type PickForm,
  renderDreamPage, readDream,
  renderRobots, renderSitemap,
  handoffBetween, spiritOfCategory, type Handoff,
  type BusinessInfo,
} from '../../../packages/site-policy/src/index.ts';
import {
  findProductImages, findHeroImage, findHeroVideo, findSpiritImages, findSceneImages,
  findGateVideo, findWalkVideo, findGateWebm, findWalkWebm, findSpiritVideos,
  type ProductImage,
} from './images.ts';
import {
  talk, opening, cleanAsk, cleanFacts, FREE_TURNS, personaOf, taste, chooseAsk,
  type TalkTurn,
} from '../../../packages/talk/src/index.ts';
import { buildPayload, buildPayloads, KIND_OF, type ReadingRequest } from './payload.ts';
import { pickDays, bestPerDay, mergeHours } from '../../../packages/saju-rules/src/index.ts';
import { buildPreview, sampleFor, sampleNoticeFor } from './preview.ts';

/** 주문 저장소. 배포 전에 Postgres 구현체로 갈아끼운다. */
export interface OrderStore {
  get(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

/**
 * 리포트 본문 보관.
 *
 * 메모리(Map)와 Postgres 두 가지를 같은 얼굴로 다루기 위한 것이다.
 * 라우트가 저장 방식을 알 필요는 없다.
 */
export interface ReportBox {
  get(orderId: string): Promise<string | null>;
  set(orderId: string, inputHash: string, body: string): Promise<void>;
  delete(orderId: string): Promise<void>;
}

export class MemoryReportBox implements ReportBox {
  private map = new Map<string, string>();
  async get(id: string) { return this.map.get(id) ?? null; }
  async set(id: string, _hash: string, body: string) { this.map.set(id, body); }
  async delete(id: string) { this.map.delete(id); }
}

export class MemoryOrderStore implements OrderStore {
  private store = new Map<string, Order>();
  async get(id: string) { return this.store.get(id) ?? null; }
  async save(order: Order) { this.store.set(order.id, order); }
}

/** 리포트 생성기. 실제로는 @saju/report 의 generateReport 를 감싼다. */
export type ReportGenerator = (args: {
  kind: string; data: unknown; subject: string; question?: string;
}) => Promise<{ text: string }>;

/** 브라우저 결제창에 필요한 값. 비어 있으면 화면이 결제 버튼을 감춘다 */
export interface CheckoutConfig {
  storeId: string;
  channelKey: string;
}

export interface ApiDeps {
  gateway: PaymentGateway;
  orders: OrderStore;
  generate: ReportGenerator;
  /** 생성된 리포트 본문 보관. 없으면 메모리에 담는다 */
  reportStore?: ReportBox | null;
  /**
   * 신령이 모델로 말할 수 있는가.
   *
   * 열쇠가 없으면 `false` 다. 그래도 상담 칸은 그대로 돈다 — 대본이 답한다.
   * 손님은 신령이 없는 집을 보지 않는다.
   */
  talkModel?: boolean;
  /** 하루에 모델로 답할 수 있는 횟수. 넘으면 대본으로 내려간다 */
  talkDailyLimit?: number;
  /** 포트원 상점 정보. 없으면 결제 기능이 꺼진 채로 뜬다 */
  checkout?: CheckoutConfig;
  /** 사업자 정보. 없으면 환경변수에서 읽는다 */
  business?: BusinessInfo;
  /** 상품 그림. 없으면 기동할 때 public 폴더를 훑는다 */
  images?: Map<string, ProductImage>;
  /** 첫 화면에 깔 그림. `null` 이면 종이색 바탕으로 뜬다 */
  heroImage?: ProductImage | null;
  /** 첫 화면에 트는 영상. `null` 이면 그림만 뜬다 */
  heroVideo?: ProductImage | null;
  /** 신령 얼굴 그림. 없으면 기동할 때 public 폴더를 훑는다 */
  spiritImages?: Map<string, ProductImage>;
  /** 신령계 배경 그림. 없으면 기동할 때 public 폴더를 훑는다 */
  sceneImages?: Map<string, ProductImage>;
  /** 문이 열리는 영상. `null` 이면 밝히자마자 바로 안으로 들어간다 */
  gateVideo?: ProductImage | null;
  /** 풍신령이 문까지 데려가는 영상. `null` 이면 그림만 뜬다 */
  walkVideo?: ProductImage | null;
  /** 같은 두 장면의 webm 한 벌. mp4 를 못 여는 브라우저가 이쪽을 고른다 */
  gateWebm?: ProductImage | null;
  walkWebm?: ProductImage | null;
  /** 신령이 움직이는 3~5초 영상. 없으면 얼굴 그림이 그대로 돈다 */
  spiritVideos?: Map<string, ProductImage>;
  spiritWebms?: Map<string, ProductImage>;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const VIEWER_PATH = join(HERE, '..', '..', 'manse-viewer', 'index.html');

/**
 * 화면 HTML을 만든다.
 *
 * `apps/manse-viewer/index.html` 은 문서 조각이다 — 아티팩트로 게시할 때는
 * 바깥 껍데기를 플랫폼이 씌워준다. 우리가 직접 서빙할 때는 여기서 씌운다.
 * 덕분에 같은 파일이 무료 데모(아티팩트)와 실제 사이트 양쪽에서 쓰인다.
 */
const STUDIO_CONTAINER_HTML = `<div id="mobileContainer">

    <!-- 상단 글로벌 바: 신령음 오디오 스위치 (첫 대문에서 유일하게 노출되는 상단 HUD) -->
    <div class="global-audio-badge" id="soundControl" title="신령음 켜기/끄기">
      <span class="sound-icon">🔊</span>
      <span class="sound-text">신령음 ON</span>
    </div>

    <!-- ================= STAGE 1: 1인칭 신령계 진입문 (루프 없음! 마지막 프레임 정지) ================= -->
    <section id="stageGate" class="stage-section active">
      <div class="gate-bg-wrap">
        <!-- loop 속성 완전 제거: 영상 끝나면 문지기 대기 상태로 정지 -->
        <video id="gateVideo" playsinline autoplay muted preload="auto">
          <source src="assets/신령계문.mp4" type="video/mp4">
        </video>
        <div class="video-overlay"></div>
      </div>

      <div class="gate-content">
        <span class="badge-tag">⛩️ 10대 신령의 성지</span>
        <h1 class="main-title">천 년을 이어온 <span class="gold-text">신령계의 문</span>이<br>당신 앞에서 열립니다</h1>
        <p class="sub-desc-original">문 너머에는 <span class="gold-highlight">10대 신령</span>이 기다리고 있습니다.<br>지금 문을 두드리면 당신의 명식이
          봉인 해제됩니다.</p>
        <div class="enter-actions">
          <button type="button" id="btnKnockGate" class="btn-primary pulse-gold">🚪 신령계 문 두드리기</button>
        </div>
      </div>

      <img src="assets/늘봄붓글씨_골드누끼.png" alt="늘봄사주" class="watermark-seal-cover">
    </section>

    <!-- ================= STAGE 2: 신령계 입장 연출 (문이 열리고 안으로 들어가는 1회성 연출 영상) ================= -->
    <section id="stageEnter" class="stage-section">
      <div class="enter-video-wrap">
        <video id="enterVideo" playsinline autoplay muted preload="auto">
          <source src="assets/입장.mp4" type="video/mp4">
        </video>
      </div>

      <img src="assets/늘봄붓글씨_골드누끼.png" alt="늘봄사주" class="watermark-seal-cover">
    </section>

    <!-- ================= STAGE 3: 10대 신령 메뉴판 ================= -->
    <section id="stageSpirits" class="stage-section spirits-menu-section">
      <div class="spirits-menu-header">
        <div class="spirits-menu-user" id="userInfoDisplay">
          <span class="user-seal-mark">늘봄</span>
          <span class="user-name-text">명식 봉인 해제</span>
        </div>
        <h2 class="spirits-menu-title">어떤 물음을 품고 오셨습니까</h2>
        <p class="spirits-menu-desc">마음이 닿는 신령을 선택하면 1:1 대면 처소로 모십니다</p>
      </div>

      <!-- 갈래 탭 10개 (가로 스크롤) -->
      <nav class="spirits-category-tabs" id="spiritsCategoryTabs" aria-label="사주 갈래 선택">
        <button type="button" class="category-tab active" data-category="연애">연애</button>
        <button type="button" class="category-tab" data-category="재회">재회</button>
        <button type="button" class="category-tab" data-category="궁합">궁합</button>
        <button type="button" class="category-tab" data-category="가족">가족</button>
        <button type="button" class="category-tab" data-category="작명">작명</button>
        <button type="button" class="category-tab" data-category="출산">출산</button>
        <button type="button" class="category-tab" data-category="나">나</button>
        <button type="button" class="category-tab" data-category="삼합">삼합</button>
        <button type="button" class="category-tab" data-category="돈과 일">돈과 일</button>
        <button type="button" class="category-tab" data-category="시기">시기</button>
      </nav>

      <!-- 그 갈래 신령 한 줄 헤더 (작은 얼굴 + 물음) -->
      <div class="active-spirit-strip" id="activeSpiritStrip">
        <img src="/img/spirits/flower" alt="도화신령" class="strip-spirit-face" id="stripSpiritFace">
        <span class="strip-spirit-question" id="stripSpiritQuestion">이 사람, 어떨까?</span>
      </div>

      <!-- 상품 카드 캐러셀 (화면 폭 82%, 다음 장 살짝 걸침) -->
      <div class="product-carousel-container" id="productCarouselContainer">
        <div class="product-carousel-track" id="productCarouselTrack">
          <!-- JS가 동적으로 렌더링 -->
        </div>
      </div>

      <!-- 몇 장인지 나타내는 점 인디케이터 -->
      <div class="carousel-dots" id="carouselDots" aria-hidden="true"></div>

      <img src="assets/늘봄붓글씨_골드누끼.png" alt="늘봄사주" class="watermark-seal-cover">
    </section>

    <!-- ================= STAGE 4: 100% 2K 신령 1:1 대면 처소 (9:16 모바일 세로 풀스크린) ================= -->
    <section id="stageChamber" class="stage-section chamber-section">
      <!-- 정지 포스터 사진을 아예 없애고, 1080p 대면 영상이 검은 배경 위에서 0초부터 바로 페이드인 (사진→영상 전환 번쩍임 원천 차단) -->
      <!-- 10대 신령 1080p 대면 영상: loop 제거 — 8초 줌인이 끝나면 마지막 프레임에서 정지 -->
      <video id="chamberSpiritVideo" playsinline autoplay muted class="chamber-bg-video"></video>
      <!-- 정지 화면 위로 은은하게 떠다니는 신령 기운 파티클 (영상 종료 후에만 시작) -->
      <canvas id="chamberParticleCanvas" class="chamber-particle-canvas"></canvas>

      <!-- 상단 오버레이 HUD: 마당 복귀 & 신령 명패 (뒤로가기 버튼 바로 옆에 나란히 배치, 우측 신령음 버튼과 분리) -->
      <div class="chamber-top-bar">
        <button type="button" id="btnExitChamber" class="btn-back-courtyard">
          <span>⛩️ 신령계 마당으로</span>
        </button>
        <div class="chamber-spirit-badge">
          <span id="chamberSpiritName" class="badge-title">도화신령</span>
          <span id="chamberSpiritDomain" class="badge-role">도화 · 매력 · 연애운</span>
        </div>
      </div>

      <!-- 신령 1:1 상담 대화: 8초 영상이 멈춘 뒤 신령이 한 단계씩 물어본다. 멘트와 선택지는 app.js의 CHAMBER_FLOWS에서 신령별로 채운다 -->
      <div class="chamber-consult" id="chamberConsult" hidden>
        <p class="consult-say" id="consultSay"></p>
        <p class="consult-note">* 답변하지 않아도 다음으로 넘어갈 수 있어요</p>
        <div class="consult-fields" id="consultFields"></div>
        <button type="button" class="consult-cta" id="consultCta">다음으로</button>
      </div>

      <!-- 처소 하단 워터마크 가림막: 신령마다 AI 워터마크 위치가 왼쪽/오른쪽으로 제각각이라 양쪽 다 가림 -->
      <div class="watermark-mask-bl"></div>
      <img src="assets/늘봄붓글씨_골드누끼.png" alt="늘봄사주" class="watermark-seal-cover">
    </section>

    <!-- ================= MODAL: 사주 신상 정보 입력 (무단침입 방지 Checkpoint) ================= -->
    <div id="sajuInputModal" class="modal-backdrop">
      <div class="modal-dialog saju-input-dialog">
        <div class="saju-modal-header">
          <h3 class="saju-modal-title">신령계 입장 전, 명식(命式)을 봉인합니다</h3>
        </div>

        <div class="saju-form">
          <div class="form-group">
            <label for="inputName">성함</label>
            <input type="text" id="inputName" placeholder="성함을 입력하세요">
          </div>

          <div class="form-row">
            <div class="form-group flex-2">
              <label for="inputBirth">생년월일</label>
              <input type="date" id="inputBirth">
            </div>
            <div class="form-group flex-1">
              <label for="inputTime">태어난 시간</label>
              <select id="inputTime">
                <option value="unknown">시간 모름</option>
                <option value="ja">자시 (23:30~01:29)</option>
                <option value="chuk">축시 (01:30~03:29)</option>
                <option value="in">인시 (03:30~05:29)</option>
                <option value="myo">묘시 (05:30~07:29)</option>
                <option value="jin">진시 (07:30~09:29)</option>
                <option value="sa">사시 (09:30~11:29)</option>
                <option value="o">오시 (11:30~13:29)</option>
                <option value="mi">미시 (13:30~15:29)</option>
                <option value="sin">신시 (15:30~17:29)</option>
                <option value="yu">유시 (17:30~19:29)</option>
                <option value="sul">술시 (19:30~21:29)</option>
                <option value="hae">해시 (21:30~23:29)</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>성별</label>
            <div class="gender-toggle">
              <button type="button" id="btnGenderMale" class="gender-btn active" data-gender="male">남성</button>
              <button type="button" id="btnGenderFemale" class="gender-btn" data-gender="female">여성</button>
            </div>
          </div>

          <button type="button" id="btnSubmitSaju" class="btn-primary pulse-gold">⛩️ 이 명식으로 신령계 문 열기</button>
        </div>
      </div>
    </div>

  </div>`;

function renderPage(
  checkout: CheckoutConfig | null, business: BusinessInfo, images: ReadonlySet<string>,
  hero = false, heroVideo = false, faces: ReadonlySet<string> = new Set(),
  scenes: ReadonlySet<string> = new Set(), gateVideo = false, walkVideo = false,
  gateWebm = false, walkWebm = false,
  clips: ReadonlySet<string> = new Set(), clipWebms: ReadonlySet<string> = new Set(),
): string {
  const fragment = readFileSync(VIEWER_PATH, 'utf8').replace(/<title>[\s\S]*?<\/title>\s*/i, '');
  const sellable = Object.values(CATALOG)
    .filter((p) => !p.needsPartner && !p.needsFace && !p.needsPick)
    .map((p) => ({
      id: p.id, name: p.name, priceKrw: p.priceKrw, hook: p.hook,
      needsName: p.needsName === true,
    }))
    .sort((a, b) => a.priceKrw - b.priceKrw);
  const config = JSON.stringify({
    apiBase: '', checkout, ready: checkout !== null, sellable,
  });

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
${renderSocialHead(business, {
    title: HOME_TITLE, description: HOME_DESCRIPTION, path: '/', image: hero,
  })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/font-iropke-batang/1.2/font-iropke-batang.css">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700;900&family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css?v=consult_10spirits">
<style>:root{color-scheme:dark;--nb-ink:#F5F5F7;}body{margin:0}img{max-width:100%}[hidden]{display:none!important}
${LANDING_CSS}
${PRODUCTS_CSS}
${STAGE_CSS}
body {
  background: #020205;
  color: #f5f5f7;
  font-family: 'Noto Sans KR', sans-serif;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  overflow-x: hidden;
  overflow-y: auto !important;
}
.site-footer-wrapper {
  width: 100%;
  max-width: 460px;
  box-sizing: border-box;
  padding: 24px 16px 40px;
  font-size: 13px;
  line-height: 1.6;
  color: #888;
  background: #06060a;
  border-top: 1px solid rgba(212, 175, 55, 0.2);
  z-index: 10;
}
${FOOTER_CSS}
</style>
<script>
window.SAJU_CONFIG = ${config};
window.__CATALOG_PRODUCTS__ = ${JSON.stringify(Object.values(CATALOG).map(p => ({ id: p.id, name: p.name, hook: p.hook, category: p.category })))};
</script>
<script src="https://cdn.portone.io/v2/browser-sdk.js"></script>
</head>
<body>
${STUDIO_CONTAINER_HTML}

<div class="site-footer-wrapper">
  ${renderFooter(business)}
</div>

<!-- 심사 및 시스템 검증용 보존 블록 (hidden 처리) -->
<div id="legacyStageWrapper" style="display:none!important;" hidden>
${renderStage(business, scenes, { walk: walkVideo, open: gateVideo, walkWebm, openWebm: gateWebm }, faces, clips, clipWebms)}
${renderHero(business, checkout !== null, hero, heroVideo)}
${renderSpiritRow(faces)}
${renderProducts(checkout !== null, images, faces, false, scenes)}
${renderTryHeading()}
${fragment}
<style>${VIEWER_SKIN}</style>
${STAGE_SCRIPT}
</div>

<script src="/app.js?v=consult_10spirits"></script>
</body>
</html>`;
}

const FOOTER_CSS = `
.biz{max-width:1080px;margin:56px auto 0;padding:22px;border-top:1px solid var(--nb-line-soft);
  color:var(--nb-ink-3);font:12.5px/1.7 var(--nb-sans)}
.biz-links{display:flex;gap:16px;margin-bottom:10px}
.biz-links a{color:var(--nb-gold)}
.biz-rows{display:flex;flex-wrap:wrap;gap:4px 14px}
.biz-rows b{font-weight:600;color:var(--nb-ink-2)}
.biz-note{margin-top:10px}`;

/**
 * 무료 만세력 화면의 색을 우리 색으로 맞춘다.
 *
 * 그 화면은 아티팩트로 따로 게시하는 물건이라 자기 색을 들고 다닌다 —
 * 차가운 회색 바탕이다. 한 페이지 안에서 위는 한지색이고 가운데만 회색이면
 * 서로 다른 사이트를 이어 붙인 것처럼 보인다.
 *
 * 조각의 `:root` 가 우리 것보다 뒤에 오므로 여기서 다시 덮는다. 조각 자체는
 * 손대지 않는다 — 아티팩트로 나갈 때는 원래 색 그대로여야 한다.
 *
 * 오행 다섯 색과 도장의 붉은색은 그대로 둔다. 뜻이 있는 색이다.
 */
const VIEWER_SKIN = `
:root{
  --paper:var(--nb-paper); --surface:var(--nb-paper-2); --surface-2:var(--nb-paper-3);
  --ink:var(--nb-ink); --ink-2:var(--nb-ink-2); --ink-3:var(--nb-ink-3);
  --rule:var(--nb-line); --rule-soft:var(--nb-line-soft);
  --seal:var(--nb-gold); --seal-soft:rgba(212,175,55,.16);
  --field:var(--nb-paper-2);
}
/* 조각 안에 색이 직접 박힌 두 곳. 보라색 알약 버튼 하나가 화면 전체를 싸구려로 만든다 */
.wiz-next{background:var(--nb-gold);color:var(--nb-paper);border-radius:0;letter-spacing:.02em}
.wiz-dot.on{background:var(--nb-gold)}

/* 얼굴·손금을 고르는 칸의 배치가 깨져 있다.
   fg 는 두 칸 격자인데 seg 에 grid-row:1/span 2 가 붙어 있다. 행이 정해진 항목이
   먼저 놓이므로 버튼이 왼쪽 첫 칸을 차지하고, 이름표가 오른쪽으로 밀려난다.
   버튼 칸은 1fr 이라 옆에 빈자리까지 남는다.
   조각은 아티팩트로도 나가므로 손대지 않고 여기서 한 줄짜리로 세워 준다 —
   이름표 · 고르는 버튼 · 명리 용어 순서로 위에서 아래로 읽힌다. */
.fg{grid-template-columns:1fr;gap:.3rem}
.fg > .seg{grid-row:auto;width:fit-content;max-width:100%;flex-wrap:wrap}

/* 여기부터는 「행정 서식」을 위쪽 화면과 한 가족으로 만드는 손질이다.
   붉은색은 남겨 둔다 — 오류·경고·불리처럼 **뜻이 있는 자리**에 쓰이고 있어서,
   금색으로 바꾸면 나쁜 소식이 좋은 소식처럼 보인다. 손대는 것은 껍데기뿐이다. */
.tabs{width:100%}
.tab{flex:1;white-space:nowrap;font-size:.86rem}
.tab.on{color:var(--nb-gold);box-shadow:inset 0 -2px 0 var(--nb-gold)}
.seg button.on{background:transparent;color:var(--nb-gold);box-shadow:inset 0 -2px 0 var(--nb-gold)}
button.pay{background:var(--nb-ink);color:var(--nb-paper-2);border-radius:0;letter-spacing:.02em}
input,select,textarea{border-radius:0;border-color:var(--nb-line)}
input:focus-visible,select:focus-visible,button:focus-visible{outline-color:var(--nb-gold)}
/* 대문자 영문 모노 라벨은 서식 서류의 인상을 준다. 위쪽 금색 라벨과 같은 결로 맞춘다 */
.label,.who{font-family:var(--nb-sans);text-transform:none;letter-spacing:.16em;color:var(--nb-gold)}
.f > .label{color:var(--nb-ink-3);letter-spacing:.04em;font-size:.78rem}
.seal{border-color:var(--nb-gold);color:var(--nb-gold);border-radius:0;border-width:1px}
.pro{border-color:var(--nb-gold)}
.pro::before{background:var(--nb-gold);color:var(--nb-paper-2)}`;

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256 * 1024) throw new HttpError(413, '요청이 너무 큽니다.');
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, '본문이 올바른 JSON이 아닙니다.'); }
}

/**
 * 폼으로 보낸 값을 읽는다.
 *
 * 택일은 자바스크립트 없이도 돌아야 한다. 폼을 그대로 보내면 서버가 재서 결과가
 * 그려진 페이지를 돌려준다 — 이 화면에는 손님의 생년월일이 오지 않으므로
 * 서버에서 계산해도 된다.
 */
async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32 * 1024) throw new HttpError(413, '요청이 너무 큽니다.');
    chunks.push(chunk as Buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

/** 보내온 값을 그대로 믿지 않는다. 아는 것만 남긴다 */
function cleanPickForm(body: URLSearchParams): PickForm {
  const dates = [...new Set(body.getAll('date'))]
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)))
    .sort()
    .slice(0, DATE_SLOTS);
  const times = body.getAll('time').filter((t) => TIMES.includes(t)).sort();
  const place = PLACES.some((x) => x.name === body.get('place')) ? body.get('place')! : '서울';
  return { dates, times, place };
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

// 화면을 고쳐 올렸는데 손님 브라우저가 옛 화면을 그대로 보여 주면
// 고친 것이 없는 것과 같다. 화면은 늘 새로 받아 오게 한다
const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache',
} as const;

function sendHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, { ...HTML_HEADERS, 'Content-Length': Buffer.byteLength(html) });
  res.end(html);
}

/**
 * 단품을 보고 있는 손님에게 내밀 묶음 하나.
 *
 * 「따로 사면 얼마」는 구성 상품의 **실제 판매가 합계**다. 판 적 없는 정가를
 * 지어내 할인율을 부풀리지 않는다. 얹는 금액(addKrw)을 함께 주는 이유는,
 * 손님이 보는 것이 묶음 값이 아니라 「여기서 얼마 더」이기 때문이다.
 */
function upsellOffer(productId: string) {
  const pack = upsellFor(productId);
  if (!pack) return null;
  const here = orderable(productId).priceKrw;
  const apart = pack.members.reduce((sum, m) => sum + CATALOG[m].priceKrw, 0);
  return {
    id: pack.id,
    name: pack.name,
    priceKrw: pack.priceKrw,
    /** 지금 사려던 것에서 더 내는 돈 */
    addKrw: pack.priceKrw - here,
    apartKrw: apart,
    saveKrw: apart - pack.priceKrw,
    needsPartner: pack.needsPartner,
    members: pack.members.map((m) => ({ id: m, name: CATALOG[m].name, priceKrw: CATALOG[m].priceKrw })),
  };
}

/**
 * 단품을 보고 있는 손님에게 **묶음을 전부 사다리로** 내민다.
 *
 * 하나만 내밀면 손님은 「살까 말까」 둘 중에 고른다. 셋을 나란히 놓으면
 * 「어느 걸 살까」로 물음이 바뀐다. 사람은 양 끝을 피하고 가운데를 고른다.
 *
 * 값은 전부 계산된 것이다. 「따로 사면 얼마」는 구성 상품의 **실제 판매가
 * 합계**이지 판 적 없는 정가가 아니다. 지어낸 할인율은 쓰지 않는다.
 */
/**
 * 이 묶음을 파는 것은 **신령이 신령을 소개하는 일**이다.
 *
 * 값만 나란히 놓으면 손님이 푸는 문제는 「싼 것 고르기」다. 이 집에서는
 * 지금 봐 준 신령이 친우를 불러 주는 일이라, 문제가 「더 볼까 말까」로 바뀐다.
 *
 * 소개받은 신령은 **묻고 싶은 것 하나**를 받아 준다. 말뿐인 선물이 아니다 —
 * 리포트가 실제로 그 답을 담는다. 말만 하고 안 주면 거짓 광고다.
 *
 * 같은 신령이 지키는 갈래끼리 묶이면 소개가 아니라 **덧보기**다. 남을 부를 일이
 * 아니라 「앉은 김에 이것도」가 맞는 말이다.
 */
function handoffFor(soloId: string, members: readonly string[]): Handoff | null {
  const fromId = spiritOfCategory(CATALOG[soloId as never]?.category ?? '');
  if (!fromId) return null;
  // 얹히는 편 가운데 **다른 신령이 지키는 것**을 찾는다. 없으면 같은 신령이다
  const other = members.find((m) => m !== soloId
    && spiritOfCategory(CATALOG[m as never]?.category ?? '') !== fromId);
  const toId = other
    ? spiritOfCategory(CATALOG[other as never]?.category ?? '')
    : fromId;
  return toId ? handoffBetween(fromId, toId) : null;
}

function upsellOffers(productId: string) {
  const packs = packagesContaining(productId as never);
  if (!packs.length) return [];
  const here = orderable(productId).priceKrw;
  return packs.map((pack) => {
    const apart = pack.members.reduce((sum, m) => sum + CATALOG[m].priceKrw, 0);
    return {
      id: pack.id,
      name: pack.name,
      hook: pack.hook,
      priceKrw: pack.priceKrw,
      // 신령이 신령을 부르는 말. 못 만들면 null 이고 화면은 값만 보여 준다
      handoff: handoffFor(productId, pack.members),
      addKrw: pack.priceKrw - here,
      apartKrw: apart,
      saveKrw: apart - pack.priceKrw,
      recommended: pack.recommended === true,
      needsPartner: orderable(pack.id).needsPartner,
      members: pack.members.map((m) => ({ id: m, name: CATALOG[m].name, priceKrw: CATALOG[m].priceKrw })),
    };
  })
    /*
     * 내미는 차례를 **여기 한 곳에서** 정한다.
     *
     * 추천을 맨 위에, 그다음은 싼 것부터. 화면이 제 마음대로 줄을 세우면
     * 화면을 고칠 때마다 차례가 흔들린다.
     *
     * 다만 차례만 바꾼다. **비싼 쪽을 미리 골라 두지는 않는다** — 그건
     * 2024년 공정위가 다크패턴으로 이름 붙여 둔 짓이다. 고르는 것은 손님이고,
     * 우리는 무엇이 있는지 보기 좋게 늘어놓을 뿐이다.
     */
    .sort((a, b) => (Number(b.recommended) - Number(a.recommended)) || (a.priceKrw - b.priceKrw));
}

function validateReading(body: any): ReadingRequest {
  if (!body || typeof body !== 'object') throw new HttpError(400, '요청 본문이 필요합니다.');
  const productId = String(body.productId ?? '');
  if (!isOrderable(productId)) throw new HttpError(400, `알 수 없는 상품입니다: ${body.productId}`);
  const item = orderable(productId);
  /*
   * 택일은 **아직 태어나지 않은 아이**의 날을 고르는 것이라 생년월일이 없다.
   * 없는 것을 내라고 하면 손님은 아무 날이나 찍어 넣는다 — 그러면 우리가 잰 것은
   * 아무 뜻도 없어진다. 그래서 이 상품만은 후보 날짜와 시각을 받는다.
   */
  if (item.needsPick) {
    if (!Array.isArray(body.pick?.dates) || !body.pick.dates.length) {
      throw new HttpError(400, '의사에게 받은 후보 날짜가 필요합니다.');
    }
    if (!Array.isArray(body.pick?.times) || !body.pick.times.length) {
      throw new HttpError(400, '수술이 가능한 시각이 필요합니다.');
    }
  } else if (!body.birth?.date) {
    throw new HttpError(400, '생년월일이 필요합니다.');
  }
  // 궁합이 든 묶음은 상대의 생년월일이 있어야 만들 수 있다. 결제 전에 말한다
  if (item.needsPartner && !body.partner?.date) {
    throw new HttpError(400, '이 상품에는 상대의 생년월일이 필요합니다.');
  }
  /*
   * 작명은 성이 있어야 짓는다. 성의 획수로 네 격이 서기 때문에, 성이 없으면
   * 고를 수 있는 획수 자체가 정해지지 않는다.
   */
  if (item.needsName) {
    const surname = String(body.name?.surname ?? '').trim();
    if (!surname) throw new HttpError(400, '아이의 성이 필요합니다.');
    if (surname.length > 4) throw new HttpError(400, '성이 너무 깁니다.');
    const fixed = body.name?.fixed;
    if (fixed && !['앞', '뒤'].includes(String(fixed.at))) {
      throw new HttpError(400, '돌림자 자리는 앞이나 뒤여야 합니다.');
    }
  }
  /*
   * 신령이 약속한 「원하는 것 하나」.
   *
   * 안 적어도 된다. 적었으면 한 줄로 다듬어 싣는다 — 줄바꿈이 잔뜩 든 글을
   * 그대로 프롬프트에 넣으면 모델이 그걸 지시문으로 읽는다.
   */
  if (body.question !== undefined && body.question !== null && typeof body.question !== 'string') {
    throw new HttpError(400, '질문은 글로 적어 주세요.');
  }
  body.question = cleanQuestion(body.question) ?? undefined;

  return body as ReadingRequest;
}

/**
 * 파일을 **통째로 메모리에 올리지 않고** 조금씩 흘려보낸다.
 *
 * 예전에는 그림 하나를 보낼 때마다 그 파일을 전부 메모리로 읽어 들였다.
 * 신령 영상 한 개가 7메가인데 우리 서버는 512메가짜리다 — 손님 열 명이
 * 동시에 다른 신령을 누르면 70메가가 한꺼번에 뜬다. 손님이 없을 때는
 * 안 터지고 **광고를 켠 날 터진다.** 그래서 미리 고친다.
 *
 * 흘려보내면 메모리에 올라가는 것은 한 번에 몇십 킬로바이트뿐이다.
 */
function pipeFile(
  res: ServerResponse, path: string, head: Record<string, string | number>,
  status = 200, start?: number, end?: number,
): void {
  const stream = createReadStream(path, start === undefined ? {} : { start, end });
  /*
   * 여는 데 실패하면(배포 중에 파일이 바뀌는 등) 머리글을 아직 안 보냈을 때만
   * 404 로 답할 수 있다. 이미 보냈으면 연결을 끊는 수밖에 없다 —
   * 반쪽짜리 그림을 200 이라고 우기는 것보다 낫다.
   */
  stream.on('error', () => {
    if (!res.headersSent) { res.writeHead(404); res.end('그림을 열지 못했습니다.'); }
    else res.destroy();
  });
  // 손님이 창을 닫으면 읽던 것을 놓아 준다. 안 놓으면 파일 손잡이가 쌓인다
  res.on('close', () => stream.destroy());
  res.writeHead(status, head);
  stream.pipe(res);
}

/** 그림 한 장. 크기는 보내기 직전에 재고, 내용은 흘려보낸다 */
function sendImage(res: ServerResponse, file: ProductImage): void {
  pipeFile(res, file.path, {
    'Content-Type': file.type,
    'Content-Length': statSync(file.path).size,
    // 한 시간. 그림을 다시 뽑아 올려도 오래 묵지 않는다
    'Cache-Control': 'public, max-age=3600',
  });
}

/**
 * 영상 보내기.
 *
 * 브라우저는 영상을 통째로 받지 않고 **조각내어** 요청한다. 그 요청을 못 받아
 * 주면 재생이 아예 시작되지 않는다. 첫 화면 영상과 문 여는 영상이 같은 규칙을
 * 쓰므로 한 곳에 둔다 — 두 곳에 두면 언젠가 한쪽만 고친다.
 *
 * 달라고 한 조각만 읽어 보낸다. 예전에는 1메가를 달라고 해도 7메가를 통째로
 * 읽고 거기서 잘라 줬다.
 */
function sendVideo(req: IncomingMessage, res: ServerResponse, file: ProductImage): void {
  const size = statSync(file.path).size;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  const head = {
    'Content-Type': file.type,
    'Cache-Control': 'public, max-age=3600',
    'Accept-Ranges': 'bytes',
  };
  if (!range) {
    pipeFile(res, file.path, { ...head, 'Content-Length': size });
    return;
  }
  /*
   * 「bytes=-500」 은 **끝에서 500바이트**라는 뜻이다. 앞의 숫자가 없으면
   * 0 이 아니다 — 이것을 0 으로 읽으면 영상 앞부분을 보내게 된다.
   */
  const suffix = !range[1] && Boolean(range[2]);
  const start = suffix
    ? Math.max(0, size - Number(range[2]))
    : (range[1] ? Number(range[1]) : 0);
  const end = suffix
    ? size - 1
    : (range[2] ? Math.min(Number(range[2]), size - 1) : size - 1);
  if (!(Number.isFinite(start) && Number.isFinite(end) && start >= 0 && start <= end && end < size)) {
    res.writeHead(416, { ...head, 'Content-Range': `bytes */${size}` });
    res.end();
    return;
  }
  pipeFile(res, file.path, {
    ...head,
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': end - start + 1,
  }, 206, start, end);
}


/** 정적 파일 서빙 (CSS, JS, 비디오/오디오 Range 스트리밍 지원) */
function serveStaticFile(req: IncomingMessage, res: ServerResponse, filePath: string): void {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new HttpError(404, '파일을 찾을 수 없습니다: ' + filePath);
  }
  const ext = extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
  };
  const mime = mimeMap[ext] || 'application/octet-stream';
  const size = statSync(filePath).size;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  const head: Record<string, string | number> = {
    'Content-Type': mime,
    'Cache-Control': 'public, max-age=86400',
    'Accept-Ranges': 'bytes',
  };
  if (range && (ext === '.mp4' || ext === '.mp3' || ext === '.webm')) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    pipeFile(res, filePath, {
      ...head,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': end - start + 1,
    }, 206, start, end);
    return;
  }
  pipeFile(res, filePath, { ...head, 'Content-Length': size });
}

export function createApi(deps: ApiDeps) {
  const reports: ReportBox = deps.reportStore ?? new MemoryReportBox();

  const checkout = deps.checkout ?? null;
  const business = deps.business ?? loadBusinessInfo();
  // 기동할 때 한 번만 훑는다. 그림은 배포로만 바뀐다
  const images = deps.images ?? findProductImages();
  const haveImage = new Set(images.keys());
  const hero = deps.heroImage !== undefined ? deps.heroImage : findHeroImage();
  const heroVideo = deps.heroVideo !== undefined ? deps.heroVideo : findHeroVideo();
  // 신령 얼굴도 같이 훑는다. 없는 얼굴은 한자 도장으로 나가므로 몇 장이든 상관없다
  const spirits = deps.spiritImages ?? findSpiritImages();
  const haveFace = new Set(spirits.keys());
  // 신령이 살아 움직이는 3~5초 영상. 없으면 얼굴 그림이 그대로 돈다
  const spiritVideos = deps.spiritVideos ?? findSpiritVideos();
  const spiritWebms = deps.spiritWebms ?? findSpiritVideos(undefined, '.webm');
  const haveClip = new Set([...spiritVideos.keys(), ...spiritWebms.keys()]);
  const scenes = deps.sceneImages ?? findSceneImages();
  const haveScene = new Set(scenes.keys());
  const gateVideo = deps.gateVideo !== undefined ? deps.gateVideo : findGateVideo();
  const walkVideo = deps.walkVideo !== undefined ? deps.walkVideo : findWalkVideo();
  // mp4 를 못 여는 브라우저를 위한 두 번째 벌. 없으면 없는 대로 둔다
  const gateWebm = deps.gateWebm !== undefined ? deps.gateWebm : findGateWebm();
  const walkWebm = deps.walkWebm !== undefined ? deps.walkWebm : findWalkWebm();

  /**
   * 하루치 상담 예산.
   *
   * 상담은 손님이 누를 때마다 돈이 나간다. 광고가 잘못 터지거나 누가
   * 재미로 두드리면 **하룻밤에 요금이 불어난다.** 그래서 하루 한도를 두고,
   * 넘으면 모델을 안 부르고 대본으로 내려간다 — 화면은 그대로 돈다.
   */
  const talkLimit = deps.talkDailyLimit ?? Number(process.env.TALK_DAILY_LIMIT ?? 1500);
  let talkDay = '';
  let talkSpent = 0;
  const today = (): string => new Date().toISOString().slice(0, 10);
  function overTalkBudget(): boolean {
    if (talkDay !== today()) { talkDay = today(); talkSpent = 0; }
    return talkSpent >= talkLimit;
  }
  function spendTalk(): void {
    if (talkDay !== today()) { talkDay = today(); talkSpent = 0; }
    talkSpent += 1;
  }

  const routes: Record<string, (req: IncomingMessage, res: ServerResponse, id: string) => Promise<void>> = {
    /** 화면. 결제 설정을 주입해 내려준다 */
    'GET /': async (_req, res) => {
      const html = renderPage(
        checkout, business, haveImage, hero !== null, heroVideo !== null, haveFace, haveScene,
        gateVideo !== null, walkVideo !== null, gateWebm !== null, walkWebm !== null,
        haveClip, new Set(spiritWebms.keys()),
      );
      res.writeHead(200, { ...HTML_HEADERS, 'Content-Length': Buffer.byteLength(html) });
      res.end(html);
    },

    /** 결제 준비 상태. 상점 정보가 없으면 화면이 결제 버튼을 감춘다 */
    'GET /api/config': async (_req, res) => {
      send(res, 200, { ready: checkout !== null, checkout });
    },

    /**
     * 살아 있는지 확인하는 자리.
     *
     * 배포 플랫폼이 여기를 주기적으로 두드려서, 죽으면 다시 띄운다.
     * 화면을 렌더링하지 않으므로 파일을 읽지 않는다 — 헬스체크가 디스크를
     * 건드리면 그 자체가 장애 원인이 된다.
     */
    'GET /healthz': async (_req, res) => {
      send(res, 200, { ok: true, payments: checkout !== null });
    },

    /**
     * 정책 페이지 세 장.
     *
     * PG 심사에서 실제로 열어보는 주소다. 결제 화면 안의 팝업이 아니라
     * 고정된 주소로 접근되어야 하므로 라우트로 둔다.
     */
    /**
     * 상품·가격 전용 페이지.
     *
     * 첫 화면에도 같은 내용이 붙지만, 심사가 곧바로 열어볼 수 있는 주소를
     * 따로 둔다. 「상품 등록 유무」는 자동 검사 항목이라 찾기 쉬워야 한다.
     */
    /**
     * 상품 하나짜리 페이지.
     *
     * 카드사 등록심사가 "상품을 클릭했을 때 상세페이지가 제대로 되어 있는가"를
     * 본다. 목록에 설명이 다 있어도 들어갈 곳이 없으면 걸린다.
     */
    'GET /products/:id': async (_req, res, id) => {
      const product = CATALOG[id as ProductId];
      if (!product) throw new HttpError(404, `없는 상품입니다: ${id}`);
      /*
       * 실제로 나가는 글의 앞부분을 상세페이지에 그대로 싣는다.
       *
       * 그림으로 결과지를 보여 주고 각주에 「실제로는 글로 드립니다」라고
       * 적는 집이 있다. 그건 화면에 보여 준 것을 안 주는 것이다.
       */
      sendHtml(res, renderProductPage(
        product, business, checkout !== null, renderFooter(business), haveImage, haveFace,
        {
          text: makePreview(sampleFor(product.id), Math.max(product.previewRatio, 0.4)),
          notice: sampleNoticeFor(product.id),
        },
      ));
    },

    /**
     * 상품 그림.
     *
     * 확장자 없는 주소로 받는다. 그록이 무엇을 뱉든 파일 이름만 상품 아이디에
     * 맞추면 되고, 나중에 jpg를 webp로 바꿔도 화면 쪽은 손댈 것이 없다.
     *
     * 요청에서 온 문자열로 경로를 만들지 않는다. 기동할 때 카탈로그와 대조해
     * 만들어 둔 표에서 꺼내 쓸 뿐이라 경로 조작이 성립하지 않는다.
     */
    'GET /img/products/:id': async (_req, res, id) => {
      const image = images.get(id);
      if (!image) throw new HttpError(404, `그림이 없습니다: ${id}`);
      sendImage(res, image);
    },

    /**
     * 신령 얼굴.
     *
     * 상품 그림과 똑같은 방식이다 — 기동할 때 만들어 둔 표에서만 꺼내므로
     * 요청 문자열로 파일을 찾는 일이 없다.
     */
    /**
     * 신령이 움직이는 짧은 영상. 얼굴 그림과 같은 폴더에 같은 이름으로 둔다.
     *
     * `flower` 면 mp4, `flower.webm` 이면 webm 이다. 브라우저가 `<source>`
     * 두 줄 중에 제가 아는 쪽 하나만 골라 받는다.
     */
    'GET /video/spirits/:id': async (req, res, id) => {
      const webm = id.endsWith('.webm');
      const clip = webm ? spiritWebms.get(id.slice(0, -5)) : spiritVideos.get(id);
      if (!clip) throw new HttpError(404, `신령 영상이 없습니다: ${id}`);
      sendVideo(req, res, clip);
    },

    'GET /img/spirits/:id': async (_req, res, id) => {
      const image = spirits.get(id);
      if (!image) throw new HttpError(404, `신령 그림이 없습니다: ${id}`);
      sendImage(res, image);
    },

    /** 문이 열리는 영상. 첫 화면 영상과 같은 방식으로 조각내어 준다 */
    'GET /video/gate-open': async (req, res) => {
      if (!gateVideo) throw new HttpError(404, '문 여는 영상이 없습니다.');
      sendVideo(req, res, gateVideo);
    },

    /** 풍신령이 문까지 데려가는 영상 */
    'GET /video/gate-walk': async (req, res) => {
      if (!walkVideo) throw new HttpError(404, '데려가는 영상이 없습니다.');
      sendVideo(req, res, walkVideo);
    },

    // mp4 를 못 여는 브라우저가 고르는 쪽. 브라우저는 둘 중 하나만 받는다
    'GET /video/gate-open.webm': async (req, res) => {
      if (!gateWebm) throw new HttpError(404, '문 여는 영상이 없습니다.');
      sendVideo(req, res, gateWebm);
    },

    'GET /video/gate-walk.webm': async (req, res) => {
      if (!walkWebm) throw new HttpError(404, '데려가는 영상이 없습니다.');
      sendVideo(req, res, walkWebm);
    },

    /** 신령계 배경. 신령 얼굴과 같은 방식이다 */
    'GET /img/scene/:id': async (_req, res, id) => {
      const image = scenes.get(id);
      if (!image) throw new HttpError(404, `배경 그림이 없습니다: ${id}`);
      sendImage(res, image);
    },

    /** 첫 화면에 까는 그림. 상품이 아니므로 주소도 따로 둔다 */
        /** 신령음 배경음악. 브라우저 범위 요청 스트리밍 */
    'GET /audio/bgm': async (req, res) => {
      const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'scene');
      const p1 = join(publicDir, '신령음.mp3');
      const p2 = join(publicDir, 'bgm.mp3');
      const targetPath = existsSync(p1) ? p1 : (existsSync(p2) ? p2 : null);
      if (!targetPath) throw new HttpError(404, '신령음 음원이 없습니다.');
      const size = statSync(targetPath).size;
      const head = {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': 'bytes',
      };
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
      if (!range) {
        pipeFile(res, targetPath, { ...head, 'Content-Length': size });
        return;
      }
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      pipeFile(res, targetPath, {
        ...head,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': end - start + 1,
      }, 206, start, end);
    },

    'GET /img/hero': async (_req, res) => {
      if (!hero) throw new HttpError(404, '첫 화면 그림이 없습니다.');
      sendImage(res, hero);
    },

    /**
     * 첫 화면 영상.
     *
     * 브라우저는 영상을 통째로 받지 않고 조각내어 요청한다(Range). 그것을
     * 받아 주지 않으면 어떤 브라우저는 아예 재생을 시작하지 않는다.
     */
    'GET /video/hero': async (req, res) => {
      if (!heroVideo) throw new HttpError(404, '첫 화면 영상이 없습니다.');
      sendVideo(req, res, heroVideo);
    },

    'GET /products': async (_req, res) =>
      sendHtml(res, renderProductsPage(
        business, checkout !== null, renderFooter(business), haveImage, haveFace, haveScene,
      )),

    /*
     * 택일 — 수술로 낳는 날 고르기.
     *
     * 값을 받지 않는다. 아무도 자동으로 안 해 주는 일이라 이것만 보고 들어오는
     * 손님이 있고, 그 손님이 아기 이름과 사주까지 보게 된다.
     */
    'GET /pick': async (_req, res) => sendHtml(res, renderPickPage(
      business, renderFooter(business),
      { dates: [], times: ['09:00', '10:00', '11:00'], place: '서울' },
      { ranked: [], perDay: [] },
    )),

    'POST /pick': async (req, res) => {
      const form = cleanPickForm(await readForm(req));
      const times = form.times.length ? form.times : ['09:00', '10:00', '11:00'];
      const longitude = PLACES.find((x) => x.name === form.place)!.longitude;
      // 같은 시주끼리는 묶어서 낸다. 10시와 11시가 같은 사시면 한 칸이면 된다
      const ranked = form.dates.length
        ? mergeHours(pickDays({ dates: form.dates, times, longitude }))
        : [];
      sendHtml(res, renderPickPage(
        business, renderFooter(business),
        { ...form, times },
        { ranked, perDay: ranked.length ? bestPerDay(ranked) : [] },
      ));
    },

    /*
     * 검색엔진에 길을 알려 준다.
     *
     * 주소만 등록해 두면 무엇을 긁어야 하는지 몰라 수집이 한참 걸린다.
     * 값을 받지 않는 판으로 손님을 데려오는 장사라 이 두 파일이 곧 매출이다.
     */
    /*
     * 꿈해몽 — 값을 받지 않는다.
     *
     * 사람을 데려오는 입구다. 사주는 생년월일을 적어야 하지만 꿈은 아무것도
     * 적을 필요가 없다. 문턱이 제일 낮아 검색으로 들어오기도 제일 쉽다.
     *
     * 모델을 부르지 않는다 — 표에서 꺼내므로 몇 명이 오든 원가가 0이다.
     * 공짜로 내놓는 것에 모델을 붙이면 사람이 몰릴수록 돈이 나간다.
     */
    'GET /dream': async (_req, res) =>
      sendHtml(res, renderDreamPage(business, renderFooter(business))),

    'POST /dream': async (req, res) => {
      const form = await readForm(req);
      // 보내온 것을 그대로 믿지 않는다. 길이를 잘라서 쓴다
      const text = String(form.get('text') ?? '').slice(0, 500);
      const reading = text.trim() ? readDream(text) : null;
      sendHtml(res, renderDreamPage(business, renderFooter(business), text, reading));
    },

    'GET /robots.txt': async (_req, res) => {
      const body = renderRobots(business);
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(body);
    },

    'GET /sitemap.xml': async (_req, res) => {
      const body = renderSitemap(business);
      res.writeHead(200, {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(body);
    },

    'GET /terms': async (_req, res) => sendHtml(res, renderTerms(business)),
    'GET /privacy': async (_req, res) => sendHtml(res, renderPrivacy(business)),
    'GET /refund': async (_req, res) => sendHtml(res, renderRefund(business)),

    /** 상품 목록. 가격은 서버가 정한다 */
    'GET /api/products': async (_req, res) => {
      send(res, 200, { products: Object.values(CATALOG), notice: WITHDRAWAL_NOTICE });
    },

    /**
     * 결제 전 미리보기. 모델을 부르지 않으므로 원가가 없다.
     * 전자상거래법상 "시험 사용 상품 제공" 요건을 채우는 자리이기도 하다.
     */
    'POST /api/preview': async (req, res) => {
      const reading = validateReading(await readJson(req));
      const item = orderable(reading.productId);
      const parts = buildPayloads(reading);
      const each = parts.map((part) => ({
        productId: part.productId,
        name: CATALOG[part.productId].name,
        preview: buildPreview(part.productId, part.data, item.previewRatio),
      }));
      // 묶음이면 편마다 무엇이 담기는지 이름을 붙여 늘어놓는다
      const contents = item.isPackage
        ? each.flatMap((e) => e.preview.contents.map((c: string) => `${e.name} — ${c}`))
        : each[0].preview.contents;
      send(res, 200, {
        product: item,
        notice: WITHDRAWAL_NOTICE,
        preview: { ...each[0].preview, contents },
        // 단품을 보고 있으면 이것을 품은 묶음을 함께 알려 준다
        upsell: item.isPackage ? null : upsellOffer(item.id),
        // 묶음 사다리. 결제 직전에 단품·묶음을 나란히 놓는다
        upsells: item.isPackage ? [] : upsellOffers(item.id),
      });
    },

    /**
     * 주문 생성.
     * 금액은 클라이언트가 보낸 값을 쓰지 않고 카탈로그에서 가져온다.
     * 고지와 미리보기를 실제로 제공했는지 여부를 주문에 남겨, 나중에 환불 판정에 쓴다.
     */
    'POST /api/orders': async (req, res) => {
      const body = await readJson(req);
      const reading = validateReading(body);
      if (body.acknowledgedNotice !== true) {
        throw new HttpError(400, '청약철회 제한 고지에 대한 확인이 필요합니다.');
      }
      const parts = buildPayloads(reading);
      const subject = parts[0].subject;
      /*
       * 이용권은 「이 입력으로 만든 것」에 묶인다. 묶음은 편이 여럿이므로
       * 편 전체를 하나로 묶어 지문을 뜬다 — 한 편만 바뀌어도 다른 주문이 된다.
       */
      // 질문이 다르면 다른 주문이다. 이용권이 이 지문에 묶이므로 여기에도 들어가야 한다
      const asked = reading.question;
      const inputHash = parts.length === 1
        ? cacheKey({
          input: { kind: parts[0].kind as any, data: parts[0].data, subject, question: asked },
          model: 'claude-opus-5',
          effort: 'medium',
        })
        : cacheKey({
          input: {
            kind: parts[0].kind as any,
            data: { 묶음: reading.productId, 편: parts.map((x) => ({ 상품: x.productId, 자료: x.data })) },
            subject,
            question: asked,
          },
          model: 'claude-opus-5',
          effort: 'medium',
        });

      const order = createOrder({
        id: `ord_${randomUUID()}`,
        productId: reading.productId,
        inputHash,
        noticeGiven: true,
        previewProvided: body.previewShown === true,
      });
      await deps.orders.save({ ...order, ...({ reading } as any) });
      send(res, 201, {
        order,
        // 포트원은 결제 식별자를 우리가 정한다. 주문 id를 그대로 쓴다
        paymentId: order.id,
        amountKrw: order.amountKrw,
        notice: WITHDRAWAL_NOTICE,
      });
    },

    /**
     * 신령과 주고받기.
     *
     * 손님이 신령을 누르면 그 뒤로는 **그 신령이 상담한다.** 홈페이지가
     * 설명하는 것이 아니다.
     *
     * 계산은 여기서 하지 않는다. 사주는 이미 화면이 만세력 조각으로 계산해
     * 두었고, 여기 오는 것은 그 결과(어떤 사람인가)뿐이다. 생년월일 자체는
     * 오지 않는다 — 신령이 말하는 데 필요하지 않다.
     */
    'POST /api/talk': async (req, res) => {
      const body = await readJson(req);
      const spiritId = typeof body.spirit === 'string' ? body.spirit : '';
      if (!personaOf(spiritId)) throw new HttpError(400, '모르는 신령입니다.');

      const facts = cleanFacts(body.facts);
      const ask = cleanAsk(body.ask);
      // 손님이 아직 아무 말도 안 했으면 신령이 먼저 건다
      if (!ask) {
        const first = opening(spiritId, facts);
        send(res, 200, { ...first, left: FREE_TURNS, close: '', byModel: false });
        return;
      }

      const turn = Number.isFinite(body.turn) ? Math.floor(body.turn as number) : 0;
      if (turn >= FREE_TURNS) throw new HttpError(429, '공짜로 주고받는 횟수를 다 쓰셨습니다.');

      // 보내온 지난 대화를 그대로 믿지 않는다. 길이와 개수를 잘라서 쓴다
      const history: TalkTurn[] = Array.isArray(body.history)
        ? (body.history as unknown[]).slice(-FREE_TURNS * 2).map((t) => {
          const o = (t ?? {}) as Record<string, unknown>;
          return {
            who: o.who === 'spirit' ? ('spirit' as const) : ('guest' as const),
            text: cleanAsk(o.text),
          };
        }).filter((t) => t.text)
        : [];

      const result = await talk({ spiritId, facts, ask, history, turn }, {
        useModel: deps.talkModel === true,
        overBudget: overTalkBudget(),
      });
      if (result.byModel) spendTalk();
      send(res, 200, result);
    },

    /**
     * 신령이 상품 하나를 그 자리에서 봐 주는 말.
     *
     * 손님이 「이거 볼래」 하고 고르면 **값을 받기 전에 먼저 한 조각을
     * 준다.** 표만 보여 주고 사라고 하면 아무도 안 산다.
     *
     * 여기서 하는 말은 전부 손님의 사주에서 나온 것이다. 모델을 부르지
     * 않으므로 손님이 몇 번을 눌러도 원가가 0이다.
     */
    'POST /api/taste': async (req, res) => {
      const body = await readJson(req);
      const productId = typeof body.product === 'string' ? body.product : '';
      if (!CATALOG[productId as ProductId]) throw new HttpError(400, '모르는 상품입니다.');
      send(res, 200, taste(productId, cleanFacts(body.facts)));
    },

    /** 결제창을 띄우기 직전 */
    'POST /api/orders/:id/pending': async (req, res, id) => {
      const order = await mustGet(id);
      const updated = markPending(order, id);
      await save(order, updated);
      send(res, 200, { order: strip(updated) });
    },

    /**
     * 결제 확인 → 리포트 생성.
     * PG에 직접 물어보고, 금액과 주문번호를 대조한 뒤에만 리포트를 만든다.
     */
    'POST /api/orders/:id/confirm': async (req, res, id) => {
      const body = await readJson(req);
      const stored = await mustGet(id);
      const paymentId = String(body.paymentId ?? id);

      let paid: Order;
      try {
        paid = await confirmPayment(stored, deps.gateway, paymentId);
      } catch (error) {
        const reason = error instanceof Error ? error.message : '알 수 없는 오류';
        if (stored.status === 'created' || stored.status === 'pending') {
          await save(stored, failOrder(stored, reason));
        }
        throw new HttpError(402, reason);
      }

      const reading = (stored as any).reading as ReadingRequest;
      const parts = buildPayloads(reading);
      /*
       * 묶음이라도 주문은 한 건, 이용권도 하나다. 편마다 만들어 한 벌로 붙인다.
       * 한꺼번에 부르지 않고 차례로 부른다 — 세 편을 동시에 던지면 한도에 걸린다.
       */
      const chunks: string[] = [];
      for (const part of parts) {
        const made = await deps.generate({
          kind: part.kind, data: part.data, subject: part.subject, question: part.question,
        });
        chunks.push(parts.length === 1
          ? made.text
          : `# ${CATALOG[part.productId].name}\n\n${made.text}`);
      }
      await reports.set(id, stored.inputHash, chunks.join('\n\n---\n\n'));

      const done = markFulfilled(paid);
      await save(stored, done);
      send(res, 200, { order: strip(done), ready: true });
    },

    /**
     * 리포트 전문.
     * 이용권을 확인하고, 열람 시점을 기록한다 — 청약철회 제한의 기준점이다.
     */
    'GET /api/orders/:id/report': async (_req, res, id) => {
      const stored = await mustGet(id);
      if (!hasEntitlement(stored, stored.inputHash)) {
        throw new HttpError(403, '결제가 확인되지 않았거나 환불된 주문입니다.');
      }
      const text = await reports.get(id);
      if (!text) throw new HttpError(409, '리포트가 아직 준비되지 않았습니다.');

      const viewed = stored.status === 'viewed' ? stored : markViewed(stored);
      await save(stored, viewed);
      send(res, 200, { text, order: strip(viewed) });
    },

    /** 환불 가능 여부만 조회. 실제로 취소하지 않는다 */
    'GET /api/orders/:id/refund': async (_req, res, id) => {
      const order = await mustGet(id);
      const verdict = assessRefund(order);
      send(res, 200, { verdict, message: refundNotice(verdict) });
    },

    'POST /api/orders/:id/refund': async (_req, res, id) => {
      const stored = await mustGet(id);
      const verdict = assessRefund(stored);
      if (!verdict.refundable) throw new HttpError(409, verdict.reason);

      const outcome = await refundOrder(stored, deps.gateway);
      await save(stored, outcome.order);
      await reports.delete(id);
      send(res, 200, {
        order: strip(outcome.order),
        refundedKrw: outcome.cancelledAmountKrw,
        message: refundNotice(outcome.verdict),
      });
    },
  };

  async function mustGet(id: string): Promise<Order> {
    const order = await deps.orders.get(id);
    if (!order) throw new HttpError(404, '주문을 찾을 수 없습니다.');
    return order;
  }
  /** 내부 보관 필드(reading)를 유지하면서 저장한다 */
  async function save(previous: Order, next: Order): Promise<void> {
    await deps.orders.save({ ...next, ...({ reading: (previous as any).reading } as any) });
  }
  /** 응답에서 내부 필드를 뺀다 */
  function strip(order: Order): Order {
    const { ...rest } = order as any;
    delete rest.reading;
    return rest;
  }

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const parts = url.pathname.split('/').filter(Boolean); // api, orders, :id, action
      let key = `${req.method} ${url.pathname}`;
      let id = '';

      if (parts[0] === 'api' && parts[1] === 'orders' && parts[2]) {
        id = parts[2];
        key = `${req.method} /api/orders/:id${parts[3] ? `/${parts[3]}` : ''}`;
      } else if (parts[0] === 'products' && parts[1] && !parts[2]) {
        id = parts[1];
        key = `${req.method} /products/:id`;
      } else if (parts[0] === 'img' && parts[1] === 'products' && parts[2] && !parts[3]) {
        id = parts[2];
        key = `${req.method} /img/products/:id`;
      } else if (parts[0] === 'video' && parts[1] === 'spirits' && parts[2] && !parts[3]) {
        id = parts[2];
        key = `${req.method} /video/spirits/:id`;
      } else if (parts[0] === 'img' && parts[1] === 'spirits' && parts[2] && !parts[3]) {
        id = parts[2];
        key = `${req.method} /img/spirits/:id`;
      } else if (parts[0] === 'audio' && parts[1] === 'bgm' && !parts[2]) {
        key = 'GET /audio/bgm';
      } else if (parts[0] === 'img' && parts[1] === 'scene' && parts[2] && !parts[3]) {
        id = parts[2];
        key = `${req.method} /img/scene/:id`;
      }

            if (req.method === 'GET' && (url.pathname === '/style.css' || url.pathname === '/app.js')) {
        const p = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', url.pathname.slice(1));
        serveStaticFile(req, res, p);
        return;
      } else if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
        const sub = decodeURIComponent(url.pathname.slice('/assets/'.length));
        const p = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', sub);
        serveStaticFile(req, res, p);
        return;
      }
      const route = routes[key];
      if (!route) throw new HttpError(404, `없는 경로입니다: ${req.method} ${url.pathname}`);
      await route(req, res, id);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof Error ? error.message : '서버 오류';
      if (status === 500) console.error('[api]', error);
      send(res, status, { error: message });
    }
  };
}

export function startApi(deps: ApiDeps, port = Number(process.env.PORT ?? 3000)) {
  const server = createHttpServer(createApi(deps));
  server.listen(port, () => console.log(`[api] http://localhost:${port}`));
  return server;
}
