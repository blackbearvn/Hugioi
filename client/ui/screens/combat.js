/* HƯ GIỚI · LỊCH LUYỆN: chọn nơi, ghi chép và đếm ngược mười phút. */
(function (root) {
  'use strict';
  const H = root.HU_GAME, F = H.F, A = root.HU_ASSETS, UI = root.HU_UI;
  const { $, esc, num, btn, card, abs, pct } = UI.kit;

  /* ======================================================================
     SẢNH LỊCH LUYỆN
     Chọn nơi đến ở cột trái, điểm đến đang chọn ở cột phải. Giao chiến diễn ra ở trang riêng
     (battle-page.js); sảnh chỉ còn việc chuẩn bị, theo dõi chuyến đi và nhật ký.
     ====================================================================== */
  const fmtClock = sec => String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  const zoneArt = id => `style="--zone-art:url('${esc(abs(A?.zoneBg?.(id) || A?.BG?.combat || ''))}')"`;

  function resumeBanner(e) {
    const b = e.battle, active = b.state === 'active';
    return `<div class="lt-resume${active ? '' : ' is-over'}" role="status">
      <div><b>${active ? 'Đang giao chiến với ' + esc(e.name) : 'Trận vừa kết thúc'}</b>
      <p>${active ? 'Đồng hồ chuyến đi tạm dừng cho đến khi phân thắng bại.' : 'Xem kết quả rồi tiếp tục chuyến đi.'}</p></div>
      ${btn(active ? 'Quay lại trận' : 'Xem kết quả', 'battlePageResume', '', false, 'btn-gold')}</div>`;
  }

  function journeyBlock(journey) {
    const now = UI.session.serverNow();
    const remain = journey.battle ? Math.max(0, Math.ceil((journey.battle.remaining || 0) / 1000)) : Math.max(0, Math.ceil((journey.end - now) / 1000));
    return `<section class="lt-journey" aria-label="Chuyến đi hiện tại">
      <div class="lt-clock" role="timer" aria-label="Thời gian lịch luyện còn lại">
        <span>Còn lại</span><strong${journey.battle ? '' : ' id="explorationCountdown"'}>${fmtClock(remain)}</strong>
        <div class="lt-line" aria-hidden="true"><i${journey.battle ? '' : ' id="explorationProgress"'} style="width:${(100 - remain / 6).toFixed(1)}%"></i></div>
      </div>
      ${journey.battle ? resumeBanner(journey) : eventBlock()}
    </section>`;
  }

  function destination(z, journey, blocked) {
    const locked = z.realm > UI.s().realm;
    return `<aside class="lt-dest" ${zoneArt(z.id)} aria-label="Điểm đến đã chọn">
      <div class="lt-dest-body">
        <h3>${esc(z.name)}</h3>
        <p>${esc(z.desc)}</p>
        <dl class="lt-facts">
          <div><dt>Thời gian</dt><dd>10 phút</dd></div>
          <div><dt>Phần thưởng</dt><dd>${H.EXPLORE_POINTS} điểm lịch luyện</dd></div>
          <div><dt>Gặp trên đường</dt><dd>Yêu thú, đạo hữu, kỳ duyên</dd></div>
        </dl>
        ${blocked && !journey ? `<p class="lt-warn">${esc(blocked)}</p>` : ''}
        ${journey ? '<p class="lt-note">Đang đi. Kết thúc chuyến mới đổi được nơi đến.</p>'
          : btn(locked ? 'Chưa đủ cảnh giới' : 'Khởi hành', 'exploreStart', '', !!blocked || locked, 'btn-gold lt-go')}
      </div>
    </aside>`;
  }

  function lobby() {
    const s = UI.s(), journey = s.exploration?.active, blocked = root.HU_COMMANDS?.activityConflict(s, 'startExploration');
    const here = H.ZONES[s.zone] || H.ZONES[0];
    const rows = H.ZONES.map(z => {
      const locked = z.realm > s.realm;
      return `<li><button type="button" class="zone-row${z.id === s.zone ? ' on' : ''}${locked ? ' is-locked' : ''}" data-act="travel" data-index="${z.id}"
        ${journey || locked ? 'disabled' : ''} aria-pressed="${z.id === s.zone}" ${zoneArt(z.id)}>
        <span class="zr-art" aria-hidden="true"></span>
        <span class="zr-text"><b>${esc(z.name)}</b><small>${locked ? 'Mở ở ' + esc(F.REALMS[z.realm]) : esc(F.REALMS[z.realm])}</small></span>
      </button></li>`;
    }).join('');
    return `<div class="lt">
      <header class="lt-head">
        <div><h3>Lịch luyện</h3><p>Mỗi chuyến mười phút. Có thể gặp yêu thú chặn đường, đạo hữu hoặc một kỳ duyên.</p></div>
        <p class="lt-points"><b>${num(s.adventurePoints || 0)}</b><span>điểm lịch luyện, dùng để mượn sách ở Tàng Kinh Các</span></p>
      </header>
      ${journey ? journeyBlock(journey) : ''}
      <div class="lt-body">
        <ul class="lt-zones" aria-label="Nơi lịch luyện">${rows}</ul>
        ${destination(here, journey, blocked)}
      </div>
      <section class="lt-journal"><h4>Nhật ký</h4><div class="journal" id="combatJournal" aria-live="polite"></div></section>
    </div>`;
  }

  /* Sự kiện ngẫu nhiên của chuyến đi hiện tại: quái, NPC hoặc kỳ duyên địa bảo.
     Quái và NPC cho chọn cách ứng phó; kết quả chỉ được tính khi hết chuyến. */
  const EVENT_LABELS = { monster: 'Yêu thú chặn đường', npc: 'Gặp gỡ đạo hữu', encounter: 'Kỳ duyên địa bảo' };
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
     SÂN KHẤU
     Hoạt ảnh nằm ở client/ui/battle-stage.js, dùng chung với Bí cảnh và PvP.
     Ở đây chỉ cấp ảnh nhân vật, ảnh yêu thú theo địa điểm và thanh máu hiện tại.
     ====================================================================== */
  const heroFrameSrcs = action => {
    const s = UI.s();
    return (A?.preloadHero?.(s.gender, s.realm, action) || []).map(im => im && im.src).filter(Boolean);
  };
  const enemyFrameSrcs = (action, fallback) => {
    const s = UI.s(), n = A?.enemyFrames?.(s.zone, s.enemyKind, action) || fallback;
    return Array.from({ length: n }, (_, i) => A.enemySrc(s.zone, s.enemyKind, action, i));
  };
  const reduced = () => !!UI.isReduced?.() || UI.s()?.settings?.combatEffects === false;
  const stage = UI.stage.create({
    heroFrames: heroFrameSrcs,
    heroIdleMs: () => A.heroFrameMs(UI.s().gender, 'dung_chien'),
    foeFrames: action => enemyFrameSrcs(action, action === 'tu_vong' ? 4 : 3),
    foeIdle: step => { const s = UI.s(), n = A?.enemyFrames?.(s.zone, s.enemyKind, 'dung_yen') || 3; return A.enemySrc(s.zone, s.enemyKind, 'dung_yen', Math.floor(step / 3) % n); },
    active: () => UI.s().exploration?.active?.battle?.state === 'active',
    snapshot: () => {
      const s = UI.s(), b = s.exploration?.active?.battle;
      const maxHp = UI.g().stats().HP, maxMp = UI.g().maxMp();
      return {
        hp: maxHp > 0 ? Math.max(0, Math.min(1, s.hp / maxHp)) : 0,
        mp: maxMp > 0 ? Math.max(0, Math.min(1, s.mp / maxMp)) : 0,
        enemy: b?.enemyMax > 0 ? Math.max(0, Math.min(1, b.enemyHp / b.enemyMax)) : 0
      };
    }
  });

  /* ======================================================================
     TỰ ĐỘNG GIAO CHIẾN
     Mỗi lượt vẫn là một lệnh battleAct riêng; chỉ việc chọn hành động được làm hộ.
     ====================================================================== */
  const auto = { ...UI.stage.autoKit.load(), timer: 0 };
  const manualCtx = () => {
    const s = UI.s(), g = UI.g(), b = s.exploration.active.battle, st = g.stats(), maxMp = g.maxMp();
    const manuals = (s.activeManuals || []).filter(k => H.MANUALS.school(H.item(k)) === 'ngoai').map(code => {
      const x = H.item(code), sk = H.MANUALS.skillOf(x);
      return sk ? { code, kind: sk.kind, cd: b.cd?.['m:' + code] || 0, mpCost: maxMp * sk.mpPct, damage: (sk.multiplier || 0) * g.manualPower(code) } : null;
    }).filter(Boolean);
    const artifacts = (s.equipment || []).filter(k => H.DESIGN.effects[H.item(k)?.code]?.['điều kiện kích hoạt'] === 'khi kích hoạt').map(code => {
      const d = H.DESIGN.effects[H.item(code).code];
      return { code, kind: d['hiệu ứng'] === 'hồi máu' ? 'heal' : 'guard', cd: b.cd?.['a:' + code] || 0 };
    });
    const restores = x => x.kind !== 'PILL' ? null : x.effect === 'HOI_MP' ? 'mp' : ['HOI_PHUC', 'HOI_HP'].includes(x.effect) ? 'hp' : null;
    const items = Object.entries(s.bag).map(([code, n]) => ({ code, n, x: H.item(code) }))
      .filter(i => i.x && i.n > 0 && i.x.tier <= s.realm + 1 && restores(i.x))
      .sort((a, c) => (a.x.tier - c.x.tier) || (a.n - c.n))
      .map(i => ({ code: i.code, n: i.n, restores: restores(i.x) }));
    return { mode: 'explore', battle: H.BATTLE, over: b.state !== 'active', hp: s.hp, maxHp: st.HP, mp: s.mp, maxMp,
      healCd: b.healCd, powerCd: b.powerCd, heavy: b.intent === 'heavy', manuals, artifacts, items };
  };
  const autoStop = () => { root.clearTimeout(auto.timer); auto.timer = 0; auto.on = false; };
  function autoTick() {
    root.clearTimeout(auto.timer); auto.timer = 0;
    if (!auto.on) return;
    const b = UI.s().exploration?.active?.battle;
    if (!b || b.state !== 'active' || !$('battleArena')) { autoStop(); return; }
    if (document.hidden || UI.battleFx?.busy?.()) { auto.timer = root.setTimeout(autoTick, 400); return; }
    const pick = root.HU_AUTO_BATTLE.choose(manualCtx(), auto);
    if (!pick) { autoStop(); return; }
    const el = document.querySelector(`.battle-panel [data-act="battleAct"][data-action="${pick.action}"]${pick.code ? `[data-code="${CSS.escape(pick.code)}"]` : ''}`);
    /* Tự động đi qua đúng nút người chơi bấm, nên mọi kiểm tra và hiệu ứng đều giống nhau. */
    if (el && !el.disabled) el.click();
    else if (pick.action !== 'attack') { const atk = document.querySelector('.battle-panel [data-action="attack"]'); if (atk && !atk.disabled) atk.click(); }
    auto.timer = root.setTimeout(autoTick, 900);
  }

  UI.battleFx = {
    /* Ghi lại thanh máu trước khi lệnh chạy để lát nữa chạy mượt tới giá trị mới. */
    capture() { stage.capture(); },
    cancel() { stage.cancel(); },
    resolve(out, action, code) {
      const item = code ? H.item(code) : null;
      const design = code ? H.DESIGN?.effects?.[code] : null;
      stage.queue({
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
        crit: !!out?.crit, takenCrit: !!out?.takenCrit,
        counter: !!out?.counter,
        won: !!out?.won, fled: !!out?.fled, state: out?.state || 'active'
      });
    },
    busy: stage.busy,
    mount() {
      stage.mount();
      /* Sân đã đổi (hết trận, rời màn) thì ngừng tự động; còn trận thì tiếp tục nhịp. */
      if (auto.on && !auto.timer) auto.timer = root.setTimeout(autoTick, 700);
      if (!$('battleArena')) autoStop();
    }
  };

  /* ======================================================================
     BẢNG GIAO CHIẾN
     ====================================================================== */
  const { vital, chipRow } = UI.stage;
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
    const heroSrc = A?.heroSrc?.(s.gender, s.realm, 'dung_chien', 0) || '';
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
        ${UI.stage.autoKit.html(auto)}
        <span class="battle-note">${auto.on ? 'Tự chọn chiêu mỗi lượt · bấm Tự động để dừng' : 'Mỗi lượt một hành động · phím 1–4'}</span>
        ${btn('Rút lui · ' + Math.round((B.flee || .55) * 100) + '%', 'battleAct', 'data-action="flee"', false, 'btn-outline btn-sm')}
      </div>
    </div>` : '';

    const logOpen = UI.view.battleLog !== false, lines = (b.log || []).slice(0, 4);
    const latest = lines[0] || e.text || '';
    return `<section class="battle-panel${boss ? ' boss' : ''}${active ? '' : ' is-over'}" aria-label="Giao chiến với ${esc(e.name)}">
      ${UI.stage.arenaHtml({
        boss, bg, mode: 'explore', over: !active, beaten: b.state === 'won',
        hero: { name: s.name, sub: g.realmLabel(), hp: s.hp, max: st.HP, mp: s.mp, maxMp, src: heroSrc, alt: s.name + ' đang giao chiến', chips: buffChips(b) + statusChips(b.statuses) },
        foe: { tag: kindLabel, name: e.name, sub: level, hp: b.enemyHp, max: b.enemyMax, src: foeSrc, alt: e.name + ' đang đối đầu', chips: statusChips(b.enemyStatuses) },
        center: {
          round: b.turn,
          clock: `<span class="battle-clock" role="timer" aria-label="Thời gian lịch luyện còn lại, tạm dừng khi giao chiến">
              <b id="explorationCountdown">${clock}</b>
              <span class="battle-clock-bar" aria-hidden="true"><i id="explorationProgress" style="width:${(100 - remain / 6).toFixed(1)}%"></i></span>
            </span>`,
          kind: active && boss ? `<span class="battle-kind">Giai đoạn ×${phase.toFixed(2)}</span>` : ''
        },
        telegraph: active ? `<p class="battle-telegraph${heavy ? ' heavy' : ''}" role="status">
          <i class="battle-pip" aria-hidden="true"></i>
          <b>${esc(e.name)}</b> chuẩn bị ${heavy ? 'đòn nặng' : 'đòn thường'}${heavy ? ' · thủ thế giảm ' + Math.round(B.guardCut * 100) + '%' : ''}
        </p>` : '',
        ticker: latest
      })}
      <div class="battle-side">
      ${verdict}
      ${command}
      <div class="battle-log${logOpen ? ' is-open' : ''}">
        <button type="button" class="battle-log-head" data-act="battleLog" aria-expanded="${logOpen}">Diễn biến<i aria-hidden="true">${logOpen ? '▾' : '▸'}</i></button>
        ${logOpen ? `<ol class="run-log" role="log" aria-live="polite" aria-label="Diễn biến lượt đánh">${lines.map(v => `<li>${esc(v)}</li>`).join('')}</ol>` : ''}
      </div>
      </div>
    </section>`;
  }

  function eventBlock() {
    const s = UI.s(), e = s.exploration?.active;
    if (!e) return '';
    const options = (H.EXPLORE_CHOICES || {})[e.kind], chosen = e.choice >= 0, tamMaMax = H.TAM_MA_MAX || 100;
    const choices = options ? `<div class="event-choices ev-choices" role="group" aria-label="Cách ứng phó">${options.map((o, i) => `
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
      <span class="ev-kind">${EVENT_LABELS[e.kind] || 'Sự kiện'}</span><h3>${esc(e.name)}</h3>
      <p class="event-text">${esc(e.text)}</p>${choices}<p class="info-note">${note}</p></section>`;
  }

  /* Sảnh luôn là sảnh; trận đấu có trang riêng nên không còn lồng vào cửa sổ. */
  function panel() { return lobby(); }
  UI.exploreBattle = {
    html() { const e = UI.s().exploration?.active; return e?.battle ? battlePanel(e) : ''; },
    meta() { const s = UI.s(), e = s.exploration?.active; return e?.battle ? { title: e.name, sub: 'Lịch luyện tại ' + (H.ZONES[s.zone]?.name || '') } : null; }
  };

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
      .map(v => '<div>' + esc(v) + '</div>').join('');
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
  /* Bật/tắt tự động và hai công tắc phụ (dùng kỹ năng, dùng đan phù). */
  UI.action('battleAuto', (el, d) => {
    if (d.auto === 'on') {
      auto.on = !auto.on;
      if (!auto.on) autoStop();
      else auto.timer = root.setTimeout(autoTick, 300);
    } else if (d.auto === 'skills' || d.auto === 'items') {
      auto[d.auto] = !auto[d.auto];
      UI.stage.autoKit.save(auto);
    } else return UI.KEEP;
  });
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
