/* HƯ GIỚI · LỊCH LUYỆN: chọn nơi, ghi chép và đếm ngược mười phút. */
(function (root) {
  'use strict';
  const H = root.HU_GAME, F = H.F, UI = root.HU_UI;
  const { $, esc, num, btn, card } = UI.kit;

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

  /* Bảng điều khiển giao chiến theo lượt. Chỉ số đọc từ engine để nhãn, hồi chiêu
     và chi phí linh lực luôn khớp với luật thật. */
  function battlePanel(e) {
    const s = UI.s(), g = UI.g(), b = e.battle, B = H.BATTLE;
    const st = g.stats(), maxMp = g.maxMp(), active = b.state === 'active';
    const ratio = b.enemyMax > 0 ? b.enemyHp / b.enemyMax : 0, heavy = b.intent === 'heavy';
    const kindLabel = (H.BATTLE_LABELS || {})[s.enemyKind] || 'Yêu thú';
    const phase = active ? g.battlePhase(g.battleEnemy(), ratio) : 1;
    const statuses = arr => arr && arr.length
      ? `<div class="battle-statuses">${arr.map(x => `<span class="battle-status">${esc(x.type)} · ${x.turns} lượt</span>`).join('')}</div>` : '';
    const manuals = (s.activeManuals || []).filter(k => H.MANUALS.school(H.item(k)) === 'ngoai').map(k => {
      const x = H.item(k), cd = b.cd?.['m:' + k] || 0;
      return btn(`${esc(x.name)}<small>${cd > 0 ? 'còn ' + cd + ' lượt' : 'Công pháp ngoại tu'}</small>`, 'battleAct', `data-action="manual" data-code="${esc(k)}"`, !active || cd > 0, 'btn-outline');
    }).join('');
    const artifacts = (s.equipment || []).filter(k => H.DESIGN.effects[H.item(k)?.code]?.['điều kiện kích hoạt'] === 'khi kích hoạt').map(k => {
      const x = H.item(k), cd = b.cd?.['a:' + k] || 0;
      return btn(`${esc(x.name)}<small>${cd > 0 ? 'còn ' + cd + ' lượt' : 'Kích hoạt pháp bảo'}</small>`, 'battleAct', `data-action="artifact" data-code="${esc(k)}"`, !active || cd > 0, 'btn-outline');
    }).join('');
    const pillKinds = { HOI_PHUC: 1, HOI_HP: 1, HOI_MP: 1, GIAI_DOC: 1, KHANG_HIEU_UNG: 1, CHIEN_DAU: 1, KIEP: 1 };
    const items = Object.entries(s.bag).filter(([code, n]) => {
      const x = H.item(code);
      if (!x || !n || x.tier > s.realm + 1) return false;
      return x.kind === 'PILL' ? !!pillKinds[x.effect] : x.kind === 'TAL';
    }).sort((a, b2) => (H.item(b2[0])?.tier || 0) - (H.item(a[0])?.tier || 0)).slice(0, 8).map(([code, n]) => {
      const x = H.item(code), hint = UI.kit.pillEffectText?.(x, s) || x.effect || 'Dùng ngay';
      return btn(`${esc(x.name)} ×${n}<small>${esc(hint)}</small>`, 'battleAct', `data-action="item" data-code="${esc(code)}"`, !active, 'btn-outline');
    }).join('');
    const result = !active ? `<div class="battle-result ${esc(b.state)}" role="status">
      <b>${b.state === 'won' ? 'Thắng lợi' : b.state === 'fled' ? 'Đã rút lui' : 'Thất bại'}</b>
      <p>${esc(b.result || e.text)}</p>
      <p class="info-note battle-summary">Đã trải qua ${Math.max(1, b.turn)} lượt · địch còn ${Math.round(Math.max(0, b.enemyHp) / Math.max(1, b.enemyMax) * 100)}% sinh lực.</p>
      ${b.state === 'lost' ? '<p class="info-note">Đạo thân đã tọa hóa. Hãy trở về Khởi Nguyên để bắt đầu kiếp mới.</p>'
        : btn('Tiếp tục lịch luyện', 'battleAct', 'data-action="continue"', false, 'btn-gold')}
    </div>` : '';
    const skill = (label, action, hint, off, style, key) => btn(`${label}${key ? ' <kbd class="battle-key">' + key + '</kbd>' : ''}<small>${hint}</small>`, 'battleAct',
      `data-action="${action}"${key ? ' aria-keyshortcuts="' + key + '"' : ''}`, off, style);
    const lastLogs = (b.log || []).slice(0, 4);
    const foeSprite = (root.HU_ASSETS?.enemySrc ? root.HU_ASSETS.enemySrc(s.zone, s.enemyKind, 'dung_yen', 0) : '');
    const boss = String(s.enemyKind).startsWith('boss');
    const remain = Math.max(0, Math.ceil((b.remaining || 0) / 1000));
    const clock = String(Math.floor(remain / 60)).padStart(2, '0') + ':' + String(remain % 60).padStart(2, '0');
    const body = `<div class="exploration-clock battle-clock" role="timer" aria-label="Thời gian lịch luyện còn lại, đang tạm dừng">
        <span>Thời gian trở về · tạm dừng khi giao chiến</span><strong id="explorationCountdown">${clock}</strong>
        <div class="meter-bar" aria-hidden="true"><i id="explorationProgress" style="width:${(100 - remain / 6).toFixed(1)}%"></i></div>
      </div>
      <div class="battle-arena ${boss ? 'boss' : ''}">
        <div class="battle-foe">
          <img id="battleFoeSprite" class="battle-foe-sprite" src="${esc(foeSprite)}" alt="${esc(e.name)} đang đối đầu" decoding="async">
          <div class="battle-foe-body">
            <p class="battle-foe-name">${esc(e.name)} <span class="battle-foe-tag">${esc(kindLabel)}</span></p>
            ${meter('Địch', b.enemyHp, b.enemyMax, 'hp')}${statuses(b.enemyStatuses)}
          </div>
        </div>
        <div id="battleVfx" class="battle-vfx" aria-hidden="true"></div>
      </div>
      <p class="run-intent ${heavy ? 'heavy' : ''}" role="status">${active
        ? heavy ? '⚠ ' + esc(e.name) + ' dồn sức tung đòn nặng — thủ thế giảm ' + Math.round(B.guardCut * 100) + '% sát thương.'
          : esc(e.name) + ' chuẩn bị tung đòn thường.'
        : 'Trận chiến đã kết thúc.'}${active && boss ? ' <small>Giai đoạn ×' + phase.toFixed(2) + ' · ' + esc(kindLabel) + '</small>' : ''}</p>
      <div class="battle-vitals" id="battleSelf">${meter('Sinh lực', s.hp, st.HP, 'hp')}${meter('Linh lực', s.mp, maxMp, 'mp')}</div>
      ${b.shield > 0 || b.damageCut > 0 ? '<p class="info-note battle-shield">' +
        (b.shield > 0 ? 'Hộ thuẫn: ' + num(b.shield) : '') +
        (b.damageCut > 0 ? (b.shield > 0 ? ' · ' : '') + 'Giảm ' + Math.round(b.damageCut * 100) + '% sát thương nhận' : '') + '</p>' : ''}${statuses(b.statuses)}
      <div class="battle-log" role="log" aria-live="polite" aria-label="Diễn biến lượt đánh">
        <b>Diễn biến</b>
        <ol class="run-log">${lastLogs.map(v => `<li>${esc(v)}</li>`).join('')}</ol>
      </div>
      ${active ? `<div class="run-actions action-group">
        ${skill('Tấn công', 'attack', 'Sát thương cơ bản', false, 'btn-gold', '1')}
        ${skill('Trọng kích ×2,2', 'power', b.powerCd > 0 ? 'còn ' + b.powerCd + ' lượt' : Math.round(B.powerMp * 100) + '% linh lực', b.powerCd > 0 || s.mp < maxMp * B.powerMp, 'btn-gold', '2')}
        ${skill('Thủ thế', 'guard', 'Giảm ' + Math.round(B.guardCut * 100) + '% sát thương nhận', false, 'btn-outline', '3')}
        ${skill('Hồi phục', 'heal', b.healCd > 0 ? 'còn ' + b.healCd + ' lượt' : Math.round(B.healPct * 100) + '% HP · ' + Math.round(B.healMp * 100) + '% MP', b.healCd > 0 || s.mp < maxMp * B.healMp || s.hp >= st.HP, 'btn-outline', '4')}
      </div>
      <details class="battle-extra">
        <summary>Công pháp · Pháp bảo · Vật phẩm</summary>
        <div class="battle-tools">
          <div class="battle-tool-group"><b>Ngoại tu</b>${manuals || '<small>Chưa đặt công pháp ngoại tu.</small>'}</div>
          <div class="battle-tool-group"><b>Pháp bảo</b>${artifacts || '<small>Không có pháp bảo kích hoạt.</small>'}</div>
          <div class="battle-tool-group"><b>Vật phẩm</b>${items || '<small>Không có đan/phù dùng trong trận.</small>'}</div>
        </div>
      </details>
      <div class="action-group">${skill('Rút lui', 'flee', '~' + Math.round((B.flee || .55) * 100) + '% thành công', false, 'btn-outline')}</div>` : result}`;
    return card('Giao chiến · ' + esc(e.name), body, {
      eyebrow: active ? 'LƯỢT ' + b.turn + ' · ' + kindLabel : 'KẾT QUẢ · ' + kindLabel, cls: 'battle-panel run-panel'
    });
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
  UI.register({
    id: 'combat', label: 'Lịch luyện', icon: 'ICON-MENU-002', eyebrow: 'LỊCH LUYỆN',
    render: panel, panel, update,
    signature: () => {
      const s = UI.s(), e = s.exploration?.active, b = e?.battle;
      return [s.craftQueue.length,s.dungeon?.active?.end,s.dungeon?.run?.id,s.zone, e?.start || 0, e?.end || 0, e?.kind || '', e?.choice ?? -1, s.tamMa || 0, s.exploration?.last?.end || 0,
        b ? [b.state, b.turn, Math.round(b.enemyHp), b.intent, b.healCd, b.powerCd, Math.round(s.hp), Math.round(s.mp), JSON.stringify(b.cd || {})].join(',') : '',
        s.logs[0] || '', s.logs.length, s.adventurePoints || 0].join('|');
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
    const out = await UI.command('battleAct', payload);
    if (!out) return;
    /* Hành động chạy xong mới tới lượt refresh của shell; hoãn hiệu ứng một nhịp
       để không bị lần vẽ lại bảng trận xóa mất. */
    root.setTimeout(() => {
      const foe = $('battleFoeSprite') || $('enemySprite');
      if (out.dealt > 0) {
        UI.vfx?.float('−' + num(out.dealt), 'battleFoe', 'skill');
        if (foe && foe.id === 'battleFoeSprite') { foe.classList.remove('hurt'); void foe.offsetWidth; foe.classList.add('hurt'); }
      }
      if (out.healed > 0) UI.vfx?.float('+' + num(out.healed), 'battleSelf', 'heal');
      if (out.taken > 0) UI.vfx?.float('−' + num(out.taken), 'battleSelf');
      if (out.taken > 0) UI.heroAttack?.();
    }, 60);
    if (out.won) UI.toast('Thắng lợi! Chiến lợi phẩm đã vào túi.', { type: 'gold', title: 'Giao chiến' });
    else if (out.fled) UI.toast('Đã rút lui an toàn.', { type: 'info', title: 'Giao chiến' });
  });
  UI.action('travel', async (el, d) => {
    if (UI.s().exploration?.active) throw Error('Chuyến lịch luyện chưa kết thúc; chưa thể đổi địa điểm.');
    const zone = Number(d.index);
    await UI.command('travel', { zone });
    UI.toast('Đã chọn ' + H.ZONES[zone].name + ' để lịch luyện.', { type: 'info', title: 'Bí cảnh' });
  });
})(typeof window !== 'undefined' ? window : globalThis);
