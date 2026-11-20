/* Các bảng mở rộng dùng chung cửa sổ Thế giới / Nhân vật. */
(function (root) {
  'use strict';
  const H = root.HU_GAME, F = H.F, UI = root.HU_UI, L = root.HU_LABELS;
  const { esc, num, moneyHTML, pct, duration, row, btn, card, empty, live, bar, img } = UI.kit;
  const element = i => i < 0 ? 'Vô hệ' : H.ELEMENT_NAMES[i];
  const color = i => root.HU_MERIDIANS?.HE_COLOR?.[H.ELEMENT_NAMES[i]] || '#b6c7dc';
  const signed = n => (n >= 0 ? '+' : '') + pct(n);
  /* Nhãn hệ/linh căn/tông môn/danh phận lấy màu từ client/ui/labels.js. */
  const elementLabel = (i, text = element(i)) => {
    if (!L) return esc(text);
    if (i < 0) return L.span(text, 'element', 'trungHoa');
    const key = H.ELEMENT_NAMES[i];
    return key ? L.span(text, 'element', key) : esc(text);
  };
  const rootLabelHtml = (type, sub, variant = 'name') => {
    const text = H.rootLabel(type, sub);
    if (!L) return esc(text);
    return type === 'Dị' && H.DI_LINH_CAN[sub]
      ? L.span(text, 'element', sub, { variant })
      : L.span(text, 'root', type, { variant });
  };
  const sectLabel = (sect, variant = 'name') => !L ? esc(sect?.name || 'Tông môn')
    : L.span(sect?.name || 'Tông môn', 'sect', sect?.id || 'generic', { variant });
  const roleLabel = (role, variant = 'name') => !L ? esc(role?.name || '')
    : L.span(role?.name || '', 'role', role?.id || 'guest', { variant });
  let measuredPlayer = null;
  const sectMeasured = () => !!UI.session?.playerId && measuredPlayer === UI.session.playerId;
  UI.sectMeasured = sectMeasured;
  const clock = a => `<progress class="adventure-progress" max="100" value="0" data-job-start="${a.start}" data-job-end="${a.end}" aria-label="Tiến độ chuyến đi"></progress>${row('Còn lại', live(a.end))}`;
  const date = at => new Date(at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  function dungeonResult(r) {
    const d = H.DUNGEONS.find(x => x.id === r.id);
    return `<section class="bc-last" aria-label="Kết quả chuyến gần nhất">
      <h4>${esc(d.name)}, ${r.floors}/${d.floors} tầng</h4>
      <p class="${r.success ? 'gold' : 'muted'}">${r.success ? 'Đã hạ ' + esc(d.boss) + '.' : 'Đã rút lui dưỡng thương.'}${r.first ? ' Thông quan lần đầu.' : ''}</p>
      <div class="bc-last-rows">${row(F.currency(UI.s().realm).name, moneyHTML(r.stone))}${row('Tu vi thực nhận', '+' + num(r.exp))}</div>
    </section>`;
  }
  /* Thanh chỉ số có nhãn chữ và vai trò meter để đọc được bằng trình đọc màn hình. */
  const meter = (label, value, max, cls) => {
    const v = Math.max(0, Math.min(max, value));
    return `<div class="run-meter"><span>${label}</span><div class="meter-bar ${cls}" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="${Math.round(max)}" aria-valuenow="${Math.round(v)}"><i style="width:${max > 0 ? v / max * 100 : 0}%"></i></div><b>${num(v)} / ${num(max)}</b></div>`;
  };
  /* ---- Sân khấu bí cảnh: dùng chung bộ diễn hoạt với Lịch luyện ---- */
  const A = root.HU_ASSETS;
  const dKind = (d, floor) => floor >= d.floors ? 'boss' : floor >= Math.ceil(d.floors * .6) ? 'tinh anh' : 'thường';
  const dZone = d => Math.max(0, Math.min((H.ZONES?.length || 1) - 1, d.realm));
  const runDungeon = () => { const run = UI.s().dungeon.run; return run ? { run, d: H.DUNGEONS.find(x => x.id === run.id) } : null; };
  const runStage = UI.stage.create({
    heroIdleMs: () => A.heroFrameMs(UI.s().gender, 'dung_chien'),
    heroFrames: action => { const s = UI.s(); return (A?.preloadHero?.(s.gender, s.realm, action) || []).map(im => im && im.src).filter(Boolean); },
    foeFrames: action => {
      const c = runDungeon(); if (!c) return [];
      const z = dZone(c.d), k = dKind(c.d, c.run.floor), n = A.enemyFrames(z, k, action) || 1;
      return Array.from({ length: n }, (_, i) => A.enemySrc(z, k, action, i));
    },
    foeIdle: step => {
      const c = runDungeon(); if (!c) return '';
      const z = dZone(c.d), k = dKind(c.d, c.run.floor);
      return A.enemySrc(z, k, 'dung_yen', Math.floor(step / 3) % (A.enemyFrames(z, k, 'dung_yen') || 1));
    },
    active: () => !!UI.s().dungeon.run,
    snapshot: () => {
      const s = UI.s(), g = UI.g(), run = s.dungeon.run, st = g.stats();
      return { hp: st.HP > 0 ? Math.max(0, Math.min(1, s.hp / st.HP)) : 0, mp: 0, enemy: run?.enemyMax > 0 ? Math.max(0, Math.min(1, run.enemyHp / run.enemyMax)) : 0 };
    }
  });
  const runAuto = { ...UI.stage.autoKit.load(), timer: 0 };
  const runAutoStop = () => { root.clearTimeout(runAuto.timer); runAuto.timer = 0; runAuto.on = false; };
  function runAutoTick() {
    root.clearTimeout(runAuto.timer); runAuto.timer = 0;
    if (!runAuto.on) return;
    const c = runDungeon();
    if (!c || !document.querySelector('.run-panel')) { runAutoStop(); return; }
    if (document.hidden || runStage.busy()) { runAuto.timer = root.setTimeout(runAutoTick, 400); return; }
    const s = UI.s(), g = UI.g(), st = g.stats();
    const pick = root.HU_AUTO_BATTLE.choose({ mode: 'dungeon', run: H.DUNGEON_RUN, hp: s.hp, maxHp: st.HP, mp: s.mp, maxMp: g.maxMp(),
      sta: c.run.sta, healCd: c.run.healCd, heavy: c.run.intent === 'heavy' }, runAuto);
    const el = pick && document.querySelector(`.run-panel [data-act="dungeonAct"][data-move="${pick.action}"]`);
    if (el && !el.disabled) el.click();
    else { const guard = document.querySelector('.run-panel [data-move="guard"]'); if (guard && !guard.disabled) guard.click(); else { runAutoStop(); return; } }
    runAuto.timer = root.setTimeout(runAutoTick, 1400);
  }
  /* Gọi sau mỗi lần vẽ lại màn có bảng chiến đấu bí cảnh. */
  function mountRun() {
    runStage.mount();
    if (!document.querySelector('.run-panel')) { runAutoStop(); return; }
    if (runAuto.on && !runAuto.timer) runAuto.timer = root.setTimeout(runAutoTick, 700);
  }

  function runPanel() {
    const s = UI.s(), g = UI.g(), run = s.dungeon.run, R = H.DUNGEON_RUN;
    if (!run) return '';
    const d = H.DUNGEONS.find(x => x.id === run.id), enemy = g.runEnemy(d, run.floor), st = g.stats();
    const phase = enemy.id ? H.DESIGN.phase(enemy.id, run.enemyHp / run.enemyMax) : null;
    const heavy = run.intent === 'heavy', mpCost = g.maxMp() * R.healMp;
    const pips = Array.from({ length: d.floors }, (_, i) => `<i class="${i < run.cleared ? 'done' : i + 1 === run.floor ? 'now' : ''}" aria-hidden="true"></i>`).join('');
    const act = (move, label, hint, off, style) => btn(`${label}<small>${hint}</small>`, 'dungeonAct', `data-move="${move}" aria-keyshortcuts="${['attack', 'power', 'guard', 'heal'].indexOf(move) + 1}"`, off, style);
    const zone = dZone(d), kind = dKind(d, run.floor);
    const arena = UI.stage.arenaHtml({
      boss: enemy.boss, mode: 'dungeon', bg: UI.kit.abs(A?.zoneBg?.(zone) || A?.BG?.combat || ''),
      hero: { name: s.name, sub: g.realmLabel(), hp: s.hp, max: st.HP, mp: s.mp, maxMp: g.maxMp(), src: A.heroSrc(s.gender, s.realm, 'dung_chien', 0), alt: s.name + ' đang giao chiến' },
      foe: { tag: enemy.boss ? 'Thủ lĩnh' : 'Hộ vệ', name: enemy.name, sub: 'Tầng ' + run.floor + '/' + d.floors, hp: run.enemyHp, max: run.enemyMax, src: A.enemySrc(zone, kind, 'dung_yen', 0), alt: enemy.name + ' đang đối đầu' },
      center: { round: run.turn + 1, kind: `<span class="battle-kind">Tầng ${run.floor}/${d.floors}</span>` },
      telegraph: `<p class="battle-telegraph${heavy ? ' heavy' : ''}" role="status"><i class="battle-pip" aria-hidden="true"></i><b>${esc(enemy.name)}</b> chuẩn bị ${heavy ? 'đòn nặng, thủ thế sẽ đỡ gần hết' : 'đòn thường'}</p>`,
      ticker: run.log[0] || ''
    });
    return `<section class="battle-panel dungeon-battle run-panel${enemy.boss ? ' boss' : ''}" aria-label="Chiến đấu trong ${esc(d.name)}, tầng ${run.floor}">
      ${arena}
      <div class="battle-side">
        <div class="run-floors" role="img" aria-label="Đã vượt ${run.cleared}/${d.floors} tầng">${pips}</div>
        ${enemy.boss ? '<p class="hu-dungeon-lore">' + esc(H.STORY.DUNGEONS[d.id]?.boss || '') + '</p>' : ''}
        ${phase ? '<p class="run-intent" role="status"><small>' + esc(phase['kỹ năng giai đoạn']) + '</small></p>' : ''}
        ${meter('Thể lực', run.sta, run.staMax, 'sta')}
        <div class="run-actions action-group">
          ${act('attack', 'Xuất chiêu', '−' + R.attack + ' thể lực', run.sta < R.attack, 'btn-gold')}
          ${act('power', 'Trọng kích ×2,2', '−' + R.power + ' thể lực', run.sta < R.power, 'btn-gold')}
          ${act('guard', 'Thủ thế', '+' + R.guardGain + ' thể lực, đỡ đòn', false, 'btn-outline')}
          ${act('heal', 'Hồi phục', run.healCd > 0 ? 'còn ' + run.healCd + ' lượt' : Math.round(R.healMp * 100) + '% linh lực', run.healCd > 0 || s.mp < mpCost, 'btn-outline')}
        </div>
        <div class="battle-footactions">
          ${UI.stage.autoKit.html(runAuto, { mode: 'dungeon', act: 'runAuto' })}
          ${btn('Rút lui giữ thưởng', 'dungeonRetreat', '', false, 'btn-outline btn-sm')}
        </div>
        <p class="info-note">Phím 1–4. Mỗi lượt hồi ${R.passiveGain} thể lực, qua tầng hồi thêm ${R.floorGain}. Sinh lực và linh lực không tự hồi trong bí cảnh. Tự động chỉ chọn giữa bốn chiêu này, chưa dùng được công pháp và đan phù.</p>
        <div class="battle-log is-open"><h4 class="battle-log-head">Diễn biến</h4>
          <ol class="run-log" aria-live="polite" aria-label="Diễn biến lượt đánh">${run.log.map(v => `<li>${esc(v)}</li>`).join('')}</ol></div>
      </div>
    </section>`;
  }
  /* Chữ ký trận bí cảnh: giữ nguyên khi chiêu đang diễn hoạt để nhịp tick không vẽ lại giữa chừng. */
  let heldRun = '';
  function runSignature() {
    if (runStage.busy() && heldRun) return heldRun;
    const s = UI.s(), r = s.dungeon.run;
    return heldRun = r ? [r.id, r.floor, r.turn, Math.round(r.enemyHp), Math.round(r.sta), r.healCd, r.intent, Math.round(s.hp), Math.round(s.mp), r.log[0], r.log.length, runAuto.on, runAuto.skills, runAuto.items].join('|') : '';
  }
  const runMeta = () => { const c = runDungeon(); return c ? { title: c.d.name, sub: 'Tầng ' + c.run.floor + ' trên ' + c.d.floors } : null; };

  function runBanner() {
    const c = runDungeon();
    if (!c) return '';
    return `<div class="lt-resume" role="status"><div><b>Đang ở tầng ${c.run.floor}/${c.d.floors} của ${esc(c.d.name)}</b>
      <p>Trận được giữ nguyên, sinh lực và thể lực không đổi khi bạn rời đi.</p></div>${btn('Quay lại trận', 'battlePageResume', '', false, 'btn-gold')}</div>`;
  }

  function dungeons() {
    const s = UI.s(), g = UI.g(), a = s.dungeon.active, active = H.DUNGEONS.find(d => d.id === a?.id), run = s.dungeon.run;
    const blocked = root.HU_COMMANDS?.activityConflict(s, 'startDungeon');
    const busy = !!a || !!run || !!s.sect.mission || !!blocked, hpOk = s.hp >= g.stats().HP * .5;
    const bonus = Math.round((H.DUNGEON_RUN.bonus - 1) * 100);
    const items = H.DUNGEONS.map(d => {
      const locked = s.realm < d.realm, r = s.dungeon.records[d.id], aff = g.affinity(d.element), off = locked || busy || !hpOk;
      const best = r?.best || 0, art = UI.kit.abs(A?.zoneBg?.(dZone(d)) || A?.BG?.combat || '');
      const ticks = Array.from({ length: d.floors }, (_, i) => `<i class="${i < best ? 'done' : ''}"></i>`).join('');
      return `<li class="bc-item${locked ? ' is-locked' : ''}${run?.id === d.id || a?.id === d.id ? ' is-live' : ''}" style="--zone-art:url('${esc(art)}');--el:${color(d.element)}">
        <div class="bc-art" aria-hidden="true"></div>
        <div class="bc-main">
          <h4>${esc(d.name)}</h4>
          <p class="bc-boss">Thủ lĩnh ${esc(d.boss)}</p>
          <p class="bc-desc">${esc(d.desc)}</p>
          <p class="hu-dungeon-lore">${esc(H.STORY.DUNGEONS[d.id]?.intro || '')}</p>
          <div class="bc-tags"><span>${elementLabel(d.element)}</span><span>${esc(F.REALMS[d.realm])}</span><span>${d.floors} tầng</span><span>${duration(d.seconds)} nếu để tự chạy</span></div>
        </div>
        <div class="bc-side">
          <div class="bc-record" role="img" aria-label="Kỷ lục ${best} trên ${d.floors} tầng">
            <div class="bc-ticks">${ticks}</div>
            <p><b>${best}/${d.floors}</b> tầng, ${r?.clears || 0} lần thông quan</p>
          </div>
          ${locked ? `<p class="bc-lock">Mở ở ${esc(F.REALMS[d.realm])}</p>` : `<p class="bc-meta">Tương khắc ${signed(aff)} sát thương. Dự kiến ${g.estimateDungeon(d.id)}/${d.floors} tầng.</p>`}
          <p class="bc-meta">${r?.clears ? 'Thủ lĩnh cho 1 đến ' + (d.floors >= 8 ? 3 : 2) + ' Tinh hoa.' : 'Thông quan đầu: thưởng ×2 và thêm 3 Tinh hoa.'}</p>
          <div class="bc-actions">${btn(locked ? 'Chưa mở' : run?.id === d.id ? 'Đang chiến đấu' : 'Thân chinh giao chiến', 'dungeonEnter', `data-id="${d.id}"`, off, 'btn-gold')}${locked ? '' : btn(a?.id === d.id ? 'Đang thám hiểm' : 'Khởi hành tự động', 'dungeonStart', `data-id="${d.id}"`, off, 'btn-outline')}</div>
        </div>
      </li>`;
    }).join('');
    return `<div class="bc">
      <header class="lt-head"><div><h3>Bí cảnh</h3>
        <p>Vượt từng tầng, hạ thủ lĩnh để thu Tinh hoa. Khởi hành tự động thì chuyến đi tự chạy khi bạn mở game, chiến lực chốt lúc xuất phát. Thân chinh giao chiến thì tự quản thể lực, thưởng thêm ${bonus}% và 1 Tinh hoa khi thông quan.</p></div></header>
      ${blocked && !a && !run ? '<p class="lt-warn">' + esc(blocked) + '</p>' : ''}
      ${runBanner()}
      ${active ? `<section class="bc-live"><h4>Đang thám hiểm ${esc(active.name)}</h4>${clock(a)}<p class="info-note">Thủ lĩnh tầng ${active.floors}: ${esc(active.boss)}</p>${btn('Rút lui', 'dungeonAbort', '', false, 'btn-outline')}</section>` : ''}
      ${s.dungeon.last ? dungeonResult(s.dungeon.last) : ''}
      ${s.sect.mission ? '<p class="lt-warn">Đang nhận nhiệm vụ tông môn. Hoàn tất hoặc hủy nhiệm vụ để vào bí cảnh.</p>' : !hpOk && !run ? '<p class="lt-warn">Cần 50% sinh lực để khởi hành. Bạn đang tự hồi phục.</p>' : ''}
      <ul class="bc-list" aria-label="Danh sách bí cảnh">${items}</ul>
    </div>`;
  }

  function encounters() {
    const e = UI.s().encounter;
    return `<p class="screen-lead">Cơ duyên sẽ hiển lộ khi một chuyến Lịch luyện gặp kỳ ngộ và kết thúc sau mười phút. Phúc Duyên giúp hành trình thêm thuận lợi, Vận Khí giúp tránh họa.</p>
      ${card('Dấu chân cơ duyên', row('Đã khám phá', Object.keys(e.journal).length + '/' + H.ENCOUNTERS.length) + row('Tổng kỳ ngộ', num(e.total)) + '<p class="info-note">Phần thưởng tự nhận và ghi vào Nhật ký tu tiên. Tu vi dừng ở ngưỡng đột phá.</p>')}
      ${card('Kỳ ngộ gần đây', e.recent.map(v => {
        const d = H.ENCOUNTERS.find(x => x.id === v.id), rarity = H.ENCOUNTER_RARITIES[d.rarity];
        return `<article class="encounter-entry"><header><b>${L ? L.span(d.name, 'encounter', rarity.name, { variant: 'name' }) : esc(d.name)}</b><small>${date(v.at)} · ${L ? L.span(rarity.name, 'encounter', rarity.name) : esc(rarity.name)}</small></header><p>${esc(v.text)}</p><p class="hu-dungeon-lore">${esc(H.STORY.ENCOUNTERS[v.id] || '')}</p></article>`;
      }).join('') || empty('Hãy bước vào Lịch luyện để tìm kiếm cơ duyên.'))}
      <details class="adventure-details"><summary>Sổ khám phá · ${Object.keys(e.journal).length}/${H.ENCOUNTERS.length}</summary><div class="adventure-grid">${H.ENCOUNTERS.map(d => {
        const seen = e.journal[d.id], rarity = H.ENCOUNTER_RARITIES[d.rarity];
        return `<article class="discovery ${seen ? '' : 'undiscovered'}"><small>${L ? L.span(rarity.name, 'encounter', rarity.name) : esc(rarity.name)}</small><h3>${seen ? d.name : 'Cơ duyên chưa biết'}</h3><p>${seen ? esc(d.desc) : 'Chờ thiên địa hé lộ.'}</p>${seen ? '<p class="hu-dungeon-lore">' + esc(H.STORY.ENCOUNTERS[d.id] || '') + '</p>' : ''}${seen ? '<small>Đã gặp ' + num(seen.count) + ' lần · ' + date(seen.lastAt) + '</small>' : ''}</article>`;
      }).join('')}</div></details>`;
  }

  function missionBoard() {
    const s = UI.s(), g = UI.g(), active = s.sect.mission, def = H.SECT_MISSIONS.find(x => x.id === active?.id), featured = g.featuredMission();
    const open = g.sectMissions(), all = g.sectMissions(true);
    const ready = active && active.end <= UI.session.serverNow();
    const task = def ? card(def.name, clock(active) + row('Thưởng cống hiến', '+' + Math.round(def.contribution * (active.featured ? 1.5 : 1))) +
      row('Thành công', pct(active.chance)) + (active.featured ? '<p class="gold">★ Nổi bật · thưởng ×1,5</p>' : '') +
      `<div class="action-group">${btn('Nhận thưởng', 'sectMissionClaim', '', !ready)}${btn('Hủy nhiệm vụ', 'sectMissionAbort', '', false, 'btn-outline')}</div>`, { eyebrow: ready ? 'Đã hoàn tất' : 'Đang thực hiện' }) : '';
    return task + card('Ủy thác tông môn', `<p class="info-note">Ủy thác thành công cũng nhận điểm lịch luyện bằng số cống hiến thực nhận, dùng để mượn sách tại Tàng Kinh Các.</p><div class="action-group">${btn(s.sect.repeat ? 'Tự lặp: Bật' : 'Tự lặp: Tắt', 'sectRepeat', `aria-pressed="${s.sect.repeat}"`, false, 'btn-outline')}</div>
      <p class="info-note">Tự lặp: tự nhận thưởng và làm lại khi đang chơi. Khi rời game chỉ hoàn tất một nhiệm vụ, không nhận chuyến mới. Thất bại sẽ tắt tự lặp.</p>
      ${s.dungeon.active ? '<p class="info-note">Đang trong bí cảnh; chờ trở về để nhận nhiệm vụ.</p>' : ''}
      ${[1, 2, 3, 4, 5].map(tier => {
        const list = all.filter(m => m.tier === tier);
        return `<details class="adventure-details" ${tier <= g.sectRank().tier ? 'open' : ''}><summary>Bậc ${tier} · ${list.filter(m => open.includes(m)).length}/${list.length} đã mở</summary><div class="mission-grid">` + list.map(m => {
          const locked = !open.includes(m), bonus = featured?.id === m.id;
          const blocked = locked || !!active || !!s.dungeon.active || s.hp < g.stats().HP * .4;
          return `<article class="mission-tile${locked ? ' is-locked' : ''}${bonus ? ' is-featured' : ''}">
            <header><h4>${esc(m.name)}</h4>${bonus ? '<b class="mission-badge">★ Nổi bật</b>' : locked ? '<b class="mission-badge">🔒 Chưa mở</b>' : ''}</header>
            <dl class="mission-stats"><div><dt>Thời gian</dt><dd>${duration(m.seconds)}</dd></div><div><dt>Thành công</dt><dd>${pct(g.missionChance(m))}</dd></div><div><dt>Cống hiến</dt><dd>+${Math.round(m.contribution * (bonus ? 1.5 : 1))}</dd></div></dl>
            <p class="mission-desc">${locked ? 'Cần bậc nhiệm vụ ' + m.tier + ' · ' + F.REALMS[m.minRealm] : esc(m.desc)}${bonus ? ' · thưởng ×1,5' : ''}</p>
            ${btn(locked ? 'Chưa mở' : 'Nhận', 'sectMissionStart', `data-id="${m.id}"`, blocked, locked ? 'btn-outline' : 'btn-gold')}</article>`;
        }).join('') + '</div></details>';
      }).join('')}`);
  }
  /* Kho tông môn: lưới ô vật phẩm giống Tàng bảo các; chạm ô để xem chi tiết và đổi. */
  function sectShop() {
    const s = UI.s(), g = UI.g();
    const cards = H.SECT_SHOP.filter(x => !x.sect || x.sect === s.sect.id).map(d => {
      const o = g.sectShopOffer(d.id), name = o.item?.name || d.name, id = 'sectshop:' + d.id;
      const cannot = o.locked || s.sect.contribution < o.cost;
      const meta = o.locked ? '🔒 ' + H.SECT_RANKS[d.rank].name : (o.item ? F.REALMS[o.item.tier] : H.SECT_RANKS[d.rank].name);
      UI.peek.set(id, { title: name, eyebrow: 'Kho tông môn', body: (o.item ? `<div class="shop-peek-art">${img(o.item.code)}</div>` : '') + row('Số lượng', '×' + d.count) + row('Giá cống hiến', num(o.cost)) +
        `<p class="info-note">${H.SECT_RANKS[d.rank].name}${o.item ? ' · ' + F.REALMS[o.item.tier] : ''}</p><div class="action-group">${btn('Đổi · ' + num(o.cost), 'sectBuy', `data-id="${d.id}"`, cannot, 'btn-gold btn-wide')}</div>` });
      return `<button type="button" class="shop-card${o.locked ? ' is-locked' : ''}" data-act="peek" data-peek="${esc(id)}" aria-label="${esc(name)} · ${esc(meta)} · ${num(o.cost)} cống hiến">
        <span class="shop-card-art">${o.item ? img(o.item.code) : '<span aria-hidden="true">◈</span>'}</span>
        <span class="shop-card-name">${esc(name)}${d.count > 1 ? ' ×' + d.count : ''}</span>
        <span class="shop-card-meta">${esc(meta)}</span>
        <span class="shop-card-price">${num(o.cost)} cống hiến</span></button>`;
    }).join('');
    return `<p class="screen-lead">Cống hiến khả dụng: <b>${num(s.sect.contribution)}</b>. Vật phẩm gần bậc hiện tại; giá tăng theo cảnh giới. Tiêu cống hiến không giảm chức vị.</p><div class="shop-grid sect-shop-grid">${cards}</div>`;
  }
  function libraryRecipe(x, g) {
    const requirement = F.REALMS[x.tier];
    if (x.kind === 'PILL') {
      const r = g.recipe(x.code);
      const herbs = Object.entries(r.herbs).map(([code, count]) => (H.item(code)?.name || code) + ' ×' + count).join(', ');
      return `<details class="sect-book-recipe"><summary>${esc(x.name)} <small>${esc(requirement)}</small></summary><p>${esc(x.description || '')}</p><p>Nguyên liệu: ${esc(herbs)} · ${moneyHTML(r.stone)} · ${duration(r.time)}</p></details>`;
    }
    if (x.kind === 'EQ' || x.kind === 'TAL') {
      const r = g.forgeRecipe(x.code);
      const materials = [(H.item(r.herb)?.name || 'Linh tài') + ' ×' + r.count, r.ink ? H.item(r.ink)?.name || r.ink : '', r.manual ? 'Cần lĩnh ngộ ' + (H.item(r.manual)?.name || r.manual) : ''].filter(Boolean).join(' · ');
      return `<details class="sect-book-recipe"><summary>${esc(x.name)} <small>${esc(requirement)}</small></summary><p>${esc(x.description || '')}</p><p>Nguyên liệu: ${esc(materials)} · ${moneyHTML(r.stone)}</p></details>`;
    }
    const herb = H.item(x.code.slice(5));
    const def = H.DESIGN.seedsByHerb[herb?.code];
    const growing = def ? 'Đất: ' + (def['điều kiện đất'] || 'bất kỳ') + ' · ' + def['thời gian trồng (phút)'] + ' phút' : 'Xem ô linh điền để biết điều kiện trồng.';
    return `<details class="sect-book-recipe"><summary>${esc(x.name)} <small>${esc(requirement)}</small></summary><p>Thu hoạch: ${esc(herb?.name || 'linh thảo')} · ${esc(growing)}</p></details>`;
  }
  function sectLibrary() {
    const s = UI.s(), g = UI.g(), points = s.adventurePoints || 0;
    const selected = H.SECT_BOOKS.find(b => b.id === s.borrowedBook);
    const shelves = H.SECT_BOOKS.map(book => {
      const current = selected?.id === book.id, locked = s.realm < book.minRealm;
      const label = current ? 'Đang mượn' : locked ? 'Cần ' + F.REALMS[book.minRealm] : 'Mượn · ' + num(book.cost) + ' điểm';
      return `<article class="sect-book"><div><span class="eyebrow">${esc(book.world)}</span><h3>${esc(book.name)}</h3><p>${locked ? 'Chưa đủ cảnh giới.' : current ? 'Bạn có thể đọc bên dưới.' : 'Mượn quyển này để xem công thức.'}</p></div>${btn(label, 'borrowSectBook', `data-id="${esc(book.id)}"`, current || locked || points < book.cost, 'btn-outline')}</article>`;
    }).join('');
    let reading = '';
    if (selected) {
      const entries = H.ITEMS.filter(x => x.kind === selected.kind && x.tier >= selected.minRealm && x.tier <= selected.maxRealm);
      reading = card('Đang đọc · ' + esc(selected.name), `<p>${entries.length} mục · bấm vào từng mục để xem chi tiết. Công thức chế tạo chỉ dùng được khi đang mượn đúng sách; cảnh giới và điều kiện nghề vẫn áp dụng.</p>${selected.kind === 'EQ' || selected.kind === 'TAL' ? '<p class="info-note">Luyện khí và chế phù mở ở Kết Đan; một số công thức cần bí tịch riêng.</p>' : ''}${selected.kind === 'PILL' ? '<button class="btn btn-outline" data-go="craft:dan">Đến Luyện đan</button>' : ['EQ','TAL'].includes(selected.kind) ? '<button class="btn btn-outline" data-go="craft:khi">Đến Luyện khí & Chế phù</button>' : '<button class="btn btn-outline" data-go="craft:dien">Đến Linh điền</button>'}<div class="sect-book-recipes">${entries.map(x => libraryRecipe(x,g)).join('')}</div>`, { eyebrow: 'Sách đang mượn' });
    }
    return `<section class="sect-library"><div class="sect-library-intro"><span class="eyebrow gold">Tàng kinh các</span><h3>Tri thức trên tiên lộ</h3><p>Điểm lịch luyện: <b>${num(points)}</b>. Nhận 20 điểm mỗi chuyến lịch luyện và thêm điểm khi hoàn thành ủy thác tông môn.</p><p>Mỗi lần mượn trả điểm; bạn giữ một quyển để đọc đến khi mượn quyển khác. Những lần mở lại quyển đang mượn không mất thêm điểm.</p></div>${reading}<div class="sect-book-grid">${shelves}</div></section>`;
  }
  function sectRite() {
    const s = UI.s(), g = UI.g(), seen = sectMeasured(), disciple = g.sectDisciple();
    const rootName = H.rootLabel(s.rootType, s.rootSub);
    const guide = H.DESIGN.npc.NPC001;
    const guideName = L ? L.span(guide?.['tên NPC'] || 'Người dẫn đường', 'role', 'npc', { variant: 'name' }) : esc(guide?.['tên NPC'] || 'Người dẫn đường');
    const result = seen && disciple ? `<div class="sect-rite-result" role="status"><span>Linh căn</span><strong>${rootLabelHtml(s.rootType, s.rootSub)}</strong><span>Danh phận nhập môn</span><b>${roleLabel(disciple)}</b>${s.sect.joined ? '<small>Danh phận được ghi nhận khi gia nhập.</small>' : '<small>Chọn tông môn để xác nhận danh phận.</small>'}</div>` : '<div class="sect-rite-prompt">Đặt tay lên bia đá để soi rõ linh căn.</div>';
    return `<section class="sect-rite" aria-label="Bia đo linh căn"><div class="sect-rite-top"><span class="eyebrow gold">Sơ nhập sơn môn</span><h2>Vấn Linh Đài</h2><p>Thiên địa làm chứng · một niệm khai linh</p></div>${result}<div class="sect-rite-bottom"><div class="sect-rite-guide"><img src="${esc(guide?.ảnh || '')}" alt="" loading="lazy"><p><b>${guideName}</b><br>Hãy chạm bia để xem linh căn và danh phận.</p></div>${btn(seen ? 'Đo lại linh căn' : 'Chạm bia đo linh căn', 'sectMeasure', '', false, 'btn-gold')}</div></section>`;
  }
  /* Sơn môn: cảnh toàn màn hình, mỗi khu là một tấm biển đặt trên cảnh. Chọn khu để mở trang con. */
  const SECT_ZONES = [['missions', 'Nhiệm vụ'], ['exploration', 'Lịch luyện'], ['dungeons', 'Bí cảnh'], ['library', 'Tàng Kinh Các'], ['shop', 'Kho tông môn'], ['ranks', 'Chức vị']];
  function zoneStatus(id, d) {
    const s = UI.s(), g = UI.g(), m = s.sect.mission, e = s.exploration?.active, a = s.dungeon.active, run = s.dungeon.run;
    if (id === 'missions') return m ? { text: 'Đang làm · ' + live(m.end), alert: m.end <= Date.now() } : { text: d ? 'Nhận việc tông môn' : 'Chưa nhập môn · soi linh căn', alert: !d };
    if (id === 'exploration') return e ? { text: e.battle ? 'Đang giao chiến' : 'Đang lịch luyện', alert: !!e.battle } : { text: 'Điểm lịch luyện ' + num(s.adventurePoints || 0) };
    if (id === 'dungeons') return run ? { text: 'Tầng ' + run.floor + ' · đang chiến đấu', alert: true } : a ? { text: 'Còn ' + live(a.end) } : { text: 'Sẵn sàng thám hiểm' };
    if (id === 'library') { const b = H.SECT_BOOKS.find(x => x.id === s.borrowedBook); return { text: b ? esc(b.name) : 'Chưa mượn sách' }; }
    if (id === 'shop') return { text: d ? 'Cống hiến ' + num(s.sect.contribution) : 'Cần nhập môn' };
    return { text: d ? esc(g.sectRank().name) : 'Cần nhập môn' };
  }
  function sectHub() {
    const d = UI.g().sectDefinition();
    const zones = SECT_ZONES.map(([id, label], i) => {
      const st = zoneStatus(id, d);
      return `<button type="button" class="hub-zone" style="--i:${i}" data-act="sectPanel" data-panel="${id}"><span class="hub-zone-name">${label}${st.alert ? '<i class="hub-dot" aria-hidden="true"></i>' : ''}</span><span class="hub-zone-line">${st.text}</span></button>`;
    }).join('');
    return `<section class="sect-hub" aria-label="Sơn môn"><header class="hub-title"><h2>${d ? sectLabel(d) : 'Sơn môn'}</h2><p>${d ? 'Chọn một nơi trong tông môn.' : 'Chưa gia nhập tông môn. Soi linh căn ở mục Nhiệm vụ để chọn môn phái.'}</p></header><div class="hub-zones">${zones}</div></section>`;
  }
  function sect(tab = 'hub') {
    const s = UI.s(), g = UI.g(), d = g.sectDefinition();
    if (tab === 'hub') return sectHub();
    const sub = SECT_ZONES.some(z => z[0] === tab) ? tab : 'missions';
    const nav = `<div class="sect-subhead"><button type="button" class="sect-back" data-act="sectPanel" data-panel="hub">‹ Sơn môn</button><h3>${SECT_ZONES.find(z => z[0] === sub)[1]}</h3></div>`;
    if (sub === 'exploration') return nav + UI.screens.combat.panel();
    if (sub === 'dungeons') return nav + dungeons();
    /* Đã đo linh căn thì ẩn bia đo; chỉ còn việc chọn tông môn hoặc làm nhiệm vụ. */
    const rite = sub === 'missions' && !sectMeasured() ? sectRite() : '';
    /* Chưa đo linh căn: các tab khác không có bia đá, thêm lối tắt về Nhiệm vụ
       để người chơi không gặp nút "Gia nhập" bị khóa mà không rõ đường đi. */
    const riteLink = !d && !sectMeasured() && sub !== 'missions'
      ? `<div class="action-group">${btn('Đến bia đo linh căn', 'sectPanel', 'data-panel="missions"', false, 'btn-outline')}</div>` : '';
    if (!d) return nav + rite + `<p class="screen-lead">${sectMeasured() ? 'Chọn một tông môn để bước lên tiên lộ.' : 'Chạm bia đo linh căn trước khi chọn tông môn.'}</p>${riteLink}<div class="adventure-grid">${H.SECTS.map(x => card(sectLabel(x), `<p>${x.desc}</p><p class="gold">${x.bonus}</p>` + btn('Gia nhập', 'joinSect', `data-id="${x.id}"`, !sectMeasured()))).join('')}</div>`;
    const rank = g.sectRank();
    const header = card(sectLabel(d), `<p>${d.desc} <b class="gold">${d.bonus}</b></p>` + row('Danh phận', g.sectDisciple() ? roleLabel(g.sectDisciple()) : 'Chưa xác định') + row('Cấp cống hiến', rank.name) + row('Cống hiến khả dụng', num(s.sect.contribution)) + row('Điểm lịch luyện', num(s.adventurePoints || 0)) + row('Tổng đã kiếm', num(s.sect.earned)) +
      row('Thu nhập tông môn', moneyHTML(g.sectIncome()) + '/giây') +
      (rank.next ? bar((s.sect.earned - rank.at) / (rank.next.at - rank.at) * 100) + `<p class="info-note">Còn ${num(rank.next.at - s.sect.earned)} cống hiến đã kiếm để lên ${rank.next.name}.</p>` : '<p class="gold">Đã đạt chức vị tối cao.</p>') +
      `<div class="action-group">${btn(s.sect.blessing ? 'Tắt chúc phúc' : 'Chúc phúc +10% tốc độ hấp thụ linh khí', 'blessing', '', false, 'btn-outline')}${btn('Cống hiến · ' + moneyHTML(F.price_ha(s.realm)), 'donate', '', s.stone < F.price_ha(s.realm), 'btn-outline')}</div>`);
    const panels = { missions: missionBoard, library: sectLibrary, shop: sectShop, ranks: () => card('Lộ trình chức vị', H.SECT_RANKS.map(r => row(r.name, num(r.at) + ' tổng cống hiến · bậc ' + r.tier)).join('') + '<p class="info-note">Cống hiến đã kiếm tính cả nhiệm vụ và quyên góp. Rời tông môn sẽ đặt lại chức vị, cống hiến và chúc phúc.</p>' + btn('Rời tông môn', 'sectLeave', '', !!s.sect.mission, 'btn-outline')) };
    /* Thẻ thông tin tông môn (danh phận, cống hiến, chúc phúc) chỉ đặt ở Chức vị, không lặp ở các nơi khác. */
    return nav + rite + (sub === 'ranks' ? header : '') +
      (s.sect.last && sub === 'missions' ? `<p class="adventure-result info-note">${esc(s.sect.last.text)}</p>` : '') + panels[sub]();
  }

  /* Tổng quan linh căn và thế mạnh. Hỗn Độn là bí mật: chỉ hiện khi người chơi đã có. */
  function rootOverview() {
    const s = UI.s(), g = UI.g(), type = s.rootType, info = H.ROOT_TYPES[type] || { group: 'ngu_hanh', desc: '' };
    const group = H.ROOT_GROUPS.find(x => x.id === info.group);
    const combat = F.LINH_CAN_COMBAT[type] || 1, trib = F.LINH_CAN_TRIB[type] || 1;
    let extra = '';
    if (type === 'Dị') {
      const di = H.DI_LINH_CAN[s.rootSub];
      if (di) extra = `<div class="root-di"><b>${L ? L.span(di.name, 'element', s.rootSub) : esc(di.name)} · ${esc(di.role)}</b><p>${esc(di.desc)}</p><p class="root-di-fx">Thế mạnh: ${esc(UI.rootEffectText(di.effects))}</p></div>`;
    } else if (type === 'Hỗn Độn') {
      extra = `<div class="root-di"><b>Giữ các hệ thành phần ban đầu</b><p>Không bị khắc; khắc ngũ hành và dị linh căn +10%.</p></div>`;
    }
    const body = `<p>${esc(info.desc)}</p>${row('Tốc độ hấp thụ linh khí', '×' + F.LINH_CAN_RATE[type])}${combat > 1 ? row('Chiến lực', '×' + combat) : ''}${row('Chịu lôi kiếp', '×' + trib)}${extra}`;
    const rank = (types, cur) => types.map(n => L
      ? L.span(n, 'root', n, { className: 'root-chip' + (cur === n ? ' is-current' : '') })
      : `<span class="root-chip ${cur === n ? 'is-current' : ''}">${esc(n)}</span>`).join('<span class="root-sep">›</span>');
    const classes = `<div class="root-class"><b>Ngũ hành cơ bản</b><div>${rank(['Ngụy', 'Tứ hành', 'Tam hành', 'Song', 'Thiên'], type)}</div><p class="info-note">Theo số hệ đạt 50 điểm; Thiên là một hệ thuần, không biến thể.</p></div>` +
      `<div class="root-class"><b>Dị linh căn</b><div>${H.DI_KEYS.map(k => L
        ? L.span(H.DI_LINH_CAN[k].name, 'element', k, { className: 'root-chip' + (type === 'Dị' && s.rootSub === k ? ' is-current' : '') })
        : `<span class="root-chip ${type === 'Dị' && s.rootSub === k ? 'is-current' : ''}">${esc(H.DI_LINH_CAN[k].name)}</span>`).join('<span class="root-sep">·</span>')}</div><p class="info-note">Dị khắc hệ gốc và không bị hệ gốc khắc.</p></div>` +
      (type === 'Hỗn Độn' ? `<div class="root-class"><b>Chí tôn</b><div>${rank(['Hỗn Độn'], type)}</div></div>` : '');
    return card(rootLabelHtml(type, s.rootSub, 'badge'), body, { eyebrow: (group ? group.name : 'Linh căn').toUpperCase() }) + card('Phân loại linh căn', classes, { eyebrow: 'Ba nhóm' });
  }

  const ELEMENT_TEXT = [
    'Sắc bén, thiên về công phạt.', 'Sinh cơ bừng bừng, thiên về sinh lực và hồi phục.', 'Uyển chuyển, thiên về linh lực và né tránh.',
    'Bùng nổ, thiên về uy lực và sát thương bạo kích.', 'Vững chãi, thiên về phòng thủ và giảm sát thương.'
  ];
  /* Tab Kinh mạch: linh căn của nhân vật và kiến thức ngũ hành cơ bản. */
  function roots() {
    const s = UI.s(), els = UI.g().activeElements();
    const names = H.ELEMENT_NAMES;
    const elements = names.map((name, i) => {
      const beats = names[H.BEATS[i]], beatenBy = names[H.BEATS.indexOf(i)];
      const have = els.includes(i);
      return card(`${elementLabel(i, name)} · ${s.roots[i]} điểm${have ? ' · đã có' : ''}`,
        `<p>${esc(ELEMENT_TEXT[i])}</p><p class="root-di-fx">Thế mạnh: ${esc(UI.rootEffectText(H.ELEMENT_BASE[i]))}</p>` +
        row('Khắc', beats) + row('Bị khắc bởi', beatenBy), { cls: have ? '' : 'adventure-locked' });
    }).join('');
    const rules = card('Tương sinh và tương khắc',
      '<p><b>Tương sinh:</b> Mộc → Hỏa → Thổ → Kim → Thủy → Mộc.</p><p><b>Tương khắc:</b> Kim → Mộc → Thổ → Thủy → Hỏa → Kim.</p>' +
      '<p class="info-note">Đánh trúng hệ bị khắc: sát thương +20%. Bị hệ khắc mình đánh: −20%. Dị linh căn khắc hệ gốc và không bị hệ gốc khắc.</p>', { eyebrow: 'Quy luật' });
    const count = card('Số hệ quyết định loại linh căn',
      '<p>Mỗi hệ đạt từ 50 điểm là một hệ linh căn. Càng ít hệ, linh lực càng tinh thuần và hấp thụ linh khí càng nhanh: Ngụy (5 hệ) → Tứ hành → Tam hành → Song → Thiên (1 hệ thuần).</p>' +
      '<p class="info-note">Dị linh căn là biến thể cao cấp của một hệ gốc (Băng, Lôi, Phong, Độc), có thế mạnh riêng.</p>', { eyebrow: 'Phân loại' });
    return `<div class="screen-grid">${rootOverview()}</div>
      <h3 class="root-section-title">Ngũ hành cơ bản</h3>
      <div class="adventure-grid">${elements}</div>
      <div class="screen-grid">${rules}${count}</div>`;
  }
  function update() {
    const now = UI.session.serverNow();
    document.querySelectorAll('[data-job-end]').forEach(el => {
      const start = Number(el.dataset.jobStart), end = Number(el.dataset.jobEnd);
      el.value = Math.max(0, Math.min(100, (now - start) / Math.max(1, end - start) * 100));
    });
    document.querySelectorAll('[data-act="sectMissionClaim"]').forEach(el => { el.disabled = !UI.s().sect.mission || UI.s().sect.mission.end > now; });
    document.querySelectorAll('[data-act="encounter"]').forEach(el => { el.disabled = UI.s().encounter.usedAt + 90000 > now; });
  }
  UI.adventure = { dungeons, encounters, sect, roots, update, runPanel, runSignature, runMeta, mountRun, runBusy: runStage.busy };
  UI.action('sectMeasure', () => {
    if (!UI.session?.playerId) throw Error('Chưa có đạo thân để đo linh căn.');
    measuredPlayer = UI.session.playerId;
    UI.toast('Bia đã soi rõ ' + H.rootLabel(UI.s().rootType, UI.s().rootSub) + '.', { type: 'gold', title: 'Vấn Linh Đài' });
  });
  UI.action('dungeonStart', async (el, d) => { await UI.command('startDungeon', { id: d.id }); UI.toast('Đã khởi hành. Kết quả sẽ tự ghi vào nhật ký.', { type: 'gold', title: 'Bí cảnh' }); });
  UI.action('dungeonEnter', async (el, d) => {
    await UI.command('enterDungeon', { id: d.id });
    UI.toast('Vào bí cảnh. Thể lực cạn thì thủ thế để hồi sức; thấy cảnh báo đòn nặng nên thủ thế.', { type: 'gold', title: 'Bí cảnh' });
  });
  UI.action('runAuto', (el, d) => {
    if (d.auto !== 'on') return UI.KEEP;
    runAuto.on = !runAuto.on;
    if (!runAuto.on) runAutoStop(); else runAuto.timer = root.setTimeout(runAutoTick, 300);
  });
  const RUN_KEYS = ['attack', 'power', 'guard', 'heal'];
  const MOVE_LABEL = { attack: 'Xuất chiêu', power: 'Trọng kích', guard: 'Thủ thế', heal: 'Hồi phục' };
  UI.action('dungeonAct', async (el, d) => {
    if (runStage.busy()) { UI.toast('Chiêu thức đang thi triển, hãy chờ một nhịp.', { type: 'info', title: 'Bí cảnh' }); return UI.KEEP; }
    runStage.capture();
    let r;
    try { r = await UI.command('dungeonAct', { action: d.move }); } catch (error) { runStage.cancel(); throw error; }
    if (!r) return UI.KEEP;
    if (d.move !== 'retreat' && !r.ended) runStage.queue({
      action: d.move, cry: MOVE_LABEL[d.move] || '', dealt: Math.max(0, Number(r.dealt) || 0), healed: Math.max(0, Number(r.healed) || 0),
      taken: Math.max(0, Number(r.taken) || 0), crit: !!r.crit, takenCrit: !!r.takenCrit, counter: !!r.counter && !r.floorCleared, state: 'active'
    });
    if (r.ended || r.died) runAutoStop();
    if (r.ended) {
      UI.toast(r.ended.text, { type: r.ended.success ? 'loot' : r.ended.why === 'defeat' ? 'danger' : 'info', title: r.ended.success ? 'Thông quan bí cảnh' : 'Kết thúc chuyến bí cảnh' });
      if (r.ended.success) UI.vfx?.stage({ kind: 'chien_dau', variant: 'phi_thang', fps: 14, size: 'clamp(110px,18vw,190px)', style: { left: '50%', bottom: '24%', transform: 'translateX(-50%)' } });
    } else if (r.floorCleared) UI.toast('Qua tầng ' + r.floorCleared + '. Thể lực hồi thêm ' + H.DUNGEON_RUN.floorGain + '.', { type: 'success', title: 'Bí cảnh' });
  });
  UI.action('dungeonRetreat', async () => {
    const run = UI.s().dungeon.run;
    UI.modal('Rút lui khỏi bí cảnh?', '<p>Giữ phần thưởng của ' + (run?.cleared || 0) + ' tầng đã vượt; các tầng còn lại bỏ dở.</p>', async () => {
      const r = await UI.command('dungeonAct', { action: 'retreat' });
      UI.toast(r.ended.text, { type: 'info', title: 'Rút lui' });
    }, 'Rút lui');
    return UI.KEEP;
  });
  // Phím 1–4 chọn hành động khi bảng chiến đấu đang mở và không đang gõ chữ.
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey || !RUN_KEYS[Number(e.key) - 1]) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || !document.querySelector('.run-panel')) return;
    const b = document.querySelector('.run-panel [data-act="dungeonAct"][data-move="' + RUN_KEYS[Number(e.key) - 1] + '"]');
    if (b && !b.disabled) { e.preventDefault(); b.click(); }
  });
  UI.action('dungeonAbort', async () => { UI.modal('Rút khỏi bí cảnh?', '<p>Chuyến đi hiện tại sẽ không có phần thưởng.</p>', async () => await UI.command('abortDungeon'), 'Rút lui'); return UI.KEEP; });
  UI.action('sectPanel', async (el, d) => { if (['hub', 'missions', 'library', 'shop', 'ranks','exploration','dungeons'].includes(d.panel)) UI.go('sect:' + d.panel); });
  UI.action('borrowSectBook', async (el, d) => { const book = await UI.command('buySect', { id: d.id }); UI.toast('Đã mượn ' + book.name + ' · còn ' + num(book.points) + ' điểm lịch luyện.', { type: 'success', title: 'Tàng Kinh Các' }); });
  UI.action('sectRepeat', async () => { await UI.command('setSectRepeat', { enabled: !UI.s().sect.repeat }); });
  UI.action('sectMissionAbort', async () => { UI.modal('Hủy nhiệm vụ?', '<p>Nhiệm vụ hiện tại không có phần thưởng; tự lặp sẽ tắt.</p>', async () => await UI.command('abortSectMission'), 'Hủy nhiệm vụ'); return UI.KEEP; });
  UI.action('sectLeave', async () => { UI.modal('Rời tông môn?', '<p>Chức vị, cống hiến và chúc phúc sẽ đặt lại. Sau đó có thể chọn tông môn mới.</p>', async () => { await UI.command('leaveSect'); UI.view.sectPanel = 'missions'; }, 'Rời tông môn'); return UI.KEEP; });
  UI.action('sectBuy', async (el, d) => { const r = await UI.command('buySect', { id: d.id, ...(d.element === undefined ? {} : { element: Number(d.element) }) }); UI.toast('Nhận ' + r.name + ' ×' + r.count + '.', { type: 'loot', title: 'Kho tông môn' }); });
})(typeof window !== 'undefined' ? window : globalThis);
