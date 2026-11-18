/* HƯ GIỚI · SÂN KHẤU GIAO CHIẾN THEO LƯỢT
 * Một sân khấu dùng chung cho Lịch luyện, Bí cảnh, Sinh Tử Đài (PvP) và tỷ thí tông môn:
 *   UI.stage.arenaHtml(cfg)  dựng khung sân: thẻ hai bên, số lượt, hai nhân vật, lớp hiệu ứng.
 *   UI.stage.create(ctx)     bộ diễn hoạt cho một sân đang hiển thị (ra chiêu, trúng đòn, phản kích,
 *                            thanh máu chạy, thắng/thua). ctx cấp ảnh nhân vật và đối thủ.
 *   UI.stage.replay(cfg)     màn phủ phát lại trận theo lượt từ kịch bản (PvP, tỷ thí), có chế độ
 *                            tự động / từng lượt, tăng tốc và bỏ qua.
 *   UI.stage.autoKit         bật/tắt tự động giao chiến (skill, vật phẩm), nhớ theo từng máy.
 * Một hành động được mô tả bằng "sự kiện lượt" p:
 *   { action, kind, effect, cry, dealt, healed, taken, crit, takenCrit, counter, won, fled, state, before }
 * Cả hoạt cảnh thật (máy chủ trả về từng lượt) lẫn kịch bản phát lại đều đi qua cùng một đường này. */
(function (root) {
  'use strict';
  const A = root.HU_ASSETS, UI = root.HU_UI;
  if (!UI) return;
  const { $, esc, num } = UI.kit;

  /* ======================================================================
     KHUNG SÂN VÀ THẺ TRẠNG THÁI
     ====================================================================== */
  const vital = (label, value, max, cls, bar, mini = false) => {
    const v = Math.max(0, Math.min(max || 0, value || 0));
    const p = max > 0 ? v / max * 100 : 0;
    return `<div class="battle-vital${mini ? ' mini' : ''}">
      <div class="battle-vital-head"><span>${esc(label)}</span><b>${num(v)}<i> / ${num(max || 0)}</i></b></div>
      <div class="meter-bar ${cls}" role="meter" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${Math.round(max || 0)}" aria-valuenow="${Math.round(v)}"><i data-bar="${bar}" style="width:${p.toFixed(1)}%"></i></div>
    </div>`;
  };

  /* Cột trạng thái chỉ giữ một hàng chip để thanh sinh lực hai bên luôn thẳng hàng;
     phần dư gộp thành chip "+N" và liệt kê đầy đủ trong title. */
  const chipRow = list => {
    if (!list?.length) return '';
    const max = root.innerWidth <= 620 ? 1 : 2;
    const shown = list.slice(0, max), rest = list.length - shown.length;
    const more = list.slice(max).map(x => x.label).join(' · ');
    return `<div class="battle-statuses">${shown.map(x => `<span class="battle-status ${x.tone || 'bad'}" title="${esc(x.label)}">${esc(x.label)}${x.turns != null ? `<i>${esc(String(x.turns))}</i>` : ''}</span>`).join('')}${rest > 0 ? `<span class="battle-status more" title="${esc(more)}">+${rest}</span>` : ''}</div>`;
  };

  /* cfg: { boss, bg, label, hero:{name,sub,hp,max,mp,maxMp,chips,src,alt}, foe:{tag,name,sub,hp,max,chips,src,alt,human},
            center:{round,clock,kind}, telegraph, ticker, bars:{hero,mp,foe} }
     Mọi chuỗi chữ được thoát ở đây; chips và telegraph/clock/kind là HTML đã thoát từ nơi gọi. */
  function arenaHtml(cfg) {
    const h = cfg.hero, f = cfg.foe, c = cfg.center || {}, boss = !!cfg.boss;
    const unit = (side, over, extra) => `<div class="battle-unit ${side}${over}">
        <div class="battle-figure">${extra}</div></div>`;
    const heroImg = `<img id="battleSelf" class="battle-sprite hero" src="${esc(h.src)}" alt="${esc(h.alt || h.name)}" decoding="async" fetchpriority="high">`;
    const foeImg = `<img id="battleFoeSprite" class="battle-sprite foe${f.human ? ' human' : ''}" src="${esc(f.src)}" alt="${esc(f.alt || f.name)}" decoding="async">`;
    return `<div class="battle-stage${boss ? ' boss' : ''}${cfg.mode ? ' mode-' + esc(cfg.mode) : ''}" id="battleArena" style="--battle-bg:url('${esc(cfg.bg || '')}')">
        <div class="battle-sky" aria-hidden="true"></div>
        <div class="battle-hud">
          <div class="battle-card hero">
            <div class="battle-card-name"><b>${esc(h.name)}</b><small>${esc(h.sub || '')}</small></div>
            ${vital('Sinh lực', h.hp, h.max, 'hp', 'hp')}
            ${h.maxMp > 0 ? vital('Linh lực', h.mp, h.maxMp, 'mp', 'mp', true) : ''}
            ${h.chips || ''}
          </div>
          <div class="battle-center">
            <span class="battle-round" aria-label="Lượt ${num(c.round || 1)}">${esc(c.roundLabel || 'LƯỢT')}<b>${num(c.round || 1)}</b></span>
            ${c.clock || ''}${c.kind || ''}
          </div>
          <div class="battle-card foe${boss ? ' boss' : ''}">
            <div class="battle-card-name">${f.tag ? `<span class="battle-tag${boss ? ' boss' : ''}">${esc(f.tag)}</span>` : ''}<b>${esc(f.name)}</b><small>${esc(f.sub || '')}</small></div>
            ${vital('Sinh lực', f.hp, f.max, 'hp', 'enemy')}
            ${f.chips || ''}
          </div>
        </div>
        ${cfg.telegraph || '<span></span>'}
        <div class="battle-fighters">
          ${unit('hero', cfg.over ? ' is-over' : '', heroImg)}
          ${unit('foe', (cfg.over ? ' is-over' : '') + (cfg.beaten ? ' is-beaten' : ''), f.human ? `<span class="battle-flip">${foeImg}</span>` : foeImg)}
        </div>
        <div class="battle-cry" aria-hidden="true"></div>
        <div id="battleVfx" class="battle-vfx" aria-hidden="true"></div>
        <p class="battle-ticker" aria-hidden="true"><i class="battle-pip" aria-hidden="true"></i>${esc(cfg.ticker || '')}</p>
      </div>`;
  }

  /* ======================================================================
     BỘ DIỄN HOẠT
     Hoạt ảnh khung hình lấy từ thư mục media: nhân vật/tung_skill, quái/tan_cong
     và các chuỗi chien_dau của bộ VFX. Trạng thái "đang diễn hoạt" được giữ ở đây
     để lần vẽ lại kế tiếp không cắt ngang.
     ctx: {
       heroFrames(action) → [src]      ảnh nhân vật theo động tác (dung_chien, tan_cong, tu_vong)
       foeFrames(action)  → [src]      ảnh đối thủ (tan_cong, tu_vong)
       heroIdleMs()       → số         nhịp mỗi khung của thế đứng giao chiến (mặc định 200)
       foeIdle(step)      → src        ảnh đối thủ khi đứng thở
       active()           → bool       còn trận để thở không
     } */
  function create(ctx) {
    const fx = { pending: null, busyUntil: 0, seq: 0, timers: [], idle: 0, before: null };
    const reduced = () => !!UI.isReduced?.() || UI.s()?.settings?.combatEffects === false;
    const clearTimers = () => { fx.timers.forEach(t => root.clearTimeout(t)); fx.timers = []; };
    const later = (ms, fn) => fx.timers.push(root.setTimeout(fn, ms));

    /* Bảng trận được dựng lại sau mỗi lượt, nhưng ảnh nhân vật/yêu thú thì không đổi.
       Giữ lại chính phần tử ảnh của lượt trước để khung đã vẽ không bị trống một nhịp
       khi DOM mới thay vào (Chrome vẽ lại ảnh mới chậm hơn khung hình đầu). */
    const SPRITES = { battleSelf: null, battleFoeSprite: null };
    function keepSprites(skipSrc) {
      for (const id of Object.keys(SPRITES)) {
        const fresh = document.getElementById(id);
        if (!fresh) continue;
        const old = SPRITES[id];
        if (old && old !== fresh && !old.isConnected && fresh.parentNode) {
          if (!skipSrc) {
            const src = fresh.getAttribute('src');
            if (src) old.setAttribute('src', src);
          }
          old.className = fresh.className;
          old.alt = fresh.alt;
          fresh.parentNode.replaceChild(old, fresh);
          SPRITES[id] = old;
        } else {
          SPRITES[id] = fresh;
        }
      }
    }

    function playFrames(img, frames, interval, done) {
      if (!img || !frames.length) { done?.(); return; }
      if (reduced()) return;
      img.dataset.anim = 'busy';
      let i = 0;
      const step = () => {
        if (!img.isConnected) { img.dataset.anim = ''; return; }
        img.src = frames[Math.min(i, frames.length - 1)];
        i++;
        if (i < frames.length) later(interval, step);
        else { img.dataset.anim = ''; done?.(); }
      };
      step();
    }
    const heroAttackFrames = () => playFrames($('battleSelf'), ctx.heroFrames('tan_cong'), 120);
    const heroDeathFrames = () => playFrames($('battleSelf'), ctx.heroFrames('tu_vong'), 150);
    const foeAttackFrames = () => playFrames($('battleFoeSprite'), ctx.foeFrames('tan_cong'), 110);
    const foeDeathFrames = () => playFrames($('battleFoeSprite'), ctx.foeFrames('tu_vong'), 130);

    /* Nhấp nháy trúng đòn trên khung hình, không đụng tới khung ảnh đang chạy. */
    function jolt(el, cls = 'is-hurt', ms = 360) {
      if (!el) return;
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
      later(ms, () => el.classList.remove(cls));
    }

    /* Thanh máu chạy từ giá trị trước hành động tới giá trị mới thay vì nhảy. */
    function animateBars(before) {
      const arena = $('battleArena');
      const panel = arena?.closest('.battle-panel') || arena;
      if (!panel || !before || reduced()) return;
      const nodes = [...panel.querySelectorAll('[data-bar]')];
      const target = nodes.map(i => ({ i, to: i.style.width }));
      nodes.forEach(i => { i.style.transition = 'none'; });
      nodes.forEach(i => {
        const key = i.dataset.bar, ratio = Math.max(0, Math.min(1, before[key] ?? 0));
        i.style.width = (ratio * 100).toFixed(1) + '%';
      });
      void arena.offsetWidth;
      nodes.forEach(i => { i.style.transition = ''; });
      target.forEach(({ i, to }) => { i.style.width = to; });
    }

    /* Một hành động được diễn hoạt theo nhịp: ra chiêu → địch trúng đòn → địch phản kích → kết thúc. */
    function playSequence(p) {
      clearTimers();
      const arena = $('battleArena');
      if (!arena) return;
      animateBars(p.before);
      const heroImg = $('battleSelf'), foeImg = $('battleFoeSprite');
      const heroFig = heroImg?.closest('.battle-figure'), foeFig = foeImg?.closest('.battle-figure');
      const cry = arena.querySelector('.battle-cry');
      if (cry && p.cry) { cry.textContent = p.cry; cry.classList.add('show'); arena.classList.add('is-crying'); }
      later(1500, () => { cry?.classList.remove('show'); arena.classList.remove('is-crying'); });
      if (reduced()) {
        /* Giảm chuyển động: bỏ hoạt ảnh nhưng vẫn hiện con số kết quả của lượt. */
        if (p.dealt > 0) UI.vfx?.floatNumber?.(p.dealt, 'battleFoe', p.crit ? 'crit' : 'damage');
        if (p.healed > 0) UI.vfx?.floatNumber?.(p.healed, 'battleSelf', 'heal');
        if (p.taken > 0) UI.vfx?.floatNumber?.(p.taken, 'battleSelf', p.takenCrit ? 'crit' : 'damage');
        return;
      }

      const offensive = ['attack', 'power', 'flee'].includes(p.action) || p.dealt > 0;
      /* Chọn hiệu ứng theo loại đòn: chém kiếm, luồng linh khí, phù lục, hộ thuẫn, hồi sinh. */
      const isTalisman = p.action === 'item' && p.kind === 'TAL';
      const isPill = p.action === 'item' && p.kind === 'PILL';
      const strikeFx = isTalisman ? 'linh_phu' : p.action === 'attack' ? 'nhan_vat' : 'linh_khi';
      if (offensive) {
        later(0, () => {
          heroFig?.classList.add('is-attacking');
          heroAttackFrames();
          if (p.dealt > 0) {
            if (isTalisman) UI.vfx?.effect?.('linh_phu', 'battleSelf');
            UI.vfx?.effect?.(isTalisman ? 'trung_don' : strikeFx, 'battleFoe', { size: 'clamp(112px,14vw,152px)' });
          }
        });
        later(220, () => {
          if (p.dealt > 0) {
            jolt(foeFig);
            UI.vfx?.floatNumber?.(p.dealt, 'battleFoe', p.crit ? 'crit' : 'damage');
            UI.vfx?.effect?.('hit', 'battleFoe', { fps: 16, size: 'clamp(104px,13vw,140px)' });
            arena.classList.add('is-shake');
            later(360, () => arena.classList.remove('is-shake'));
          }
        });
        later(470, () => heroFig?.classList.remove('is-attacking'));
      } else if (p.action === 'guard') {
        later(0, () => {
          heroFig?.classList.add('is-guarding');
          UI.vfx?.ring?.('battleSelf', '#e6bd5c');
          UI.vfx?.effect?.('ho_thuan', 'battleSelf');
        });
        later(650, () => heroFig?.classList.remove('is-guarding'));
      }
      if (p.healed > 0) {
        later(120, () => {
          heroFig?.classList.add('is-guarding');
          if (['manual', 'artifact', 'item'].includes(p.action)) heroAttackFrames();
          UI.vfx?.effect?.(p.action === 'artifact' && p.effect === 'hồi máu' ? 'hoi_phuc' : 'hoi_sinh', 'battleSelf', { size: 'clamp(88px,12vw,126px)' });
          UI.vfx?.floatNumber?.(p.healed, 'battleSelf', 'heal');
        });
        later(760, () => heroFig?.classList.remove('is-guarding'));
      }
      /* Pháp bảo hộ thuẫn, đan/phù tăng ích: vẫn có động tác vận công và luồng sáng
         để người chơi thấy lệnh đã được thi triển dù không gây sát thương. */
      if (['manual', 'artifact', 'item'].includes(p.action) && !(p.dealt > 0) && !(p.healed > 0)) {
        later(0, () => {
          heroFig?.classList.add('is-casting');
          heroAttackFrames();
          const vfx = p.action === 'artifact'
            ? (p.effect === 'hồi máu' ? 'hoi_phuc' : 'ho_thuan')
            : isTalisman ? 'linh_phu'
            : isPill ? (p.effect === 'CHIEN_DAU' ? 'phi_thang' : 'hoi_sinh')
            : 'ho_thuan';
          UI.vfx?.effect?.(vfx, 'battleSelf', { size: 'clamp(96px,13vw,140px)' });
        });
        later(680, () => heroFig?.classList.remove('is-casting'));
      }

      if (p.counter && !p.won) {
        later(620, () => {
          foeFig?.classList.add('is-attacking');
          foeAttackFrames();
          UI.vfx?.effect?.('ke_dich', 'battleSelf', { size: 'clamp(92px,12vw,130px)' });
        });
        later(860, () => {
          if (p.taken > 0) {
            jolt(heroFig);
            UI.vfx?.floatNumber?.(p.taken, 'battleSelf', p.takenCrit ? 'crit' : 'damage');
            arena.classList.add('is-shake');
            later(360, () => arena.classList.remove('is-shake'));
          }
        });
        later(1100, () => foeFig?.classList.remove('is-attacking'));
      }
      if (p.won) {
        later(520, () => {
          foeFig?.classList.add('is-defeated');
          foeDeathFrames();
          UI.vfx?.burst?.('battleFoe', '#ffd98a', 20);
          arena.classList.add('is-won');
        });
        later(720, () => UI.vfx?.effect?.('phi_thang', 'battleSelf', { size: 'clamp(120px,16vw,180px)' }));
      }
      if (p.state === 'lost') {
        later(1060, () => {
          heroFig?.classList.add('is-fallen');
          heroDeathFrames();
          UI.vfx?.burst?.('battleSelf', '#ff9a8a', 16);
          arena.classList.add('is-lost');
        });
      }
      if (p.fled) {
        later(160, () => {
          heroFig?.classList.add('is-leaving');
          UI.vfx?.ring?.('battleSelf', '#9cc4ff');
          UI.vfx?.effect?.('phi_thang', 'battleSelf');
        });
        later(720, () => heroFig?.classList.remove('is-leaving'));
      }
    }

    /* Nhịp thở của sân khấu: nhân vật và đối thủ tự tiến khung khi rảnh,
       dừng hẳn khi trận kết thúc để giữ tư thế ngã xuống. */
    function startIdle() {
      if (fx.idle || reduced()) return;
      /* Nạp sẵn cả ba động tác để nhịp đầu vào trận không bị trống khung. */
      for (const action of ['dung_chien', 'tan_cong', 'tu_vong']) ctx.heroFrames(action).forEach(src => { const im = new Image(); im.src = src; im.decode?.().catch(() => {}); });
      const heroFrames = ctx.heroFrames('dung_chien');
      let tick = 0;
      /* Thế đứng giao chiến là bốn khung, nhịp riêng của từng đạo thân (nam 250 ms, nữ 180 ms);
         đối thủ giữ nhịp thở 160 ms. Vòng lặp 60 ms chỉ đổi ảnh khi khung thật sự đổi. */
      fx.idle = root.setInterval(() => {
        const hero = $('battleSelf'), foe = $('battleFoeSprite');
        if (!hero || !foe) { root.clearInterval(fx.idle); fx.idle = 0; return; }
        if (document.hidden || !ctx.active()) return;
        if (hero.dataset.anim !== 'busy' && heroFrames.length) {
          const src = heroFrames[Math.floor(Date.now() / (ctx.heroIdleMs?.() || 200)) % heroFrames.length];
          if (hero.getAttribute('src') !== src) hero.src = src;
        }
        if (foe.dataset.anim !== 'busy' && tick % 3 === 0) { const src = ctx.foeIdle(Math.floor(tick / 3)); if (src) foe.src = src; }
        tick++;
      }, 60);
    }
    const stopIdle = () => { if (fx.idle) { root.clearInterval(fx.idle); fx.idle = 0; } };

    return {
      /* Ghi lại thanh máu trước khi lệnh chạy để lát nữa chạy mượt tới giá trị mới. */
      capture(snapshot) { fx.before = snapshot || ctx.snapshot?.() || null; },
      cancel() { fx.before = null; },
      /* Nhận sự kiện lượt từ máy chủ hoặc kịch bản; sân sẽ diễn hoạt ở lần mount kế tiếp. */
      queue(p, holdMs) {
        fx.pending = { seq: ++fx.seq, ...p, before: p.before || fx.before };
        fx.before = null;
        /* Trận thua có thêm chuỗi gục ngã sau đòn cuối nên giữ khóa hoạt ảnh lâu hơn. */
        fx.busyUntil = Date.now() + (reduced() ? 120 : holdMs || (p.state === 'lost' ? 2150 : 1600));
      },
      busy: () => Date.now() < fx.busyUntil,
      mount() {
        const arena = $('battleArena');
        if (!arena) { clearTimers(); return; }
        startIdle();
        const p = fx.pending;
        /* Giữ ảnh cũ khi sắp diễn hoạt, để khung đang vẽ không bị thay bằng ảnh chưa kịp hiện. */
        keepSprites(!!p);
        if (!p || arena.dataset.fxSeq === String(p.seq)) return;
        arena.dataset.fxSeq = String(p.seq);
        fx.pending = null;
        /* Bảng vừa dựng lại theo trạng thái mới nên ảnh nhân vật cần một nhịp giải mã;
           chờ xong mới diễn hoạt để khung đầu không bị trống. */
        const img = $('battleSelf');
        if (reduced() || !img || (img.complete && img.naturalWidth)) { playSequence(p); return; }
        let played = false;
        const start = () => { if (!played) { played = true; playSequence(p); } };
        later(220, start);
        img.decode?.().then(start).catch(start);
      },
      /* Phát ngay một sự kiện lên sân đang có (dùng cho phát lại, không dựng lại DOM). */
      play(p) { clearTimers(); fx.busyUntil = Date.now() + (reduced() ? 120 : p.state === 'lost' ? 2150 : 1600); playSequence(p); },
      stop() { clearTimers(); stopIdle(); },
      reduced
    };
  }

  /* ======================================================================
     TỰ ĐỘNG GIAO CHIẾN · bật/tắt và lựa chọn, nhớ theo từng máy
     ====================================================================== */
  const AUTO_KEY = 'hugioi.auto-battle';
  const autoKit = {
    load() {
      const D = root.HU_AUTO_BATTLE?.DEFAULTS || { skills: true, items: true };
      let saved = {};
      try { saved = JSON.parse(root.localStorage?.getItem(AUTO_KEY) || '{}') || {}; } catch { saved = {}; }
      return { skills: D.skills, items: D.items, ...saved, on: false };
    },
    save(v) { try { root.localStorage?.setItem(AUTO_KEY, JSON.stringify({ skills: !!v.skills, items: !!v.items })); } catch { /* bỏ qua */ } },
    /* Dải điều khiển dùng chung: nút Tự động và hai công tắc phụ. */
    html(state, opts = {}) {
      const act = opts.act || 'battleAuto';
      const sw = (key, label, on) => `<button type="button" class="auto-chip${on ? ' on' : ''}" data-act="${act}" data-auto="${key}" aria-pressed="${on}">${label}</button>`;
      return `<div class="auto-bar" role="group" aria-label="Tự động giao chiến">
        <button type="button" class="auto-toggle${state.on ? ' on' : ''}" data-act="${act}" data-auto="on" aria-pressed="${!!state.on}"><i aria-hidden="true"></i>${state.on ? 'Đang tự động · bấm để dừng' : 'Tự động'}</button>
        ${opts.mode === 'dungeon' ? '' : sw('skills', 'Dùng kỹ năng', state.skills) + sw('items', 'Dùng đan, phù', state.items)}
      </div>`;
    }
  };

  /* ======================================================================
     PHÁT LẠI TRẬN THEO LƯỢT (PvP, tỷ thí tông môn)
     cfg: {
       mode 'pvp' | 'sect', label, title, bg, bout (kết quả của bout-script),
       hero:{name,sub,gender,realm,maxHp,maxMp}, foe:{name,sub,tag,gender,realm},
       resultHtml, onClose
     } */
  let overlay = null;
  function replay(cfg) {
    if (!A || !document.body) return null;
    overlay?.close();
    const { bout } = cfg, rounds = bout.rounds;
    const heroSrc = A.heroSrc(cfg.hero.gender, cfg.hero.realm, 'dung_chien', 0);
    const foeSrc = A.heroSrc(cfg.foe.gender, cfg.foe.realm, 'dung_chien', 0);
    const framesOf = who => action => (A.preloadHero?.(who.gender, who.realm, action) || []).map(im => im && im.src).filter(Boolean);
    const heroFrames = framesOf(cfg.hero), foeFrames = framesOf(cfg.foe);
    let index = 0, auto = true, speed = 1, timer = 0, done = false, closed = false;

    const stage = create({
      heroFrames, foeFrames,
      heroIdleMs: () => A.heroFrameMs(cfg.hero.gender, 'dung_chien'),
      foeIdle: () => { const f = foeFrames('dung_chien'); return f.length ? f[Math.floor(Date.now() / A.heroFrameMs(cfg.foe.gender, 'dung_chien')) % f.length] : ''; },
      active: () => !done
    });
    const el = document.createElement('div');
    el.className = 'stage-overlay';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', cfg.title);
    el.innerHTML = `<div class="stage-overlay-card battle-panel">
      <header class="stage-overlay-head"><div><span class="eyebrow gold">${esc(cfg.label)}</span><h3>${esc(cfg.title)}</h3></div>
        <button type="button" class="stage-x" data-stage="close" aria-label="Đóng">×</button></header>
      ${arenaHtml({
        mode: cfg.mode, bg: cfg.bg, over: false,
        hero: { name: cfg.hero.name, sub: cfg.hero.sub, hp: bout.heroMax, max: bout.heroMax, mp: 0, maxMp: 0, src: heroSrc },
        foe: { name: cfg.foe.name, sub: cfg.foe.sub, tag: cfg.foe.tag, hp: bout.foeMax, max: bout.foeMax, src: foeSrc, human: true },
        center: { round: 1, roundLabel: 'LƯỢT' }, ticker: 'Hai bên đối mặt trên đài.'
      })}
      <div class="stage-controls" role="group" aria-label="Điều khiển trận đấu">
        <button type="button" class="auto-toggle on" data-stage="auto" aria-pressed="true"><i aria-hidden="true"></i><span>Tự động</span></button>
        <button type="button" class="btn btn-outline btn-sm" data-stage="next" disabled>Lượt kế</button>
        <button type="button" class="btn btn-outline btn-sm" data-stage="speed" aria-label="Tốc độ phát">×1</button>
        <button type="button" class="btn btn-outline btn-sm" data-stage="skip">Bỏ qua</button>
      </div>
      <div class="stage-result" role="status" hidden></div>
      <p class="battle-note stage-note">Kết quả đã được máy chủ định đoạt; sân khấu tái hiện diễn biến từng lượt.</p>
    </div>`;
    document.body.append(el);
    const game = $('game'); if (game) game.inert = true;
    const q = s => el.querySelector(s);

    const setBars = r => {
      const set = (key, v, max) => { const i = el.querySelector(`[data-bar="${key}"]`); if (!i) return; i.style.width = (max > 0 ? Math.max(0, v) / max * 100 : 0).toFixed(1) + '%';
        const b = i.closest('.battle-vital')?.querySelector('.battle-vital-head b'); if (b) b.innerHTML = `${num(Math.max(0, v))}<i> / ${num(max)}</i>`;
        const m = i.closest('[role="meter"]'); if (m) m.setAttribute('aria-valuenow', String(Math.round(Math.max(0, v)))); };
      set('hp', r.heroHp, bout.heroMax); set('enemy', r.foeHp, bout.foeMax);
    };
    const ticker = text => { const t = q('.battle-ticker'); if (t) t.lastChild.textContent = text; };
    const roundText = r => {
      const who = r.cry;
      const base = r.action === 'manual' || r.action === 'guard' ? 'Bạn thi triển ' + who : r.action === 'power' ? 'Bạn tung trọng kích' : 'Bạn tấn công';
      const dealt = r.dealt > 0 ? ' · −' + num(r.dealt) + (r.crit ? ' bạo kích' : '') : '';
      const heal = r.healed > 0 ? ' · +' + num(r.healed) + ' sinh lực' : '';
      const back = r.counter ? (r.taken > 0 ? ` · ${cfg.foe.name} phản kích −${num(r.taken)}` : ` · né được đòn của ${cfg.foe.name}`) : '';
      return base + dealt + heal + back + '.';
    };

    function finish() {
      done = true; clearTimeout(timer);
      const wonMatch = bout.win;
      const box = q('.stage-result');
      box.hidden = false;
      box.className = 'stage-result battle-verdict ' + (wonMatch ? 'won' : 'lost');
      box.innerHTML = `<span class="battle-verdict-seal ${wonMatch ? 'won' : 'lost'}" aria-hidden="true">${wonMatch ? '勝' : '敗'}</span>
        <b>${wonMatch ? 'Thắng lợi' : 'Thất bại'}</b>${cfg.resultHtml || ''}<small>${rounds.length} lượt · ${wonMatch ? cfg.foe.name + ' bại trận' : 'đạo thân tọa hóa'}</small>
        <button type="button" class="btn btn-gold" data-stage="close">Rời đài</button>`;
      q('[data-stage="next"]').disabled = true;
      q('[data-stage="skip"]').hidden = true;
      q('[data-stage="auto"]').disabled = true;
      q('.stage-result .btn')?.focus?.({ preventScroll: true });
    }

    function step() {
      if (closed || done || index >= rounds.length) return;
      const r = rounds[index++];
      const rc = q('.battle-round b'); if (rc) rc.textContent = String(r.turn);
      setBars(r);
      ticker(roundText(r));
      stage.play({ action: r.action === 'manual' ? 'manual' : r.action, kind: '', effect: '', cry: r.cry, dealt: r.dealt, healed: r.healed,
        taken: r.taken, crit: r.crit, takenCrit: r.takenCrit, counter: r.counter, won: r.won, fled: false, state: r.state });
      if (index >= rounds.length) { timer = root.setTimeout(finish, (r.state === 'lost' ? 2300 : 1500) / speed); return; }
      if (auto) timer = root.setTimeout(step, 1750 / speed);
      else q('[data-stage="next"]').disabled = false;
    }

    function close() {
      if (closed) return;
      closed = true; clearTimeout(timer); stage.stop();
      UI.vfx?.clear?.('#battleVfx');
      el.remove();
      if (game) game.inert = false;
      document.removeEventListener('keydown', onKey, true);
      if (overlay === handle) overlay = null;
      cfg.onClose?.();
    }
    const skipAll = () => {
      if (done || closed) return;
      clearTimeout(timer); index = rounds.length;
      const r = rounds.at(-1); setBars(r); ticker(roundText(r));
      const rc = q('.battle-round b'); if (rc) rc.textContent = String(r.turn);
      if (r.state === 'lost') { q('.battle-figure.is-attacking, .battle-unit.hero .battle-figure')?.classList.add('is-fallen'); q('#battleArena').classList.add('is-lost'); }
      else q('.battle-unit.foe .battle-figure')?.classList.add('is-defeated');
      finish();
    };
    const onKey = e => {
      if (e.key === 'Escape') { e.stopPropagation(); if (done) close(); else skipAll(); }
      else if ((e.key === ' ' || e.key === 'Enter') && !auto && !done && e.target === document.body) { e.preventDefault(); q('[data-stage="next"]').click(); }
    };
    document.addEventListener('keydown', onKey, true);

    el.addEventListener('click', e => {
      const b = e.target.closest('[data-stage]');
      if (!b) { if (e.target === el && done) close(); return; }
      const act = b.dataset.stage;
      if (act === 'close') { if (done) close(); else skipAll(); }
      else if (act === 'skip') skipAll();
      else if (act === 'next') { b.disabled = true; step(); }
      else if (act === 'speed') { speed = speed === 1 ? 2 : 1; b.textContent = '×' + speed; }
      else if (act === 'auto') {
        auto = !auto;
        b.classList.toggle('on', auto); b.setAttribute('aria-pressed', String(auto));
        b.querySelector('span').textContent = auto ? 'Tự động' : 'Từng lượt';
        if (auto) { q('[data-stage="next"]').disabled = true; if (!done && !stage.busy()) { clearTimeout(timer); timer = root.setTimeout(step, 250); } else if (!done) { clearTimeout(timer); timer = root.setTimeout(step, 900); } }
        else { clearTimeout(timer); timer = root.setTimeout(() => { if (!done && !closed) q('[data-stage="next"]').disabled = false; }, 0); }
      }
    });

    const handle = { close, el };
    overlay = handle;
    stage.mount();
    q('[data-stage="auto"]')?.focus?.({ preventScroll: true });
    timer = root.setTimeout(step, 700);
    return handle;
  }

  UI.stage = { vital, chipRow, arenaHtml, create, replay, autoKit, close: () => overlay?.close() };
})(typeof window !== 'undefined' ? window : globalThis);
