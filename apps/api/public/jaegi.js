/*
 * 얼굴·손 사진 재기 — 어느 화면에서든 쓴다.
 *
 * 터진 뒤에 적은 것 (2026-10-03): 재는 기능이 첫 화면(만세력)에만 있어서,
 * 상품 상세페이지에서는 사진을 받을 수가 없었다. 그래서 손님은 사진을 보여 줄
 * 자리를 찾지 못한 채 결제 화면까지 갔다.
 *
 * **사진은 손님 기기 밖으로 한 바이트도 나가지 않는다.** 브라우저 안에서 재고
 * 곧바로 버린다. 서버로 보내지도, 저장하지도 않는다.
 *
 * 쓰려면 이 파일 **앞에** /engine.js 를 먼저 불러야 한다 (MS.measureFace 등).
 */
(function () {
  var WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
  var FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/'
    + 'face_landmarker/float16/1/face_landmarker.task';
  var HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/'
    + 'hand_landmarker/float16/1/hand_landmarker.task';
  /** 이보다 오래 걸리면 포기한다. 손님을 하염없이 기다리게 두지 않는다 */
  var WAIT_MS = 25000;

  var facePicker = null;
  var handPicker = null;

  function 늦으면포기(got) {
    var giveUp = new Promise(function (_, no) {
      setTimeout(function () {
        no(new Error('인터넷이 느려서 사진을 재지 못했습니다. 잠시 뒤 다시 해 주십시오.'));
      }, WAIT_MS);
    });
    return Promise.race([got, giveUp]);
  }

  function 얼굴도구() {
    if (facePicker) return facePicker;
    var got = import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14').then(function (V) {
      return V.FilesetResolver.forVisionTasks(WASM).then(function (fs) {
        return V.FaceLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
          runningMode: 'IMAGE', numFaces: 1,
        });
      });
    });
    facePicker = 늦으면포기(got).catch(function (e) { facePicker = null; throw e; });
    return facePicker;
  }

  function 손도구() {
    if (handPicker) return handPicker;
    var got = import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14').then(function (V) {
      return V.FilesetResolver.forVisionTasks(WASM).then(function (fs) {
        return V.HandLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'GPU' },
          runningMode: 'IMAGE', numHands: 1,
        });
      });
    });
    handPicker = 늦으면포기(got).catch(function (e) { handPicker = null; throw e; });
    return handPicker;
  }

  function 사진을읽는다(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { ok({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('사진을 읽지 못했습니다.')); };
      img.src = url;
    });
  }

  /** 잰 값을 저장한다. 결제 화면과 리포트가 이걸 가져다 쓴다 */
  function 담는다(무엇, 값) {
    try {
      var saved = JSON.parse(sessionStorage.getItem('nb_reading') || '{}') || {};
      saved[무엇] = Object.assign({}, saved[무엇] || {}, 값);
      sessionStorage.setItem('nb_reading', JSON.stringify(saved));
      window.dispatchEvent(new CustomEvent('nb:잼', { detail: { 무엇: 무엇, 값: saved[무엇] } }));
      return saved[무엇];
    } catch (e) { return 값; }
  }

  function 잰다(file, 도구, 뽑는다, 못찾음) {
    if (!window.MS) return Promise.reject(new Error('재는 도구를 아직 못 받았습니다. 새로고침한 뒤 다시 해 주십시오.'));
    return 사진을읽는다(file).then(function (r) {
      return 도구().then(function (picker) {
        var res = picker.detect(r.img);
        URL.revokeObjectURL(r.url);  // 사진은 여기서 끝이다
        var 값 = 뽑는다(res);
        if (!값) throw new Error(못찾음);
        return 값;
      }, function (e) { URL.revokeObjectURL(r.url); throw e; });
    });
  }

  window.NB재기 = {
    얼굴: function (file) {
      return 잰다(file, 얼굴도구, function (res) {
        var marks = res && res.faceLandmarks && res.faceLandmarks[0];
        if (!marks) return null;
        return window.MS.measureFace(marks).features;
      }, '사진에서 얼굴을 못 찾았습니다. 얼굴이 크게 나온 정면 사진으로 해 주십시오.')
        .then(function (f) { return 담는다('face', f); });
    },
    손: function (file) {
      return 잰다(file, 손도구, function (res) {
        var marks = res && res.landmarks && res.landmarks[0];
        if (!marks) return null;
        return { handShape: window.MS.measureHand(marks).shape };
      }, '사진에서 손을 못 찾았습니다. 손바닥을 펴서 크게 찍어 주십시오.')
        .then(function (p) { return 담는다('palm', p); });
    },
    담긴값: function () {
      try { return JSON.parse(sessionStorage.getItem('nb_reading') || '{}') || {}; } catch (e) { return {}; }
    },
  };
})();
