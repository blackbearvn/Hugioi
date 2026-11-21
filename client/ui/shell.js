/* HƯ GIỚI · KHUNG ỨNG DỤNG
 * Bố cục ba vùng theo skeleton: trạng thái · sân khấu · menu, cùng cửa sổ nổi.
 * Bộ định tuyến, toast/modal, hiệu ứng nền, độ kiếp đài, vòng lặp 1 giây và vòng lặp hình ảnh. */
(function (root) {
  'use strict';
  const H = root.HU_GAME, F = H.F, A = root.HU_ASSETS;
  const UI = root.HU_UI, L = root.HU_LABELS;
  const { $, $$, esc, clamp, num, money, moneyHTML, pct, duration, btn } = UI.kit;
  const store = UI.store;
  /* Độ kiếp đài nằm ở tribulation-page.js (nạp sau tệp này); chuyển tiếp truy cập tới UI.tribulation. */
  const tribIdle = { active: false, pageOpen: false, phase: 'closed', layoutScene() {}, setReduced() {} };
  const trib = new Proxy({}, { get: (_, key) => (UI.tribulation || tribIdle)[key], set: (_, key, value) => { (UI.tribulation || tribIdle)[key] = value; return true; } });

  let modalAction = null, modalFocus = null, modalBusy = false, modalDismissible = true;
  let lastFrameTime = 0, frameCount = 0, zTop = 1;
  let lastStageMode = '', lastIdleVfx = 0, lastDocTitle = '';
  let heroAttackUntil = 0, heroAttackFrame = 0;

  const motionQuery = typeof root.matchMedia === 'function' ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const isReduced = () => {
    const m = UI.s().settings.motionMode;
    return document.body.classList.contains('device-reduced-motion') ||
      m === 'reduced' || (m === 'auto' && !!motionQuery?.matches);
  };

  /* ======================================================================
     TOAST / MODAL
     ====================================================================== */
  const TOAST_MAX = 3;
  const TOAST_ICON = { info: '✦', success: '✓', danger: '!', gold: '✧', loot: '◈', tribulation: '⚡' };
  const TOAST_TITLE = { info: 'Thiên mệnh', success: 'Thành công', danger: 'Cảnh báo', gold: 'Cơ duyên', loot: 'Thu hoạch', tribulation: 'Thiên kiếp' };
  const toastState = { queue: [], active: 0 };

  function classifyToast(message) {
    if (/thất bại|không thể|không đủ|chưa đủ|lỗi|hỏng|đang mở|quá mạnh|chưa mở|không có/i.test(message)) return 'danger';
    if (/thiên kiếp|lôi kiếp|độ kiếp|đột phá|phi thăng/i.test(message)) return 'tribulation';
    if (/nhận|mua|thu hoạch|yêu đan|cơ duyên|rơi|phần thưởng/i.test(message)) return 'loot';
    if (/thành công|đã |nâng|may mắn|hoàn tất|chúc mừng/i.test(message)) return 'success';
    return 'info';
  }

  function toast(message, opts = {}) {
    const text = String(message ?? '').trim();
    if (!text) return;
    const type = opts.type || classifyToast(text);
    toastState.queue.push({ ...opts, message: text, type });
    if (logState.live) queueLog(text, { type, source: 'toast' });
    if (toastState.queue.length > 12) {
      const extra = toastState.queue.splice(10);
      const count = extra.reduce((n, item) => n + (item.collapsed || 1), 0);
      toastState.queue.push({ message: `+${count} thông báo khác`, collapsed: count, type: 'info', title: 'Thiên mệnh', duration: 2600 });
    }
    drainToasts();
  }

  function drainToasts() {
    while (toastState.active < TOAST_MAX && toastState.queue.length) showToast(toastState.queue.shift());
  }

  function showToast(data) {
    const root = $('toast');
    if (!root) return;
    const type = TOAST_ICON[data.type] ? data.type : 'info';
    const item = document.createElement('div');
    item.className = 'toast-item toast-' + type;
    item.innerHTML = '<span class="toast-icon" aria-hidden="true">' + esc(data.icon || TOAST_ICON[type] || '✦') + '</span>' +
      '<div class="toast-copy">' + (data.title === false ? '' : '<b>' + esc(data.title || TOAST_TITLE[type] || 'Thông báo') + '</b>') +
      '<p>' + esc(data.message) + '</p></div>' +
      '<button type="button" class="toast-close" aria-label="Đóng thông báo">✕</button>' +
      '<i class="toast-life" aria-hidden="true"></i>';
    root.append(item);
    toastState.active++;
    const life = Math.max(900, Math.min(Number(data.duration) || 0, 3200) || (type === 'danger' ? 3200 : 2200));
    item.style.setProperty('--toast-life', life + 'ms');
    requestAnimationFrame(() => item.classList.add('show'));
    let timer = 0, remaining = life, started = Date.now();
    const paused = new Set();
    const close = () => {
      if (!item.isConnected || item.classList.contains('out')) return;
      clearTimeout(timer);
      item.classList.add('out');
      item.classList.remove('show');
      if (item.contains(document.activeElement)) {
        const next = item.nextElementSibling || item.previousElementSibling;
        const fallback = !$('modalLayer').hidden ? $('modalButtons').querySelector('button') : trib.pageOpen ? $('tribBack') : $('stage');
        (next?.querySelector('button') || fallback)?.focus({ preventScroll: true });
      }
      setTimeout(() => {
        item.remove();
        toastState.active = Math.max(0, toastState.active - 1);
        drainToasts();
      }, 220);
    };
    const arm = () => {
      if (paused.size || item.classList.contains('out')) return;
      started = Date.now();
      clearTimeout(timer);
      timer = setTimeout(close, Math.max(0, remaining));
    };
    const pause = reason => {
      if (!paused.size) {
        clearTimeout(timer);
        remaining = Math.max(0, remaining - (Date.now() - started));
      }
      paused.add(reason);
      item.classList.add('paused');
    };
    const resume = reason => {
      paused.delete(reason);
      if (!paused.size) { item.classList.remove('paused'); arm(); }
    };
    item.addEventListener('mouseenter', () => pause('hover'));
    item.addEventListener('mouseleave', () => resume('hover'));
    item.addEventListener('focusin', () => pause('focus'));
    item.addEventListener('focusout', e => { if (!item.contains(e.relatedTarget)) resume('focus'); });
    item.querySelector('.toast-close').addEventListener('click', e => { e.stopPropagation(); close(); });
    item.addEventListener('click', close);
    arm();
  }

  const { buildLog, logFloatState, logState, queueLog, setLogCollapsed, syncLogOwner } = UI.logPanel;

  function modal(title, html, onConfirm = null, label = 'Tiếp tục', eyebrow = 'Thiên mệnh', opts = {}) {
    modalAction = onConfirm;
    modalBusy = !!opts.busy;
    modalDismissible = opts.dismissible !== false;
    if ($('modalLayer').hidden) modalFocus = document.activeElement;
    const type = opts.type || 'info';
    const layer = $('modalLayer');
    layer.dataset.type = type;
    layer.classList.toggle('is-busy', modalBusy);
    layer.querySelector('.game-modal').dataset.type = type;
    layer.querySelector('.game-modal').classList.toggle('is-busy', modalBusy);
    layer.querySelector('.game-modal').setAttribute('aria-busy', String(modalBusy));
    $('modalEyebrow').textContent = eyebrow;
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = html;
    $('modalSymbol').textContent = opts.symbol || ({ success: '✦', danger: '⚠', gold: '✧', info: '✧' }[type] || '✦');
    /* Chỉ hộp thoại có hành động xác nhận mới cần nút ở chân. Hộp thông tin
       đóng bằng nút × ở góc trên hoặc bấm nền, không lặp thêm nút "Đóng". */
    $('modalButtons').innerHTML = modalBusy ? '' : onConfirm
      ? btn(label, 'modalConfirm', '', false, type === 'danger' ? 'btn-danger' : 'btn-gold') +
        btn('Hủy', 'modalClose', '', false, 'btn-outline')
      : '';
    layer.querySelector('.modal-x').hidden = modalBusy || !modalDismissible;
    layer.hidden = false;
    hideItemTip();
    document.body.classList.add('modal-open');
    ['game', 'tribulationFx', 'welcome'].forEach(id => { $(id).inert = true; });
    UI.vfx?.clear('#modalVfx');
    if (opts.vfx !== false) {
      const fx = opts.vfx || (type === 'success' ? ['chien_dau', 'phi_thang']
        : type === 'danger' ? ['loi_kiep', 'ha_gioi']
          : type === 'gold' ? ['chien_dau', 'linh_phu'] : null);
      if (fx) UI.vfx?.play('#modalVfx', { kind: fx[0], variant: fx[1], fps: 10, loop: true, className: 'modal-vfx-sprite' });
    }
    /* Hộp thông tin (không có nút xác nhận) nhận tiêu điểm vào chính khung,
       tránh viền vàng dính trên nút ×; Tab vẫn tới được nút ×. Hộp xác nhận
       đưa tiêu điểm vào hành động chính. */
    const card = layer.querySelector('.game-modal');
    const primary = !modalBusy && onConfirm
      ? $('modalButtons').querySelector(type === 'danger' ? '[data-act="modalClose"]' : 'button')
      : null;
    (primary || card).focus?.({ preventScroll: true });
  }

  function closeModal(force = false) {
    if (modalBusy && !force) return;
    if (!modalDismissible && !force) return;
    modalBusy = false;
    modalDismissible = true;
    const layer = $('modalLayer');
    layer.hidden = true;
    layer.removeAttribute('data-type');
    layer.classList.remove('is-busy');
    const card = layer.querySelector('.game-modal');
    card.removeAttribute('data-type');
    card.classList.remove('is-busy');
    card.removeAttribute('aria-busy');
    layer.querySelector('.modal-x').hidden = false;
    document.body.classList.remove('modal-open');
    ['game', 'tribulationFx', 'welcome'].forEach(id => { $(id).inert = false; });
    UI.vfx?.clear('#modalVfx');
    modalAction = null;
    const target = modalFocus?.isConnected && !modalFocus.matches(':disabled') && modalFocus.getClientRects().length ? modalFocus : trib.pageOpen ? $('tribBack') : $('stage');
    try { target?.focus?.({ preventScroll: true }); } catch { /* bỏ qua */ }
    modalFocus = null;
  }

  /* ======================================================================
     ĐỊNH TUYẾN
     ====================================================================== */
  const tabOf = def => {
    if (!def?.tabs) return '';
    const wanted = UI.tabState[def.id];
    return def.tabs.some(t => t.id === wanted) ? wanted : def.tabs[0].id;
  };

  function resetFilters() {
    Object.assign(UI.view, { category: 'Tất cả', query: '', page: 0, quality: 0, selected: '', onlyReady: false });
  }

  /* ======================================================================
     BỐ CỤC THEO TỈ LỆ KHUNG
     ====================================================================== */
  function pickLayout() {
    const w = root.innerWidth || document.documentElement.clientWidth || 0;
    const h = root.innerHeight || document.documentElement.clientHeight || 1;
    const a = w / h;
    return a < 0.85 ? 'portrait' : ((w >= 900 && a >= 1.15) || (w >= 700 && h <= 520 && a >= 1.5)) ? 'wide' : 'landscape';
  }

  /* Chỉ cuộn thanh điều hướng, không làm trang nội dung hoặc cả cửa sổ nhảy. */
  function revealHorizontalItem(container, item) {
    if (!container || !item) return;
    const bar = container.getBoundingClientRect(), target = item.getBoundingClientRect();
    if (target.left < bar.left || target.right > bar.right) {
      container.scrollLeft += target.left - bar.left - (container.clientWidth - target.width) / 2;
    }
  }

  function applyLayout() {
    const el = $('game');
    if (!el) return;
    closePageNav();
    closeTabbar();
    const layout = pickLayout();
    document.body.dataset.layout = layout;
    if (el.dataset.layout !== layout) {
      el.dataset.layout = layout;
      wins.relayout();
    } else {
      wins.fit();
    }
  }

  /* ======================================================================
     CỬA SỔ NỔI
     ====================================================================== */
  /* Thứ tự menu: Nhân vật → Tu luyện → Bế quan → Nhiệm vụ → Tông môn → Nghề phụ → Lịch luyện → Thế giới → Thêm. Truyền âm mở bằng bong bóng chat, Bảng xếp hạng nằm trong Giao du. */
  const WINDOW_ORDER = ['character', 'idle', 'retreat', 'quests', 'sect', 'craft', 'combat', 'world'];
  const WINDOW_SIZE = { idle: 470, retreat: 620, combat: 590, craft: 740, character: 760, world: 850, quests: 700, chat: 620, ranking: 740, settings: 630, meta: 760, more: 720 };
  const BADGED = ['combat', 'craft', 'retreat', 'quests'];

  const wins = {
    map: new Map(),
    taskbar: null,
    has(id) { return this.map.has(id); },
    key(id) { return 'huGioiWin:' + ($('game')?.dataset.layout || 'wide') + ':' + id; },
    topId() {
      let top = null, z = -1;
      this.map.forEach((w, id) => { if (w.minimized) return; const n = +w.el.style.zIndex || 0; if (n >= z) { z = n; top = id; } });
      return top;
    },
    open(id) {
      if (id === 'tribulation') { go('tribulation'); return null; }
      const def = UI.screens[id];
      if (!def) return null;
      closeMoreMenu();
      if (id !== 'chat') this.closeOthers(id);
      if (this.map.has(id)) {
        const w = this.map.get(id);
        if (w.tab !== tabOf(def)) this.render(id);
        this.restore(id); return w.el;
      }
      const el = document.createElement('section');
      const isPage = id !== 'chat';
      el.className = isPage ? 'win page desktop-window' : 'win chat-floating desktop-window';
      el.dataset.window = id;
      if (id === 'chat') el.id = 'chatFloating';
      el.tabIndex = -1;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', def.label);
      const icon = def.icon && /^ICON-/.test(def.icon)
        ? '<img src="media/assets/ui/icon/menu/' + esc(def.icon) + '-40.png" alt="" decoding="async">'
        : '<span aria-hidden="true">' + esc(def.icon || '◈') + '</span>';
      const navIcon = k => { const d = UI.screens[k], ic = d.icon && /^ICON-/.test(d.icon) ? '<img src="media/assets/ui/icon/menu/' + esc(d.icon) + '-40.png" alt="" decoding="async">' : '<span aria-hidden="true">' + esc(d.icon || '◈') + '</span>'; return ic; };
      const nav = isPage ? '<nav class="page-nav" aria-label="Chuyển trang">' +
        '<button type="button" class="page-nav-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="pageNavMenu" aria-label="Chuyển trang, đang ở ' + esc(def.label) + '">' +
        '<span class="page-nav-toggle-ico" aria-hidden="true">☰</span><span class="page-nav-toggle-current">' + esc(def.label) + '</span><span class="page-nav-toggle-chevron" aria-hidden="true">⌄</span></button>' +
        '<div id="pageNavMenu" class="page-nav-menu">' + [...WINDOW_ORDER, 'settings'].filter(k => k !== 'idle' && UI.screens[k]).map(k =>
        '<button type="button" data-open-page="' + k + '" class="' + (k === id ? 'on' : '') + '" aria-label="' + esc(UI.screens[k].label) + '" title="' + esc(UI.screens[k].label) + '"' + (k === id ? ' aria-current="page"' : '') + '>' + navIcon(k) + '<span>' + esc(UI.screens[k].label) + '</span></button>').join('') + '</div></nav>' : '';
      el.innerHTML = isPage ? '<header><button class="page-back" type="button" aria-label="Quay lại màn tu luyện">‹ <span>Tu luyện</span></button>' +
        '<b>' + icon + '<span>' + esc(def.label) + '</span></b>' + nav + '</header><div class="win-body"></div>'
        : '<header><b>' + icon + '<span>' + esc(def.label) + '</span></b><button type="button" class="win-close" aria-label="Đóng truyền âm">×</button></header><div class="win-body"></div><div class="rz" aria-hidden="true"></div>';
      $('wins').appendChild(el);
      const rect = this.clampRect(this.loadRect(id) || this.defaultRect(id));
      this.setRect(el, rect);
      this.map.set(id, { el, body: el.querySelector('.win-body'), rect, def, sig: '', minimized: false, maximized: false, restoreRect: null });
      el.addEventListener('pointerdown', () => this.focus(id), true);
      if (isPage) el.querySelector('.page-back').addEventListener('click', e => { e.stopPropagation(); go('idle'); });
      else { el.querySelector('.win-close').addEventListener('click', e => { e.stopPropagation(); this.close(id); }); drag(el.querySelector('header'), el, id); resize(el.querySelector('.rz'), el, id); }
      this.render(id);
      this.focus(id);
      if (isPage) root.requestAnimationFrame(() => {
        if (el.isConnected) revealHorizontalItem(el.querySelector('.page-nav-menu'), el.querySelector('.page-nav-menu .on'));
      });
      markMenu();
      this.updateTaskbar();
      updateStage();
      return el;
    },
    close(id) {
      const w = this.map.get(id);
      if (!w) return;
      if (!w.maximized) this.saveRect(id, w.rect);
      w.el.remove();
      this.map.delete(id);
      if (UI.current === id) UI.current = this.topId() || 'idle';
      this.updateTaskbar();
      markMenu();
      updateStage();
    },
    closeOthers(except = null) {
      let removed = false;
      [...this.map.keys()].forEach(id => {
        if (id === except || id === 'chat') return;
        const w = this.map.get(id);
        if (!w) return;
        if (!w.maximized) this.saveRect(id, w.rect);
        w.el.remove();
        this.map.delete(id);
        removed = true;
      });
      if (removed) {
        if (UI.current !== except) UI.current = this.topId() || 'idle';
        markMenu();
        updateStage();
      }
    },
    closeAll() {
      this.map.forEach((w, id) => { if (!w.maximized) this.saveRect(id, w.rect); });
      this.map.forEach(w => w.el.remove());
      this.map.clear();
      this.updateTaskbar();
      UI.current = 'idle';
      markMenu();
      updateStage();
    },
    toggle(id) {
      if (!this.has(id)) return this.open(id);
      this.close(id);
    },
    updateTaskbar() {
      if (!this.taskbar) {
        this.taskbar = document.createElement('nav');
        this.taskbar.id = 'windowTaskbar';
        this.taskbar.className = 'window-taskbar';
        this.taskbar.setAttribute('aria-label', 'Thanh tác vụ');
        document.body.appendChild(this.taskbar);
        this.taskbar.addEventListener('click', e => {
          const button = e.target.closest('[data-task-window]');
          if (button?.dataset.taskWindow === '__log') setLogCollapsed(!logState.collapsed);
          else if (button) this.toggle(button.dataset.taskWindow);
        });
      }
      const logInTaskbar = !UI.release.chat && logFloatState.floating && $('logPanel');
      this.taskbar.hidden = true;
      this.taskbar.innerHTML = [...this.map.entries()].map(([id,w]) =>
        '<button type="button" class="window-task' + (w.minimized ? ' minimized' : '') +
        (this.topId() === id ? ' active' : '') + '" data-task-window="' + esc(id) +
        '" aria-pressed="' + String(this.topId() === id) + '">' + esc(w.def.label) + '</button>').join('') +
        (logInTaskbar ? '<button type="button" data-task-window="__log" class="window-task' +
          (logState.collapsed ? ' minimized' : ' active') + '" aria-pressed="' + String(!logState.collapsed) + '">Nhật ký</button>' : '');
    },
    minimize(id) {
      const w = this.map.get(id); if (!w) return;
      w.minimized = true; w.el.hidden = true;
      if (UI.current === id) UI.current = this.topId() || 'idle';
      this.updateTaskbar(); markMenu(); updateStage();
    },
    restore(id) {
      const w = this.map.get(id);
      if (!w) return this.open(id);
      w.minimized = false; w.el.hidden = false;
      this.focus(id); return w.el;
    },
    maximize(id) {
      const w = this.map.get(id); if (!w) return;
      if (w.maximized) {
        w.maximized = false;
        w.rect = this.clampRect(w.restoreRect || this.defaultRect(id));
        w.restoreRect = null;
      } else {
        w.restoreRect = { ...w.rect }; w.maximized = true;
        const W = root.innerWidth || 1280, H = root.innerHeight || 768;
        w.rect = { x: 8, y: 8, w: W - 16, h: Math.max(180,H - 64) };
      }
      this.setRect(w.el,w.rect);
      w.el.classList.toggle('maximized',w.maximized);
      w.el.querySelector('.win-max').textContent = w.maximized ? '❐' : '▢';
      w.el.querySelector('.win-max').setAttribute('aria-label',w.maximized ? 'Khôi phục kích thước' : 'Phóng to');
      if (!w.maximized) this.saveRect(id,w.rect);
      this.focus(id);
    },
    focus(id) {
      const w = this.map.get(id);
      if (!w) return;
      if (w.minimized) { w.minimized = false; w.el.hidden = false; }
      w.el.style.zIndex = ++zTop;
      this.map.forEach((v, k) => v.el.classList.toggle('top', k === id));
      if (id !== 'chat') UI.current = id;
      this.updateTaskbar();
      markMenu();
    },
    render(id) {
      const w = this.map.get(id);
      if (!w) return;
      if (tipCell && w.body.contains(tipCell)) hideItemTip();
      const def = w.def, tab = tabOf(def), y = w.body.scrollTop;
      const oldTab = w.tab, oldTabMenu = w.body.querySelector('.tabbar-menu');
      const oldTabScroll = oldTabMenu?.scrollLeft || 0;
      const oldTabOpen = !!w.body.querySelector('.tabbar.open');
      const content = def.panel ? def.panel(tab) : def.render(tab);
      w.body.innerHTML = (id === 'idle' ? '<p class="screen-lead">Tu vi tự tăng khi nhập định. Mở các bảng bên dưới để tăng tốc, xem công pháp và mục tiêu gần.</p>' : '') + content;
      w.body.scrollTop = y;
      w.tab = tab;
      const tabbar = w.body.querySelector('.tabbar');
      if (tabbar) {
        const menu = tabbar.querySelector('.tabbar-menu');
        if (oldTab === tab) {
          if (menu) menu.scrollLeft = oldTabScroll;
          // Vẽ lại nền (dữ liệu về, đồng hồ đếm) không được đóng menu thả xuống người chơi đang mở.
          if (oldTabOpen) { tabbar.classList.add('open'); tabbar.querySelector('.tabbar-toggle')?.setAttribute('aria-expanded', 'true'); }
        }
        else root.requestAnimationFrame(() => {
          if (tabbar.isConnected) revealHorizontalItem(menu, tabbar.querySelector('.tab.active'));
        });
      }
      if (def.pageBg) { const bg = def.pageBg(tab); if (bg) w.el.style.setProperty('--page-bg', "url('" + bg + "')"); else w.el.style.removeProperty('--page-bg'); }
      def.mount?.(tab);
      def.update?.(tab);
      updateTimers();
      w.sig = def.signature?.(tab) ?? '';
    },
    refreshAll() { this.map.forEach((w, id) => this.render(id)); },
    /* Trang riêng: phủ đúng vùng sân khấu + nhật ký, tách biệt màn chơi. */
    pageRect() {
      const a = $('stage')?.getBoundingClientRect(), b = $('logPanel')?.getBoundingClientRect();
      if (!a || !a.width) return null;
      const bottom = b && b.height ? Math.max(a.bottom, b.bottom) : a.bottom;
      return { x: a.left, y: a.top, w: a.width, h: bottom - a.top };
    },
    defaultRect(id) {
      const layout = $('game')?.dataset.layout || 'wide';
      const W = root.innerWidth || document.documentElement.clientWidth || 1280;
      const H = root.innerHeight || document.documentElement.clientHeight || 800;
      // Truyền âm trên màn ngang thấp: không bó cửa sổ vào sân khấu chỉ cao
      // ~180 px, nếu không transcript và ô nhập sẽ bị cắt.
      if (id === 'chat' && H <= 520)
        return this.clampRect({ x: (W - Math.min(W - 16, WINDOW_SIZE.chat)) / 2, y: 8,
          w: Math.min(W - 16, WINDOW_SIZE.chat), h: H - 16 });
      // Truyền âm trên điện thoại cần đủ chỗ đọc tin và soạn, kể cả màn thấp.
      // Vị trí người chơi đã lưu vẫn được ưu tiên trong loadRect().
      if (id === 'chat' && layout === 'portrait' && W < 600) {
        const height = Math.min(H - 16, Math.max(380, H * 0.78));
        return this.clampRect({ x: 8, y: (H - height) / 2, w: W - 16, h: height });
      }
      const stage = $('stage')?.getBoundingClientRect();
      const pad = layout === 'portrait' ? 8 : 12;
      const maxW = stage ? Math.max(260, stage.width - pad * 2) : W - 16;
      const maxH = stage ? Math.max(180, stage.height - pad * 2) : H - 16;
      const width = Math.max(260, Math.min(WINDOW_SIZE[id] || 520, layout === 'portrait' ? W - 20 : maxW, W - 16));
      let height = Math.min(layout === 'portrait' ? H * 0.7 : H * 0.88, 800, maxH);
      height = Math.max(180, Math.min(height, H - 16));
      let x, y;
      /* Màn rộng: sân khấu thấp (~500px ở 768p) nên cửa sổ nội dung dài bị cắt sớm. Cho cửa sổ cao đến hết màn hình,
         đè lên phần nhật ký bên dưới (kéo thả được) để thấy nhiều nội dung hơn mà không phải cuộn. */
      const tall = layout === 'wide' && stage && H > 520 && id !== 'combat';
      if (tall) height = Math.max(height, Math.min(800, H - stage.top - 16));
      if (stage) {
        x = stage.left + (stage.width - width) / 2;
        y = tall ? stage.top + 10 : stage.top + (stage.height - height) / 2;
      } else {
        x = (W - width) / 2;
        y = (H - height) / 2;
      }
      // Điện thoại: cửa sổ chiếm trọn khoảng trống giữa bảng trạng thái và thanh menu,
      // thay vì bị bó trong sân khấu (chỉ cao ~370px nên nội dung bị cắt sớm).
      const status = $('status')?.getBoundingClientRect(), menu = $('menu')?.getBoundingClientRect();
      if (layout === 'portrait' && W < 600 && status && menu && menu.top - status.bottom > 200) {
        const top = status.bottom + 8;
        return this.clampRect({ x: 8, y: top, w: W - 16, h: menu.top - 8 - top });
      }
      /* Lịch luyện: hero và quái đứng ở hai bên giữa sân khấu nên cửa sổ ở giữa sẽ che trận đánh.
         Trên màn rộng, đặt cửa sổ dưới sân khấu (đè lên bảng nhật ký, nhật ký chiến đấu đã có trong cửa sổ). */
      if (id === 'combat' && layout === 'wide' && stage) {
        const top = stage.bottom + 6, h = H - top - 8;
        if (h >= 220) return this.clampRect({ x: stage.left, y: top, w: stage.width, h });
      }
      /* Màn ngang thấp: chừa cột kỹ năng ở mép trái sân khấu. */
      if (id === 'combat' && layout === 'wide' && stage && H <= 520) {
        return this.clampRect({ x: stage.left + 58, y, w: Math.min(width, stage.width - 66), h: height });
      }
      return this.clampRect({ x, y, w: width, h: height });
    },
    loadRect(id) {
      // Vị trí cửa sổ chat cũ lưu ở chiều ngang không còn đủ chỗ soạn tin.
      if (id === 'chat' && (root.innerHeight || document.documentElement.clientHeight) <= 520) return null;
      try {
        const raw = JSON.parse(localStorage.getItem(this.key(id)) || 'null');
        if (raw && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(raw[k]))) return this.clampRect(raw);
      } catch { /* bỏ qua */ }
      return null;
    },
    saveRect(id, rect) {
      try { localStorage.setItem(this.key(id), JSON.stringify(rect)); } catch { /* bỏ qua */ }
    },
    clampRect(r) {
      const W = root.innerWidth || document.documentElement.clientWidth || 1280;
      const H = root.innerHeight || document.documentElement.clientHeight || 800;
      r.w = Math.max(260, Math.min(r.w, W - 16));
      r.h = Math.max(180, Math.min(r.h, H - 16));
      r.x = Math.max(8, Math.min(r.x, W - r.w - 8));
      r.y = Math.max(8, Math.min(r.y, H - r.h - 8));
      return r;
    },
    setRect(el, r) {
      el.style.left = r.x + 'px';
      el.style.top = r.y + 'px';
      el.style.width = r.w + 'px';
      el.style.height = r.h + 'px';
    },
    fit() {
      this.map.forEach((w, id) => {
        if (id === 'chat' && !w.maximized &&
            (root.innerHeight || document.documentElement.clientHeight) <= 520) {
          w.rect = this.defaultRect(id);
        } else if (w.maximized) {
          const W = root.innerWidth || 1280, H = root.innerHeight || 768;
          w.rect = { x: 8, y: 8, w: W - 16, h: Math.max(180, H - 64) };
        } else w.rect = this.clampRect(w.rect);
        this.setRect(w.el, w.rect);
        if (id !== 'chat') revealHorizontalItem(w.el.querySelector('.page-nav-menu'), w.el.querySelector('.page-nav-menu .on'));
      });
      this.fitChatToVisualViewport();
    },
    /* Bàn phím ảo có thể chỉ thu visual viewport, không phát resize trên window.
       Dùng hình chữ nhật tạm thời, không ghi đè vị trí/kích thước người chơi đã lưu. */
    fitChatToVisualViewport() {
      const w = this.map.get('chat'), viewport = root.visualViewport;
      if (!w) return;
      const composing = w.el.contains(document.activeElement) && document.activeElement.matches('input, textarea');
      const keyboard = viewport && viewport.scale === 1 && composing && viewport.height < (root.innerHeight || 0) - 80;
      w.el.classList.toggle('keyboard-open', !!keyboard);
      if (!keyboard) {
        if (w.visualRect) this.setRect(w.el, w.rect);
        w.visualRect = false;
        return;
      }
      const pad = 8, width = Math.max(0, viewport.width - pad * 2), height = Math.max(0, viewport.height - pad * 2);
      const left = viewport.offsetLeft + pad, top = viewport.offsetTop + pad;
      const rect = { w: Math.min(w.rect.w, width), h: Math.min(w.rect.h, height) };
      rect.x = Math.max(left, Math.min(w.rect.x, left + width - rect.w));
      rect.y = Math.max(top, Math.min(w.rect.y, top + height - rect.h));
      this.setRect(w.el, rect);
      w.visualRect = true;
    },
    relayout() {
      this.map.forEach((w, id) => {
        w.maximized = false; w.restoreRect = null;
        w.rect = this.clampRect(this.loadRect(id) || this.defaultRect(id));
        this.setRect(w.el, w.rect);
        this.render(id);
      });
      this.fitChatToVisualViewport();
    }
  };
  UI.windows = wins;

  function drag(handle, el, id) {
    handle.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      const w = wins.map.get(id);
      if (!w) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, ox = w.rect.x, oy = w.rect.y;
      try { handle.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
      el.classList.add('drag');
      const mv = ev => {
        w.rect = wins.clampRect({ ...w.rect, x: ox + ev.clientX - sx, y: oy + ev.clientY - sy });
        wins.setRect(el, w.rect);
      };
      const up = () => {
        handle.removeEventListener('pointermove', mv);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        el.classList.remove('drag');
        wins.saveRect(id, w.rect);
      };
      handle.addEventListener('pointermove', mv);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  }

  function resize(handle, el, id) {
    handle.addEventListener('pointerdown', e => {
      const w = wins.map.get(id);
      if (!w) return;
      e.preventDefault();
      e.stopPropagation();
      const sx = e.clientX, sy = e.clientY, ow = w.rect.w, oh = w.rect.h;
      try { handle.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
      const mv = ev => {
        w.rect = wins.clampRect({ ...w.rect, w: ow + ev.clientX - sx, h: oh + ev.clientY - sy });
        wins.setRect(el, w.rect);
      };
      const up = () => {
        handle.removeEventListener('pointermove', mv);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        wins.saveRect(id, w.rect);
      };
      handle.addEventListener('pointermove', mv);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  }

  function buildMenu() {
    const menu = $('menu');
    if (!menu) return;
    menu.innerHTML = '<button type="button" id="menuToggle" class="menu-toggle" aria-controls="menu" aria-expanded="true" aria-label="Thu gọn menu" title="Thu gọn menu"><span class="ico" aria-hidden="true">☰</span><span>Menu</span></button>' + WINDOW_ORDER.map(id => {
      const def = UI.screens[id];
      if (!def) return '';
      const icon = def.icon && /^ICON-/.test(def.icon)
        ? '<img src="media/assets/ui/icon/menu/' + esc(def.icon) + '-40.png" alt="" decoding="async">'
        : '<span class="ico" aria-hidden="true">' + esc(def.icon || '◈') + '</span>';
      const badge = BADGED.includes(id) ? '<em class="badge' + (id === 'tribulation' ? ' hot' : '') + '" data-badge="' + id + '" hidden></em>' : '';
      return '<button type="button" data-window="' + id + '" title="' + esc(def.label) + '" aria-label="' + esc(def.label) + '" aria-pressed="false">' + icon + '<span>' + esc(def.label) + '</span>' + badge + '</button>';
    }).join('') +
      '<button type="button" id="moreMenuBtn" class="menu-more" title="Thêm" aria-label="Thêm" aria-haspopup="true" aria-expanded="false" aria-controls="moreMenu"><span class="ico" aria-hidden="true">⋯</span><span>Thêm</span></button>';
    applyMenuState(false);
    menu.addEventListener('scroll', updateMenuOverflow, { passive: true });
    root.addEventListener('resize', updateMenuOverflow);
    markMenu();
  }

  /* Menu thu gọn/mở bằng icon ☰; nhớ lựa chọn theo trình duyệt. */
  function menuCollapsed() {
    try { return localStorage.getItem('huGioiMenuCollapsed') === '1'; } catch { return false; }
  }
  function applyMenuState(collapsed) {
    const game = $('game'), toggle = $('menuToggle');
    if (!game) return;
    if (collapsed === false && toggle && !toggle.dataset.init) { collapsed = menuCollapsed(); toggle.dataset.init = '1'; }
    game.dataset.menu = collapsed ? 'collapsed' : 'open';
    if (toggle) {
      const label = collapsed ? 'Mở menu' : 'Thu gọn menu';
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
      toggle.querySelector('.ico').textContent = collapsed ? '▸' : '☰';
    }
  }
  function toggleMenu() {
    const collapsed = $('game').dataset.menu !== 'collapsed';
    closeMoreMenu();
    applyMenuState(collapsed);
    try { localStorage.setItem('huGioiMenuCollapsed', collapsed ? '1' : '0'); } catch { /* bỏ qua */ }
    requestAnimationFrame(() => { wins.fit(); trib.layoutScene(); });
  }

  /* Menu ngang: chỉ hiện vệt mờ ở mép khi còn mục chưa nhìn thấy.
     Mục đang mở luôn được cuộn vào giữa nếu người chơi chuyển trang. */
  function updateMenuOverflow() {
    const menu = $('menu'), game = $('game');
    if (!menu || game?.dataset.layout !== 'portrait' || game?.dataset.menu === 'collapsed') return;
    menu.dataset.moreLeft = String(menu.scrollLeft > 2);
    menu.dataset.moreRight = String(menu.scrollLeft + menu.clientWidth < menu.scrollWidth - 2);
  }
  function keepSelectedMenuVisible() {
    const menu = $('menu'), game = $('game');
    if (!menu || game?.dataset.layout !== 'portrait' || game?.dataset.menu === 'collapsed') return;
    const active = menu.querySelector('button.on');
    const selected = active?.dataset.window || active?.id || '';
    if (active && menu.dataset.current !== selected) {
      menu.dataset.current = selected;
      const left = active.offsetLeft;
      menu.scrollTo({ left: Math.max(0, left + active.offsetWidth / 2 - menu.clientWidth / 2), behavior: 'auto' });
    }
    updateMenuOverflow();
  }

  function markMenu() {
    $('game')?.classList.toggle('page-open', [...wins.map.keys()].some(id => id !== 'chat'));
    $$('#menu [data-window]').forEach(b => {
      const on = b.dataset.window === 'tribulation' ? trib.pageOpen : b.dataset.window === 'idle' ? wins.map.size === 0 && !trib.pageOpen : wins.has(b.dataset.window);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const moreBtn = $('moreMenuBtn');
    if (moreBtn) {
      const on = wins.has('more');
      moreBtn.classList.toggle('on', on);
      moreBtn.setAttribute('aria-pressed', String(on));
    }
    root.requestAnimationFrame(keepSelectedMenuVisible);
  }

  function closeMoreMenu({ focus = false } = {}) {
    const menu = $('moreMenu'), trigger = $('moreMenuBtn');
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
    if (focus) try { trigger?.focus({ preventScroll: true }); } catch { /* bỏ qua */ }
  }

  function positionMoreMenu() {
    const menu = $('moreMenu'), trigger = $('moreMenuBtn');
    if (!menu || menu.hidden || !trigger) return;
    const r = trigger.getBoundingClientRect();
    const W = root.innerWidth || document.documentElement.clientWidth || 1280;
    const H = root.innerHeight || document.documentElement.clientHeight || 800;
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const layout = $('game')?.dataset.layout || 'wide';
    let left, top;
    if (layout === 'portrait') {
      left = clamp(r.left + r.width / 2 - mw / 2, 8, W - mw - 8);
      top = r.top - mh - 8;
      if (top < 8) top = Math.min(H - mh - 8, r.bottom + 8);
    } else {
      left = r.left - mw - 10;
      top = clamp(r.top + r.height / 2 - mh / 2, 8, H - mh - 8);
      if (left < 8) left = Math.min(W - mw - 8, r.right + 10);
    }
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';
  }

  function openMoreMenu() {
    UI.release.syncMoreMenu();
    const menu = $('moreMenu'), trigger = $('moreMenuBtn');
    if (!menu || !trigger) return;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    positionMoreMenu();
    try { menu.querySelector('button')?.focus({ preventScroll: true }); } catch { /* bỏ qua */ }
  }

  function toggleMoreMenu() {
    const menu = $('moreMenu');
    if (!menu) return;
    menu.hidden ? openMoreMenu() : closeMoreMenu({ focus: true });
  }

  /* Điều hướng trang: thanh ngang trên desktop, dropdown gọn trên mobile.
     Chỉ đổi cách trình bày, mục đang mở vẫn được đánh dấu và giữ nguyên hành vi. */
  function pageNavToggle() {
    return document.querySelector('.win.page .page-nav-toggle');
  }

  function closePageNav({ focus = false } = {}) {
    const nav = pageNavToggle()?.closest('.page-nav');
    if (!nav?.classList.contains('open')) return false;
    nav.classList.remove('open');
    pageNavToggle()?.setAttribute('aria-expanded', 'false');
    if (focus) try { pageNavToggle()?.focus({ preventScroll: true }); } catch { /* bỏ qua */ }
    return true;
  }

  function togglePageNav(nav) {
    const toggle = nav?.querySelector('.page-nav-toggle');
    if (!nav || !toggle) return;
    if (nav.classList.contains('open')) { closePageNav({ focus: true }); return; }
    closeTabbar();
    nav.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    try {
      (nav.querySelector('.page-nav-menu .on') || nav.querySelector('.page-nav-menu button'))?.focus({ preventScroll: true });
    } catch { /* bỏ qua */ }
  }

  function closeTabbar({ focus = false } = {}) {
    const bar = document.querySelector('.win.page .tabbar.open');
    if (!bar) return false;
    bar.classList.remove('open');
    const toggle = bar.querySelector('.tabbar-toggle');
    toggle?.setAttribute('aria-expanded', 'false');
    if (focus) try { toggle?.focus({ preventScroll: true }); } catch { /* bỏ qua */ }
    return true;
  }

  function toggleTabbar(bar) {
    const toggle = bar?.querySelector('.tabbar-toggle');
    if (!bar || !toggle) return;
    if (bar.classList.contains('open')) { closeTabbar({ focus: true }); return; }
    closePageNav();
    bar.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    try {
      (bar.querySelector('.tab.active') || bar.querySelector('.tab'))?.focus({ preventScroll: true });
    } catch { /* bỏ qua */ }
  }

  /* ======================================================================
     RENDER / ĐIỀU HƯỚNG
     ====================================================================== */
  function refresh() {
    hideItemTip();
    updateChrome();
    updateStage();
    wins.refreshAll();
    updateTimers();
    if (trib.pageOpen) trib.updatePage();
    UI.battlePage?.sync(true);
    UI.craftPage?.sync();
    UI.tutorial?.update();
  }

  function soft() {
    hideItemTip();
    updateChrome();
    updateStage();
    wins.map.forEach(w => w.def.update?.(tabOf(w.def)));
    updateTimers();
    if (trib.pageOpen) trib.updatePage();
    UI.battlePage?.sync(false);
    UI.craftPage?.sync();
    UI.tutorial?.update();
  }

  function go(target, { silent = false } = {}) {
    if (target === 'combat') target = 'sect:exploration';
    if (target === 'world:dungeons') target = 'sect:dungeons';
    if (target === 'world:sect') target = 'sect:missions';
    if (!UI.release.allowed(target)) return;
    if (target === 'chat') { wins.toggle('chat'); return; }
    if (target === 'world:quests') target = 'quests'; // Liên kết cũ từ NPC / URL vẫn hoạt động.
    if (!UI.s().created) return;
    if (['running', 'settling'].includes(trib.phase)) return;
    closeMoreMenu();
    hideItemTip();
    const [id, tab] = String(target || 'idle').split(':');
    if (trib.pageOpen && id !== 'tribulation') trib.closePage();
    if (id === 'tribulation') {
      const conflict = root.HU_COMMANDS?.activityConflict(UI.s(), 'breakthrough');
      if (conflict) { toast(conflict, { type: 'info' }); return; }
      resetFilters();
      wins.closeAll();
      UI.current = 'tribulation';
      trib.openPage();
      updateChrome();
      updateStage();
      if (!silent) {
        try { if (root.location.hash !== '#tribulation') root.location.hash = '#tribulation'; } catch { /* file:// cũ */ }
        try { $('tribBack')?.focus?.({ preventScroll: true }); } catch { /* bỏ qua */ }
      }
      return;
    }
    const def = UI.screens[id] || UI.screens.idle;
    if (UI.current !== def.id || tab) resetFilters();
    UI.current = def.id;
    if (tab) UI.tabState[def.id] = tab;
    if (def.id === 'idle') { wins.closeOthers('chat'); UI.current = 'idle'; }
    else wins.open(def.id);
    updateChrome();
    updateStage();
    if (!silent) {
      try {
        const hash = '#' + def.id + (tab ? '/' + tabOf(def) : '');
        if (root.location.hash !== hash) root.location.hash = hash;
      } catch { /* file:// cũ */ }
      const focusEl = def.id === 'idle' ? $('stage') : wins.map.get(def.id)?.el;
      try { focusEl?.focus?.({ preventScroll: true }); } catch { /* bỏ qua */ }
    }
  }

  /* ======================================================================
     TRẠNG THÁI / SÂN KHẤU
     ====================================================================== */
  function updateChrome() {
    const s = UI.s(), g = UI.g();
    if (!s.created || !$('playerName')) return;
    syncLogOwner();
    const unlocked = UI.session.drainAchievements();
    if (unlocked.length) {
      unlocked.slice(0, 2).forEach(a => toast('Mở thành tựu kiếp này · ' + a.name + '.', { type: 'gold', title: 'Thành tựu', duration: 5200 }));
      if (unlocked.length > 2) toast('+' + (unlocked.length - 2) + ' thành tựu khác vừa mở.', { type: 'gold', title: 'Thành tựu', duration: 5200 });
    }
    const need = g.need(), p = clamp(s.qi / need * 100, 0, 100), readyQi = p >= 100 && !s.completed;
    const shown = UI.session.displayQi(), pShown = clamp(shown / need * 100, 0, 100);
    $('playerName').textContent = s.name;
    $('playerRealm').textContent = g.realmLabel();
    const rootText = H.rootLabel(s.rootType, s.rootSub).toUpperCase(), rootNode = $('playerRoot');
    const rootKey = s.rootType === 'Dị' ? 'di:' + s.rootSub : 'root:' + s.rootType;
    // Chỉ dựng lại khi nhãn đổi, để animation chữ không bị khởi động lại mỗi giây.
    if (rootNode.dataset.labelKey !== rootKey) {
      rootNode.dataset.labelKey = rootKey;
      rootNode.innerHTML = !L ? esc(rootText)
        : s.rootType === 'Dị' && H.DI_LINH_CAN[s.rootSub] ? L.span(rootText, 'element', s.rootSub)
          : L.span(rootText, 'root', s.rootType);
    }
    $('playerPlace').textContent = F.realm_map(s.zone) + ' · ' + H.ZONES[s.zone].name;
    const avatar = $('avatar'), avatarSrc = A.heroPortrait(s.gender, s.realm);
    if (avatar && avatar.getAttribute('src') !== avatarSrc) avatar.src = avatarSrc;
    const moneyEl = $('moneyTop'), moneyText = money(s.stone);
    if (moneyEl) {
      if (moneyEl.textContent !== moneyText) moneyEl.innerHTML = moneyHTML(s.stone);
      moneyEl.setAttribute('aria-label', money(s.stone, s.realm, false));
      const label = $('moneyLabel');
      if (label) label.textContent = F.currency(s.realm).name;
    }
    const trainingBusy = !!root.HU_COMMANDS?.activityConflict(s, 'breakthrough');
    $('topRate').textContent = trainingBusy && !s.retreat?.active ? 'Tạm dừng' : '+' + num(g.rate()) + '/giây';
    $('topWorld').textContent = F.realm_map(s.zone);
    const destiny = H.META_UPGRADES[s.destiny], destinyNode = $('topDaoVan');
    const destinyName = destiny?.name || 'Không có';
    if (destinyNode.dataset.labelKey !== (s.destiny || 'none')) {
      destinyNode.dataset.labelKey = s.destiny || 'none';
      destinyNode.innerHTML = destiny && L ? L.span(destinyName, 'destiny', s.destiny) : esc(destinyName);
    }
    $('topQiFill').style.width = pShown + '%';
    $('topQiFill').parentElement.classList.toggle('full', pShown >= 100);
    $('topQiText').textContent = num(shown) + ' / ' + num(need);
    $('topQiHint').textContent = s.completed ? 'Đã chứng đạo' : readyQi ? 'Đã đầy' : Math.floor(pShown) + '%';
    const st = g.stats(), maxMp = g.maxMp(), hpPct = clamp(s.hp / st.HP * 100, 0, 100), mpPct = clamp(s.mp / maxMp * 100, 0, 100);
    if ($('hpFill')) $('hpFill').style.width = hpPct + '%';
    if ($('mpFill')) $('mpFill').style.width = mpPct + '%';
    if ($('hpValue')) $('hpValue').textContent = num(s.hp) + ' / ' + num(st.HP);
    if ($('mpValue')) $('mpValue').textContent = num(s.mp) + ' / ' + num(maxMp);
    const life = g.lifeInfo();
    $('lifeFill').style.width = clamp(s.age / life.max * 100, 0, 100) + '%';
    $('lifeValue').textContent = s.completed ? 'Trường sinh' : Math.floor(s.age) + ' / ' + num(life.max) + ' năm';
    $('lifeRow').classList.toggle('low-life', !s.completed && (life.left <= 40 || life.seconds <= 1800));
    $('lifeRow').title = s.completed ? 'Đã chứng đạo, không còn giới hạn thọ nguyên.' : 'Còn ' + num(life.left) + ' năm thọ nguyên · khoảng ' + duration(life.seconds) + ' tu luyện liên tục (1 năm ≈ ' + duration(1 / life.pace) + ')';
    $('lifeMeter').setAttribute('aria-valuemax', String(life.max));
    $('lifeMeter').setAttribute('aria-valuenow', String(Math.min(life.max, Math.floor(s.age))));
    $('lifeMeter').setAttribute('aria-valuetext', $('lifeValue').textContent);
    $('statusVitals')?.setAttribute('aria-label', 'Sinh lực ' + num(s.hp) + ' trên ' + num(st.HP) + '; linh khí ' + num(s.mp) + ' trên ' + num(maxMp) + '; thọ nguyên ' + $('lifeValue').textContent);
    const talents = $('statusTalents');
    if (!talents.childElementCount) talents.innerHTML = H.TALENT_INFO.map(t => `<div class="status-talent" data-talent="${t.key}"><img src="${A.BASE}ui/icon/menu/${t.icon}" alt=""><span>${esc(t.name)}</span><b></b><meter min="0" max="${H.TALENT_MAX}" aria-label="${esc(t.name)}"></meter></div>`).join('');
    for (const t of H.TALENT_INFO) {
      const el = talents.querySelector(`[data-talent="${t.key}"]`), value = s.talent[t.key] || 0;
      el.querySelector('b').textContent = value;
      el.querySelector('meter').value = value;
      el.title = t.name + ': ' + value + ' điểm · ' + t.effect(value);
    }
    const bb = $('btn-break');
    if (bb) {
      /* Tiểu cảnh giới tự động đột phá; chỉ tầng cuối (viên mãn) mới cần bấm tay để độ kiếp. */
      const peak = s.stage === F.STAGES[s.realm], can = !s.completed && readyQi && peak && !trainingBusy;
      bb.disabled = !can;
      bb.classList.toggle('ready', can);
      bb.classList.toggle('auto', !s.completed && !peak);
      $('breakLabel').textContent = s.completed ? 'Đã chứng đạo' : peak ? 'Đột phá đại cảnh giới' : 'Tự động đột phá';
      $('breakHint').textContent = trainingBusy ? 'Hoàn tất hoạt động đang làm' : s.completed ? 'Đạo quả viên mãn' : peak ? (can ? 'Viên mãn · bấm để nhận thiên kiếp' : 'Viên mãn · chưa đủ tu vi') : 'Tầng ' + s.stage + '/' + F.STAGES[s.realm] + ' · tự động';
    }
    const badge = (id, text, on) => {
      const el = document.querySelector('#menu [data-badge="' + id + '"]');
      if (!el) return;
      el.hidden = !on; el.textContent = text;
    };
    badge('craft', String(s.craftQueue.length + s.garden.length), s.craftQueue.length + s.garden.length > 0);
    badge('combat', '⚔', s.auto);
    badge('retreat', '!', !!s.retreat?.report);
    const daily = UI.session.daily;
    const questBadge = (daily?.claimable || 0) + (UI.session.mailClaimable || 0) + (daily?.checkin?.canCheckIn ? 1 : 0);
    badge('quests', String(questBadge), questBadge > 0);
    /* Chấm đỏ báo việc cần làm ngay: đột phá, nhận thưởng, thu hoạch, sách chưa lĩnh ngộ… */
    const nowMs = Date.now();
    const peakNow = s.stage === F.STAGES[s.realm] && readyQi && !s.completed;
    const reds = {
      idle: peakNow && !trainingBusy,
      retreat: !!s.retreat?.report,
      craft: s.garden.some(p => { try { return g.gardenInfo(p, nowMs).ripe; } catch { return false; } }),
      quests: questBadge > 0,
      chat: (UI.chatUnread?.() || 0) > 0,
      more: (UI.friendRequests?.() || 0) > 0,
      sect: !!s.sect.mission && nowMs >= s.sect.mission.end,
      character: Object.keys(s.bag).some(k => { const x = H.item(k); return x?.kind === 'BT' && !s.learned[k]; })
    };
    $$('#menu [data-window]').forEach(b => b.classList.toggle('has-red', !!reds[b.dataset.window]));
    $$('[data-open-page]').forEach(b => b.classList.toggle('has-red', !!reds[b.dataset.openPage]));
    $('moreMenuBtn')?.classList.toggle('has-red', !!reds.more);
    markMenu();
    document.body.classList.toggle('mode-fight', s.auto);
    const docTitle = s.name + ' · Hư Giới';
    if (docTitle !== lastDocTitle) { lastDocTitle = docTitle; document.title = docTitle; }
  }

  // Ghi nhớ chuyến đang diễn ra để tự trả về đài ngay cả khi bộ tự lưu
  // đã kết toán chuyến trước vòng tick kế tiếp.
  let lockedExplorationStart = null;
  function updateStage() {
    const s = UI.s(), g = UI.g();
    if (!s.created || !$('scene')) return;
    if (trib.pageOpen) return;
    const exploring = s.exploration?.active;
    if (exploring) lockedExplorationStart = exploring.start;
    const mode = (exploring || wins.has('combat')) ? 'combat' : 'idle';
    if (mode !== lastStageMode) {
      heroAttackUntil = 0;
      lastStageMode = mode;
    }
    const gameEl = $('game');
    if (gameEl) { gameEl.dataset.stage = mode; gameEl.dataset.exploreKind = exploring?.kind || ''; }
    // Scale theo chính kích thước đài, không theo viewport: trên điện thoại nhỏ
    // đạo thân sẽ thu lại thay vì lớn ngang pháp trận.
    const stageEl = $('stage'), actor = $('heroActor');
    if (stageEl && actor && stageEl.clientWidth && stageEl.clientHeight) {
      const unit = Math.round(clamp(Math.min(stageEl.clientWidth * .20, stageEl.clientHeight * .32), 67, 174));
      if (actor.dataset.heroUnit !== String(unit)) {
        actor.dataset.heroUnit = String(unit);
        actor.style.setProperty('--hero-unit', unit + 'px');
      }
    }
    UI.skillDock?.update();
    UI.combatFx?.sync(mode);
    UI.environment?.update(s);
    const battle = exploring?.battle;
    $('stageTag').textContent = battle ? 'Giao chiến · ' + exploring.name
      : exploring ? 'Lịch luyện · ' + H.ZONES[s.zone].name : F.realm_map(s.zone) + ' · ' + H.ZONES[s.zone].name;
    $('rateText').textContent = battle
      ? (battle.state === 'active'
        ? 'Lượt ' + battle.turn + ' · địch còn ' + Math.round(Math.max(0, battle.enemyHp) / Math.max(1, battle.enemyMax) * 100) + '% sinh lực'
        : battle.state === 'won' ? 'Thắng lợi · chờ xác nhận' : battle.state === 'fled' ? 'Đã rút lui' : 'Thất bại')
      : exploring ? 'Trở về sau ' + explorationCountdown(exploring.end) : '+' + num(g.rate()) + ' tu vi/giây';
    $('stageHeroName').textContent = s.name;
    const enemyActor = $('enemyActor');
    if (enemyActor) {
      enemyActor.hidden = !battle;
      if (battle) {
        const labels = H.BATTLE_LABELS || {};
        const lvl = g.enemy?.()?.level;
        const nameEl = $('enemyName'), levelEl = $('enemyLevel'), bar = $('enemyBar');
        if (nameEl) nameEl.textContent = exploring.name || 'Yêu thú';
        if (levelEl) levelEl.textContent = (labels[s.enemyKind] || 'Yêu thú') + (lvl ? ' · Cấp ' + lvl : '');
        if (bar) bar.style.width = Math.max(0, Math.min(100, battle.enemyMax > 0 ? battle.enemyHp / battle.enemyMax * 100 : 0)) + '%';
        enemyActor.classList.toggle('boss', ['boss', 'boss kiếp'].includes(s.enemyKind));
        enemyActor.classList.toggle('defeated', battle.state === 'won');
        enemyActor.dataset.battle = battle.state;
      }
    }
    stageFrame(frameCount, isReduced());
  }

  function heroAttack() {
    if (!UI.vfx?.effectsEnabled()) return;
    const s = UI.s();
    heroAttackFrame = frameCount;
    heroAttackUntil = Date.now() + A.heroFrames(s.gender, s.realm, 'tan_cong') * 235;
    stageFrame(frameCount, false);
  }

  function explorationCountdown(end, now = UI.session.serverNow()) {
    const seconds = Math.max(0, Math.ceil((end - now) / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  function explorationPose(start, now = UI.session.serverNow()) {
    // Một tư thế kéo dài 9 giây; lựa chọn ngẫu nhiên có thể tái hiện khi tải lại.
    const phase = Math.floor(Math.max(0, now - start) / 9000);
    const seed = Math.imul((Math.floor(start / 1000) ^ (phase + 1)) >>> 0, 1664525) + 1013904223;
    return ((seed >>> 9) & 3) < 2 ? 'di_chuyen' : 'dung_yen';
  }

  function stageFrame(n, reduced) {
    const s = UI.s();
    if (!s.created) return;
    const exploring = s.exploration?.active, battle = exploring?.battle;
    const hero = $('heroSprite');
    if (hero) {
      const action = exploring && !battle ? explorationPose(exploring.start) : 'dung_yen';
      A.preloadHero(s.gender, s.realm, action);
      const src = A.heroSrc(s.gender, s.realm, action, reduced ? 0 : n);
      hero.dataset.action = action;
      hero.alt = action === 'di_chuyen' ? 'Đạo thân đang đi bộ lịch luyện' :
        battle ? 'Đạo thân đang giao chiến' :
          exploring ? 'Đạo thân đang ngồi thiền nghỉ ngơi giữa đường' : 'Đạo thân đang nhập định';
      if (hero.getAttribute('src') !== src) hero.src = src;
    }
    const foe = $('enemySprite');
    if (foe && battle) {
      const src = A.enemySrc(s.zone, s.enemyKind, 'dung_yen', reduced ? 0 : n);
      if (foe.getAttribute('src') !== src) foe.src = src;
      foe.alt = (exploring.name || 'Yêu thú') + ' đang đối đầu';
    }
  }

  function updateTimers() {
    const s = UI.s(), now = UI.session.serverNow();
    $$('[data-end]').forEach(el => {
      const end = Number(el.dataset.end);
      el.textContent = now >= end ? 'Sẵn sàng' : duration((end - now) / 1000);
    });
    $$('[data-cooldown]').forEach(el => {
      const t = s.cooldowns[Number(el.dataset.cooldown)] || 0;
      el.textContent = now >= t ? 'Sẵn sàng' : 'Hồi ' + duration((t - now) / 1000);
    });
  }

  /* ======================================================================
     GỢI Ý VẬT PHẨM
     ====================================================================== */
  let tipCell = null;

  function hideItemTip() {
    const tip = $('itemTip');
    if (tipCell) {
      tipCell.removeAttribute('aria-describedby');
      tipCell = null;
    }
    if (!tip) return;
    tip.hidden = true;
    tip.setAttribute('aria-hidden', 'true');
  }

  function showItemTip(cell) {
    const key = cell?.dataset?.select, tip = $('itemTip');
    const x = key ? H.item(key) : null;
    if (!tip || !x) return;
    const g = UI.g();
    const count = g.count(key);
    const rankLabel = UI.kit.rankLabelOf(x), qualityLabel = UI.kit.qualityLabelOf(x);
    const rankHtml = L ? L.span(rankLabel, 'rank', rankLabel, { variant: 'badge' }) : esc(rankLabel);
    const qualityHtml = L ? L.span(qualityLabel, 'quality', qualityLabel, { variant: 'badge' }) : esc(qualityLabel);
    const requiredRealm = Number.isInteger(x.useReq?.realmMin) ? F.REALMS[x.useReq.realmMin] : (x.realm || '—');
    const effect = UI.kit.itemEffectText ? UI.kit.itemEffectText(x) : '';
    const price = moneyHTML(F.shop_sell_price(g.price(key)));
    const v = A.itemImg(x);
    tip.innerHTML = `<div class="item-tip-head"><img src="${v.src}"${v.style ? ` style="${esc(v.style)}"` : ''} alt="" decoding="async"><div><b>${esc(x.name)}</b><span class="item-tip-badges">${qualityHtml}</span><small>${esc(x.category || '—')}</small></div></div>` +
      `<p class="item-tip-desc">${esc(x.description || 'Không có mô tả.')}</p>` + (x.lore ? `<p class="item-tip-lore">${esc(x.lore)}</p>` : '') +
      (effect ? `<p class="item-tip-effect"><span>Thuộc tính / công dụng</span> ${esc(effect)}</p>` : '') +
      `<div class="item-tip-meta"><span>Cấp bậc <b>${rankHtml}</b></span><span>Cảnh giới yêu cầu <b>${esc(requiredRealm)}</b></span><span>Số lượng <b>×${num(count)}</b></span><span>Giá bán <b>${price}</b></span></div>` +
      `<p class="item-tip-cond"><span>Điều kiện</span> ${esc(UI.kit.useCondition(x))}</p>`;
    tip.hidden = false;
    tip.setAttribute('aria-hidden', 'false');
    if (tipCell && tipCell !== cell) tipCell.removeAttribute('aria-describedby');
    tipCell = cell;
    cell.setAttribute('aria-describedby', 'itemTip');
    const r = cell.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    const VW = root.innerWidth || 1280, VH = root.innerHeight || 800;
    let left = r.right + 10, top = r.top + r.height / 2 - th / 2;
    if (left + tw > VW - 8) left = r.left - tw - 10;
    if (left < 8) left = clamp(r.left + r.width / 2 - tw / 2, 8, VW - tw - 8);
    top = clamp(top, 8, VH - th - 8);
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  /* ======================================================================
     MÙA & LÁ RƠI
     ====================================================================== */
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  function seasonOf(s) {
    if (s.settings.season && s.settings.season !== 'auto') return s.settings.season;
    return SEASONS[Math.floor((s.tick || 0) / 900) % 4];
  }

  function fillLeaves(layer, season) {
    layer.innerHTML = '';
    for (let i = 0; i < 14; i++) {
      const leaf = document.createElement('img');
      leaf.className = 'leaf' + (season === 'summer' ? ' firefly' : '');
      leaf.src = A.seasonSprite(season, i);
      leaf.alt = '';
      leaf.draggable = false;
      leaf.decoding = 'async';
      leaf.style.left = (Math.random() * 100).toFixed(2) + '%';
      leaf.style.animationDelay = (-Math.random() * 14).toFixed(2) + 's';
      leaf.style.animationDuration = (8 + Math.random() * 8).toFixed(2) + 's';
      leaf.style.width = (season === 'summer' ? 14 + i % 3 * 3 : 18 + i % 4 * 5) + 'px';
      layer.append(leaf);
    }
    layer.dataset.season = season;
  }

  function buildHeroParticles() {
    const host = $('heroParticles');
    if (!host || host.childElementCount) return;
    const colors = ['#8cecff', '#67c9ff', '#ffdf8a', '#bda8ff', '#7fffd0'];
    const total = (root.innerWidth || 1280) < 600 ? 8 : 12;
    host.innerHTML = Array.from({ length: total }, (_, i) => {
      const angle = i / total * Math.PI * 2;
      const x = 50 + Math.cos(angle) * (38 + i % 3 * 5);
      const y = 55 + Math.sin(angle) * (28 + i % 4 * 4);
      const dx = Math.cos(angle) * (8 + i % 4 * 4);
      const size = 3 + i % 3;
      const dur = 2.8 + i % 5 * .55;
      return `<i style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--dx:${dx.toFixed(1)}px;--dx2:${(dx * 1.7).toFixed(1)}px;--s:${size}px;--dur:${dur}s;--delay:${(-i * .47).toFixed(2)}s;--c:${colors[i % colors.length]}"></i>`;
    }).join('');
  }

  function updateSceneEffects() {
    const s = UI.s();
    if (!s.created) return;
    const reduced = isReduced();
    $$('.scene').forEach(scene => {
      let layer = scene.querySelector('.fx-leaves');
      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'fx-leaves';
        layer.setAttribute('aria-hidden', 'true');
        scene.append(layer);
      }
      const season = seasonOf(s);
      if (layer.dataset.season !== season) fillLeaves(layer, season);
      layer.hidden = reduced || !s.settings.seasonEffects || document.hidden;
    });
    const aura = $('idleAura');
    if (aura) aura.hidden = reduced || !s.settings.cultivationEffects || !!s.exploration?.active;
    const particles = $('heroParticles');
    if (particles) particles.hidden = reduced || !s.settings.cultivationEffects || !!s.exploration?.active;
    const quote = $('idleQuote');
    if (quote) quote.textContent = s.exploration?.active ? 'Một bước vào bí cảnh, cơ duyên khó lường.' : 'Hô hấp như mây, ý niệm như nước; linh khí tự tụ nơi đan điền.';
  }

  function applySettings() {
    const s = UI.s();
    document.body.classList.toggle('reduced-motion', isReduced());
    document.body.classList.toggle('motion-full', s.settings.motionMode === 'full');
    document.body.classList.toggle('effects-off', s.settings.combatEffects === false);
    UI.tribulation?.setReduced(isReduced());
    if (isReduced() || s.settings.combatEffects === false) UI.vfx?.clearAll();
    updateSceneEffects();
    UI.environment?.update(s);
    const note = $('motionStatus');
    if (note) note.textContent = isReduced() ? 'Đang giảm chuyển động: lá, linh khí và hiệu ứng khung hình ở trạng thái tĩnh.' : 'Đang bật đầy đủ: lá rơi, linh khí và hiệu ứng chiến đấu chuyển động.';
  }

  /* Độ kiếp đài: xem client/ui/tribulation-page.js (nạp ngay sau tệp này, gắn UI.tribulation). */
  UI.applySettings = applySettings;
  UI.isReduced = isReduced;
  UI.updateSceneEffects = updateSceneEffects;

  /* ======================================================================
     HÀNH ĐỘNG
     ====================================================================== */
  function safe(fn) {
    try {
      const result = fn();
      if (result && typeof result.then === 'function')
        return result.catch(e => { toast(e.message); console.warn('Hư Giới:', e.message); return UI.KEEP; });
      return result;
    } catch (e) { toast(e.message); console.warn('Hư Giới:', e.message); return UI.KEEP; }
  }

  async function run(name, el) {
    if (name === 'modalClose') { closeModal(); return; }
    if (name === 'modalConfirm') {
      if ($('modalLayer').hidden) return;
      const fn = modalAction;
      closeModal();
      if (fn && !store.locked) { store.catchUp(); await safe(fn); store.write(); refresh(); }
      return;
    }
    if (name === 'resetAfterDeath') { await safe(() => UI.resetAfterDeath?.()); return; }
    if (!$('modalLayer').hidden) {
      const peekOpen = !!$('modalBody').querySelector('.peek-pop');
      if (!UI.modalActions.has(name) && !peekOpen) return;
      /* Nút chỉnh số lượng trong hộp thoại cửa hàng phải giữ hộp thoại mở. */
      if (!(peekOpen && UI.modalKeepOpen.has(name))) closeModal();
    }
    if (store.locked) { toast('Một tab khác đang chơi. Đóng tab kia rồi tải lại trang.'); return; }
    if (trib.pageOpen) {
      if (name === 'tribStart') { await safe(() => trib.start()); return; }
      if (name === 'tribClose' || name === 'tribReturn' || name === 'tribBack') { trib.close(); return; }
      if (trib.active) return;
    } else if (trib.active) return;
    store.catchUp();
    const handler = UI.actions[name];
    if (!handler) return;
    const result = await safe(() => handler(el, el?.dataset || {}));
    if (result === UI.KEEP) return;
    store.write();
    if (result === UI.SOFT) soft(); else refresh();
  }

  /* ======================================================================
     SỰ KIỆN
     ====================================================================== */
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-shade')) { closeModal(); return; }
    if (!$('modalLayer').hidden && !e.target.closest('#modalLayer, #toast')) return;
    const moreToggle = e.target.closest('#moreMenuBtn');
    if (moreToggle && UI.s().created) { e.preventDefault(); toggleMoreMenu(); return; }
    const moreGo = e.target.closest('#moreMenu [data-more-go]');
    if (moreGo && UI.s().created) {
      e.preventDefault();
      const target = moreGo.dataset.moreGo;
      closeMoreMenu();
      safe(() => { store.catchUp(); go(target); });
      return;
    }
    if (!$('moreMenu')?.hidden && !e.target.closest('#moreMenu, #moreMenuBtn')) closeMoreMenu();
    const pageNavBtn = e.target.closest('.page-nav-toggle');
    if (pageNavBtn) { e.preventDefault(); togglePageNav(pageNavBtn.closest('.page-nav')); return; }
    if (!e.target.closest('.page-nav')) closePageNav();
    const tabbarBtn = e.target.closest('.tabbar-toggle');
    if (tabbarBtn) { e.preventDefault(); toggleTabbar(tabbarBtn.closest('.tabbar')); return; }
    if (!e.target.closest('.tabbar')) closeTabbar();
    if (e.target.closest('#menuToggle')) { e.preventDefault(); toggleMenu(); return; }
    const pageBtn = e.target.closest('[data-open-page]');
    if (pageBtn && UI.s().created) {
      closePageNav();
      safe(() => { store.catchUp(); if (trib.pageOpen) trib.closePage(); go(pageBtn.dataset.openPage); });
      return;
    }
    const winBtn = e.target.closest('[data-window]');
    if (winBtn && !winBtn.closest('.win') && UI.s().created) {
      safe(() => {
        store.catchUp();
        if (winBtn.dataset.window === 'combat') {
          // Giống các tab khác: bấm lần nữa để đóng, kể cả khi chuyến đi còn giờ.
          if (wins.has('combat')) wins.close('combat');
          else go('combat');
        } else if (winBtn.dataset.window === 'tribulation') {
          if (trib.pageOpen) trib.close();
          else go('tribulation');
        } else if (winBtn.dataset.window === 'idle' && winBtn.closest('#menu')) {
          go('idle');
        } else {
          if (trib.pageOpen) trib.closePage();
          go(winBtn.dataset.window);
        }
      });
      return;
    }
    const nav = e.target.closest('[data-go]');
    if (nav && UI.s().created) { safe(() => { if (!$('modalLayer').hidden && nav.closest('#modalLayer')) closeModal(); store.catchUp(); go(nav.dataset.go); }); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      closeTabbar();
      UI.tabState[UI.current] = tab.dataset.tab;
      resetFilters();
      refresh();
      return;
    }
    const select = e.target.closest('[data-select]');
    if (select?.dataset.popup !== undefined) { safe(() => run('itemPop', select)); return; }
    if (select) { UI.view.selected = select.dataset.select; refresh(); return; }
    const b = e.target.closest('[data-act]');
    if (b) safe(() => run(b.dataset.act, b));
  });

  document.addEventListener('change', e => {
    if (store.locked || trib.active) return;
    if (['categoryFilter', 'qualityFilter'].includes(e.target.id)) safe(() => run('search', { dataset: {} }));
  });

  /* Chuyển tiêu điểm ra ngoài bằng Tab cũng đóng dropdown điều hướng. */
  document.addEventListener('focusin', e => {
    if (!e.target.closest('.page-nav')) closePageNav();
    if (!e.target.closest('.tabbar')) closeTabbar();
  });

  document.addEventListener('keydown', e => {
    if (UI.intro?.active) return;
    if (e.key === 'Tab' && !$('modalLayer').hidden) {
      const els = [...$('modalLayer').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(x => x.offsetParent !== null);
      const first = els[0], last = els.at(-1);
      if (!first) { e.preventDefault(); $('modalLayer').querySelector('.game-modal').focus(); }
      else if (!$('modalLayer').contains(document.activeElement)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      return;
    }
    if (trib.pageOpen) {
      if (e.key === 'Escape') {
        if (!$('modalLayer').hidden) closeModal();
        else if ($('tribDetails').open) { e.preventDefault(); $('tribDetails').open = false; $('tribDetails').querySelector('summary').focus(); }
        else if (trib.phase !== 'running') { e.preventDefault(); trib.close(); }
      }
      return;
    }
    if (trib.active) return;
    if (e.key === 'Escape') {
      if (!$('modalLayer').hidden) closeModal();
      else if (!$('moreMenu')?.hidden) closeMoreMenu({ focus: true });
      else if (closePageNav({ focus: true })) { /* đã đóng dropdown điều hướng */ }
      else if (closeTabbar({ focus: true })) { /* đã đóng dropdown tab phụ */ }
      else if (wins.topId()) wins.close(wins.topId());
      return;
    }
    if (e.target.id === 'itemSearch' && e.key === 'Enter') { e.preventDefault(); safe(() => run('search', { dataset: {} })); return; }
    if (!store.ready || !UI.s().created || !$('modalLayer').hidden || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName) || e.ctrlKey || e.altKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (['1', '2', '3', '4'].includes(key)) {
      const battle = UI.s().exploration?.active?.battle;
      if (battle?.state === 'active' && UI.actions?.battleAct) {
        const action = ['attack', 'power', 'guard', 'heal'][Number(key) - 1];
        run('battleAct', { dataset: { action } });
      }
      return;
    }
    if (key === 'enter') {
      const battle = UI.s().exploration?.active?.battle;
      if (battle && ['won', 'fled'].includes(battle.state) && UI.actions?.battleAct) {
        e.preventDefault();
        run('battleAct', { dataset: { action: 'continue' } });
      }
      return;
    }
    const map = { t: 'idle', l: 'combat', n: 'craft', c: 'character', i: 'character:bag', m: 'world' };
    if (map[key]) safe(() => go(map[key]));
  });

  if (typeof root.addEventListener === 'function') {
    root.addEventListener('hashchange', () => {
      if (!store.ready || !UI.s().created) return;
      closeMoreMenu();
      hideItemTip();
      if (['running', 'settling'].includes(trib.phase)) {
        try { root.history.replaceState(null, '', '#tribulation'); } catch { /* file:// cũ */ }
        return;
      }
      const [id, tab] = String(root.location.hash || '#idle').replace(/^#\/?/, '').split('/');
      if (!UI.release.allowed(id + (tab ? ':' + tab : ''))) { go('idle'); return; }
      if (id === 'world' && ['sect','dungeons'].includes(tab)) { go('world:' + tab, { silent: true }); return; }
      if (!UI.screens[id]) return;
      if (id === 'tribulation') { trib.openPage(); return; }
      if (trib.pageOpen) trib.closePage();
      if (tab) UI.tabState[id] = tab;
      if (id === 'idle') wins.closeAll();
      else if (id === 'combat') { go('combat'); return; }
      else wins.open(id);
      updateChrome();
      updateStage();
    });
    root.addEventListener('resize', () => { applyLayout(); positionMoreMenu(); trib.layoutScene(); });
    root.addEventListener('orientationchange', () => { applyLayout(); positionMoreMenu(); trib.layoutScene(); });
  }
  if (root.visualViewport) {
    root.visualViewport.addEventListener('resize', () => wins.fitChatToVisualViewport());
    root.visualViewport.addEventListener('scroll', () => wins.fitChatToVisualViewport());
    document.addEventListener('focusin', () => wins.fitChatToVisualViewport());
    document.addEventListener('focusout', () => root.requestAnimationFrame(() => wins.fitChatToVisualViewport()));
  }

  document.addEventListener('pointerover', e => {
    const cell = e.target.closest('.inventory-cell[data-select]');
    if (cell) showItemTip(cell);
  });
  document.addEventListener('pointerout', e => {
    const cell = e.target.closest('.inventory-cell[data-select]');
    if (cell && !cell.contains(e.relatedTarget)) hideItemTip();
  });
  document.addEventListener('focusin', e => {
    const cell = e.target.closest('.inventory-cell[data-select]');
    if (cell) showItemTip(cell);
  });
  document.addEventListener('focusout', e => {
    const cell = e.target.closest('.inventory-cell[data-select]');
    if (cell && !cell.contains(e.relatedTarget)) hideItemTip();
  });
  document.addEventListener('scroll', hideItemTip, true);

  /* ======================================================================
     VÒNG LẶP
     ====================================================================== */
  function tick() {
    if (!store.ready || document.hidden || store.locked) return;
    safe(() => {
      const beforeQi = UI.s().qi;
      const wasExploring = !!UI.s().exploration?.active || lockedExplorationStart !== null;
      const report = store.catchUp();
      if (wasExploring && !UI.s().exploration?.active) {
        lockedExplorationStart = null;
        // Việc hoàn tất chuyến đi không được đóng trang người chơi đang xem.
        if (wins.has('combat') || UI.current === 'combat') go('idle');
        toast('Đã kết thúc mười phút lịch luyện. Đạo thân trở về đài Tu luyện.', { type: 'gold', title: 'Lịch luyện hoàn tất' });
        store.write();
      }
      if (trib.active) return;
      const stNow = UI.s(), gameNow = UI.g();
      const finish = stNow.exploration?.active?.end;
      if ((finish && UI.session.serverNow() >= finish) ||
          (!root.HU_COMMANDS?.activityConflict(stNow, 'breakthrough') && !stNow.completed && stNow.qi < gameNow.need() * (1 - 1e-12) && UI.session.displayQi() >= gameNow.need())) store.syncOnce();
      updateChrome();
      updateStage();
      updateSceneEffects();
      // Nhiệm vụ ngày làm mới định kỳ để badge và mốc 00:00 UTC+7 cập nhật.
      if (UI.session.daily && Date.now() - UI.session.dailyLoadedAt > 60000)
        UI.session.loadDaily().catch(() => { /* lần sau tick sẽ thử lại */ });
      const absorbed = Math.max(0, UI.s().qi - beforeQi);
      if (absorbed > 0 && report?.seconds <= 3 && UI.current === 'idle' && !UI.s().auto && !UI.intro?.active && !trib.pageOpen && $('modalLayer').hidden && $('game')?.dataset.stage === 'idle') UI.vfx?.cultivationGain(absorbed);
      wins.map.forEach((w, id) => {
        const def = w.def, tab = tabOf(def);
        def.update?.(tab);
        const sig = def.signature?.(tab) ?? '';
        if (sig !== w.sig && !w.body.contains(document.activeElement)) wins.render(id);
      });
      updateTimers();
      if (trib.pageOpen) trib.updatePage();
      UI.battlePage?.sync(false);
    UI.craftPage?.sync();
      UI.tutorial?.update();
      const st = UI.s();
      if (!trib.pageOpen && $('game')?.dataset.stage === 'idle' && !st.auto && st.settings.cultivationEffects && !isReduced() && Date.now() - lastIdleVfx > 14000) {
        lastIdleVfx = Date.now();
        UI.vfx?.effect('qi', 'hero', { fps: 10 });
        UI.vfx?.ring('hero', '#70d4e8');
      }
    });
  }
  setInterval(tick, 1000);
  setInterval(() => { if (store.ready && !document.hidden && !store.locked) { store.catchUp(); store.write(); } }, 15000);

  function animate(time) {
    if (trib.pageOpen && !document.hidden && time - lastFrameTime >= 235) {
      lastFrameTime = time; frameCount++;
      trib.heroFrame(frameCount);
    }
    if (store.ready && UI.s().created && !trib.active && !trib.pageOpen && !document.hidden && time - lastFrameTime >= 235) {
      lastFrameTime = time; frameCount++;
      stageFrame(frameCount, isReduced());
    }
    requestAnimationFrame(animate);
  }

  motionQuery?.addEventListener?.('change', () => { if (store.ready && UI.s().created) applySettings(); });
  store.setBusy(() => trib.active);
  applyLayout();
  requestAnimationFrame(animate);

  Object.assign(UI, {
    toast, modal, closeModal, go, refresh, soft, run, safe,
    closeMoreMenu, hideItemTip, markMenu,
    updateChrome, updateStage, updateTimers, heroAttack,
    tabOf: id => tabOf(UI.screens[id]),
    animate, resetFilters, toastState,
    buildShell() { applyLayout(); buildMenu(); buildLog(); buildHeroParticles(); updateChrome(); updateStage(); updateSceneEffects(); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
