/*
 * 날짜를 **손으로 적을 수 있게** 바꾼다.
 *
 * 터진 뒤에 적은 것 (2026-10-03): 생년월일 칸이 달력에서 고르는 것뿐이었다.
 * 폰에서 누르면 달력이 뜨는데, 1988년을 찾으려면 한 달씩 수십 번을 넘겨야 한다.
 * 사장님이 직접 겪고 두 번 말씀하셨다.
 *
 * 그래서 숫자를 그냥 두드려 넣게 한다. 19880514 라고 치면 1988-05-14 가 된다.
 * 달력이 편한 분을 위해 **달력 단추**를 옆에 남겨 둔다.
 *
 * 값의 모양(YYYY-MM-DD)은 그대로다 — 다른 곳이 읽는 방식을 바꾸지 않는다.
 */
(function () {
  function 숫자만(s) { return String(s || '').replace(/[^0-9]/g, '').slice(0, 8); }

  function 모양을잡는다(숫자) {
    var n = 숫자만(숫자);
    if (n.length <= 4) return n;
    if (n.length <= 6) return n.slice(0, 4) + '-' + n.slice(4);
    return n.slice(0, 4) + '-' + n.slice(4, 6) + '-' + n.slice(6);
  }

  function 제대로된날인가(v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    var y = +v.slice(0, 4), m = +v.slice(5, 7), d = +v.slice(8, 10);
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
    var t = new Date(y, m - 1, d);
    return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
  }

  function 바꾼다(원래) {
    if (!원래 || 원래.dataset.naljaDone) return;
    원래.dataset.naljaDone = '1';

    var 담는통 = document.createElement('span');
    담는통.className = 'nalja-wrap';
    담는통.style.cssText = 'display:flex;gap:8px;align-items:center;width:100%';

    var 글칸 = document.createElement('input');
    글칸.type = 'text';
    글칸.inputMode = 'numeric';
    글칸.autocomplete = 'bday';
    글칸.placeholder = '예: 1988-05-14';
    글칸.maxLength = 10;
    글칸.className = 원래.className;
    글칸.style.cssText = 원래.getAttribute('style') || '';
    글칸.style.flex = '1 1 auto';
    글칸.style.minWidth = '0';
    글칸.value = 원래.value || '';
    if (원래.required) 글칸.required = true;

    var 달력단추 = document.createElement('button');
    달력단추.type = 'button';
    달력단추.textContent = '📅';
    달력단추.title = '달력에서 고르기';
    달력단추.setAttribute('aria-label', '달력에서 고르기');
    달력단추.style.cssText = 'flex:0 0 auto;padding:10px 12px;border-radius:8px;cursor:pointer;'
      + 'border:1px solid rgba(212,175,55,.5);background:rgba(212,175,55,.1);color:#f3e5ab;font-size:16px';

    // 원래 칸은 달력 전용으로 남겨 두고 눈에서만 감춘다 (id 와 name 은 여기 그대로)
    원래.style.position = 'absolute';
    원래.style.opacity = '0';
    원래.style.width = '1px';
    원래.style.height = '1px';
    원래.style.pointerEvents = 'none';
    원래.setAttribute('aria-hidden', 'true');
    원래.tabIndex = -1;

    원래.parentNode.insertBefore(담는통, 원래);
    담는통.appendChild(글칸);
    담는통.appendChild(달력단추);
    담는통.appendChild(원래);

    var 알린다 = function () {
      원래.dispatchEvent(new Event('input', { bubbles: true }));
      원래.dispatchEvent(new Event('change', { bubbles: true }));
    };

    글칸.addEventListener('input', function () {
      var 앞 = 글칸.selectionStart === 글칸.value.length;
      글칸.value = 모양을잡는다(글칸.value);
      if (앞) { try { 글칸.setSelectionRange(글칸.value.length, 글칸.value.length); } catch (e) {} }
      원래.value = 제대로된날인가(글칸.value) ? 글칸.value : '';
      알린다();
    });

    글칸.addEventListener('blur', function () {
      if (글칸.value && !제대로된날인가(글칸.value)) {
        글칸.setCustomValidity('태어난 날을 1988-05-14 처럼 적어 주십시오.');
        글칸.reportValidity &&글칸.reportValidity();
      } else {
        글칸.setCustomValidity('');
      }
    });

    달력단추.addEventListener('click', function () {
      try {
        원래.style.position = ''; 원래.style.opacity = ''; 원래.style.width = '';
        원래.style.height = ''; 원래.style.pointerEvents = '';
        if (원래.showPicker) { 원래.showPicker(); } else { 원래.focus(); 원래.click(); }
        setTimeout(function () {
          원래.style.position = 'absolute'; 원래.style.opacity = '0';
          원래.style.width = '1px'; 원래.style.height = '1px'; 원래.style.pointerEvents = 'none';
        }, 300);
      } catch (e) {}
    });

    원래.addEventListener('change', function () {
      if (원래.value && 원래.value !== 글칸.value) 글칸.value = 원래.value;
    });
  }

  function 훑는다() {
    var all = document.querySelectorAll('input[type="date"]:not([data-nalja-done])');
    for (var i = 0; i < all.length; i++) 바꾼다(all[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', 훑는다);
  } else {
    훑는다();
  }
  // 나중에 생기는 칸(신령 대화 등)도 잡는다
  setTimeout(훑는다, 800);
  setTimeout(훑는다, 2500);
  try {
    new MutationObserver(훑는다).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
