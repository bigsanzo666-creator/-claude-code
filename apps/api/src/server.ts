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
import { randomUUID, createHash } from 'node:crypto';
import {
  CATALOG, getProduct, createOrder, markPending, markPaid, markFulfilled, markViewed,
  generateInviteCode, isValidInviteCode, INVITE_DISCOUNT_KRW, INVITE_MIN_ORDER_KRW, COUNT_MIN_ORDER_KRW, REWARD_TIERS,
  hasEntitlement, assessRefund, refundNotice, confirmPayment, refundOrder, failOrder,
  orderable, isOrderable, upsellFor, packagesContaining, makePreview,
  calculateUpsellPrice, UPSELL_PROMO_HOURS, recommendNext,
  HOLIDAY_MAX_MEMBERS, HOLIDAY_INCLUDED_MEMBERS, HOLIDAY_EXTRA_MEMBER_KRW, extraMemberKrw,
  WITHDRAWAL_NOTICE, CATEGORIES, isLaunchSale, maxLaunchDiscountPercent, type Order, type PaymentGateway, type ProductId,
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
  renderCheckoutPage,
  renderDreamPage, readDream,
  renderRobots, renderSitemap,
  handoffBetween, spiritOfCategory, SPIRITS, type Handoff,
  type BusinessInfo,
  renderOrderNotFoundPage, renderOrderUnpaidPage,
  renderOrderPendingReportPage, renderOrderReportPage, renderInvitePage, renderAdminInvitePage,
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
import { buildPayload, buildPayloads, KIND_OF, sajuBundle, type ReadingRequest } from './payload.ts';
import { pickDays, bestPerDay, mergeHours, buildDailyPreviewData, buildMonthPreviewData, parseInputTime, luckyNumbers, analyze } from '../../../packages/saju-rules/src/index.ts';
import { calculate } from '../../../packages/manseryeok/src/index.ts';
import { buildPreview, sampleFor, sampleNoticeFor } from './preview.ts';
import { previewSections } from './preview-sections.ts';
import { sendOrderMail, sendReportMail, sendTestMail, mailReady, redactKey } from './mail.ts';
import { byReading, readSurname, goodPairs, koreanHanjaMeaning } from '../../../packages/naming/src/index.ts';
import { type ReferralStore, MemoryReferralStore } from '../../../packages/store/src/index.ts';

/**
 * 주인 통과 판정.
 * OWNER_PASS 와 글자 그대로 같을 때만 true 다.
 * OWNER_PASS 가 비어 있거나 16자 미만이면 무조건 false 다.
 */
export function isOwnerPass(candidate: unknown): boolean {
  const ownerPass = (process.env.OWNER_PASS ?? '').trim();
  const sent = typeof candidate === 'string' ? candidate.trim() : '';
  return ownerPass.length >= 16 && sent.length > 0 && sent === ownerPass;
}

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
  kind: string; data: unknown; subject: string; question?: string; productId?: string;
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
  /** 친구 추천 저장소 */
  referrals?: ReferralStore;
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
 * 만세력 엔진(MS)을 따로 내준다.
 *
 * 터진 뒤에 적은 것 (2026-10-03): 엔진이 첫 화면 HTML 안에만 박혀 있어서,
 * 상품 상세페이지에서는 얼굴·손을 **잴 수가 없었다.** 같은 엔진을 두 벌 만들면
 * 계산이 갈라지므로, 박혀 있는 그 덩어리를 그대로 꺼내 파일로 내준다.
 * 값은 늘 한 곳에서 온다.
 */
let 엔진조각: string | null = null;
function 엔진을꺼낸다(): string {
  if (엔진조각 !== null) return 엔진조각;
  try {
    const html = readFileSync(VIEWER_PATH, 'utf8');
    const i = html.indexOf('var MS=(');
    if (i < 0) { 엔진조각 = ''; return 엔진조각; }
    const end = html.indexOf('</script>', i);
    엔진조각 = end < 0 ? '' : html.slice(i, end);
  } catch {
    엔진조각 = '';
  }
  return 엔진조각;
}

/**
 * 화면 HTML을 만든다.
 *
 * `apps/manse-viewer/index.html` 은 문서 조각이다 — 아티팩트로 게시할 때는
 * 바깥 껍데기를 플랫폼이 씌워준다. 우리가 직접 서빙할 때는 여기서 씌운다.
 * 덕분에 같은 파일이 무료 데모(아티팩트)와 실제 사이트 양쪽에서 쓰인다.
 */
/**
 * 숨겨 둔 보존 블록 안의 영상을 재우는 손질.
 *
 * `display:none` 은 그리기를 막을 뿐 **내려받기를 막지 못한다.** 보존 블록에는
 * 신령 영상이 여덟 벌씩 두 갈래(mp4·webm)로 들어 있어서, 손님이 첫 화면을 보는
 * 동안 브라우저가 50MB 를 통신선에 밀어 넣었다. 그동안 정작 보여야 할 메뉴판
 * 그림은 뒤로 밀려 1분 넘게 까맣게 남았다 — 사장님 휴대폰에서 실제로 그랬다.
 *
 * 태그는 그대로 둔다(심사·검증이 `<source src=...>` 를 본다). 눈에 보이지 않는
 * 동안 저 혼자 받아 오지만 않게 `autoplay` 를 떼고 `preload` 를 `none` 으로 돌린다.
 */
function idleVideos(html: string): string {
  return html
    .replace(/<video(\s[^>]*)>/g, (_m, attrs: string) => {
      const quiet = attrs
        .replace(/\sautoplay(?==|\b)/g, '')
        .replace(/\spreload="[^"]*"/g, '');
      return `<video${quiet} preload="none">`;
    });
}

/**
 * 손님 휴대폰에 남아 있는 옛 화면 글을 확실히 갈아 끼우는 꼬리표.
 *
 * `app.js` 와 `style.css` 는 하루짜리로 저장된다. 그런데 주소 뒤에 붙이는
 * 꼬리표를 손으로 적어 두었더니, 글은 고쳤는데 꼬리표는 그대로였다.
 * 그래서 어제 다녀간 손님 휴대폰은 **새 화면 뼈대에 옛 글**을 얹어 돌렸고,
 * 입장 영상이 통째로 안 나왔다. 실제로 그렇게 나갔다.
 *
 * 이제 꼬리표를 파일 내용에서 뽑는다. 한 글자라도 고치면 저절로 바뀌므로
 * 손으로 적을 일이 없다.
 */
function assetStamp(...names: string[]): string {
  const h = createHash('sha1');
  for (const n of names) {
    try {
      h.update(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', n)));
    } catch {
      h.update(n);
    }
  }
  return h.digest('hex').slice(0, 10);
}

/*
 * 갈래 단추는 **상품표에서 뽑는다.**
 *
 * 터진 뒤에 적은 것 (2026-09-28): 「시험과 취업」 갈래를 새로 만들었는데 여기
 * 단추 열한 개가 손으로 적혀 있어서 그 갈래만 단추가 없었다. 급제신령 상품
 * 네 개를 갈래로 찾아 들어올 길이 없었다. 손으로 적은 목록은 반드시 어긋난다.
 */
const CATEGORY_MENU = CATEGORIES.map((c) => {
  const spirit = SPIRITS.find((s) => s.keeps === c.key);
  return {
    name: c.key,
    spirit: { id: spirit?.id ?? '', name: spirit?.name ?? '', question: c.question },
  };
});

const CATEGORY_TABS = [
  '<button type="button" class="category-tab active" data-category="전체">전체</button>',
  ...CATEGORIES.map((c) =>
    `<button type="button" class="category-tab" data-category="${c.key}">${c.key}</button>`),
].join('\n          ');

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
        <video id="gateVideo" playsinline autoplay muted preload="auto" poster="assets/신령계문_첫장면.jpg">
          <source src="assets/신령계문.mp4" type="video/mp4">
        </video>
        <div class="video-overlay"></div>
      </div>

      <div class="gate-content">
        <span class="badge-tag">⛩️ 신령들의 성지</span>
        <h1 class="main-title">천 년을 이어온 <span class="gold-text">신령계의 문</span>이<br>당신 앞에서 열립니다</h1>
        <p class="sub-desc-original">문 너머에는 <span class="gold-highlight">신령들</span>이 기다리고 있습니다.<br>문을 두드리면 당신의 명식이
          봉인 해제됩니다.</p>
        <div class="enter-actions">
          <button type="button" id="btnKnockGate" class="btn-primary pulse-gold">🚪 신령계 문 두드리기</button>
        </div>
      </div>
    </section>

    <!-- ================= STAGE 2: 신령계 입장 연출 (문이 열리고 안으로 들어가는 1회성 연출 영상) ================= -->
    <section id="stageEnter" class="stage-section">
      <div class="enter-video-wrap">
        <!-- 첫 화면에서는 한 조각도 내려받지 않는다. 문을 두드린 뒤에야 받아 온다 —
             그래야 대문 영상과 메뉴판 그림이 통신선을 나눠 쓰지 않는다 -->
        <video id="enterVideo" playsinline muted preload="none" data-src="assets/입장.mp4"></video>
      </div>
    </section>

    <!-- ================= STAGE 3: 10대 신령 메뉴판 ================= -->
    <section id="stageSpirits" class="stage-section spirits-menu-section">
      <!-- 벗의 증표(소개 코드) 수동 입력창: 왼쪽 위 빈 자리 -->
      <div class="stage-invite-badge" id="stageInviteBadge">
        <button type="button" class="stage-invite-btn" id="btnOpenStageInvite">벗의 증표가 있으십니까?</button>
        <div class="stage-invite-fold" id="stageInviteFold" style="display:none">
          <div class="stage-invite-input-row">
            <input type="text" id="stageInviteInput" placeholder="증표 코드 입력" maxlength="16" autocomplete="off">
            <button type="button" id="stageInviteSubmit">확인</button>
          </div>
          <p class="stage-invite-msg" id="stageInviteMsg"></p>
        </div>
      </div>

      <div class="spirits-menu-header">
        <div class="spirits-menu-user" id="userInfoDisplay">
          <span class="user-name-text">명식 봉인 해제</span>
        </div>
        <h2 class="spirits-menu-title">어떤 물음을 품고 오셨습니까</h2>
        <p class="spirits-menu-desc"><span class="nb-brk">상품을 누르시면 신령이</span><br><span class="nb-brk">그 자리에서 사주를 봐 드립니다</span></p>
        <div class="spirits-free-duo">
          <button type="button" class="spirits-free-btn" id="btnFreeEightLetters">
            <span class="spirits-free-badge">무료</span>
            <span class="spirits-free-icon">⛩</span>
            <div class="spirits-free-content">
              <div class="spirits-free-text">내 사주 여덟 글자</div>
              <div class="spirits-free-sub">태어난 날로 보는 내 글자</div>
            </div>
            <span class="spirits-free-arrow">→</span>
          </button>
          <a href="/dream" class="spirits-free-btn" id="btnFreeDream">
            <span class="spirits-free-badge">무료</span>
            <span class="spirits-free-icon">🌙</span>
            <div class="spirits-free-content">
              <div class="spirits-free-text">꿈해몽</div>
              <div class="spirits-free-sub">간밤에 꾼 꿈을 풀어 드립니다</div>
            </div>
            <span class="spirits-free-arrow">→</span>
          </a>
        </div>
        <a href="/invite" class="spirits-invite-bar"><span class="nb-brk">벗에게 ${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원 할인증표 보내고</span><br><span class="nb-brk">그대도 역대급 보답을 받으시지요 →</span></a>
      </div>

      <!-- 갈래 탭 11개 (가로 스크롤) -->
      <div class="spirits-tabs-wrapper">
        <button type="button" class="tabs-arrow-btn prev" id="tabsArrowPrev" aria-label="이전 탭">‹</button>
        <nav class="spirits-category-tabs" id="spiritsCategoryTabs" aria-label="사주 갈래 선택">
          ${CATEGORY_TABS}
        </nav>
        <button type="button" class="tabs-arrow-btn next" id="tabsArrowNext" aria-label="다음 탭">›</button>
      </div>

      <!-- 세로 상품 목록 -->
      <div class="product-vertical-container" id="productCarouselContainer">
        <div class="product-vertical-list" id="productCarouselTrack">
          <!-- JS가 동적으로 렌더링 -->
        </div>
      </div>
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

          <div class="form-group">
            <label for="inputBirth">생년월일</label>
            <input type="date" id="inputBirth">
          </div>

          <div class="form-group">
            <label for="inputTime" style="white-space:nowrap;">태어난 시간 (시:분)</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="text" inputmode="numeric" id="inputTime" placeholder="예: 14:40, 1440, 905" style="flex:1 1 auto;">
              <label for="inputTimeUnknown" style="display:flex;align-items:center;gap:4px;font-size:12px;color:#c8c2d4;cursor:pointer;white-space:nowrap;margin-bottom:0;">
                <input type="checkbox" id="inputTimeUnknown" style="width:auto;margin:0;"> 모름
              </label>
            </div>
            <select id="inputTimeSlot" style="display:none;margin-top:6px;">
              <option value="unknown">시간 모름 (낮 12시로 계산)</option>
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

          <div class="form-group">
            <label for="inputPlace">태어난 곳</label>
            <select id="inputPlace">
              ${PLACES.map((p) => `<option value="${p.name}"${p.name === '서울' ? ' selected' : ''}>${p.name}</option>`).join('')}
            </select>
            <div class="form-hint" style="font-size: 14px; color: #dcdce6; margin-top: 6px; line-height: 1.85;">태어난 곳에 따라 시(時)가 갈릴 수 있어 여쭙습니다</div>
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
  <link href="https://fonts.googleapis.com/css2?family=Song+Myung&family=Noto+Serif+KR:wght@400;700;900&family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css?v=${assetStamp('style.css')}">
<style>:root{color-scheme:dark;--nb-ink:#F5F5F7;}body{margin:0}img{max-width:100%}[hidden]{display:none!important}
p, li, label, h1, h2, h3, h4, h5,
.sub-desc-original, .co-pricenote, .pd-launch-bar, .pd-guarantee-note,
.form-hint, .spirits-menu-desc, .nb-launch-banner-text{
  text-wrap:pretty;
  word-break:keep-all;
  overflow-wrap:anywhere;
}
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
  font-size: 14px;
  line-height: 1.85;
  color: #888;
  background: #06060a;
  border-top: 1px solid rgba(212, 175, 55, 0.2);
  z-index: 10;
}
.nb-launch-banner{width:100%;background:#2a2010;border-bottom:1px solid #d4af37;color:#f3e5ab;padding:10px 16px;box-sizing:border-box;font-size:14px;font-weight:600;z-index:9999;position:relative}
.nb-launch-banner-content{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:center}
.nb-launch-banner-text{word-break:keep-all;line-height:1.45}
.nb-launch-banner-hit{white-space:nowrap}
.nb-launch-banner-until{white-space:nowrap}
.nb-launch-banner-close{background:transparent;border:none;color:#f3e5ab;font-size:16px;cursor:pointer;padding:4px 8px;line-height:1}
.spirits-free-duo{display:flex;gap:8px;margin:20px auto 14px;max-width:440px;width:100%;box-sizing:border-box;align-items:stretch}
.spirits-free-btn{flex:1 1 0;min-width:0;display:flex;align-items:center;position:relative;padding:14px 6px 11px 7px;border:1.5px solid #d4af37;border-radius:12px;background:rgba(212,175,55,0.15);color:#f5f5f7;text-decoration:none;transition:background 0.2s,transform 0.15s,box-shadow 0.15s;box-sizing:border-box;cursor:pointer;font:inherit;text-align:left}
.spirits-free-btn:hover{background:rgba(212,175,55,0.24);transform:translateY(-2px);box-shadow:0 4px 12px rgba(212,175,55,0.25)}
.spirits-free-badge{position:absolute;top:-8px;left:8px;background:#d4af37;color:#12121c;font-size:10px;font-weight:800;padding:1px 6px;border-radius:9999px;line-height:1.2;letter-spacing:0.02em;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.35)}
.spirits-free-icon{font-size:18px;line-height:1;flex-shrink:0;margin-right:5px}
.spirits-free-content{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;justify-content:center;text-align:left}
.spirits-free-text{font-size:13.5px;font-weight:700;color:#f5f5f7;white-space:nowrap;line-height:1.25;letter-spacing:-0.4px}
.spirits-free-sub{font-size:9.5px;color:#a09eb0;white-space:nowrap;line-height:1.2;letter-spacing:-0.6px;margin-top:2px}
.spirits-free-arrow{font-size:13px;font-weight:700;color:#d4af37;flex-shrink:0;margin-left:3px}
.spirits-invite-bar{display:block;margin:0 auto 16px;max-width:440px;width:100%;box-sizing:border-box;padding:10px 14px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.25);border-radius:10px;color:#d4af37;font-size:13px;text-align:center;text-decoration:none;transition:background .2s,border-color .2s;font-weight:500;line-height:1.4}
.spirits-invite-bar:hover{background:rgba(212,175,55,0.15);border-color:rgba(212,175,55,0.5);color:#f5f5f7}
/* 터진 뒤에 적은 것 (2026-10-06): 문구가 아무 자리에서나 잘려 뜻이 끊겼다. 마디째로만 줄이 바뀌게 묶는다. */
.nb-brk{display:inline-block;white-space:nowrap}
.nb-invite-banner{width:100%;background:rgba(20,40,25,0.95);border-bottom:1px solid #4ade80;color:#d1fae5;padding:10px 16px;box-sizing:border-box;font-size:14px;font-weight:600;z-index:9999;position:relative;text-align:center}
.nb-invite-banner-content{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:center;gap:12px;text-align:center}
.nb-invite-banner-text{word-break:keep-all;line-height:1.45}
${FOOTER_CSS}
</style>
<script>
window.SAJU_CONFIG = ${config};
window.__CATALOG_PRODUCTS__ = ${JSON.stringify(Object.values(CATALOG).map(p => ({
  id: p.id, name: p.name, hook: p.hook, category: p.category,
  priceKrw: p.priceKrw, regularKrw: p.regularKrw,
  ...Object.fromEntries(Object.entries(p).filter(([key]) => key.startsWith('needs'))),
})))};
window.__CATEGORIES__ = ${JSON.stringify(CATEGORY_MENU)};
window.__IS_LAUNCH_SALE__ = ${isLaunchSale()};
window.KAKAO_JS_KEY = ${JSON.stringify(process.env.KAKAO_JS_KEY ?? '')};
</script>
<script src="https://cdn.portone.io/v2/browser-sdk.js"></script>
<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js" defer></script>
</head>
<body>
<div class="nb-invite-banner" id="nbInviteBanner" style="display:none">
  <div class="nb-invite-banner-content">
    <span class="nb-invite-banner-text">벗의 증표가 담겼습니다. ${(INVITE_MIN_ORDER_KRW / 10000)}만원 이상 점사에서 ${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원을 덜 내십니다</span>
  </div>
</div>
<script>
(function(){
  try {
    var inv = sessionStorage.getItem('nb_invite');
    if (!inv) {
      var m = location.search.match(/[?&]invite=([a-zA-Z0-9]+)/);
      if (m && m[1]) {
        inv = m[1].toLowerCase().slice(0, 12);
        sessionStorage.setItem('nb_invite', inv);
      }
    }
    if (inv) {
      var b = document.getElementById('nbInviteBanner');
      if (b) b.style.display = 'block';
    }
  } catch(e) {}
})();
</script>
${isLaunchSale() ? `
<div class="nb-launch-banner" id="nbLaunchBanner" style="display:none">
  <div class="nb-launch-banner-content">
    <span class="nb-launch-banner-text">서버 오픈 기념 — <b class="nb-launch-banner-hit">최대 ${maxLaunchDiscountPercent()}% 할인 중</b><span class="nb-launch-banner-until"> · 11월 1일까지</span></span>
    <button type="button" class="nb-launch-banner-close" id="nbCloseLaunchBanner" aria-label="닫기">✕</button>
  </div>
</div>
<script>
(function(){
  try {
    if (!localStorage.getItem('nb_dismiss_launch_banner')) {
      var b = document.getElementById('nbLaunchBanner');
      if (b) b.style.display = 'block';
    }
    var btn = document.getElementById('nbCloseLaunchBanner');
    if (btn) {
      btn.onclick = function() {
        localStorage.setItem('nb_dismiss_launch_banner', '1');
        var b = document.getElementById('nbLaunchBanner');
        if (b) b.style.display = 'none';
      };
    }
  } catch(e) {}
})();
</script>` : ''}
${STUDIO_CONTAINER_HTML}

<!-- 심사 및 시스템 검증용 보존 블록 (hidden 처리) -->
<div id="legacyStageWrapper" style="display:none!important;" hidden>
${idleVideos(renderStage(business, scenes, { walk: walkVideo, open: gateVideo, walkWebm, openWebm: gateWebm }, faces, clips, clipWebms))}
${renderHero(business, checkout !== null, hero, heroVideo)}
${renderSpiritRow(faces)}
${renderProducts(checkout !== null, images, faces, false, scenes)}
${STAGE_SCRIPT}
</div>

<!--
  무료 만세력.

  터진 뒤에 적은 것 (2026-10-05): 이것이 위 보존 블록 **안에** 들어 있었다.
  그래서 「무료 사주 보기」를 누르면 보존 블록이 통째로 열리면서 옛 첫 화면,
  신령 줄, 옛 상품 목록이 한꺼번에 튀어나오고, 만세력은 그 **맨 밑**에 있어
  손님이 한참 끌려 내려갔다. 옛 조각들이 제 너비를 들고 와 글자도 잘렸다.
  열어야 하는 것만 따로 둔다.
-->
<div id="manseStage" style="display:none!important;" hidden>
${renderTryHeading()}
${fragment}
<style>${VIEWER_SKIN}</style>
</div>

<div class="site-footer-wrapper">
  ${renderFooter(business)}
</div>

<script src="/engine.js"></script>
<script src="/jaegi.js?v=${assetStamp('jaegi.js')}"></script>
<script src="/app.js?v=${assetStamp('app.js')}"></script>
<script src="/nalja.js?v=${assetStamp('nalja.js')}"></script>
<script>
(function(){
  function openFreeSaju() {
    try {
      if (!history.state || history.state.stage !== 'viewer') {
        history.pushState({ stage: 'viewer' }, '');
      }
    } catch(err) {}
    var leg = document.getElementById('manseStage');
    if (leg) {
      leg.removeAttribute('hidden');
      leg.style.removeProperty('display');
      leg.style.display = 'block';
    }
    var pA = document.getElementById('panelA');
    if (pA) {
      pA.style.removeProperty('display');
      pA.style.display = 'block';
    }
    var stF = document.getElementById('stFree');
    if (stF) {
      stF.click();
    }
    손님명식을옮긴다();
    var target = document.getElementById('try') || document.getElementById('panelA') || document.getElementById('date');
    if (target) {
      setTimeout(function(){
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }

  /*
   * 터진 뒤에 적은 것 (2026-10-05): 손님이 첫 화면에서 명식을 넣고 들어와도
   * 무료 사주 칸은 **보기용 기본값(1990-05-15)** 그대로였다. 눌러 보면 제 사주가
   * 아니라 **남의 날짜로 계산된 명식**이 나온다. 공짜로 주는 것일수록 틀리면 안 된다.
   */
  function 손님명식을옮긴다() {
    try {
      var saved = JSON.parse(sessionStorage.getItem('nb_reading') || 'null');
      var b = saved && (saved.birth || saved);
      if (!b || !b.date) return;
      var 넣는다 = function(id, 값) {
        var el = document.getElementById(id);
        if (el && 값) { el.value = 값; el.dispatchEvent(new Event('change', { bubbles: true })); }
      };
      넣는다('date', b.date);
      넣는다('name', b.name);
      넣는다('gender', (b.gender === '여' || b.gender === 'female') ? '여' : '남');
      /* 시각을 모른다고 하신 분은 그 칸을 켜 둔다. 아무 시각이나 넣으면 시주가 거짓이 된다 */
      var notime = document.getElementById('notime');
      if (b.timeKnown === false) {
        if (notime) { notime.checked = true; notime.dispatchEvent(new Event('change', { bubbles: true })); }
      } else if (b.time) {
        if (notime) { notime.checked = false; notime.dispatchEvent(new Event('change', { bubbles: true })); }
        넣는다('time', b.time);
      }
      /* 태어난 곳은 고르는 칸이고 값이 경도라, 적힌 이름으로 찾는다 */
      var place = document.getElementById('place');
      if (place && b.place) {
        for (var i = 0; i < place.options.length; i++) {
          if (place.options[i].textContent.trim() === String(b.place).trim()) {
            place.selectedIndex = i;
            place.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
    } catch (err) {}
  }

  function closeFreeSaju() {
    var leg = document.getElementById('manseStage');
    if (leg) {
      leg.setAttribute('hidden', '');
      leg.style.display = 'none';
    }
    var target = document.querySelector('.spirits-menu-title') || document.getElementById('userInfoDisplay');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  window.openFreeSaju = openFreeSaju;
  window.closeFreeSaju = closeFreeSaju;

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('#btnFreeEightLetters');
    if (btn) {
      e.preventDefault();
      openFreeSaju();
    }
  });

  try {
    var q = new URLSearchParams(location.search);
    if (q.get('free') === '1') {
      openFreeSaju();
      var u = new URL(location.href);
      u.searchParams.delete('free');
      history.replaceState(history.state, '', u.pathname + (u.search ? u.search : '') + u.hash);
    }
  } catch(e) {}
})();
</script>
</body>
</html>`;
}

const FOOTER_CSS = `
.biz{max-width:1080px;margin:56px auto 0;padding:22px;border-top:1px solid var(--nb-line-soft);
  color:var(--nb-ink-3);font:14px/1.85 var(--nb-sans)}
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
.tab{flex:1;white-space:nowrap;font-size:14px}
.tab.on{color:var(--nb-gold);box-shadow:inset 0 -2px 0 var(--nb-gold)}
.seg button.on{background:transparent;color:var(--nb-gold);box-shadow:inset 0 -2px 0 var(--nb-gold)}
button.pay{background:var(--nb-ink);color:var(--nb-paper-2);border-radius:0;letter-spacing:.02em}
input,select,textarea{border-radius:0;border-color:var(--nb-line)}
input:focus-visible,select:focus-visible,button:focus-visible{outline-color:var(--nb-gold)}
/* 대문자 영문 모노 라벨은 서식 서류의 인상을 준다. 위쪽 금색 라벨과 같은 결로 맞춘다 */
.label,.who{font-family:var(--nb-sans);text-transform:none;letter-spacing:.16em;color:var(--nb-gold)}
.f > .label{color:var(--nb-ink-3);letter-spacing:.04em;font-size:14px}
.seal{border-color:var(--nb-gold);color:var(--nb-gold);border-radius:0;border-width:1px}
.pro{border-color:var(--nb-gold)}
.pro::before{background:var(--nb-gold);color:var(--nb-paper-2)}
#legacyStageWrapper *,#manseStage *{font-family:var(--nb-sans);font-size:14px}
#legacyStageWrapper h1,#legacyStageWrapper h2,#legacyStageWrapper .glyph,
#manseStage h1,#manseStage h2,#manseStage .glyph{font-size:28px}
/*
 * 조각이 제 너비를 들고 와서 폰에서 글자가 잘렸다. 화면 안에 가둔다.
 */
#manseStage{max-width:100%;overflow-x:hidden}
#manseStage *{max-width:100%;box-sizing:border-box}`;

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

function sendHtml(res: ServerResponse, html: string, status = 200): void {
  res.writeHead(status, { ...HTML_HEADERS, 'Content-Length': Buffer.byteLength(html) });
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

const PHOTO_REQUIREMENTS: Record<string, [boolean, boolean]> = {
  'cross-report': [true, true], 'face-palm-report': [true, true],
  'saju-face-report': [true, false], 'saju-palm-report': [false, true],
};

function requireProductPhotos(body: any, productId: string): void {
  const hasPhoto = (v: any) => Boolean(v && (typeof v !== 'object' || Object.keys(v).length > 0));
  const [faceNeeded, palmNeeded] = PHOTO_REQUIREMENTS[productId] ?? [false, false];
  if ((faceNeeded && !hasPhoto(body.face)) || (palmNeeded && !hasPhoto(body.palm)))
    throw new HttpError(400, '이 상품에 필요한 얼굴·손 사진을 먼저 보여 주셔야 합니다.');
}

export function validateReading(body: any): ReadingRequest {
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
    /*
     * 터진 뒤에 적은 것 (2026-10-05): 후보 날짜를 하나하나 적으라고 했다.
     * 기간을 받는 상품이 되었으니 날짜 목록은 더 받지 않는다. 기간은 아래
     * `needsRange` 자리에서 본다.
     */
    if (!item.needsRange && (!Array.isArray(body.pick?.dates) || !body.pick.dates.length)) {
      throw new HttpError(400, '의사에게 받은 후보 날짜가 필요합니다.');
    }
    if (!Array.isArray(body.pick?.times) || !body.pick.times.length) {
      throw new HttpError(400, '수술이 가능한 시각이 필요합니다.');
    }
  } else if (!body.birth?.date) {
    throw new HttpError(400, '생년월일이 필요합니다.');
  }

  // 태어난 곳: PLACES 표에 있는 이름일 때만 인정, 아니면 서울로 본다
  if (body.birth) {
    const rawPlace = typeof body.birth.place === 'string' ? body.birth.place.trim() : '';
    body.birth.place = PLACES.some((p) => p.name === rawPlace) ? rawPlace : '서울';
    const SIJIN_CENTER: Record<string, string> = {
      자시: '00:30', 축시: '02:30', 인시: '04:30', 묘시: '06:30',
      진시: '08:30', 사시: '10:30', 오시: '12:30', 미시: '14:30',
      신시: '16:30', 유시: '18:30', 술시: '20:30', 해시: '22:30',
      ja: '00:30', chuk: '02:30', in: '04:30', myo: '06:30',
      jin: '08:30', sa: '10:30', o: '12:30', mi: '14:30',
      sin: '16:30', yu: '18:30', sul: '20:30', hae: '22:30',
    };

    let timeKnown = body.birth.timeKnown;
    let rawTime = body.birth.time;

    if (rawTime === null || rawTime === undefined || rawTime === '' || rawTime === '모름' || rawTime === 'unknown') {
      body.birth.timeKnown = false;
      body.birth.time = '12:00';
    } else if (typeof rawTime === 'string') {
      rawTime = rawTime.trim();
      const matchedSijin = SIJIN_CENTER[rawTime] || Object.entries(SIJIN_CENTER).find(([k]) => rawTime.includes(k) && !/^\d{1,2}:\d{2}$/.test(rawTime))?.[1];
      if (timeKnown === false) {
        body.birth.timeKnown = false;
        body.birth.time = matchedSijin || parseInputTime(rawTime) || '12:00';
      } else if (matchedSijin && timeKnown !== true) {
        body.birth.timeKnown = false;
        body.birth.time = matchedSijin;
      } else {
        body.birth.time = parseInputTime(rawTime);
        body.birth.timeKnown = timeKnown !== false;
      }
    } else {
      body.birth.timeKnown = false;
      body.birth.time = '12:00';
    }
  }
  // 궁합이 든 묶음은 상대의 생년월일이 있어야 만들 수 있다. 결제 전에 말한다
  if (item.needsPartner && !body.partner?.date) {
    throw new HttpError(400, '이 상품에는 상대의 생년월일이 필요합니다.');
  }

  // 아이 상품은 아이의 생년월일(또는 예정일)이 있어야 만들 수 있다.
  if (item.needsChild) {
    /*
     * 터진 뒤에 적은 것 (2026-10-06): 작명을 맡기는 부모 상당수가 아이가
     * 태어나기 전이고, 예정일조차 모르는 분이 적지 않다. 날짜를 꼭 받으니
     * 그분들이 여기서 막혀 그대로 돌아갔다.
     *
     * 작명만 날짜 없이 통과시킨다. 날짜가 없으면 아이 사주를 세울 수 없으니
     * **사주를 봤다고 적지 않는다** — 리포트가 그렇게 밝힌다.
     */
    const 날짜없이맡긴다 = !body.child?.date && item.childDateOptional === true;
    if (날짜없이맡긴다) {
      const 적은이름 = typeof body.child?.name === 'string' ? body.child.name.trim().slice(0, 20) : '';
      const 적은성별 = String(body.child?.gender ?? '').trim();
      const 성별 = /^(여|여아|여자|female|f)$/i.test(적은성별) ? '여'
        : /^(남|남아|남자|male|m)$/i.test(적은성별) ? '남' : '';
      body.child = {
        dateUnknown: true,
        ...(적은이름 ? { name: 적은이름 } : {}),
        ...(성별 ? { gender: 성별 } : {}),
      };
    } else {
      if (!body.child?.date) {
        throw new HttpError(400, '이 상품에는 아이의 생년월일(또는 출산 예정일)이 필요합니다.');
      }
      const rawPlace = typeof body.child.place === 'string' ? body.child.place.trim() : '';
      body.child.place = PLACES.some((p) => p.name === rawPlace) ? rawPlace : '서울';

      const SIJIN_CENTER: Record<string, string> = {
        자시: '00:30', 축시: '02:30', 인시: '04:30', 묘시: '06:30',
        진시: '08:30', 사시: '10:30', 오시: '12:30', 미시: '14:30',
        신시: '16:30', 유시: '18:30', 술시: '20:30', 해시: '22:30',
        ja: '00:30', chuk: '02:30', in: '04:30', myo: '06:30',
        jin: '08:30', sa: '10:30', o: '12:30', mi: '14:30',
        sin: '16:30', yu: '18:30', sul: '20:30', hae: '22:30',
      };

      let timeKnown = body.child.timeKnown;
      let rawTime = body.child.time;

      if (rawTime === null || rawTime === undefined || rawTime === '' || rawTime === '모름' || rawTime === 'unknown') {
        body.child.timeKnown = false;
        body.child.time = '12:00';
      } else if (typeof rawTime === 'string') {
        rawTime = rawTime.trim();
        const matchedSijin = SIJIN_CENTER[rawTime] || Object.entries(SIJIN_CENTER).find(([k]) => rawTime.includes(k) && !/^\d{1,2}:\d{2}$/.test(rawTime))?.[1];
        if (timeKnown === false) {
          body.child.timeKnown = false;
          body.child.time = matchedSijin || parseInputTime(rawTime) || '12:00';
        } else if (matchedSijin && timeKnown !== true) {
          body.child.timeKnown = false;
          body.child.time = matchedSijin;
        } else {
          body.child.time = parseInputTime(rawTime);
          body.child.timeKnown = timeKnown !== false;
        }
      } else {
        body.child.timeKnown = false;
        body.child.time = '12:00';
      }
      /*
       * 터진 뒤에 적은 것 (2026-10-05): 아이 성별을 「남」으로 메워 넣고 있었다.
       * 딸인데 그냥 넘어가면 **대운이 거꾸로** 나간다 — 리포트 전체가 틀린다.
       * 메우지 않고 되묻는다.
       */
      const rawChildGender = String(body.child.gender ?? '').trim();
      const childGender = /^(여|여아|여자|female|f)$/i.test(rawChildGender) ? '여'
        : /^(남|남아|남자|male|m)$/i.test(rawChildGender) ? '남' : '';
      if (!childGender) {
        throw new HttpError(400, '아이가 아들인지 딸인지 골라 주셔야 합니다. 대운이 가는 방향이 달라집니다.');
      }
      body.child.gender = childGender;
      body.child.isDueDate = Boolean(body.child.isDueDate);
      if (typeof body.child.name === 'string') {
        body.child.name = body.child.name.trim().slice(0, 20);
      }
    }
  }

  /*
   * 혼인 택일처럼 기간이 필요한 상품.
   *
   * 최대 180일(여섯 달)까지만 받는다.
   */
  if (item.needsRange) {
    const range = body.range;
    if (!range || typeof range !== 'object' || !range.from || !range.to) {
      throw new HttpError(400, '보고 싶은 기간(시작 날짜와 끝 날짜)이 필요합니다.');
    }
    const fromStr = String(range.from).trim();
    const toStr = String(range.to).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromStr) || !/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
      throw new HttpError(400, '날짜 형식이 올바르지 않습니다.');
    }
    if (fromStr > toStr) {
      throw new HttpError(400, '끝 날짜가 시작 날짜보다 앞설 수 없습니다.');
    }
    const fromMs = new Date(fromStr).getTime();
    const toMs = new Date(toStr).getTime();
    const diffDays = Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 180) {
      throw new HttpError(400, '기간은 최대 180일(여섯 달) 안으로 잡아 주세요.');
    }
    body.range = {
      from: fromStr,
      to: toStr,
      avoid: Array.isArray(range.avoid)
        ? range.avoid.filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())).map((d: any) => d.trim())
        : [],
    };
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
    let cleanFixed: { char: string; at: '앞' | '뒤' } | undefined = undefined;
    if (fixed && fixed.char !== undefined && fixed.char !== null && String(fixed.char).trim() !== '') {
      const fixedChar = String(fixed.char).trim();
      const chars = Array.from(fixedChar);
      if (chars.length > 1) {
        throw new HttpError(400, '돌림자는 한 글자만 적어 주십시오.');
      }
      const c = chars[0];
      if (!/^[\uac00-\ud7af\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]$/u.test(c)) {
        throw new HttpError(400, '돌림자는 한글 또는 한자 한 글자만 적어 주십시오.');
      }
      if (!['앞', '뒤'].includes(String(fixed.at))) {
        throw new HttpError(400, '꼭 넣을 글자를 어디에 넣을지 골라 주십시오.');
      }
      cleanFixed = { char: c, at: fixed.at as '앞' | '뒤' };
    }
    const rawAvoid = body.name?.avoid;
    let cleanAvoid: string[] | undefined = undefined;
    if (rawAvoid !== undefined && rawAvoid !== null) {
      if (!Array.isArray(rawAvoid)) {
        throw new HttpError(400, '피할 글자 형식이 올바르지 않습니다.');
      }
      if (rawAvoid.length > 20) {
        throw new HttpError(400, '피할 글자는 20자까지 적으실 수 있습니다.');
      }
      const filtered: string[] = [];
      for (const it of rawAvoid) {
        if (typeof it !== 'string') continue;
        for (const ch of Array.from(it.trim())) {
          if (/^[\uac00-\ud7af\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]$/u.test(ch)) {
            filtered.push(ch);
          }
        }
      }
      if (filtered.length > 20) {
        throw new HttpError(400, '피할 글자는 20자까지 적으실 수 있습니다.');
      }
      if (filtered.length > 0) {
        cleanAvoid = Array.from(new Set(filtered));
      }
    }
    body.name = {
      surname,
      ...(cleanFixed ? { fixed: cleanFixed } : {}),
      ...(cleanAvoid ? { avoid: cleanAvoid } : {}),
    };
  }
  /*
   * 한 상에 앉는 사람들.
   *
   * 여기 적힌 사람 수가 **값을 정한다.** 그래서 화면이 보낸 인원수나 금액은
   * 쓰지 않고, 실제로 생년월일이 들어온 사람만 서버가 직접 센다.
   * 상한을 넘겨 보내면 잘라 낸다 — 짝이 제곱으로 늘어 한 편에 담기지 않는다.
   */
  if (item.needsFamily) {
    const raw = Array.isArray(body.family) ? body.family : [];
    const family = raw
      .filter((f: any) => f && typeof f.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.date))
      .slice(0, HOLIDAY_MAX_MEMBERS - 1)
      .map((f: any) => ({
        relation: String(f.relation ?? '가족').trim().slice(0, 12) || '가족',
        date: f.date,
        time: typeof f.time === 'string' && /^\d{2}:\d{2}$/.test(f.time) ? f.time : '12:00',
      }));
    if (!family.length) {
      throw new HttpError(400, '같이 보실 가족을 한 분 이상 적어 주셔야 합니다.');
    }
    body.family = family;
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

function isSameKoreanMonth(d1: Date, d2: Date): boolean {
  const getYearMonth = (d: Date) => {
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${kst.getUTCFullYear()}-${kst.getUTCMonth()}`;
  };
  return getYearMonth(d1) === getYearMonth(d2);
}

export interface InviteAttemptRecord {
  count: number;
  lockedUntil: number;
  lastAttemptAt: number;
}

export const inviteCheckAttempts = new Map<string, InviteAttemptRecord>();

export function checkInviteRateLimit(key: string, now: number = Date.now()): { allowed: boolean; remainingSec: number } {
  if (inviteCheckAttempts.size > 1000) {
    for (const [k, v] of inviteCheckAttempts.entries()) {
      if (now - v.lastAttemptAt > 10 * 60 * 1000) inviteCheckAttempts.delete(k);
    }
  }
  const item = inviteCheckAttempts.get(key);
  if (!item) return { allowed: true, remainingSec: 0 };

  // 틀린 지 10분 지난 것은 잊는다 (count 를 0 으로)
  if (now - item.lastAttemptAt > 10 * 60 * 1000) {
    item.count = 0;
    item.lockedUntil = 0;
    return { allowed: true, remainingSec: 0 };
  }

  // 잠금 상태 확인
  if (item.lockedUntil > now) {
    return { allowed: false, remainingSec: Math.ceil((item.lockedUntil - now) / 1000) };
  }

  // 잠금이 풀릴 때 count 를 0 으로 되돌린다
  if (item.lockedUntil > 0 && now >= item.lockedUntil) {
    item.count = 0;
    item.lockedUntil = 0;
  }

  return { allowed: true, remainingSec: 0 };
}

export function recordInviteCheckFail(key: string, now: number = Date.now()): { locked: boolean; remainingSec: number } {
  const item = inviteCheckAttempts.get(key) || { count: 0, lockedUntil: 0, lastAttemptAt: now };

  // 10분 지났거나 이미 만료된 잠금 후 첫 시도면 초기화
  if (now - item.lastAttemptAt > 10 * 60 * 1000 || (item.lockedUntil > 0 && now >= item.lockedUntil)) {
    item.count = 0;
    item.lockedUntil = 0;
  }

  item.lastAttemptAt = now;
  item.count += 1;
  if (item.count >= 3) {
    const LOCK_MS = 60 * 1000; // 3분 -> 1분(60초)으로 줄인다
    item.lockedUntil = now + LOCK_MS;
    inviteCheckAttempts.set(key, item);
    return { locked: true, remainingSec: 60 };
  }
  inviteCheckAttempts.set(key, item);
  return { locked: false, remainingSec: 0 };
}

export function createApi(deps: ApiDeps) {
  const reports: ReportBox = deps.reportStore ?? new MemoryReportBox();
  const referrals: ReferralStore = deps.referrals ?? new MemoryReferralStore();

  const inFlightReports = new Map<string, Promise<string>>();
  const reportErrors = new Map<string, Error>();

  async function ensureReportBuilding(stored: Order): Promise<string> {
    const id = stored.id;
    const existing = await reports.get(id);
    if (existing) return existing;

    const inFlight = inFlightReports.get(id);
    if (inFlight) return inFlight;

    reportErrors.delete(id);
    const task = (async () => {
      try {
        const reading = (stored as any).reading as ReadingRequest;
        const parts = buildPayloads(reading);
        const chunks: string[] = [];
        for (const part of parts) {
          const made = await deps.generate({
            kind: part.kind, data: part.data, subject: part.subject, question: part.question, productId: part.productId,
          });
          chunks.push(parts.length === 1
            ? made.text
            : `# ${CATALOG[part.productId].name}\n\n${made.text}`);
        }
        const fullText = chunks.join('\n\n---\n\n');
        await reports.set(id, stored.inputHash, fullText);

        const current = await mustGet(id);
        if (current.status === 'paid') {
          const done = markFulfilled(current);
          await save(current, done);
        }

        const buyerEmail = ((stored as any).email || (stored as any).reading?.email || (reading as any)?.email || (reading?.birth as any)?.email || '').trim().toLowerCase();
        if (buyerEmail) {
          try {
            const r = await sendOrderMail({
              to: buyerEmail,
              orderId: id,
              productName: CATALOG[stored.productId].name,
            });
            console.log(`[메일] ${r.sent ? '보냄' : '못 보냄'} ${id}${r.reason ? ` (${r.reason})` : ''}`);
          } catch (e) {
            console.log(`[메일] 못 보냄 ${id}`);
          }
          try {
            const myInviteCode = generateInviteCode(buyerEmail);
            await referrals.createInvite(myInviteCode, buyerEmail);
          } catch (e) {}
        } else {
          console.log(`[메일] 건너뜀 ${id} (이메일 없음)`);
        }
        if (stored.inviteCode && buyerEmail) {
          try {
            const baseAmount = stored.amountKrw + ((stored as any).discountKrw ?? stored.discountKrw ?? 0);
            await referrals.recordInviteUse({
              id: `use_${randomUUID()}`,
              code: stored.inviteCode,
              invitedEmail: buyerEmail,
              orderId: stored.id,
              amountKrw: baseAmount,
            });
          } catch (e) {}
        }

        return fullText;
      } catch (err: any) {
        if (err?.name === 'ReportTruncatedError') {
          console.warn(`[리포트] 토큰 한도 초과 잘림 발생 (주문: ${id}, 상품: ${stored.productId}): ${err.message}`);
        }
        reportErrors.set(id, err);
        return null as any;
      } finally {
        inFlightReports.delete(id);
      }
    })();

    inFlightReports.set(id, task);
    return task;
  }

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

  function getUpsellDataForOrder(order: Order, viewedAt: string) {
    const reading = (order as any).reading;
    const question = (order as any).question || reading?.question || '';
    const recs = recommendNext(order.productId, question, viewedAt);
    if (!recs || recs.length === 0) return null;

    const items = recs.map((rec) => {
      const nextId = rec.nextProduct?.id || order.productId;
      const checkoutUrl = `/checkout?product=${encodeURIComponent(nextId)}&fromOrder=${encodeURIComponent(order.id)}`;
      let reason = '';
      if (rec.isMatched) {
        reason = '손님께서 남겨 주신 물음의 맥을 이어 다음으로 짚어 볼 점사입니다.';
      } else {
        const nextP = CATALOG[nextId as keyof typeof CATALOG];
        reason = nextP ? nextP.hook : '이미 확인하신 리포트의 결을 완성하는 다음 이야기입니다.';
      }
      return {
        info: rec,
        reason,
        checkoutUrl,
      };
    });

    const first = items[0];
    return {
      items,
      info: first.info,
      reason: first.reason,
      checkoutUrl: first.checkoutUrl,
    };
  }

  const passRateLimits = new Map<string, { count: number; resetAt: number }>();
  function checkPassRateLimit(ip: string): boolean {
    const now = Date.now();
    if (passRateLimits.size > 1000) {
      for (const [k, v] of passRateLimits.entries()) {
        if (now > v.resetAt) passRateLimits.delete(k);
      }
    }
    const item = passRateLimits.get(ip);
    if (!item || now > item.resetAt) {
      passRateLimits.set(ip, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    item.count++;
    if (item.count > 30) {
      return false;
    }
    return true;
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
    'GET /favicon.ico': async (_req, res) => {
      res.writeHead(204, { 'Content-Type': 'image/x-icon' });
      res.end();
    },

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
      const url = new URL(_req.url ?? '', 'http://localhost');
      const initialQuery = {
        date: url.searchParams.get('date') || undefined,
        time: url.searchParams.get('time') || undefined,
        place: url.searchParams.get('place') || undefined,
        gender: url.searchParams.get('gender') || undefined,
      };
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
        initialQuery,
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

    /** 늘봄이 다른 점 그림 */
    /**
     * 「이런 분이 보시면 좋습니다」 세 줄에 붙는 그림.
     *
     * 파일이 없으면 404 로 답하고, 화면은 그 칸을 어두운 네모로 둔다.
     * 그림을 아직 안 만든 상품이 있어도 화면이 깨지지 않아야 한다.
     */
    /*
     * 「이런 분이 보시면 좋습니다」 그림.
     *
     * 화면은 `.jpg` 로 부르지만, **확장자가 달라도 찾아 준다.** 사장님이
     * 그림을 어떤 형식으로 저장하실지는 프로그램이 정할 일이 아니다.
     * 전에는 `.jpg` 만 받아서, `.webp` 를 올리면 **칸이 까맣게 남고 아무
     * 말도 안 나왔다.** 없는 그림과 못 읽는 그림이 똑같이 보였다.
     */
    'GET /img/fit/:id': async (_req, res, id) => {
      // 요청 문자열로 파일을 찾으므로 폴더를 벗어나는 이름을 먼저 막는다
      if (!/^[a-z0-9-]+(\.[a-z0-9]+)?$/.test(id)) {
        throw new HttpError(404, `그림이 없습니다: ${id}`);
      }
      const base = id.replace(/\.[a-z0-9]+$/, '');
      const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'fit');
      const KINDS: [string, string][] = [
        ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'],
        ['.webp', 'image/webp'], ['.avif', 'image/avif'],
      ];
      const hit = KINDS.map(([ext, type]) => [join(dir, base + ext), type] as const)
        .find(([path]) => existsSync(path));
      if (!hit) throw new HttpError(404, `그림이 없습니다: ${id}`);
      pipeFile(res, hit[0], {
        'Content-Type': hit[1],
        'Content-Length': statSync(hit[0]).size,
        'Cache-Control': 'public, max-age=3600',
      });
    },

    'GET /img/why/:id': async (_req, res, id) => {
      const cleanId = id.endsWith('.jpg') ? id : `${id}.jpg`;
      const p = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'why', cleanId);
      if (!existsSync(p)) throw new HttpError(404, `그림이 없습니다: ${id}`);
      pipeFile(res, p, {
        'Content-Type': 'image/jpeg',
        'Content-Length': statSync(p).size,
        'Cache-Control': 'public, max-age=3600',
      });
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
    /*
     * 살 자리.
     *
     * 상세페이지의 「받기」가 첫 화면으로 돌아가던 것을 여기로 돌렸다.
     * 사겠다고 누른 손님을 대문 앞에 다시 세우면 살 방법이 없다 —
     * 실제로 그래서 아무도 살 수 없었다 (2026-09-23).
     *
     * 결제가 아직 안 켜졌으면 열쇠 대신 `null` 을 넘긴다. 화면은 그대로 뜨고
     * 「결제 준비 중」이라고만 적힌다. 심사자가 값과 고지를 볼 수 있어야 한다.
     */
    /*
     * 들여다보는 화면. 손님에게는 어디에도 걸려 있지 않다.
     *
     * 사장님 화면에서만 결제 입력칸이 사라지는 일이 있는데, 여기서는 아무리
     * 해도 그 일이 안 난다. 그래서 **그 브라우저 안을 직접 보고 적어 주는**
     * 화면을 둔다. 결제 화면을 그대로 그리고, 그 위에 지금 상태를 큰 글씨로
     * 얹는다. 사장님은 한 장 찍어서 보내 주시면 된다.
     *
     * 다 잡고 나면 지운다.
     */
    'GET /jindan': async (req, res) => {
      const want = new URL(req.url ?? '/', 'http://x').searchParams.get('product') ?? 'charm-report';
      const product = CATALOG[(isOrderable(want) ? want : 'charm-report') as keyof typeof CATALOG];
      const page = renderCheckoutPage(business, renderFooter(business), product, checkout, mailReady());
      const probe = `
<div id="jindanBox" style="position:fixed!important;top:0;left:0;right:0;z-index:2147483647;background:#111;color:#0f0;font:13px/1.5 monospace;padding:10px;border-bottom:2px solid #0f0;max-height:52vh;overflow:auto;white-space:pre-wrap"></div>
<script>
(function(){
  var 줄 = [];
  function 적는다(k, v){ 줄.push(k + ' = ' + v); }
  window.addEventListener('error', function(e){ 줄.push('!! 오류: ' + (e.message||'') + ' @' + (e.lineno||'?')); 그린다(); });
  function 본다(id){
    var el = document.getElementById(id);
    if(!el) return '없음';
    var cs = getComputedStyle(el);
    return cs.display + ' / vis:' + cs.visibility + ' / h:' + Math.round(el.getBoundingClientRect().height) + ' / op:' + cs.opacity;
  }
  function 그린다(){
    var box = document.getElementById('jindanBox');
    if(box) box.textContent = 줄.join('\n');
  }
  function 모은다(){
    줄 = [];
    적는다('브라우저', navigator.userAgent.slice(0, 90));
    적는다('주소', location.href.slice(0, 90));
    try { 적는다('세션열쇠', Object.keys(sessionStorage).join(',') || '(빈칸)'); }
    catch(e){ 적는다('세션열쇠', '못읽음 ' + e.message); }
    try { 적는다('통과', sessionStorage.getItem('nb_pass') ? '있음' : '없음'); } catch(e){}
    try { 적는다('저장된명식', (sessionStorage.getItem('nb_reading')||'(없음)').slice(0,70)); } catch(e){}
    적는다('coForm', 본다('coForm'));
    적는다('coFields', 본다('coFields'));
    적는다('coPay', 본다('coPay'));
    적는다('coDone', 본다('coDone'));
    적는다('coMsg', '"' + ((document.getElementById('coMsg')||{}).textContent||'').trim().slice(0,40) + '"');
    적는다('파수꾼있나', document.documentElement.innerHTML.indexOf('빈화면파수꾼') >= 0 ? '있음' : '없음(옛날화면)');
    그린다();
  }
  모은다();
  var n = 0;
  var t = setInterval(function(){ 모은다(); if(++n > 20) clearInterval(t); }, 1000);
})();
</script>`;
      sendHtml(res, page.replace('</body>', probe + '</body>'));
    },

    'GET /checkout': async (req, res) => {
      const checkoutQuery = new URL(req.url ?? '/', 'http://x').searchParams;
      const want = checkoutQuery.get('product') ?? '';
      if (!isOrderable(want)) throw new HttpError(404, `없는 상품입니다: ${want}`);
      const product = CATALOG[want as keyof typeof CATALOG];
      // 택일은 태어난 날이 없어 여기서 못 판다. 후보 날짜를 받는 화면으로 보낸다
      if (product.needsPick && checkoutQuery.get('embedded') !== '1') {
        res.writeHead(302, { Location: '/pick' });
        res.end();
        return;
      }
      sendHtml(res, renderCheckoutPage(business, renderFooter(business), product, checkout, mailReady(), checkoutQuery.get('embedded') === '1'));
    },

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

    'GET /order/:id': async (_req, res, id) => {
      const order = await deps.orders.get(id);
      if (!order) {
        sendHtml(res, renderOrderNotFoundPage(business, renderFooter(business)), 404);
        return;
      }
      if (!hasEntitlement(order, order.inputHash)) {
        sendHtml(res, renderOrderUnpaidPage(business, renderFooter(business), order));
        return;
      }
      const text = await reports.get(id);
      if (!text) {
        sendHtml(res, renderOrderPendingReportPage(business, renderFooter(business), order));
        return;
      }
      const viewed = order.status === 'viewed' ? order : markViewed(order);
      await save(order, viewed);
      const buyerEmail = ((order as any).email || (order as any).reading?.birth?.email || '').trim().toLowerCase();
      const inviteCode = buyerEmail ? generateInviteCode(buyerEmail) : null;

      const upsellData = getUpsellDataForOrder(viewed, viewed.viewedAt);
      sendHtml(res, renderOrderReportPage(business, renderFooter(business), viewed, text, inviteCode, upsellData));
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
      const body = await readJson(req);
      const reading = validateReading(body);
      requireProductPhotos(body, reading.productId);
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
      let monthPreview = undefined;
      if (item.id === 'month-report' && reading.birth) {
        try {
          monthPreview = buildMonthPreviewData({
            date: reading.birth.date,
            time: reading.birth.time,
            place: reading.birth.place,
            gender: reading.birth.gender,
          });
        } catch (e) {
          // ignore error
        }
      }
      let dailyPreview = undefined;
      if (item.id === 'daily-report' && reading.birth) {
        try {
          dailyPreview = buildDailyPreviewData({
            date: reading.birth.date,
            time: reading.birth.time,
            place: reading.birth.place,
            gender: reading.birth.gender,
          });
        } catch (e) {
          // ignore error
        }
      }

      send(res, 200, {
        product: item,
        notice: WITHDRAWAL_NOTICE,
        preview: {
          ...each[0].preview,
          contents,
          sections: previewSections(item.id, contents, each[0].preview.fortunePoints),
        },
        dailyPreview,
        monthPreview,
        // 단품을 보고 있으면 이것을 품은 묶음을 함께 알려 준다
        upsell: item.isPackage ? null : upsellOffer(item.id),
        // 묶음 사다리. 결제 직전에 단품·묶음을 나란히 놓는다
        upsells: item.isPackage ? [] : upsellOffers(item.id),
      });
    },

    /**
     * 주인 통과 암호 확인.
     * 암호가 맞는지 서버에 물어보고, ok 만 준다.
     * 암호 글자를 되돌려 주지 않는다.
     * 틀린 암호를 무차별 대입하지 못하게, 같은 접속에서 자주 부르면 막는다.
     */
    'POST /api/pass/check': async (req, res) => {
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
        || req.socket.remoteAddress
        || 'unknown';
      if (!checkPassRateLimit(clientIp)) {
        send(res, 429, { ok: false });
        return;
      }
      try {
        const body = await readJson(req);
        const ok = isOwnerPass(body && (body as any).pass);
        send(res, 200, { ok });
      } catch {
        send(res, 400, { ok: false });
      }
    },

    /**
     * 주문 생성.
     * 금액은 클라이언트가 보낸 값을 쓰지 않고 카탈로그에서 가져온다.
     * 고지와 미리보기를 실제로 제공했는지 여부를 주문에 남겨, 나중에 환불 판정에 쓴다.
     */
    'POST /api/orders': async (req, res) => {
      const body = await readJson(req);
      const reading = validateReading(body);
      requireProductPhotos(body, reading.productId);
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

      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const inviteCode = typeof body.invite === 'string' ? body.invite.trim().toLowerCase() : null;

      let discountKrw = 0;
      let appliedInviteCode: string | null = null;
      let rewardUsed: string | null = null;
      let appliedRewardId: string | null = null;

      const baseAmount = orderable(reading.productId).priceKrw + extraMemberKrw(reading.productId, 1 + (reading.family?.length ?? 0));
      const targetRewardTier = reading.productId === 'daily-report' ? 1 : reading.productId === 'month-report' ? 5 : null;

      if (email && targetRewardTier !== null) {
        const userRewards = await referrals.getRewards(email);
        const rew = userRewards.find((r) => r.tier === targetRewardTier && r.status === '내줌');
        if (rew) {
          const isExpired = rew.expiresAt ? new Date(rew.expiresAt).getTime() <= Date.now() : false;
          const isExhausted = rew.maxUses != null && (rew.usedCount || 0) >= rew.maxUses;

          if (!isExpired && !isExhausted) {
            if (targetRewardTier === 5 && rew.lastUsedAt && isSameKoreanMonth(new Date(), new Date(rew.lastUsedAt))) {
              throw new HttpError(400, '이번 달 것은 이미 받으셨네.');
            }
            discountKrw = baseAmount;
            rewardUsed = '이용권으로 받음';
            appliedRewardId = rew.id;
          }
        }
      }

      /*
       * 주인 통과.
       *
       * 사장님이 손님과 똑같은 길을 걸어 **리포트까지** 실제로 받아 봐야
       * 무엇이 어긋났는지 안다. 미리보기만으로는 결제 뒤 화면을 못 본다.
       *
       * 지켜야 할 것:
       *  - `OWNER_PASS` 를 안 넣어 두면 이 길은 아예 없다. 기본이 잠김이다.
       *  - 짧은 암호는 받지 않는다. 주소창에 실려 다니므로 찍히면 끝난다.
       *  - 화면이 보낸 금액은 어차피 쓰지 않는다. 값은 여기서만 0이 된다.
       *  - 기록에 「주인 통과」라고 남긴다. 판 것처럼 보이면 장부가 거짓이 된다.
       */
      if (!appliedRewardId && isOwnerPass(body.pass)) {
        discountKrw = baseAmount;
        rewardUsed = '주인 통과';
      }

      if (!rewardUsed && !appliedRewardId && email && inviteCode && isValidInviteCode(inviteCode)) {
        const invite = await referrals.getInvite(inviteCode);
        if (invite) {
          if (invite.ownerEmail.toLowerCase() === email.toLowerCase()) {
            // 자기 코드로 자기가 할인받을 수 없다 (증표 주인 이메일과 사는 사람 이메일 비교)
            discountKrw = 0;
          } else if (await referrals.hasUsedInvite(email)) {
            // 같은 이메일은 할인권을 한 번만 쓴다
            discountKrw = 0;
          } else {
            if (baseAmount >= INVITE_MIN_ORDER_KRW) {
              discountKrw = INVITE_DISCOUNT_KRW;
              appliedInviteCode = inviteCode;
            }
          }
        }
      }

      if (!rewardUsed && typeof body.fromOrderId === 'string' && body.fromOrderId.trim()) {
        const prevOrder = await deps.orders.get(body.fromOrderId.trim());
        if (prevOrder && (prevOrder.status === 'viewed' || prevOrder.status === 'fulfilled' || prevOrder.status === 'paid')) {
          const prevQ = (prevOrder as any).reading?.question || (prevOrder as any).question;
          const recs = recommendNext(prevOrder.productId, prevQ, prevOrder.viewedAt);
          const matchedRec = recs.find((r) => r.nextProduct?.id === reading.productId);
          if (matchedRec) {
            const targetAmount = matchedRec.currentPriceKrw;
            if (baseAmount > targetAmount) {
              discountKrw = baseAmount - targetAmount;
              rewardUsed = matchedRec.isPromo ? '12시간 한정 이어사기' : '이어사기 특별 할인';
            }
          } else {
            const pack = upsellFor(prevOrder.productId);
            if (pack) {
              const upsellPrice = calculateUpsellPrice(prevOrder.productId, pack.id, prevOrder.viewedAt);
              const isTargetProduct = pack.id === reading.productId || pack.members.includes(reading.productId);
              if (isTargetProduct) {
                const targetAmount = upsellPrice.currentPriceKrw;
                if (baseAmount > targetAmount) {
                  discountKrw = baseAmount - targetAmount;
                  rewardUsed = upsellPrice.isPromo ? '12시간 한정 이어사기' : '이어사기 묶음 차액';
                }
              }
            }
          }
        }
      }

      const order = createOrder({
        id: `ord_${randomUUID()}`,
        productId: reading.productId,
        inputHash,
        noticeGiven: true,
        previewProvided: body.previewShown === true,
        // 값은 **서버가 센 인원**으로만 정해진다. 화면이 보낸 금액은 쓰지 않는다
        memberCount: 1 + (reading.family?.length ?? 0),
        ref: body.ref,
        email: email || null,
        inviteCode: appliedInviteCode,
        discountKrw,
        rewardUsed,
      });

      if (appliedRewardId) {
        await referrals.recordRewardUse(appliedRewardId);
      }

      await deps.orders.save({ ...order, ...({ reading: { ...reading, email: email || null }, email: email || null, rewardUsed } as any) });
      console.log(`[주문] ${order.productId} ${order.amountKrw}원${order.ref ? ` ref=${order.ref}` : ''}${rewardUsed ? ` (${rewardUsed})` : ''}`);
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
    /**
     * 결제 확인 → 바로 응답. 풀이 짓는 일은 백그라운드 시작.
     * PG에 직접 물어보고, 금액과 주문번호를 대조한 뒤 즉시 200 { order, ready: false } 응답.
     */
    'POST /api/orders/:id/confirm': async (req, res, id) => {
      const body = await readJson(req);
      const stored = await mustGet(id);
      const paymentId = String(body.paymentId ?? id);

      if (stored.status === 'paid' || stored.status === 'fulfilled' || stored.status === 'viewed') {
        const upsell = getUpsellDataForOrder(stored, stored.viewedAt || new Date().toISOString());
        ensureReportBuilding(stored);
        send(res, 200, { order: strip(stored), ready: false, upsell });
        return;
      }

      let paid: Order;
      if (stored.amountKrw === 0) {
        const pending = stored.status === 'created' ? markPending(stored, paymentId) : stored;
        paid = markPaid(pending, 0, new Date());
      } else {
        try {
          paid = await confirmPayment(stored, deps.gateway, paymentId);
        } catch (error) {
          const reason = error instanceof Error ? error.message : '알 수 없는 오류';
          if (stored.status === 'created' || stored.status === 'pending') {
            await save(stored, failOrder(stored, reason));
          }
          throw new HttpError(402, reason);
        }
      }

      await save(stored, paid);

      // 풀이 짓는 일은 뒤에서 시작만 시킨다 (메일·증표도 이 안에서 답을 보낸 뒤 처리됨)
      ensureReportBuilding(paid);

      const upsell = getUpsellDataForOrder(paid, new Date().toISOString());
      send(res, 200, { order: strip(paid), ready: false, upsell });
    },

    /**
     * 리포트 전문.
     * 풀이가 없으면 여기서 짓는다.
     * 아직 안 됐으면 202 { ready: false } 로 답한다.
     * 다 됐으면 200 과 글을 준다.
     * 짓다가 실패하면 500 { ready: false, retryable: true } 로 답한다.
     */
    'GET /api/orders/:id/report': async (_req, res, id) => {
      const stored = await mustGet(id);
      if (!hasEntitlement(stored, stored.inputHash)) {
        throw new HttpError(403, '결제가 확인되지 않았거나 환불된 주문입니다.');
      }

      // 짓다가 실패한 경우
      const lastErr = reportErrors.get(id);
      if (lastErr && !inFlightReports.has(id)) {
        reportErrors.delete(id);
        const isTruncated = lastErr?.name === 'ReportTruncatedError';
        const errorMsg = isTruncated ? '다시 만들고 있습니다' : (lastErr.message || '풀이 생성 실패');
        send(res, 500, { ready: false, retryable: true, truncated: isTruncated, error: errorMsg });
        return;
      }

      let text = await reports.get(id);
      if (!text) {
        // 풀이가 없으면 여기서 짓는다 (이미 짓고 있으면 같은 프로미스 대기/확인)
        ensureReportBuilding(stored);
        send(res, 202, { ready: false });
        return;
      }

      const 처음연다 = stored.status !== 'viewed';
      const viewed = 처음연다 ? markViewed(stored) : stored;
      await save(stored, viewed);
      const buyerEmail = ((stored as any).email || (stored as any).reading?.birth?.email || '').trim().toLowerCase();
      const inviteCode = buyerEmail ? generateInviteCode(buyerEmail) : null;
      const upsell = getUpsellDataForOrder(viewed, viewed.viewedAt);
      send(res, 200, { text, order: strip(viewed), ready: true, upsell, inviteCode });

      /*
       * 리포트 **전문**을 메일로도 보낸다.
       *
       * 결제 직후가 아니라 **처음 연 뒤에** 보낸다. 결제 직후에 전문을 보내면
       * 「열람하지 않으면 환불」이라는 약속과 어긋난다 — 메일로 글이 나간 순간
       * 열람을 안 했다고 할 수 없기 때문이다. 연 뒤라면 이미 환불이 제한된
       * 시점이라 약속과 어긋나지 않는다.
       *
       * 답을 보낸 **뒤에** 돌린다. 메일이 늦거나 실패해도 손님 화면은 기다리지
       * 않는다. 메일은 어떤 경우에도 리포트를 막아선 안 된다.
       */
      if (!viewed.email && (viewed as any).reading?.email) {
        viewed.email = (viewed as any).reading.email;
      }
      if (처음연다 && viewed.email) {
        void sendReportMail({
          to: viewed.email,
          orderId: viewed.id,
          productName: CATALOG[viewed.productId as keyof typeof CATALOG]?.name ?? viewed.productId,
          reportText: text,
        }).then((r) => {
          if (!r.sent) console.log(`[메일] 리포트 전문 못 보냄 ${viewed.id}${r.reason ? ` (${r.reason})` : ''}`);
        }).catch(() => {});
      } else if (처음연다) {
        console.log(`[메일] 리포트 전문 건너뜀 ${viewed.id} (이메일 없음)`);
      }
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
      await referrals.rollbackInviteCount(stored.id);
      send(res, 200, {
        order: strip(outcome.order),
        refundedKrw: outcome.cancelledAmountKrw,
        message: refundNotice(outcome.verdict),
      });
    },

    'GET /invite': async (_req, res) => {
      sendHtml(res, renderInvitePage(business, renderFooter(business)));
    },

    /*
     * 「희」라고 적으면 **희로 읽는 한자들을 뜻과 함께** 돌려준다.
     *
     * 터진 뒤에 적은 것 (2026-10-04): 손님이 「희」를 적으면 획수만 보고
     * 아무 희자나 골라 이름을 지어 보냈다. 「희」로 쓸 수 있는 한자는
     * 스물셋이고 뜻이 전부 다르다. 밝을 희(熙)를 원한 손님이 바랄 희(希)를
     * 받으면 그 이름은 못 쓴다. 이름은 평생 쓰는 것이다.
     *
     * 성을 같이 주면 **그 성으로 길한 획수가 서는 자리**까지 같이 본다.
     * 못 쓰는 글자를 목록에서 빼지 않는다 — 왜 못 쓰는지 알아야 한다.
     */
    'GET /api/naming/hanja': async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const 소리 = (url.searchParams.get('reading') ?? '').trim();
      const 성 = (url.searchParams.get('surname') ?? '').trim();
      if (!/^[\uac00-\ud7a3]$/.test(소리)) {
        throw new HttpError(400, '한글 한 글자를 적어 주십시오.');
      }
      const 목록 = byReading(소리, { legal: true }).sort((a, b) =>
        Number(Boolean(koreanHanjaMeaning(b.char))) - Number(Boolean(koreanHanjaMeaning(a.char))));

      let 앞획: Set<number> | null = null;
      let 끝획: Set<number> | null = null;
      if (성) {
        const sur = readSurname(성);
        if (sur) {
          const 전부 = goodPairs(sur, Number.MAX_SAFE_INTEGER);
          앞획 = new Set(전부.map((p) => p.first));
          끝획 = new Set(전부.map((p) => p.last));
        }
      }

      send(res, 200, {
        소리,
        글자들: 목록.map((h) => ({
          자: h.char,
          획: h.strokes,
          뜻: koreanHanjaMeaning(h.char),
          앞자리로_쓸_수_있나: 앞획 ? 앞획.has(h.strokes) : null,
          끝자리로_쓸_수_있나: 끝획 ? 끝획.has(h.strokes) : null,
        })),
      });
    },

    'POST /api/invite/check': async (req, res) => {
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
      const body = await readJson(req);
      const rawCode = typeof body.code === 'string' ? body.code.trim().toLowerCase() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const rateKey = email ? `email:${email}` : `ip:${ip}`;

      const rl = checkInviteRateLimit(rateKey);
      if (!rl.allowed) {
        send(res, 429, {
          ok: false,
          valid: false,
          message: `증표 입력을 여러 번 실패하여 잠시 후(${rl.remainingSec}초 뒤) 다시 시도해 주세요.`,
        });
        return;
      }

      if (!rawCode || !isValidInviteCode(rawCode)) {
        const fail = recordInviteCheckFail(rateKey);
        if (fail.locked) {
          send(res, 429, { ok: false, valid: false, message: `증표를 3회 이상 잘못 입력하여 잠시 후(${fail.remainingSec}초 뒤) 다시 시도해 주세요.` });
        } else {
          send(res, 200, { ok: false, valid: false, message: '그런 증표가 없습니다' });
        }
        return;
      }

      const invite = await referrals.getInvite(rawCode);
      if (!invite) {
        const fail = recordInviteCheckFail(rateKey);
        if (fail.locked) {
          send(res, 429, { ok: false, valid: false, message: `증표를 3회 이상 잘못 입력하여 잠시 후(${fail.remainingSec}초 뒤) 다시 시도해 주세요.` });
        } else {
          send(res, 200, { ok: false, valid: false, message: '그런 증표가 없습니다' });
        }
        return;
      }

      if (email && invite.ownerEmail.toLowerCase() === email) {
        send(res, 200, { ok: false, valid: false, message: '자신의 증표는 쓰실 수 없습니다' });
        return;
      }

      inviteCheckAttempts.delete(rateKey);
      if (email) inviteCheckAttempts.delete(`ip:${ip}`);
      send(res, 200, {
        ok: true,
        valid: true,
        code: rawCode,
        discountKrw: INVITE_DISCOUNT_KRW,
        minOrderKrw: INVITE_MIN_ORDER_KRW,
        message: `${(INVITE_MIN_ORDER_KRW / 10000)}만원 이상 상품에서 ${INVITE_DISCOUNT_KRW.toLocaleString('ko-KR')}원 깎입니다`,
      });
    },

    'POST /api/invite/status': async (req, res) => {
      const body = await readJson(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!email) throw new HttpError(400, '이메일이 필요합니다.');
      const code = generateInviteCode(email);
      await referrals.createInvite(code, email);
      const count = await referrals.getReferralCount(email);
      const rewards = await referrals.getRewards(email);
      send(res, 200, { code, count, rewards });
    },

    'POST /api/invite/reward/claim': async (req, res) => {
      const body = await readJson(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const tier = typeof body.tier === 'number' ? body.tier : parseInt(String(body.tier), 10);
      if (!email || !tier) throw new HttpError(400, '이메일과 보답 단계가 필요합니다.');

      const count = await referrals.getReferralCount(email);
      if (count < tier) {
        throw new HttpError(400, `소개 실적(${count}명)이 보답 조건(${tier}명)에 미치지 못합니다.`);
      }

      let kind = '';
      let expiresAt: string | null = null;
      let maxUses: number | null = null;

      if (tier === 1) {
        const rewardsList = await referrals.getRewards(email);
        const tier1Rew = rewardsList.find((r) => r.tier === 1);
        const grantCount = tier1Rew?.grantCount ?? 0;
        if (grantCount >= count) {
          throw new HttpError(400, `이번 소개 몫은 이미 받으셨네. 한 분 더 소개하시면 30일이 더 붙네. (소개 ${count}명 · 받은 30일 ${grantCount}번)`);
        }
        const rew = await referrals.extendDailyPass(email, 30);
        const exp = new Date(rew.expiresAt!);
        const msg = `오늘의 운세 30일이 더 붙었네. ${exp.getMonth() + 1}월 ${exp.getDate()}일까지 보실 수 있네.`;
        send(res, 200, { ok: true, reward: rew, message: msg });
        return;
      } else if (tier === 5) {
        kind = '월운세 6달';
        const d = new Date();
        d.setMonth(d.getMonth() + 6);
        expiresAt = d.toISOString();
        maxUses = 6;
      } else {
        const tierItem = REWARD_TIERS.find((t) => t.tier === tier);
        if (!tierItem) throw new HttpError(400, '알 수 없는 보답 단계입니다.');
        kind = tierItem.kind;
      }

      const rew = await referrals.claimReward(email, tier, kind, '내줌', expiresAt, maxUses);
      send(res, 200, { ok: true, reward: rew });
    },

    'POST /api/invite/reward/apply': async (req, res) => {
      const body = await readJson(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const tier = typeof body.tier === 'number' ? body.tier : parseInt(String(body.tier), 10);
      if (!email || !tier) throw new HttpError(400, '이메일과 보답 단계가 필요합니다.');

      const count = await referrals.getReferralCount(email);
      if (count < tier) {
        throw new HttpError(400, `소개 실적(${count}명)이 보답 조건(${tier}명)에 미치지 못합니다.`);
      }

      const tierItem = REWARD_TIERS.find((t) => t.tier === tier);
      if (!tierItem) throw new HttpError(400, '알 수 없는 보답 단계입니다.');

      if (tier === 1) {
        const rewardsList = await referrals.getRewards(email);
        const tier1Rew = rewardsList.find((r) => r.tier === 1);
        const grantCount = tier1Rew?.grantCount ?? 0;
        if (grantCount >= count) {
          throw new HttpError(400, `이번 소개 몫은 이미 받으셨네. 한 분 더 소개하시면 30일이 더 붙네. (소개 ${count}명 · 받은 30일 ${grantCount}번)`);
        }
        const rew = await referrals.extendDailyPass(email, 30);
        const exp = new Date(rew.expiresAt!);
        const msg = `오늘의 운세 30일이 더 붙었네. ${exp.getMonth() + 1}월 ${exp.getDate()}일까지 보실 수 있네.`;
        send(res, 200, { ok: true, reward: rew, message: msg });
        return;
      } else if (tier === 5) {
        const d = new Date();
        d.setMonth(d.getMonth() + 6);
        const rew = await referrals.claimReward(email, 5, '월운세 6달', '내줌', d.toISOString(), 6);
        send(res, 200, { ok: true, reward: rew, message: '이용권이 지급되었습니다.' });
        return;
      }

      const rew = await referrals.applyReward(email, tier, tierItem.kind, '신청');
      send(res, 200, { ok: true, reward: rew, message: '신청이 들어갔네. 하루 안에 확인해 드리겠네.' });
    },

    'POST /api/invite/lucky-numbers': async (req, res) => {
      const body = await readJson(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!email) throw new HttpError(400, '이메일이 필요합니다.');
      const count = await referrals.getReferralCount(email);
      if (count < 3) {
        throw new HttpError(403, '3명 이상 소개한 분만 보실 수 있습니다.');
      }
      const birth = body.birth || {};
      const date = String(birth.date || '1990-01-01');
      const time = String(birth.time || '12:00');
      const place = String(birth.place || '서울');
      const gender = (birth.gender === '여' ? '여' : '남') as '남' | '여';

      const ms = calculate({ date, time, place, gender });
      const ys = analyze(ms).yongsin;

      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      const mondayISO = monday.toISOString().slice(0, 10);

      const result = luckyNumbers(ms, ys, mondayISO);
      send(res, 200, result);
    },

    'GET /admin/invite': async (req, res) => {
      const adminToken = process.env.ADMIN_TOKEN;
      const url = new URL(req.url ?? '/', 'http://localhost');
      const reqToken = url.searchParams.get('token') || (req.headers['authorization']?.replace(/^Bearer\s+/, ''));
      if (!adminToken || !reqToken || reqToken !== adminToken) {
        throw new HttpError(404, '없는 경로입니다: GET /admin/invite');
      }

      const reqs = await referrals.listRewardRequests();
      const requestViews = await Promise.all(reqs.map(async (r) => ({
        id: r.id,
        ownerEmail: r.ownerEmail,
        referralCount: await referrals.getReferralCount(r.ownerEmail),
        tier: r.tier,
        kind: r.kind,
        createdAt: r.createdAt,
      })));
      const top = await referrals.listTopReferrers();
      sendHtml(res, renderAdminInvitePage(business, renderFooter(business), adminToken, requestViews, top));
    },

    'POST /api/admin/invite/reward/review': async (req, res) => {
      const body = await readJson(req);
      const adminToken = process.env.ADMIN_TOKEN;
      if (!adminToken || body.token !== adminToken) {
        throw new HttpError(404, '없는 경로입니다.');
      }
      const id = String(body.id || '');
      const status = body.status === '내줌' ? '내줌' : '거절';
      await referrals.reviewReward(id, status);
      send(res, 200, { ok: true });
    },

    'GET /admin/mail-check': async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const token = url.searchParams.get('token') || (req.headers['authorization']?.replace(/^Bearer\s+/, '') ?? '');
      const pass = url.searchParams.get('pass') ?? '';
      const adminToken = process.env.ADMIN_TOKEN;

      const isAdminAuthed = Boolean(adminToken && token && token === adminToken);
      const isOwnerAuthed = isOwnerPass(pass) || isOwnerPass(token);

      if (!isAdminAuthed && !isOwnerAuthed) {
        throw new HttpError(404, '없는 경로입니다: GET /admin/mail-check');
      }

      const to = (url.searchParams.get('to') || '').trim();
      if (!to || !to.includes('@')) {
        throw new HttpError(400, 'to 파라미터가 필요합니다 (올바른 이메일 주소).');
      }

      const customFrom = url.searchParams.get('from')?.trim() || undefined;
      const result = await sendTestMail({ to, from: customFrom });
      send(res, 200, {
        from: result.from,
        hasKey: result.hasKey,
        keyLength: result.keyLength,
        status: result.status,
        response: redactKey(result.response || ''),
        sent: result.sent,
        reason: result.reason ? redactKey(result.reason) : undefined,
      });
    },
  };

  async function mustGet(id: string): Promise<Order> {
    const order = await deps.orders.get(id);
    if (!order) throw new HttpError(404, '주문을 찾을 수 없습니다.');
    return order;
  }
  async function save(previous: Order, next: Order): Promise<void> {
    await deps.orders.save({
      ...next,
      reading: (previous as any).reading,
      email: (previous as any).email,
      inviteCode: (previous as any).inviteCode ?? next.inviteCode,
      discountKrw: (previous as any).discountKrw ?? next.discountKrw,
      rewardUsed: (previous as any).rewardUsed ?? next.rewardUsed,
    } as any);
  }
  /** 응답에서 내부 필드를 뺀다 */
  function strip(order: Order): Order {
    const { ...rest } = order as any;
    delete rest.reading;
    delete rest.email;
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
      } else if (parts[0] === 'order' && parts[1] && !parts[2]) {
        id = parts[1];
        key = `${req.method} /order/:id`;
      } else if (parts[0] === 'products' && parts[1] && !parts[2]) {
        id = parts[1];
        key = `${req.method} /products/:id`;
      } else if (parts[0] === 'img' && parts[1] === 'products' && parts[2] && !parts[3]) {
        id = parts[2];
        key = `${req.method} /img/products/:id`;
      } else if (parts[0] === 'img' && parts[1] === 'why' && parts[2] && !parts[3]) {
        id = parts[2];
        key = `${req.method} /img/why/:id`;
      } else if (parts[0] === 'img' && parts[1] === 'fit' && parts[2] && !parts[3]) {
        id = parts[2];
        key = `${req.method} /img/fit/:id`;
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

      if (req.method === 'GET' && url.pathname === '/engine.js') {
        const code = 엔진을꺼낸다();
        res.writeHead(code ? 200 : 404, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
        });
        res.end(code || '// 엔진을 찾지 못했습니다');
        return;
      }
            if (req.method === 'GET' && (url.pathname === '/style.css' || url.pathname === '/app.js' || url.pathname === '/jaegi.js' || url.pathname === '/nalja.js')) {
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
