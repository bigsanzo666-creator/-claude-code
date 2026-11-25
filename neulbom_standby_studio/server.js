// ==========================================================================
// 늘봄사주 스탠바이 체험 스튜디오 — 테스트 전용 서버 (포트 4000)
//
// ⚠️ 이 폴더는 실제 홈페이지가 아니다.
//    Dockerfile 이 packages/ 와 apps/ 만 담기 때문에 이 서버는 배포되지 않는다.
//    실제 사이트로 합칠 때는 apps/api 의 서버에 같은 기능을 옮겨 붙인다.
//
// 하는 일 세 가지
//   1) public/ 안의 파일을 그대로 내려준다 (원래부터 하던 일)
//   2) POST /api/consult  — 상담 답변을 받아 파일에 적어 둔다
//   3) POST /api/reading  — 생년월일시로 진짜 명식을 계산해서 풀이를 돌려준다
//
// 2·3번이 무슨 일이 있어도 1번을 죽이면 안 된다. 손님이 보는 화면이 1번이다.
// ==========================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const CONSULT_LOG = path.join(DATA_DIR, 'consults.jsonl');

// 계산 엔진은 실제 홈페이지와 **같은 것**을 쓴다. 여기에 사주 계산을 새로 적지 않는다.
const MANSERYEOK = path.join(__dirname, '..', 'packages', 'manseryeok', 'src', 'index.ts');
const SAJU_RULES = path.join(__dirname, '..', 'packages', 'saju-rules', 'src', 'index.ts');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
};

// ==========================================================================
// 시진 → 시각
//
// 화면의 「자시 (23:30~01:29)」 같은 안내는 이미 진태양시를 감안한 시계 시각이라
// 그 구간의 한가운데를 그대로 쓴다. 엔진이 경도·균시차 보정을 한 번 더 한다.
// ==========================================================================
const TIME_OF_SIJIN = {
  unknown: null,
  ja: '00:30', chuk: '02:30', in: '04:30', myo: '06:30',
  jin: '08:30', sa: '10:30', o: '12:30', mi: '14:30',
  sin: '16:30', yu: '18:30', sul: '20:30', hae: '22:30',
};

/** 신령마다 어느 주제를 짚어 주는가. 종합을 보는 둘은 전부 펼친다. */
const TOPICS_OF_SPIRIT = {
  dohwa: ['charm', 'peers'],
  wol: ['charm', 'learning'],
  yeon: ['charm', 'helper'],
  samhap: null,
  jakmyeong: ['learning', 'expression'],
  samsin: ['expression', 'learning'],
  myeonggyeong: null,
  jae: ['wealth', 'career'],
  san: ['expression', 'peers'],
  pung: ['travel', 'career'],
};

// ==========================================================================
// 계산 엔진 불러오기
//
// 서버가 뜰 때 불러오지 않는다. 엔진에 문제가 있어도 체험 페이지는 열려야 하므로,
// 첫 요청이 올 때 한 번만 불러오고 그 결과를 들고 있는다.
// ==========================================================================
let enginePromise = null;

function loadEngine() {
  if (!enginePromise) {
    enginePromise = Promise.all([
      import('file://' + MANSERYEOK),
      import('file://' + SAJU_RULES),
    ]).then(([manseryeok, rules]) => ({ manseryeok, rules }));
    // 실패하면 다음 요청 때 다시 해 볼 수 있게 비워 둔다
    enginePromise.catch(() => { enginePromise = null; });
  }
  return enginePromise;
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

/** 요청 본문을 읽는다. 너무 크면 끊는다 — 사진은 이쪽으로 오지 않는다. */
function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('보낸 내용이 너무 큽니다.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error('보낸 내용을 읽지 못했습니다.'));
      }
    });
    req.on('error', reject);
  });
}

// ==========================================================================
// 1) 상담 답변 받기
//
// 개인정보(성함·생년월일시·상담 답변)가 들어온다. 이 파일은 테스트용 기록일 뿐이라
// data/ 폴더째 깃에 올리지 않는다. 실제 홈페이지로 옮길 때는 파일이 아니라
// packages/store 의 데이터베이스에 넣는다.
// ==========================================================================
function handleConsult(req, res) {
  readBody(req).then((body) => {
    const record = {
      id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      at: new Date().toISOString(),
      spiritId: String(body.spiritId || ''),
      spiritName: String(body.spiritName || ''),
      name: String(body.name || ''),
      birthDate: String(body.birthDate || ''),
      birthTime: String(body.birthTime || ''),
      gender: String(body.gender || ''),
      answers: body.answers && typeof body.answers === 'object' ? body.answers : {},
    };

    fs.mkdir(DATA_DIR, { recursive: true }, (mkdirErr) => {
      if (mkdirErr) {
        console.error('[상담 저장 실패]', mkdirErr.message);
        sendJson(res, 500, { ok: false, reason: '기록을 남기지 못했습니다.' });
        return;
      }
      fs.appendFile(CONSULT_LOG, JSON.stringify(record) + '\n', 'utf8', (appendErr) => {
        if (appendErr) {
          console.error('[상담 저장 실패]', appendErr.message);
          sendJson(res, 500, { ok: false, reason: '기록을 남기지 못했습니다.' });
          return;
        }
        console.log('[상담 답변 저장]', record.spiritName || record.spiritId, record.name, record.id);
        sendJson(res, 200, { ok: true, id: record.id });
      });
    });
  }).catch((error) => {
    sendJson(res, 400, { ok: false, reason: error.message });
  });
}

// ==========================================================================
// 2) 진짜 명식으로 풀이 만들기
//
// 여기서 지어내는 문장은 하나도 없다. 전부 packages/saju-rules 가 계산한 값이고,
// 모델(AI)을 부르지 않으므로 손님이 아무리 많이 봐도 돈이 들지 않는다.
// ==========================================================================
function handleReading(req, res) {
  readBody(req).then(async (body) => {
    const date = String(body.birthDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      sendJson(res, 400, { ok: false, reason: '생년월일이 올바르지 않습니다.' });
      return;
    }

    const sijin = String(body.birthTime || 'unknown');
    const time = Object.prototype.hasOwnProperty.call(TIME_OF_SIJIN, sijin)
      ? TIME_OF_SIJIN[sijin]
      : null;
    const gender = body.gender === 'female' ? '여' : body.gender === 'male' ? '남' : null;

    const { manseryeok, rules } = await loadEngine();

    const ms = manseryeok.calculate({ date, time });
    const analysis = rules.analyze(ms);
    const reading = rules.freeReading(ms, analysis, {
      gender,
      todayYear: new Date().getFullYear(),
    });

    const wanted = TOPICS_OF_SPIRIT[String(body.spiritId || '')];
    const topicIds = wanted === null ? rules.ALL_TOPICS : (wanted || []);
    const topics = topicIds.map((id) => rules.extractTopic(analysis, id));

    sendJson(res, 200, {
      ok: true,
      reading,
      topics,
      // 용어를 그냥 던지지 않기 위한 뜻풀이. 화면에서 작은 글씨로 붙는다.
      glossary: { gods: rules.GOD_MEANING },
      // 왜 이렇게 나왔는지 화면에 밝힌다. 서비스마다 명식이 다른 것이 불신의 원인이다.
      basis: {
        inputTime: ms.meta.inputTime,
        correctedTime: ms.meta.correctedTime,
        correctedDate: ms.meta.correctedDate,
        solarTimeOffsetMin: ms.meta.solarTimeOffsetMin,
        dstApplied: ms.meta.dstApplied,
        monthTermName: ms.meta.monthTermName,
        monthTermEnteredAt: ms.meta.monthTermEnteredAt,
        solarYear: ms.meta.solarYear,
        hourKnown: Boolean(ms.hour),
      },
    });
  }).catch((error) => {
    console.error('[풀이 계산 실패]', error && error.message);
    sendJson(res, 500, { ok: false, reason: (error && error.message) || '풀이를 계산하지 못했습니다.' });
  });
}

// ==========================================================================
// 3) 원래 하던 일 — public/ 의 파일 내려주기
// ==========================================================================
function serveStatic(req, res) {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }
  const decodedPath = decodeURIComponent(reqPath);
  const filePath = path.join(PUBLIC_DIR, decodedPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + decodedPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const range = req.headers.range;

    if (range && (ext === '.mp4' || ext === '.webm' || ext === '.mp3' || ext === '.ogg' || ext === '.m4a')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': 'bytes ' + start + '-' + end + '/' + stats.size,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

const server = http.createServer((req, res) => {
  const routePath = req.url.split('?')[0];

  if (req.method === 'POST' && routePath === '/api/consult') {
    handleConsult(req, res);
    return;
  }
  if (req.method === 'POST' && routePath === '/api/reading') {
    handleReading(req, res);
    return;
  }
  if (routePath.startsWith('/api/')) {
    sendJson(res, 404, { ok: false, reason: '없는 주소입니다.' });
    return;
  }

  serveStatic(req, res);
});

// 요청 하나가 잘못돼도 서버 전체가 내려가지 않게 한다.
server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
process.on('unhandledRejection', (reason) => {
  console.error('[처리되지 않은 오류]', reason && reason.message ? reason.message : reason);
});

server.listen(PORT, () => {
  console.log('늘봄사주 스탠바이 스튜디오 실행 완료: http://localhost:' + PORT);
  console.log('  · 상담 답변 기록: ' + CONSULT_LOG);
  console.log('  · 풀이 계산: packages/manseryeok + packages/saju-rules (모델 호출 없음)');
});
