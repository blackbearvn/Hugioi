/* HƯ GIỚI · NHẬT KÝ THÔNG BÁO
 * Khung nhật ký: nổi/gắn, thu gọn, hàng đợi dòng chữ. Tách khỏi shell.js, nạp trước shell.js;
 * shell.js lấy các hàm cần dùng qua UI.logPanel. */
(function (root) {
  'use strict';
  const H = root.HU_GAME, F = H.F, A = root.HU_ASSETS;
  const UI = root.HU_UI, L = root.HU_LABELS;
  const { $, $$, esc, clamp, num, money, moneyHTML, pct, duration, btn } = UI.kit;
  const store = UI.store;
  const isReduced = () => UI.isReduced();
  /* ======================================================================
     NHẬT KÝ THÔNG BÁO
     ====================================================================== */
  const LOG_MAX = 60, LOG_KEY = 'huGioiLogCollapsed', LOG_FLOAT_KEY = 'huGioiLogFloating';
  const LOG_TAG = { tribulation: 'KIẾP', danger: 'NGUY', loot: 'THU', success: 'THÀNH', gold: 'DUYÊN', info: 'TIN' };
  const logState = {
    live: false, bound: false, owner: null, queue: [], current: null, timer: 0,
    follow: true, unseen: 0, count: 0, collapsed: false,
    engineRecent: new Map(), toastRecent: new Map(), lastPrune: 0
  };
  // Trạng thái chỉ thuộc giao diện; dữ liệu tu luyện và bản lưu không thay đổi.
  const logFloatState = { floating: false, maximized: false, x: null, y: null, loaded: false };
  let logDrag = null, suppressLogToggleClick = false;

  function classifyLog(text) {
    if (/thất bại|trọng thương|tổn hại|không đủ|chưa đủ|rút lui|lỗi|hỏng|nguy hiểm/i.test(text)) return 'danger';
    if (/thiên kiếp|lôi kiếp|độ kiếp|đột phá|chứng đạo|phi thăng/i.test(text)) return 'tribulation';
    if (/nhận|mua|thu hoạch|luyện thành|rơi|phần thưởng|cống hiến|đấu giá|kỳ ngộ/i.test(text)) return 'loot';
    if (/thành công|hoàn thành|nâng|thăng|kết giao|tặng|thắng|đã /i.test(text)) return 'success';
    return 'info';
  }

  const logKey = text => String(text).toLowerCase().replace(/\s+/g, ' ').replace(/[.!…]+$/g, '').trim();
  const logClock = at => new Date(at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  function pruneLogKeys(now) {
    if (now - logState.lastPrune < 12000) return;
    logState.lastPrune = now;
    for (const map of [logState.engineRecent, logState.toastRecent]) {
      for (const [key, at] of map) if (now - at > 12000) map.delete(key);
    }
  }

  function appendLogEntry(item) {
    const feed = $('logFeed');
    if (!feed) return null;
    const el = document.createElement('div');
    el.className = 'log-entry ' + item.type;
    const tag = document.createElement('span');
    tag.className = 'log-tag';
    tag.textContent = LOG_TAG[item.type] || LOG_TAG.info;
    el.append(tag);
    if (item.at) {
      const time = document.createElement('time');
      time.className = 'log-time';
      time.dateTime = new Date(item.at).toISOString();
      time.textContent = logClock(item.at);
      el.append(time);
    }
    const text = document.createElement('span');
    text.className = 'log-text';
    el.append(text);
    feed.append(el);
    while (feed.childElementCount > LOG_MAX) feed.firstElementChild.remove();
    logState.count = feed.childElementCount;
    if (logState.follow) {
      feed.scrollTop = feed.scrollHeight;
    } else {
      logState.unseen++;
    }
    updateLogChrome();
    return { el, textEl: text, full: item.text, i: 0 };
  }

  function updateLogChrome() {
    const count = $('logCount'), jump = $('logJump');
    if (count) {
      count.textContent = logState.unseen > 0 ? '+' + logState.unseen : String(logState.count);
      count.classList.toggle('has-new', logState.unseen > 0);
      count.setAttribute('aria-label', logState.unseen > 0 ? logState.unseen + ' tin mới' : logState.count + ' tin trong nhật ký');
    }
    if (jump) jump.hidden = !(logState.unseen > 0 && !logState.follow);
  }

  function setLogCollapsed(collapsed, persist = true) {
    const panel = $('logPanel'), btn = $('logToggle');
    logState.collapsed = !!collapsed;
    if (logState.collapsed && logFloatState.maximized) setLogMaximized(false);
    if (panel) panel.classList.toggle('collapsed', logState.collapsed);
    document.body.classList.toggle('log-collapsed', logState.collapsed);
    if (btn) {
      btn.setAttribute('aria-expanded', String(!logState.collapsed));
      btn.setAttribute('aria-label', logState.collapsed ? 'Mở rộng nhật ký' : 'Thu gọn nhật ký');
      btn.title = logState.collapsed ? 'Mở rộng nhật ký' : 'Thu gọn nhật ký';
    }
    if (!logState.collapsed) {
      logState.follow = true;
      logState.unseen = 0;
      const feed = $('logFeed');
      if (feed) feed.scrollTop = feed.scrollHeight;
    }
    updateLogChrome();
    if (logFloatState.floating) positionFloatingLog();
    if (persist) try { localStorage.setItem(LOG_KEY, logState.collapsed ? '1' : '0'); } catch { /* bỏ qua */ }
    if (logFloatState.floating) UI.windows?.updateTaskbar?.();
  }


  /* Cắt khung thông báo theo kiểu 9 vùng co giãn bằng CSS; không cắt ảnh
     atlas vì repo không có atlas dành cho .box. Bố cục và tọa độ là thuần UI. */
  function positionFloatingLog(x = logFloatState.x, y = logFloatState.y) {
    const panel = $('logPanel');
    if (!panel || !logFloatState.floating || logFloatState.maximized) return;
    const width = root.innerWidth || document.documentElement.clientWidth;
    const height = root.innerHeight || document.documentElement.clientHeight;
    const maxX = Math.max(8, width - panel.offsetWidth - 8);
    const maxY = Math.max(8, height - panel.offsetHeight - 8);
    const defaultX = maxX;
    const defaultY = Math.max(8, height - panel.offsetHeight - (width < 700 ? 144 : 40));
    logFloatState.x = Math.max(8, Math.min(maxX, Number.isFinite(x) ? x : defaultX));
    logFloatState.y = Math.max(8, Math.min(maxY, Number.isFinite(y) ? y : defaultY));
    panel.style.left = Math.round(logFloatState.x) + 'px';
    panel.style.top = Math.round(logFloatState.y) + 'px';
  }

  function saveFloatingLog() {
    try {
      localStorage.setItem(LOG_FLOAT_KEY, JSON.stringify({
        floating: logFloatState.floating, x: logFloatState.x, y: logFloatState.y
      }));
    } catch { /* quyền lưu bị chặn: vẫn dùng được trong phiên hiện tại */ }
  }

  function setLogMaximized(enabled) {
    const panel = $('logPanel'), toggle = $('logMaxToggle');
    if (!panel) return;
    logFloatState.maximized = !!enabled && logFloatState.floating;
    panel.classList.toggle('log-maximized', logFloatState.maximized);
    if (toggle) {
      toggle.textContent = logFloatState.maximized ? '❐' : '▢';
      toggle.setAttribute('aria-label', logFloatState.maximized ? 'Khôi phục kích thước nhật ký' : 'Phóng to nhật ký');
      toggle.title = logFloatState.maximized ? 'Khôi phục kích thước nhật ký' : 'Phóng to nhật ký';
    }
    if (!logFloatState.maximized) positionFloatingLog();
    UI.windows?.updateTaskbar?.();
  }
  function setLogFloating(floating, persist = true) {
    const panel = $('logPanel'), game = $('game'), btn = $('logFloatToggle');
    if (!panel) return;
    logFloatState.floating = !!floating;
    if (!logFloatState.floating) setLogMaximized(false);
    panel.classList.toggle('log-floating', logFloatState.floating);
    game?.classList.toggle('log-floating', logFloatState.floating);
    document.body.classList.toggle('log-floating', logFloatState.floating);
    if (btn) {
      btn.textContent = logFloatState.floating ? '↙' : '↗';
      btn.setAttribute('aria-pressed', String(logFloatState.floating));
      const text = logFloatState.floating ? 'Ghim nhật ký về dưới sân khấu' : 'Đưa nhật ký thành cửa sổ nổi';
      btn.setAttribute('aria-label', text);
      btn.title = text;
    }
    if (logFloatState.floating) positionFloatingLog();
    else {
      panel.style.removeProperty('top');
      panel.style.removeProperty('left');
    }
    if (persist) saveFloatingLog();
    UI.windows?.updateTaskbar?.();
  }

  function bindFloatingLog() {
    const panel = $('logPanel'), head = panel?.querySelector('.log-head');
    if (!panel || !head) return;
    $('logFloatToggle')?.addEventListener('click', () => setLogFloating(!logFloatState.floating));
    const tools = panel.querySelector('.log-tools');
    if (tools && !$('logMaxToggle')) {
      const max = document.createElement('button');
      max.id = 'logMaxToggle'; max.type = 'button'; max.className = 'log-max-toggle';
      max.textContent = '▢'; max.title = 'Phóng to nhật ký'; max.setAttribute('aria-label',max.title);
      tools.insertBefore(max,$('logFloatToggle') || tools.firstChild);
      max.addEventListener('click', () => {
        if (!logFloatState.floating) setLogFloating(true);
        if (logState.collapsed) setLogCollapsed(false);
        setLogMaximized(!logFloatState.maximized);
      });
    }
    head.addEventListener('pointerdown', e => {
      if (!logFloatState.floating || logFloatState.maximized || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const toggle = e.target.closest('#logToggle');
      if (e.target.closest('button') && !(logState.collapsed && toggle)) return;
      const rect = panel.getBoundingClientRect();
      logDrag = { id: e.pointerId, startX: e.clientX, startY: e.clientY,
        left: rect.left, top: rect.top, moved: false };
      const capture = toggle || head;
      try { capture.setPointerCapture(e.pointerId); } catch { logDrag = null; }
    });
    head.addEventListener('pointermove', e => {
      if (!logDrag || e.pointerId !== logDrag.id) return;
      const dx = e.clientX - logDrag.startX, dy = e.clientY - logDrag.startY;
      if (!logDrag.moved && Math.hypot(dx, dy) < 6) return;
      logDrag.moved = true;
      panel.classList.add('log-dragging');
      e.preventDefault();
      positionFloatingLog(logDrag.left + dx, logDrag.top + dy);
    });
    const finish = e => {
      if (!logDrag || e.pointerId !== logDrag.id) return;
      if (logDrag.moved) {
        suppressLogToggleClick = true;
        saveFloatingLog();
        // Một cú kéo không được vô tình mở/đóng nhật ký.
        root.setTimeout(() => { suppressLogToggleClick = false; }, 0);
      }
      logDrag = null;
      panel.classList.remove('log-dragging');
    };
    head.addEventListener('pointerup', finish);
    head.addEventListener('pointercancel', finish);
    root.addEventListener('resize', () => positionFloatingLog());
    root.addEventListener('orientationchange', () => positionFloatingLog());
  }

  function pumpLog(force = false) {
    if (!logState.live) return;
    // Không có gì để gõ: bỏ qua, tránh ép layout (scrollHeight) 40 lần/giây.
    if (!logState.current && !logState.queue.length && !force) return;
    if (document.hidden && !force) return;
    const feed = $('logFeed');
    if (!feed) return;
    const reduced = isReduced();
    let budget = reduced ? Infinity : (force ? 4 : 2 + logState.queue.length * 3);
    while (budget > 0) {
      if (!logState.current) {
        if (!logState.queue.length) break;
        logState.current = appendLogEntry(logState.queue.shift());
        if (!logState.current) break;
      }
      const cur = logState.current;
      const take = Math.min(budget, cur.full.length - cur.i);
      cur.textEl.textContent += cur.full.slice(cur.i, cur.i + take);
      cur.i += take;
      budget -= take;
      if (cur.i >= cur.full.length) {
        logState.current = null;
        if (logState.follow) feed.scrollTop = feed.scrollHeight;
      }
    }
    if (logState.follow) feed.scrollTop = feed.scrollHeight;
  }

  // Chỉ đánh máy khi còn log trong hàng đợi; không đánh thức JS ~42 lần/giây
  // trong lúc không có tin mới. Tab ẩn sẽ tiếp tục khi hiện trở lại.
  function scheduleLogPump() {
    if (!logState.live || logState.timer || document.hidden ||
        (!logState.current && !logState.queue.length)) return;
    logState.timer = root.setTimeout(() => {
      logState.timer = 0;
      pumpLog();
      scheduleLogPump();
    }, 24);
  }

  function queueLog(message, opts = {}) {
    const text = String(message ?? '').trim();
    if (!text) return;
    const now = Date.now();
    pruneLogKeys(now);
    const key = logKey(text);
    const source = opts.source || 'engine';
    /* Toast và log engine thường kể cùng một việc. Giữ bản đến trước, bỏ bản trùng trong 4 giây. */
    if (source === 'toast') {
      const hit = logState.engineRecent.get(key);
      if (hit && now - hit < 4000) return;
      logState.toastRecent.set(key, now);
    } else {
      const hit = logState.toastRecent.get(key);
      if (hit && now - hit < 4000) { logState.toastRecent.delete(key); return; }
      logState.engineRecent.set(key, now);
    }
    const type = LOG_TAG[opts.type] ? opts.type : classifyLog(text);
    logState.queue.push({ text: text.slice(0, 240), type, at: now });
    if (logState.queue.length > 30) logState.queue.splice(0, logState.queue.length - 30);
    pumpLog(true);
    scheduleLogPump();
  }

  function seedLogFeed(logs) {
    const feed = $('logFeed');
    if (!feed) return;
    feed.innerHTML = '';
    logState.queue = [];
    logState.current = null;
    logState.count = 0;
    logState.unseen = 0;
    logState.follow = true;
    const list = Array.isArray(logs) ? logs.slice(0, 38).reverse() : [];
    for (const text of list) {
      const item = appendLogEntry({ text: String(text).slice(0, 240), type: classifyLog(String(text)), at: null });
      if (item) {
        item.textEl.textContent = item.full;
        item.i = item.full.length;
      }
    }
    feed.scrollTop = feed.scrollHeight;
    updateLogChrome();
  }

  function buildLog() {
    const feed = $('logFeed');
    if (!feed) return;
    document.body.classList.toggle('journal-in-chat', !!UI.release.chat);
    logState.owner = UI.s();
    logState.live = true;
    seedLogFeed(UI.s().logs);
    if (!logState.bound) {
      logState.bound = true;
      document.addEventListener('visibilitychange', scheduleLogPump);
      feed.addEventListener('scroll', () => {
        const near = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 28;
        logState.follow = near;
        if (near) logState.unseen = 0;
        updateLogChrome();
      }, { passive: true });
      $('logToggle')?.addEventListener('click', e => {
        if (suppressLogToggleClick) { suppressLogToggleClick = false; e.preventDefault(); return; }
        setLogCollapsed(!logState.collapsed);
      });
      bindFloatingLog();
      $('logJump')?.addEventListener('click', () => {
        logState.follow = true;
        logState.unseen = 0;
        feed.scrollTop = feed.scrollHeight;
        updateLogChrome();
        try { feed.focus({ preventScroll: true }); } catch { /* bỏ qua */ }
      });
    }
    try { logState.collapsed = localStorage.getItem(LOG_KEY) === '1'; } catch { logState.collapsed = false; }
    if (!logFloatState.loaded) {
      logFloatState.loaded = true;
      try {
        const saved = JSON.parse(localStorage.getItem(LOG_FLOAT_KEY) || 'null');
        if (saved && typeof saved.floating === 'boolean') {
          logFloatState.floating = saved.floating;
          if (Number.isFinite(saved.x)) logFloatState.x = saved.x;
          if (Number.isFinite(saved.y)) logFloatState.y = saved.y;
        }
      } catch { /* giữ mặc định khi dữ liệu vị trí không hợp lệ */ }
    }
    setLogFloating(logFloatState.floating, false);
    setLogCollapsed(logState.collapsed, false);
    scheduleLogPump();
  }

  function syncLogOwner() {
    if (!logState.live) return;
    const s = UI.s();
    if (logState.owner !== s) {
      logState.owner = s;
      seedLogFeed(s.logs);
      setLogCollapsed(logState.collapsed, false);
    }
  }

  /* Theo dõi đúng phiên chơi, không sửa prototype của luật dùng chung. */
  UI.session.subscribe(event => {
    if (event.type === 'log' && logState.live && UI.s() === logState.owner) queueLog(event.message, { source: 'engine' });
    if (event.type === 'minorBreakthrough') {
      const stage = $('stage'); if (!stage) return;
      stage.querySelector('.minor-breakthrough')?.remove();
      const el = document.createElement('div'); el.className = 'minor-breakthrough'; el.setAttribute('role', 'status');
      const title = document.createElement('strong'), subtitle = document.createElement('span');
      title.textContent = 'Đột phá'; subtitle.textContent = (F.REALMS[event.realm] || '') + ' · Tầng ' + event.stage;
      el.append(title, subtitle); stage.appendChild(el); root.setTimeout(() => el.remove(), 2800);
    }
  });
  UI.logPanel = { buildLog, logFloatState, logState, queueLog, setLogCollapsed, syncLogOwner };
})(typeof window !== 'undefined' ? window : globalThis);
