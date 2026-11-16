/* HƯ GIỚI · LỊCH LUYỆN: chọn nơi, ghi chép và đếm ngược mười phút. */
(function (root) {
  'use strict';
  const H = root.HU_GAME, F = H.F, A = root.HU_ASSETS, UI = root.HU_UI;
  const { $, esc, num, btn, card, abs, pct } = UI.kit;

  function zoneCard() {
    const s = UI.s(), journey = s.exploration?.active, blocked = root.HU_COMMANDS?.activityConflict(s, 'startExploration');
    const now = UI.session.serverNow(), remain = journey ? Math.max(0, Math.ceil((journey.end - now) / 1000)) : 600;
    const countdown = String(Math.floor(remain / 60)).padStart(2, '0') + ':' + String(remain % 60).padStart(2, '0');
    return card('Chọn nơi lịch luyện', `
      <p class="info-note">${journey
        ? 'Đang hành tẩu trong bí cảnh. Phải kết thúc chuyến đi mới có thể trở về đài Tu luyện hoặc đổi địa điểm.'
        : 'Chọn địa điểm phù hợp đạo hạnh, sau đó khởi hành. Một chuyến lịch luyện kéo dài đúng mười phút.'}</p>
      ${blocked && !journey ? '<p class="info-note">' + esc(blocked) + '</p>' : ''}
      <p class="info-note">Hoàn thành chuyến đi nhận ${H.EXPLORE_POINTS} điểm lịch luyện · hiện có ${num(s.adventurePoints || 0)} điểm. Dùng điểm để mượn sách tại Tàng Kinh Các trong tông môn.</p>
      ${journey ? `<div class="exploration-clock" role="timer" aria-label="Thời gian lịch luyện còn lại">
            <span>Thời gian trở về</span><strong id="explorationCountdown">${countdown}</strong>
            <div class="meter-bar" aria-hidden="true"><i id="explorationProgress" style="width:${(100 - remain / 6).toFixed(1)}%"></i></div>
          </div>${eventBlock()}` : ''}
      <div class="zone-list">${H.ZONES.map(z => `
        <button class="zone-button ${z.id === s.zone ? 'active' : ''}" data-act="travel" data-index="${z.id}"
          ${journey || z.realm > s.realm ? 'disabled' : ''} aria-pressed="${z.id === s.zone}">
          <b>${esc(z.name)}</b><small>${z.realm > s.realm ? 'Mở ở ' + F.REALMS[z.realm] : esc(z.desc)}</small>
        </button>`).join('')}</div>
      ${journey ? '' : btn('Khởi hành lịch luyện · 10 phút', 'exploreStart', '', !!blocked, 'btn-gold')}
    `, { eyebrow: 'BÍ CẢNH', cls: 'zone-card' });
  }

  /* Sự kiện ngẫu nhiên của chuyến đi hiện tại: quái, NPC hoặc kỳ duyên địa bảo.
     Quái và NPC cho chọn cách ứng phó; kết quả chỉ được tính khi hết chuyến. */
  const EVENT_LABELS = { monster: 'YÊU THÚ CHẶN ĐƯỜNG', npc: 'GẶP GỠ ĐẠO HỮU', encounter: 'KỲ DUYÊN ĐỊA BẢO' };
  /* Thanh chỉ số có nhãn chữ và role meter để trình đọc màn hình đọc được. */
  const meter = (label, value, max, cls) => {
    const v = Math.max(0, Math.min(max || 0, value || 0));
    return `<div class="run-meter"><span>${esc(label)}</span><div class="meter-bar ${cls}" role="meter" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${Math.round(max || 0)}" aria-valuenow="${Math.round(v)}"><i style="width:${max > 0 ? v / max * 100 : 0}%"></i></div><b>${num(v)} / ${num(max || 0)}</b></div>`;
  };

  /* ======================================================================
     BIỂU TƯỢNG CHIÊU THỨC
     Nét mảnh, đồng màu để hợp bảng màu mực–vàng của giao diện.
     ====================================================================== */
  const ICONS = {
    attack: '<path d="M14 4.6 19.4 10l-1.5 1.5-1.4-1.4L6.2 20.4 3.6 20.4l.1-2.7L14 7.5l-1.5-1.4L14 4.6z"/><path d="m4.2 16.6 3.2 3.2"/>',
    power: '<circle cx="12" cy="12" r="3.4"/><path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3M5.3 5.3 7.4 7.4M16.6 16.6l2.1 2.1M18.7 5.3 16.6 7.4M7.4 16.6l-2.1 2.1"/>',
    guard: '<path d="M12 3 5 5.8v5.6c0 4.2 2.9 7.5 7 8.8 4.1-1.3 7-4.6 7-8.8V5.8L12 3z"/><path d="m9.4 11.9 1.8 1.9 3.5-3.8"/>',
    heal: '<path d="M12 20.2S4.6 15.7 4.6 10.6A3.9 3.9 0 0 1 12 8.2a3.9 3.9 0 0 1 7.4 2.4c0 5.1-7.4 9.6-7.4 9.6z"/><path d="M12 10.2v5.2M9.4 12.8h5.2"/>'
  };
  const icon = (name, cls = '') => `<svg class="battle-svg ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.attack}</svg>`;

  const ACTION_LABEL = { attack: 'Tấn công', power: 'Trọng kích', guard: 'Thủ thế', heal: 'Hồi phục', flee: 'Rút lui' };

  /* ======================================================================
     HIỆU ỨNG GIAO CHIẾN
     Hoạt ảnh khung hình lấy từ thư mục media: nhân vật/tung_skill,
     quái/tan_cong và các chuỗi chien_dau của bộ VFX. Trạng thái "đang
     diễn hoạt" được giữ ở đây để lần vẽ lại kế tiếp không cắt ngang.
     ====================================================================== */
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

  /* Bộ nhân vật thật lưu sẵn 6 ảnh cho mỗi động tác; lấy thẳng danh sách ảnh
     đã nạp để chạy khung, tránh phụ thuộc đồng hồ dùng chung với sân khấu chính. */
  function heroFrameSrcs(action) {
    const s = UI.s();
    return (A?.preloadHero?.(s.gender, s.realm, action) || []).map(im => im && im.src).filter(Boolean);
  }
  function heroAttackFrames() { playFrames($('battleSelf'), heroFrameSrcs('tan_cong'), 120); }
  function heroDeathFrames() { playFrames($('battleSelf'), heroFrameSrcs('tu_vong'), 150); }
  function foeAttackFrames() {
    const img = $('battleFoeSprite'), s = UI.s();
    if (!img) return;
    const n = A?.enemyFrames?.(s.zone, s.enemyKind, 'tan_cong') || 3;
    playFrames(img, Array.from({ length: n }, (_, i) => A.enemySrc(s.zone, s.enemyKind, 'tan_cong', i)), 110);
  }
  function foeDeathFrames() {
    const img = $('battleFoeSprite'), s = UI.s();
    if (!img) return;
    const n = A?.enemyFrames?.(s.zone, s.enemyKind, 'tu_vong') || 4;
    playFrames(img, Array.from({ length: n }, (_, i) => A.enemySrc(s.zone, s.enemyKind, 'tu_vong', i)), 130);
  }

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

  /* Một hành động của người chơi được diễn hoạt theo nhịp:
     ra chiêu → địch trúng đòn → địch phản kích → kết thúc. */
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
    if (reduced()) return;

    const offensive = ['attack', 'power', 'flee'].includes(p.action) || p.dealt > 0;
    /* Chọn hiệu ứng theo loại đòn: chém kiếm, luồng linh khí, phù lục, hộ thuẫn,
       hồi sinh. Bộ chien_dau có sẵn cả bảy chuỗi nên không cần vẽ thêm. */
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
          UI.vfx?.float?.('−' + num(p.dealt), 'battleFoe', 'skill');
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
        UI.vfx?.float?.('+' + num(p.healed), 'battleSelf', 'heal');
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
          UI.vfx?.float?.('−' + num(p.taken), 'battleSelf');
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

  /* Nhịp thở của sân khấu: khung hình nhân vật và yêu thú tự tiến khi rảnh,
     dừng hẳn khi trận kết thúc để giữ tư thế ngã xuống. */
  function startIdle() {
    if (fx.idle || reduced()) return;
    const s = UI.s();
    /* Nạp sẵn cả ba động tác để nhịp đầu vào trận không bị trống khung. */
    for (const action of ['di_chuyen', 'tan_cong', 'tu_vong']) {
      (A?.preloadHero?.(s.gender, s.realm, action) || []).forEach(im => {
        if (im?.decode) im.decode().catch(() => {});
      });
    }
    const heroFrames = heroFrameSrcs('di_chuyen');
    const foeCount = A?.enemyFrames?.(s.zone, s.enemyKind, 'dung_yen') || 3;
    let step = 0;
    fx.idle = root.setInterval(() => {
      const hero = $('battleSelf'), foe = $('battleFoeSprite');
      if (!hero || !foe) { root.clearInterval(fx.idle); fx.idle = 0; return; }
      if (document.hidden) return;
      const e = UI.s().exploration?.active, b = e?.battle;
      if (!b || b.state !== 'active') return;
      if (hero.dataset.anim !== 'busy' && heroFrames.length) hero.src = heroFrames[step % heroFrames.length];
      if (foe.dataset.anim !== 'busy') foe.src = A.enemySrc(s.zone, s.enemyKind, 'dung_yen', Math.floor(step / 3) % foeCount);
      step++;
    }, 160);
  }

  UI.battleFx = {
    /* Ghi lại thanh máu trước khi lệnh chạy để lát nữa chạy mượt tới giá trị mới. */
    capture() {
      const s = UI.s(), e = s.exploration?.active, b = e?.battle;
      const maxHp = UI.g().stats().HP, maxMp = UI.g().maxMp();
      fx.before = {
        hp: maxHp > 0 ? Math.max(0, Math.min(1, s.hp / maxHp)) : 0,
        mp: maxMp > 0 ? Math.max(0, Math.min(1, s.mp / maxMp)) : 0,
        enemy: b?.enemyMax > 0 ? Math.max(0, Math.min(1, b.enemyHp / b.enemyMax)) : 0
      };
    },
    cancel() { fx.before = null; },
    resolve(out, action, code) {
      const item = code ? H.item(code) : null;
      const design = code ? H.DESIGN?.effects?.[code] : null;
      fx.pending = {
        seq: ++fx.seq,
        turn: out?.turn,
        action,
        kind: item?.kind || '',
        effect: action === 'artifact' ? (design?.['hiệu ứng'] || '') : (item?.effect || ''),
        cry: action === 'manual' || action === 'artifact' || action === 'item'
          ? (item?.name || ACTION_LABEL[action] || '')
          : ACTION_LABEL[action] || '',
        dealt: Math.max(0, Number(out?.dealt) || 0),
        healed: Math.max(0, Number(out?.healed) || 0),
        taken: Math.max(0, Number(out?.taken) || 0),
        counter: !!out?.counter,
        won: !!out?.won, fled: !!out?.fled, state: out?.state || 'active',
        before: fx.before
      };
      fx.before = null;
      /* Trận thua có thêm chuỗi gục ngã sau đòn cuối, nên giữ khóa hoạt ảnh
         lâu hơn để hộp thoại tọa hóa không cắt ngang. */
      fx.busyUntil = Date.now() + (reduced() ? 120 : out?.state === 'lost' ? 2150 : 1600);
    },
    busy() { return Date.now() < fx.busyUntil; },
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
      /* Bảng vừa được dựng lại theo trạng thái mới, nên ảnh đạo thân cần một nhịp
         giải mã; chờ xong mới diễn hoạt để khung đầu không bị trống. */
      const img = $('battleSelf');
      if (reduced() || !img || (img.complete && img.naturalWidth)) { playSequence(p); return; }
      let played = false;
      const start = () => { if (!played) { played = true; playSequence(p); } };
      later(220, start);
      img.decode?.().then(start).catch(start);
    }
  };

  /* ======================================================================
     BẢNG GIAO CHIẾN
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
  const statusChips = (arr, tone = 'bad') => chipRow((arr || []).map(x => ({ tone, label: x.type, turns: x.turns })));
  const buffChips = b => {
    const list = [];
    if (b.guard) list.push('Thủ thế');
    if (b.shield > 0) list.push('Hộ thuẫn ' + num(b.shield));
    if (b.damageCut > 0) list.push('Giảm ' + Math.round(b.damageCut * 100) + '% sát thương');
    if (b.atkBuff?.turns > 0) list.push('Cường công +' + Math.round(b.atkBuff.points * 100) + '%');
    if (b.regen?.turns > 0) list.push('Hồi phục theo lượt');
    if (b.ward?.turns > 0) list.push('Kháng hiệu ứng');
    if (b.bonusDef > 0) list.push('Phòng ngự +' + num(b.bonusDef));
    if (b.bonusDodge > 0) list.push('Né tránh +' + Math.round(b.bonusDodge * 100) + '%');
    return chipRow(list.map(label => ({ tone: 'good', label })));
  };

  /* Một thẻ chiêu thức lớn cho bốn động tác cơ bản. */
  function skillCard({ action, key, label, hint, cd, cost, disabled, tone }) {
    const off = disabled || cd > 0;
    return `<button type="button" class="battle-skill ${tone || ''}${off ? ' is-off' : ''}${cd > 0 ? ' on-cd' : ''}"
      data-act="battleAct" data-action="${action}" aria-keyshortcuts="${key}" ${off ? 'disabled' : ''}
      aria-label="${esc(label)} · ${esc(hint)}">
      <span class="battle-skill-ico">${icon(action)}${cd > 0 ? `<i class="battle-skill-cd">${cd}</i>` : ''}</span>
      <b class="battle-skill-name">${esc(label)}</b>
      <small class="battle-skill-hint">${cd > 0 ? 'Còn ' + cd + ' lượt' : esc(hint)}</small>
      <span class="battle-skill-cost">${esc(cost)}</span>
      <kbd class="battle-key">${key}</kbd>
    </button>`;
  }

  /* Thẻ công pháp · pháp bảo · đan dược dùng chung một khuôn. */
  const toolRow = ({ action, code, name, art, meta, cd }) => `<button type="button" class="battle-tool" data-act="battleAct"
      data-action="${action}" data-code="${esc(code)}" ${cd > 0 ? 'disabled' : ''} aria-label="${esc(name)}${cd > 0 ? ' · còn ' + cd + ' lượt' : ''}">
      <span class="battle-tool-art">${art}</span>
      <span class="battle-tool-text"><b>${esc(name)}</b><small>${esc(meta)}</small></span>
      ${cd > 0 ? `<span class="battle-tool-cd">${cd}</span>` : ''}
    </button>`;

  function battlePanel(e) {
    const s = UI.s(), g = UI.g(), b = e.battle, B = H.BATTLE;
    const st = g.stats(), maxMp = g.maxMp(), active = b.state === 'active';
    const ratio = b.enemyMax > 0 ? b.enemyHp / b.enemyMax : 0, heavy = b.intent === 'heavy';
    const kindLabel = (H.BATTLE_LABELS || {})[s.enemyKind] || 'Yêu thú';
    const phase = active ? g.battlePhase(g.battleEnemy(), ratio) : 1;
    const boss = String(s.enemyKind).startsWith('boss');
    const remain = Math.max(0, Math.ceil((b.remaining || 0) / 1000));
    const clock = String(Math.floor(remain / 60)).padStart(2, '0') + ':' + String(remain % 60).padStart(2, '0');
    const info = g.enemy?.() || {};
    const level = info.level ? 'Cấp ' + info.level : F.REALMS[s.realm];
    const bg = abs(A?.zoneBg?.(s.zone) || A?.BG?.combat || '');
    const heroSrc = A?.heroSrc?.(s.gender, s.realm, 'di_chuyen', 0) || '';
    const foeSrc = A?.enemySrc?.(s.zone, s.enemyKind, 'dung_yen', 0) || '';
    const powerOff = b.powerCd > 0 || s.mp < maxMp * B.powerMp;
    const healOff = b.healCd > 0 || s.mp < maxMp * B.healMp || s.hp >= st.HP;

    /* --- Công pháp ngoại tu --- */
    const manuals = (s.activeManuals || []).filter(k => H.MANUALS.school(H.item(k)) === 'ngoai').map(key => {
      const x = H.item(key), sk = H.MANUALS.skillOf(x), cd = b.cd?.['m:' + key] || 0;
      const pw = g.manualPower(key);
      const meta = !sk ? 'Không có chiêu thức'
        : sk.kind === 'attack' ? 'Sát thương ×' + (sk.multiplier * pw).toFixed(2) + ' · ' + Math.round(sk.mpPct * 100) + '% MP'
          : sk.kind === 'heal' ? 'Hồi ' + num(sk.value * pw) + ' sinh lực · ' + Math.round(sk.mpPct * 100) + '% MP'
            : sk.kind === 'guard' ? 'Phòng ngự +' + num(sk.value * pw) + ' · ' + Math.round(sk.mpPct * 100) + '% MP'
              : 'Né tránh +' + Math.round(sk.value * pw) + '% · ' + Math.round(sk.mpPct * 100) + '% MP';
      return { action: 'manual', code: key, name: x.name, art: UI.kit.img(key), meta, cd };
    });

    /* --- Pháp bảo có kỹ năng kích hoạt --- */
    const artifacts = (s.equipment || []).filter(k => H.DESIGN.effects[H.item(k)?.code]?.['điều kiện kích hoạt'] === 'khi kích hoạt').map(key => {
      const x = H.item(key), d = H.DESIGN.effects[x.code], cd = b.cd?.['a:' + key] || 0;
      const meta = d['hiệu ứng'] === 'giáp ảo' ? 'Hộ thuẫn ' + Math.round(d['lá chắn (% hp tối đa)']) + '% HP'
        : d['hiệu ứng'] === 'hồi máu' ? 'Hồi phục theo lượt'
          : 'Hiệu ứng kích hoạt';
      return { action: 'artifact', code: key, name: x.name, art: UI.kit.img(key), meta, cd };
    });

    /* --- Đan và phù dùng được trong trận --- */
    const pillKinds = { HOI_PHUC: 1, HOI_HP: 1, HOI_MP: 1, GIAI_DOC: 1, KHANG_HIEU_UNG: 1, CHIEN_DAU: 1, KIEP: 1 };
    const items = Object.entries(s.bag).filter(([code, n]) => {
      const x = H.item(code);
      if (!x || !n || x.tier > s.realm + 1) return false;
      return x.kind === 'PILL' ? !!pillKinds[x.effect] : x.kind === 'TAL';
    }).sort((a, b2) => (H.item(b2[0])?.tier || 0) - (H.item(a[0])?.tier || 0)).slice(0, 12).map(([code, n]) => {
      const x = H.item(code), hint = UI.kit.pillEffectText?.(x, s) || x.description || 'Dùng ngay';
      return { action: 'item', code, name: x.name, art: UI.kit.img(code), meta: hint + ' · ×' + n, cd: 0 };
    });

    const groups = {
      manual: { label: 'Công pháp', rows: manuals, empty: 'Chưa đặt công pháp ngoại tu. Hãy lĩnh ngộ và xếp vào ô trước khi giao chiến.' },
      artifact: { label: 'Pháp bảo', rows: artifacts, empty: 'Không có pháp bảo kích hoạt trong bộ trang bị.' },
      item: { label: 'Đan dược', rows: items, empty: 'Không có đan hay phù dùng được trong trận.' }
    };
    const wanted = UI.view.battleTool;
    const toolTab = groups[wanted] ? wanted : (manuals.length ? 'manual' : items.length ? 'item' : 'artifact');
    const group = groups[toolTab];
    const tabs = Object.entries(groups).map(([id, x]) => `<button type="button" role="tab" aria-selected="${id === toolTab}"
      class="battle-tab${id === toolTab ? ' on' : ''}" data-act="battleTool" data-tool="${id}">${x.label}<i>${x.rows.length}</i></button>`).join('');

    /* --- Kết quả trận đấu --- */
    const title = b.state === 'won' ? 'Thắng lợi' : b.state === 'fled' ? 'Đã rút lui' : 'Thất bại';
    const seal = b.state === 'won' ? '勝' : b.state === 'fled' ? '退' : '敗';
    const enemyLeft = Math.round(ratio * 100);
    const verdict = !active ? `<div class="battle-verdict ${esc(b.state)}" role="status">
      <span class="battle-verdict-seal ${esc(b.state)}" aria-hidden="true">${seal}</span>
      <b>${title}</b>
      <p>${esc(b.result || e.text)}</p>
      <small>${Math.max(1, b.turn)} lượt · địch còn ${Math.max(0, enemyLeft)}% sinh lực</small>
      ${b.state === 'lost'
        ? '<p class="battle-verdict-note">Đạo thân đã tọa hóa. Hãy trở về Khởi Nguyên để bắt đầu kiếp mới.</p>'
        : btn('Tiếp tục lịch luyện', 'battleAct', 'data-action="continue"', false, 'btn-gold')}
    </div>` : '';

    /* --- Bảng chiêu thức --- */
    const command = active ? `<div class="battle-command">
      <div class="battle-skills" role="group" aria-label="Chiêu thức giao chiến">
        ${skillCard({ action: 'attack', key: '1', label: 'Tấn công', hint: 'Sát thương cơ bản', cost: '0 MP', cd: 0, disabled: false, tone: 'attack' })}
        ${skillCard({ action: 'power', key: '2', label: 'Trọng kích', hint: '×' + B.powerMult + ' sát thương', cost: Math.round(B.powerMp * 100) + '% MP', cd: b.powerCd, disabled: powerOff && b.powerCd <= 0, tone: 'seal' })}
        ${skillCard({ action: 'guard', key: '3', label: 'Thủ thế', hint: 'Giảm ' + Math.round(B.guardCut * 100) + '% sát thương', cost: '0 MP', cd: 0, disabled: false, tone: 'jade' })}
        ${skillCard({ action: 'heal', key: '4', label: 'Hồi phục', hint: Math.round(B.healPct * 100) + '% HP', cost: Math.round(B.healMp * 100) + '% MP', cd: b.healCd, disabled: healOff && b.healCd <= 0, tone: 'jade' })}
      </div>
      <div class="battle-tools">
        <div class="battle-tool-tabs" role="tablist" aria-label="Công cụ chiến đấu">${tabs}</div>
        <div class="battle-tool-list" role="tabpanel" aria-label="${group.label}">
          ${group.rows.length ? group.rows.map(toolRow).join('') : `<p class="battle-tool-empty">${esc(group.empty)}</p>`}
        </div>
      </div>
      <div class="battle-footactions">
        <span class="battle-note">Mỗi lượt một hành động · phím 1–4</span>
        ${btn('Rút lui · ' + Math.round((B.flee || .55) * 100) + '%', 'battleAct', 'data-action="flee"', false, 'btn-outline btn-sm')}
      </div>
    </div>` : '';

    const logOpen = UI.view.battleLog !== false, lines = (b.log || []).slice(0, 4);
    const latest = lines[0] || e.text || '';
    return `<section class="battle-panel${boss ? ' boss' : ''}${active ? '' : ' is-over'}" aria-label="Giao chiến với ${esc(e.name)}">
      <div class="battle-stage${boss ? ' boss' : ''}" id="battleArena" style="--battle-bg:url('${esc(bg)}')">
        <div class="battle-sky" aria-hidden="true"></div>
        <div class="battle-hud">
          <div class="battle-card hero">
            <div class="battle-card-name"><b>${esc(s.name)}</b><small>${esc(g.realmLabel())}</small></div>
            ${vital('Sinh lực', s.hp, st.HP, 'hp', 'hp')}
            ${vital('Linh lực', s.mp, maxMp, 'mp', 'mp', true)}
            ${buffChips(b)}${statusChips(b.statuses)}
          </div>
          <div class="battle-center">
            <span class="battle-round" aria-label="Lượt ${b.turn}">LƯỢT<b>${b.turn}</b></span>
            <span class="battle-clock" role="timer" aria-label="Thời gian lịch luyện còn lại, tạm dừng khi giao chiến">
              <i aria-hidden="true">⏳</i><b id="explorationCountdown">${clock}</b>
              <span class="battle-clock-bar" aria-hidden="true"><i id="explorationProgress" style="width:${(100 - remain / 6).toFixed(1)}%"></i></span>
            </span>
            ${active && boss ? `<span class="battle-kind">Giai đoạn ×${phase.toFixed(2)}</span>` : ''}
          </div>
          <div class="battle-card foe${boss ? ' boss' : ''}">
            <div class="battle-card-name"><span class="battle-tag${boss ? ' boss' : ''}">${esc(kindLabel)}</span><b>${esc(e.name)}</b><small>${esc(level)}</small></div>
            ${vital('Sinh lực', b.enemyHp, b.enemyMax, 'hp', 'enemy')}
            ${statusChips(b.enemyStatuses)}
          </div>
        </div>
        ${active ? `<p class="battle-telegraph${heavy ? ' heavy' : ''}" role="status">
          <span aria-hidden="true">${heavy ? '⚠' : '✦'}</span>
          <b>${esc(e.name)}</b> chuẩn bị ${heavy ? 'đòn nặng' : 'đòn thường'}${heavy ? ' · thủ thế giảm ' + Math.round(B.guardCut * 100) + '%' : ''}
        </p>` : '<span></span>'}
        <div class="battle-fighters">
          <div class="battle-unit hero${active ? '' : ' is-over'}">
            <div class="battle-figure">
              <img id="battleSelf" class="battle-sprite hero" src="${esc(heroSrc)}" alt="${esc(s.name)} đang giao chiến" decoding="async" fetchpriority="high">
            </div>
          </div>
          <div class="battle-unit foe${active ? '' : ' is-over'}${b.state === 'won' ? ' is-beaten' : ''}">
            <div class="battle-figure">
              <img id="battleFoeSprite" class="battle-sprite foe" src="${esc(foeSrc)}" alt="${esc(e.name)} đang đối đầu" decoding="async">
            </div>
          </div>
        </div>
        <div class="battle-cry" aria-hidden="true"></div>
        <div id="battleVfx" class="battle-vfx" aria-hidden="true"></div>
        <p class="battle-ticker" aria-hidden="true"><i>✦</i>${esc(latest)}</p>
      </div>
      ${verdict}
      ${command}
      <div class="battle-log${logOpen ? ' is-open' : ''}">
        <button type="button" class="battle-log-head" data-act="battleLog" aria-expanded="${logOpen}">Diễn biến<i aria-hidden="true">${logOpen ? '▾' : '▸'}</i></button>
        ${logOpen ? `<ol class="run-log" role="log" aria-live="polite" aria-label="Diễn biến lượt đánh">${lines.map(v => `<li>${esc(v)}</li>`).join('')}</ol>` : ''}
      </div>
    </section>`;
  }

  function eventBlock() {
    const s = UI.s(), e = s.exploration?.active;
    if (!e) return '';
    const options = (H.EXPLORE_CHOICES || {})[e.kind], chosen = e.choice >= 0, tamMaMax = H.TAM_MA_MAX || 100;
    const choices = options ? `<div class="event-choices" role="group" aria-label="Cách ứng phó">${options.map((o, i) => `
        <button class="event-choice ${chosen && e.choice === i ? 'active' : ''}" data-act="exploreChoice" data-index="${i}"
          ${chosen ? 'disabled' : ''} aria-pressed="${chosen && e.choice === i}">
          <b>${esc(o.label)}</b><small>${esc(o.desc)}</small>
        </button>`).join('')}</div>` : '';
    const note = e.kind === 'encounter'
      ? 'Cơ duyên sẽ hiển lộ khi chuyến đi kết thúc. Phúc Duyên và Vận Khí càng cao, kỳ ngộ càng quý.'
      : chosen ? 'Đã quyết định. Kết quả được tính khi chuyến đi kết thúc.'
        : e.kind === 'npc' ? 'Không chọn thì chỉ lướt qua, không đổi tâm ma. Tâm ma hiện tại: ' + num(s.tamMa || 0) + '/' + tamMaMax + '.'
          : 'Không chọn thì mặc định giao chiến. Tâm ma hiện tại: ' + num(s.tamMa || 0) + '/' + tamMaMax + '.';
    return `<section class="event-block event-${esc(e.kind)}" aria-label="Sự kiện lịch luyện">
      <span class="eyebrow gold">${EVENT_LABELS[e.kind] || 'SỰ KIỆN'}</span><h3>${esc(e.name)}</h3>
      <p class="event-text">${esc(e.text)}</p>${choices}<p class="info-note">${note}</p></section>`;
  }

  function journalCard() {
    return card('Nhật ký lịch luyện', '<div class="journal" id="combatJournal" aria-live="polite"></div>',
      { eyebrow: 'DẤU CHÂN TIÊN LỘ' });
  }

  function panel() {
    const e = UI.s().exploration?.active;
    /* Đang giao chiến: bảng trận đứng riêng, không lồng trong thẻ chọn nơi,
       để đồng hồ đếm ngược và toàn bộ nút hành động nằm trong một tầm mắt. */
    if (e?.battle) return '<div class="screen-grid combat-grid exploration-grid battle-grid">' + battlePanel(e) + journalCard() + '</div>';
    return '<div class="screen-grid combat-grid exploration-grid">' + zoneCard() + journalCard() + '</div>';
  }

  function update() {
    const s = UI.s(), journey = s.exploration?.active, clock = $('explorationCountdown');
    if (journey && clock) {
      const left = journey.battle ? Math.max(0, journey.battle.remaining || 0) : Math.max(0, journey.end - UI.session.serverNow());
      const remaining = Math.ceil(left / 1000);
      clock.textContent = String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0');
      const bar = $('explorationProgress');
      if (bar) bar.style.width = (100 - remaining / 6).toFixed(1) + '%';
    }
    const journal = $('combatJournal');
    if (journal) journal.innerHTML = s.logs.slice(0, 24)
      .map(v => '<div><time>✦</time>' + esc(v) + '</div>').join('');
  }

  // Không còn yêu thú, thanh kỹ năng hay tự chiến trên sân khấu Lịch luyện.
  UI.skillDock = { update() { const el = $('skillDock'); if (el) el.hidden = true; } };
  UI.combatFx = { sync() {} };

  /* Chữ ký bị giữ nguyên trong lúc diễn hoạt để tick mỗi giây không vẽ lại
     bảng trận giữa chừng. Sau khi diễn hoạt xong, tick kế tiếp sẽ làm mới. */
  let heldSignature = '';
  const signatureNow = () => {
    const s = UI.s(), e = s.exploration?.active, b = e?.battle;
    return [s.craftQueue.length, s.dungeon?.active?.end, s.dungeon?.run?.id, s.zone, e?.start || 0, e?.end || 0, e?.kind || '', e?.choice ?? -1, s.tamMa || 0, s.exploration?.last?.end || 0,
      b ? [b.state, b.turn, Math.round(b.enemyHp), b.intent, b.healCd, b.powerCd, Math.round(s.hp), Math.round(s.mp), JSON.stringify(b.cd || {})].join(',') : '',
      s.logs[0] || '', s.logs.length, s.adventurePoints || 0].join('|');
  };

  UI.register({
    id: 'combat', label: 'Lịch luyện', icon: 'ICON-MENU-002', eyebrow: 'LỊCH LUYỆN',
    render: panel, panel, update,
    mount() { UI.battleFx?.mount?.(); },
    signature: () => {
      if (UI.battleFx?.busy?.()) return heldSignature;
      heldSignature = signatureNow();
      return heldSignature;
    }
  });

  UI.action('exploreStart', async () => {
    const result = await UI.command('startExploration');
    UI.toast('Đã khởi hành đến ' + H.ZONES[UI.s().zone].name + ' · hẹn trở về sau 10 phút.',
      { type: 'gold', title: 'Lịch luyện' });
    UI.go('combat');
    // Rerender ngay để vô hiệu hóa nút khởi hành và bộ chọn nơi, không chờ tick tiếp theo.
    // Cuộn về đầu để người chơi thấy ngay sự kiện vừa gặp, vì nút Khởi hành nằm cuối danh sách địa điểm.
    const reveal = () => { const body = $('explorationCountdown')?.closest('.win-body'); if (body) body.scrollTop = 0; };
    reveal(); setTimeout(reveal, 0);
  });
  UI.action('exploreChoice', async (el, d) => {
    const e = UI.s().exploration?.active, option = (H.EXPLORE_CHOICES || {})[e?.kind]?.[Number(d.index)];
    await UI.command('exploreChoice', { index: Number(d.index) });
    UI.toast('Đã chọn "' + (option?.label || 'ứng phó') + '".' + (option?.id === 'fight' ? ' Giao chiến bắt đầu!' : ' Kết quả sẽ có khi chuyến đi kết thúc.'), { type: 'info', title: 'Lịch luyện' });
  });
  /* Mỗi lượt là một lệnh riêng; UI đọc lại state sau khi server xác nhận. */
  UI.action('battleAct', async (el, d) => {
    const action = d.action;
    if (!action) throw Error('Hành động không hợp lệ.');
    const payload = { action };
    if (d.code) payload.code = d.code;
    if (action !== 'continue') {
      if (UI.battleFx?.busy?.()) {
        UI.toast('Chiêu thức đang thi triển, hãy chờ một nhịp.', { type: 'info', title: 'Giao chiến' });
        return UI.KEEP;
      }
      UI.battleFx?.capture?.();
    }
    let out;
    try {
      out = await UI.command('battleAct', payload);
    } catch (error) {
      UI.battleFx?.cancel?.();
      throw error;
    }
    if (!out) return UI.KEEP;
    if (action !== 'continue') UI.battleFx?.resolve?.(out, action, d.code);
    if (out.won) UI.toast('Thắng lợi! Chiến lợi phẩm đã vào túi.', { type: 'gold', title: 'Giao chiến' });
    else if (out.fled) UI.toast('Đã rút lui an toàn.', { type: 'info', title: 'Giao chiến' });
    else if (out.state === 'lost') UI.toast('Đạo thân đã tọa hóa trong giao chiến.', { type: 'danger', title: 'Giao chiến' });
  });
  /* Chuyển nhóm công cụ trong bảng trận. */
  UI.action('battleLog', () => { UI.view.battleLog = UI.view.battleLog === false; });
  UI.action('battleTool', (el, d) => {
    if (!['manual', 'artifact', 'item'].includes(d.tool)) return UI.KEEP;
    UI.view.battleTool = d.tool;
  });
  UI.action('travel', async (el, d) => {
    if (UI.s().exploration?.active) throw Error('Chuyến lịch luyện chưa kết thúc; chưa thể đổi địa điểm.');
    const zone = Number(d.index);
    await UI.command('travel', { zone });
    UI.toast('Đã chọn ' + H.ZONES[zone].name + ' để lịch luyện.', { type: 'info', title: 'Bí cảnh' });
  });
})(typeof window !== 'undefined' ? window : globalThis);
