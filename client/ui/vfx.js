/* HƯ GIỚI · BỘ PHÁT HIỆU ỨNG KHUNG HÌNH
 * Nhận chuỗi 8 khung PNG từ HU_ASSETS và đổi src theo nhịp thời gian.
 * Chuỗi slash/hit/bolt/break/heal/qi và nhịp vòng sáng/hạt tham chiếu Hu-gioi.
 * Phát bằng DOM, cùng tọa độ nhân vật; chạy trực tiếp qua file://. */
(function (root) {
  'use strict';
  const A = root.HU_ASSETS, UI = root.HU_UI;
  if (!A || !UI) return;

  const running = new Set();
  const MAX_EFFECTS = 64;
  const hostOf = host => typeof host === 'string' ? document.querySelector(host) : host;
  const prefersReduced = () => !!UI.isReduced?.();
  const effectsEnabled = () => {
    const s = UI.s?.();
    return !prefersReduced() && s?.settings?.combatEffects !== false;
  };

  function transient(host, el, ms, enabled = effectsEnabled) {
    if (!host || !enabled() || document.hidden || running.size >= MAX_EFFECTS) return null;
    host.append(el);
    let timer;
    const handle = { el, stop() { clearTimeout(timer); el.remove(); running.delete(handle); } };
    running.add(handle);
    timer = setTimeout(handle.stop, ms);
    return handle;
  }

  function play(host, opts = {}) {
    const elHost = hostOf(host);
    if (!elHost || !opts.kind || !opts.variant) return null;
    if (!effectsEnabled() || document.hidden || running.size >= MAX_EFFECTS) return null;
    const imgs = A.preloadVfx(opts.kind, opts.variant);
    if (!imgs.length) return null;

    const sprite = document.createElement('img');
    sprite.className = 'vfx-sprite ' + (opts.className || '');
    sprite.alt = opts.alt || '';
    if (!opts.alt) sprite.setAttribute('aria-hidden', 'true');
    sprite.draggable = false;
    sprite.decoding = 'async';
    if (opts.style) Object.assign(sprite.style, opts.style);
    if (opts.size) { sprite.style.width = opts.size; sprite.style.height = opts.size; }
    sprite.src = imgs[0].src;
    elHost.append(sprite);

    const fps = Math.max(1, Number(opts.fps) || 14);
    const frameMs = 1000 / fps;
    let index = 0, start = 0, raf = 0, stopped = false, lifetimeTimer = 0;
    const finish = completed => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      clearTimeout(lifetimeTimer);
      sprite.remove();
      running.delete(handle);
      opts.onDone?.(completed);
    };
    const handle = {
      el: sprite,
      stop() {
        finish(false);
      }
    };
    running.add(handle);

    const tick = now => {
      if (stopped) return;
      if (!elHost.isConnected || !effectsEnabled() || document.hidden) { handle.stop(); return; }
      if (!start) start = now;
      const want = Math.floor((now - start) / frameMs);
      if (want !== index) {
        index = want;
        if (index >= imgs.length) {
          if (opts.loop) {
            index = 0;
            start = now;
          } else {
            finish(true);
            return;
          }
        }
        sprite.src = imgs[index].src;
      }
      raf = requestAnimationFrame(tick);
    };
    // Chờ ảnh tải xong để lần phát đầu không bỏ qua các khung hình.
    Promise.all(imgs.map(im => im.decode ? im.decode().catch(() => null) : Promise.resolve())).then(() => {
      if (!stopped) {
        if (opts.duration) lifetimeTimer = setTimeout(() => finish(true), Math.min(30000, Math.max(1, opts.duration)));
        raf = requestAnimationFrame(tick);
      }
    });
    return handle;
  }

  function at(host, opts = {}) {
    const style = { ...(opts.style || {}) };
    if (opts.x != null) style.left = opts.x;
    if (opts.y != null) style.top = opts.y;
    if (opts.size) { style.width = opts.size; style.height = opts.size; }
    return play(host, { ...opts, style });
  }

  const stage = opts => at('#stageVfx', {
    fps: 16,
    ...opts,
    className: 'stage-vfx-sprite ' + (opts.className || '')
  });

  const trib = opts => at('#tribVfxLayer', {
    fps: 14,
    ...opts,
    className: 'trib-vfx-sprite ' + (opts.className || '')
  });

  function position(target = 'hero') {
    /* Trong bảng giao chiến theo lượt, hiệu ứng phải bám theo ảnh địch/hồi máu
       ngay trong bảng vì trang Lịch luyện che sân khấu phía sau. */
    if (target === 'battleFoe' || target === 'battleSelf') {
      const host = hostOf('#battleVfx');
      const actor = hostOf(target === 'battleFoe' ? '#battleFoeSprite' : '#battleSelf');
      if (host?.getClientRects().length && actor?.getClientRects().length) {
        const r = host.getBoundingClientRect(), a = actor.getBoundingClientRect();
        /* Ảnh sprite có nhiều khoảng trong suốt quanh nhân vật, nên dùng chiều cao
           ước lệ để số sát thương và hiệu ứng rơi đúng thân, không lên bảng tên. */
        const tall = target === 'battleFoe' ? Math.min(96, a.height) : 44;
        return { host, x: a.left + a.width / 2 - r.left,
          y: (target === 'battleFoe' ? a.top + a.height * .42 : a.top + a.height * .35) - r.top,
          height: tall, battle: true };
      }
      target = target === 'battleFoe' ? 'enemy' : 'hero';
    }
    const onTrib = target === 'trib' || (target === 'hero' && UI.tribulation?.pageOpen);
    const host = hostOf(onTrib ? '#tribStageVfx' : '#stageVfx');
    if (!host || !host.getClientRects().length) return null;
    const r = host.getBoundingClientRect();
    if (onTrib) {
      const stage = hostOf('#tribStage'), css = getComputedStyle(stage);
      return { host, x: parseFloat(css.getPropertyValue('--altar-x')) || r.width / 2,
        y: parseFloat(css.getPropertyValue('--altar-y')) || r.height * .6,
        height: hostOf('#tribActor').getBoundingClientRect().height };
    }
    const actor = hostOf(target === 'enemy' ? '#enemySprite' : '#heroSprite');
    if (!actor?.getClientRects().length) return null;
    const a = actor.getBoundingClientRect();
    if (target !== 'enemy') {
      const sprite = A.HERO, height = sprite.bodyHeight[actor.dataset.action] || sprite.bodyHeight.dung_yen;
      return { host, x: a.left + a.width * sprite.anchorX / sprite.width - r.left,
        y: a.top + a.height * sprite.anchorY / sprite.height - r.top, height: a.height * height / sprite.height };
    }
    return { host, x: a.left + a.width / 2 - r.left, y: a.bottom - r.top, height: a.height };
  }

  function onActor(opts, target = 'hero') {
    const p = position(target);
    if (!p) return null;
    const { style = {}, ground = true, ...rest } = opts;
    return at(p.host, { fps: 14, size: Math.max(100, p.height * 1.5) + 'px', ...rest,
      style: { ...style, left: p.x + 'px', top: (ground ? p.y + 4 : p.y - p.height * .45) + 'px',
        bottom: 'auto', transform: ground ? 'translate(-50%,-100%)' : 'translate(-50%,-50%)' } });
  }
  const hero = opts => onActor(opts);
  const tribStage = opts => onActor({ ...opts, className: 'trib-stage-vfx-sprite ' + (opts.className || '') }, 'trib');

  function effect(name, target = 'hero', opts = {}) {
    return onActor({ kind: 'hu_gioi', variant: name, ground: ['bolt', 'break', 'heal'].includes(name), fps: 15, ...opts }, target);
  }

  function ring(target = 'hero', color = '#e6c164') {
    const p = position(target);
    if (!p) return;
    const el = document.createElement('i');
    el.className = 'vfx-ring';
    Object.assign(el.style, { left: p.x + 'px', top: p.y + 'px', color, width: p.height + 'px', height: p.height * .32 + 'px' });
    transient(p.host, el, 850);
  }

  function burst(target = 'hero', color = '#ffe29a', count = 16) {
    const p = position(target);
    if (!p || !effectsEnabled()) return;
    for (let i = 0; i < Math.min(count, root.innerWidth < 600 ? 12 : 24); i++) {
      const el = document.createElement('i'), angle = Math.random() * Math.PI * 2, d = 24 + Math.random() * 70;
      el.className = 'vfx-particle';
      Object.assign(el.style, { left: p.x + 'px', top: (p.y - p.height * .35) + 'px', background: color, color });
      el.style.setProperty('--dx', Math.cos(angle) * d + 'px');
      el.style.setProperty('--dy', Math.sin(angle) * d - 20 + 'px');
      transient(p.host, el, 700);
    }
  }

  function float(text, target = 'enemy', cls = '') {
    const p = position(target);
    if (!p) return;
    const el = document.createElement('span');
    el.className = 'float-text ' + cls;
    el.textContent = text;
    /* Trong bảng trận, ảnh quái có viền trong suốt dày nên số sát thương chỉ nhích
       lên một đoạn ngắn để nằm trên thân, không đè lên bảng tên. */
    Object.assign(el.style, { left: p.x + 'px', top: (p.y - p.height * (p.battle ? .45 : .8)) + 'px' });
    transient(p.host, el, 1000);
  }

  /* Bốn hàng của atlas floating_damage_glyphs.png. */
  const NUMBER_ROW = { damage: 0, crit: 1, heal: 2, qi: 3 };
  const NUMBER_TTL = 1100;
  /* Số từ bảy ký tự trở lên thu nhỏ để không tràn cột trận về cuối game. */
  const NUMBER_FULL_GLYPHS = 6;

  /* Dựng số bằng ký tự cắt từ sprite; giá trị quá lớn hoặc không nguyên sẽ
     quay về chữ thường để không mất thông tin. */
  function spriteNumber(value, kind, sign, label) {
    const raw = Math.abs(Number(value));
    if (!Number.isFinite(raw) || raw < 1) return null;
    const n = Math.round(raw);
    if (!/^\d+$/.test(String(n))) return null;
    const row = NUMBER_ROW[kind] ?? 0;
    const prefix = sign != null ? sign : kind === 'heal' || kind === 'qi' ? '+' : '-';
    const chars = prefix + String(n);
    const el = document.createElement('span');
    el.className = 'float-number ' + kind;
    /* Bọc trong một lớp để thu nhỏ cả số (và nhãn) mà không đụng hiệu ứng
       nổi, vốn dùng transform trên phần tử ngoài. */
    const body = document.createElement('span');
    body.className = 'fd-body';
    if (chars.length > NUMBER_FULL_GLYPHS) {
      body.style.transform = 'scale(' + (NUMBER_FULL_GLYPHS / chars.length).toFixed(3) + ')';
    }
    for (const ch of chars) {
      const glyph = A.floatGlyph?.(ch, row);
      if (!glyph) continue;
      const part = document.createElement('i');
      part.className = 'fd-glyph';
      part.style.width = glyph.width;
      part.style.backgroundImage = 'url("' + A.FLOAT_DAMAGE.src + '")';
      part.style.backgroundSize = glyph.backgroundSize;
      part.style.backgroundPosition = glyph.backgroundPosition;
      body.append(part);
    }
    if (label) {
      const text = document.createElement('span');
      text.className = 'fd-label';
      text.textContent = label;
      body.append(text);
    }
    el.append(body);
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  /* Số nổi: damage thường, crit, hồi phục và linh khí dùng bốn hàng của sprite. */
  function floatNumber(value, target = 'enemy', kind = 'damage', opts = {}) {
    if (!A.FLOAT_DAMAGE || !A.floatGlyph) return null;
    const p = position(target);
    if (!p) return null;
    const el = spriteNumber(value, kind, opts.sign, opts.label);
    if (!el) {
      const sign = opts.sign != null ? opts.sign : kind === 'damage' || kind === 'crit' ? '−' : '+';
      float(sign + UI.kit.num(value) + (opts.label ? ' ' + opts.label : ''), target,
        kind === 'crit' ? 'skill' : kind === 'heal' ? 'heal' : '');
      return null;
    }
    if (opts.className) el.classList.add(...opts.className.split(/\s+/).filter(Boolean));
    Object.assign(el.style, { left: p.x + 'px', top: (p.y - p.height * (p.battle ? .45 : .8)) + 'px' });
    if (opts.ttl) el.style.animationDuration = opts.ttl + 'ms';
    transient(p.host, el, opts.ttl || NUMBER_TTL, opts.enabled || effectsEnabled);
    return el;
  }

  function cultivationGain(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    floatNumber(amount, 'hero', 'qi', {
      label: 'linh khí', ttl: 1600, className: 'cultivation-gain',
      enabled: () => !prefersReduced() && UI.s().settings.cultivationEffects !== false
    });
  }

  function clear(host) {
    const el = hostOf(host);
    if (!el) return;
    [...running].forEach(h => { if (el.contains(h.el)) h.stop(); });
  }

  function clearAll() { [...running].forEach(h => h.stop()); }

  function screenFlash(cls = 'flash-gold', ms = 520) {
    const el = document.createElement('div');
    el.className = 'vfx-flash ' + cls;
    el.style.animationDuration = ms + 'ms';
    transient(hostOf(UI.tribulation?.pageOpen ? '#tribStage' : '#scene'), el, ms);
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) clearAll(); });

  /* Nạp sẵn tấm số nổi để trận đầu không trễ nhịp hiển thị sát thương. */
  A.preloadFloatDamage?.();

  UI.vfx = {
    play, at, stage, trib, tribStage, hero, effect, ring, burst, float, floatNumber, cultivationGain, clear, clearAll, screenFlash, effectsEnabled,
    preload: (kind, variant) => A.preloadVfx(kind, variant)
  };
})(typeof window !== 'undefined' ? window : globalThis);
