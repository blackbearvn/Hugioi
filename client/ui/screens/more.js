/* HƯ GIỚI · MÀN GIAO DU
 * Đạo hữu (người chơi thật), đạo lữ, Sinh Tử Đài và bảng xếp hạng. Toàn bộ tương tác lưu trong
 * state.social của từng đạo thân trên máy chủ; chưa phải social/PvP người thật. */
(function (root) {
  'use strict';
  const H = root.HU_GAME, F = H.F, A = root.HU_ASSETS;
  const UI = root.HU_UI;
  const { esc, num, money, moneyHTML, pct, row, btn, card, empty, tabs, live } = UI.kit;

  const TABS = [
    { id: 'online', label: 'Đạo hữu', icon: '☯' },
    { id: 'partner', label: 'Đạo lữ', icon: '❦' },
    { id: 'pvp', label: 'Sinh Tử Đài', icon: '⚔' },
    { id: 'ranking', label: 'Bảng xếp hạng', icon: '♛' }
  ];

  const { PVP_CD, DISCUSS_CD, FRIENDS, DAO, RIVALS, giftCost, BOND_MILESTONES, PARTNER } = H;

  // Chế độ top độc lập, cache ngắn, không truy vấn toàn bộ game.players.state.
  const leaderboardState = { data: null, error: '', at: 0, owner: '', mode: 'power', pending: null };
  async function loadLeaderboard(force = false) {
    const owner = UI.session?.accountId, mode = leaderboardState.mode;
    if (!owner) return;
    if (leaderboardState.owner !== owner)
      Object.assign(leaderboardState, { data: null, error: '', at: 0, owner, pending: null });
    if (leaderboardState.pending) return leaderboardState.pending;
    if (!force && Date.now() - leaderboardState.at < 30000) return;
    const task = UI.session.request('/social/ranking', 'POST', { mode })
      .then(data => { if (leaderboardState.owner === owner && leaderboardState.mode === mode) {
        leaderboardState.data = data; leaderboardState.error = ''; leaderboardState.at = Date.now();
      } })
      .catch(error => { if (leaderboardState.owner === owner && leaderboardState.mode === mode) {
        leaderboardState.error = error.message; leaderboardState.at = Date.now();
      } })
      .finally(() => {
        if (leaderboardState.pending === task) leaderboardState.pending = null;
        if (leaderboardState.owner === owner) {
          if (UI.windows?.has('ranking')) UI.windows.render('ranking');
          if (UI.windows?.has('more') && UI.tabState.more === 'ranking') UI.windows.render('more');
        }
      });
    leaderboardState.pending = task;
    return task;
  }

  // Bạn bè người chơi thật: dữ liệu ở máy chủ, tải khi mở tab và thăm dò thưa để hiện chấm đỏ lời mời.
  // Bạn bè người thật mở sớm: từ Luyện Khí viên mãn (khớp kiểm tra ở Edge friends.ts).
  const buddyOpen = () => { const st = UI.s(); return st.realm > 0 || st.stage >= F.STAGES[0]; };
  const buddy = { data: null, error: '', at: 0, owner: '', pending: null, busy: false, sugg: [], nextAt: 0, suggBusy: false, suggAt: 0, draft: '' };
  UI.friendRequests = () => buddy.owner === UI.session?.accountId ? (buddy.data?.incoming?.length || 0) : 0;
  function refreshBuddyViews() {
    if (UI.windows?.has('more') && UI.tabState.more === 'online') UI.windows.render('more');
  }
  async function buddyCall(body, force = true) {
    const owner = UI.session?.accountId;
    if (!owner) return null;
    if (buddy.owner !== owner) Object.assign(buddy, { data: null, error: '', at: 0, owner, pending: null, sugg: [], nextAt: 0, suggAt: 0, draft: '' });
    if (!force && (buddy.pending || Date.now() - buddy.at < 30000)) return buddy.pending;
    const task = UI.session.request('/social/friends', 'POST', body)
      .then(data => { if (buddy.owner === owner) { buddy.data = data; buddy.error = ''; pruneSuggestions(); } return data; })
      .catch(error => { if (buddy.owner === owner) buddy.error = error.message; throw error; })
      .finally(() => { if (buddy.pending === task) buddy.pending = null; if (buddy.owner === owner) { buddy.at = Date.now(); refreshBuddyViews(); } });
    buddy.pending = task;
    return task;
  }
  /* Người đã là bạn, đang chờ, đã mời hoặc bị chặn không còn thuộc danh sách gợi ý. */
  function pruneSuggestions() {
    const d = buddy.data;
    if (!d || !buddy.sugg.length) return;
    const taken = new Set([...d.friends, ...d.incoming, ...d.outgoing, ...d.blocked].map(p => p.id));
    buddy.sugg = buddy.sugg.filter(p => !taken.has(p.id));
  }
  // Gợi ý ngẫu nhiên 5 người mỗi lượt; đổi lượt tối đa 15 giây một lần (máy chủ giữ nguyên lượt trong 15 giây).
  async function loadSuggest(force = false) {
    const owner = UI.session?.accountId;
    /* Tôn trọng thời gian chờ cả khi danh sách gợi ý đang trống hoặc vừa lỗi. Trước đây chỉ chặn khi đã có gợi ý:
       danh sách rỗng khiến mỗi lần vẽ lại (mount) gọi lại API, API xong lại vẽ lại ... vòng lặp đến khi máy chủ báo
       "Thao tác quá nhanh" và làm menu thả xuống của tab đóng mở liên tục. */
    if (!owner || buddy.suggBusy || Date.now() < buddy.nextAt) return;
    buddy.suggBusy = true;
    try {
      const r = await UI.session.request('/social/friends', 'POST', { action: 'suggest' });
      if (buddy.owner === owner) { buddy.sugg = r.suggestions || []; pruneSuggestions(); buddy.nextAt = Number(r.nextAt) || Date.now() + 15000; buddy.error = ''; }
    } catch (error) { if (buddy.owner === owner) { buddy.error = error.message; buddy.nextAt = Date.now() + 15000; } }
    finally { buddy.suggBusy = false; buddy.suggAt = Date.now(); refreshBuddyViews(); }
  }
  const loadBuddies = force => buddyCall({ action: 'list' }, force).catch(() => null);
  root.setInterval?.(() => {
    try {
      if (root.document?.hidden || !UI.session?.accountId || !buddyOpen()) return;
      void loadBuddies(false);
    } catch { /* chưa vào game */ }
  }, 90000);

  function person(p, actions) {
    return '<div class="rank-row buddy-row ' + (p.online ? 'is-online' : '') + (p.dead ? ' is-dead' : '') + '"><span class="rank-no" title="' + (p.dead ? 'Đã tọa hóa' : p.online ? 'Đang online' : 'Ngoại tuyến') +
      '">' + (p.online ? '●' : '○') + '</span><span class="rank-name"><b>' + esc(p.name) + '</b><small>' + esc(F.REALMS[p.realm] || '') +
      (p.dead ? ' · đã tọa hóa' : p.online ? ' · đang online' : '') + '</small></span><span class="buddy-actions">' + actions + '</span></div>';
  }
  const bBtn = (act, id, label, cls = 'btn-outline') => '<button type="button" class="btn btn-sm ' + cls + '" data-act="' + act + '" data-id="' + esc(id) + '">' + label + '</button>';
  function online() {
    const d = buddy.data, L = d?.limits || { friends: 50 };
    const list = (arr, fn, none) => arr?.length ? '<div class="rank-list">' + arr.map(fn).join('') + '</div>' : '<p class="empty-note">' + none + '</p>';
    const cooling = Date.now() < buddy.nextAt;
    const suggest = card('Gợi ý đạo hữu', list(buddy.sugg, p => person(p, bBtn('buddyInvite', p.id, 'Kết giao', 'btn-gold')), buddy.suggBusy ? 'Đang tìm đạo hữu…' : 'Chưa có đạo hữu nào để gợi ý lúc này.') +
      '<button type="button" class="btn btn-outline" data-act="buddySuggest"' + (cooling || buddy.suggBusy ? ' disabled' : '') + '>Đổi lượt khác' + (cooling ? ' · ' + live(buddy.nextAt) : '') + '</button>', { eyebrow: 'NGẪU NHIÊN · 5 NGƯỜI MỖI LƯỢT' });
    const sections = d ? [
      d.incoming.length ? card('Lời mời kết giao (' + d.incoming.length + ')', list(d.incoming, p => person(p, bBtn('buddyAccept', p.id, 'Nhận', 'btn-gold') + bBtn('buddyDecline', p.id, 'Từ chối')), ''), { eyebrow: 'CHỜ BẠN PHẢN HỒI' }) : '',
      card('Bạn bè (' + d.friends.length + '/' + L.friends + ')', list(d.friends, p => person(p, bBtn('buddyRemove', p.id, 'Xóa') + bBtn('buddyBlock', p.id, 'Chặn')), 'Chưa có bạn bè. Gửi lời mời bằng tên đạo hữu ở trên.'), { eyebrow: 'ĐẠO HỮU THẬT' }),
      d.outgoing.length ? card('Đã gửi lời mời', list(d.outgoing, p => person(p, bBtn('buddyCancel', p.id, 'Thu hồi')), ''), { eyebrow: 'ĐANG CHỜ' }) : '',
      d.blocked.length ? card('Đã chặn', list(d.blocked, p => person(p, bBtn('buddyUnblock', p.id, 'Bỏ chặn')), ''), { eyebrow: 'DANH SÁCH CHẶN' }) : ''
    ].join('') : '';
    return '<p class="screen-lead">Kết giao với người chơi thật: nhập đúng tên đạo thân, đối phương nhận lời mời rồi hai bên thành bạn. Trạng thái online theo kênh truyền âm.</p>' +
      '<div class="buddy-add"><label>Tên đạo hữu<input id="buddyName" type="text" maxlength="60" autocomplete="off" placeholder="Nhập đúng tên đạo thân" value="' + esc(buddy.draft) + '"></label>' +
      '<button type="button" class="btn btn-gold" data-act="buddyAdd">Gửi lời mời</button></div>' + suggest +
      (buddy.error ? '<p class="info-note" role="alert">' + esc(buddy.error) + '</p>' : '') +
      (!d && !buddy.error ? '<p class="info-note" role="status">Đang tải danh sách bạn bè…</p>' : '') + sections +
      '<button type="button" class="btn btn-outline" data-act="buddyRefresh">Làm mới</button>';
  }

  const affinityRank = v => v >= 90 ? 'Sinh tử chi giao' : v >= 50 ? 'Tri kỷ' : v >= 20 ? 'Tương tri' : 'Sơ giao';
  const pvpTier = r => r >= 1350 ? 'Kiếm tiên' : r >= 1200 ? 'Tông sư' : r >= 1050 ? 'Kiếm khách' : r >= 900 ? 'Tán tu' : 'Sơ nhập';
  const discussGain = () => UI.g().discussGain();

  const portrait = f => A.heroPortrait(f.gender, f.realm);

  function friendCard(f) {
    const s = UI.s(), st = s.social.friends[f.id], met = !!st?.metAt, aff = st?.affinity || 0;
    return `<article class="social-card ${met ? '' : 'is-locked'}">
      <div class="social-portrait"><img src="${portrait(f)}" alt="${esc(f.name)}" loading="lazy" decoding="async"></div>
      <div class="social-copy">
        <span class="eyebrow">${esc(f.title)}</span><h3>${esc(f.name)}</h3>
        <p>${esc(f.line)}</p>
        ${met ? `<div class="affinity-line"><span>${affinityRank(aff)}</span><b>${aff}/100</b></div><div class="affinity-bar"><i style="width:${aff}%"></i></div>${milestones(f, st)}` : '<p class="info-note">Chưa kết giao · gặp gỡ để mở tương tác.</p>'}
      </div>
      <div class="social-actions">${met
        ? btn(aff >= 100 ? 'Tình nghĩa viên mãn' : `Tặng lễ · ${moneyHTML(giftCost(f))}`, 'moreGift', `data-id="${f.id}"`, aff >= 100, 'btn-outline')
        : btn('Kết giao', 'moreMeet', `data-id="${f.id}"`)}</div>
    </article>`;
  }

  /* Mốc tình nghĩa: bấm nhận thưởng khi đạt mốc. */
  function milestones(f, st) {
    const aff = st?.affinity || 0, got = st?.claimed || [];
    return `<div class="bond-marks">${BOND_MILESTONES.map(m => {
      const done = got.includes(m.at), ready = !done && aff >= m.at;
      const what = [m.reward.stone ? 'linh thạch' : '', m.reward.exp ? 'tu vi' : ''].filter(Boolean).join(' + ');
      return `<button type="button" class="bond-mark ${done ? 'done' : ready ? 'ready' : ''}" data-act="moreClaimBond" data-id="${f.id}" data-at="${m.at}" ${ready ? '' : 'disabled'} title="${esc(m.name + ': ' + what)}">${done ? '✓' : m.at}<small>${esc(m.name)}</small></button>`;
    }).join('')}</div>`;
  }

  function partner() {
    const s = UI.s(), soc = s.social, now = Date.now(), g = UI.g(), mine = soc.partner && FRIENDS.find(f => f.id === soc.partner.id);
    let body = '';
    if (mine) {
      const aff = soc.friends[mine.id]?.affinity || 0, end = soc.partner.songTuAt || 0, ready = now >= end;
      body = `<article class="social-card partner-card">
        <div class="social-portrait"><img src="${portrait(mine)}" alt="${esc(mine.name)}" loading="lazy" decoding="async"></div>
        <div class="social-copy"><span class="eyebrow">Đạo lữ · ${esc(mine.title)}</span><h3>${esc(mine.name)}</h3><p>${esc(mine.line)}</p>
          <div class="affinity-line"><span>${affinityRank(aff)}</span><b>${aff}/100</b></div><div class="affinity-bar"><i style="width:${aff}%"></i></div>
          <p class="info-note">Tốc độ tu <b>+${(g.partnerRate() * 100).toFixed(1)}%</b> · đã song tu <b>${num(soc.partner.sessions)}</b> lần · song tu nhận ≈ <b>${num(g.discussGain() * PARTNER.songTuMult * (1 + aff / 100))}</b> tu vi.</p></div>
        <div class="social-actions">${btn(ready ? 'Song tu' : 'Đang điều tức', 'moreSongTu', '', !ready)}<p class="cooldown">${ready ? 'Sẵn sàng' : live(end)}</p>${btn('Ly duyên', 'moreBreak', '', false, 'btn-outline')}</div>
      </article>`;
    } else {
      const wait = now < soc.partnerRebindAt ? `<p class="info-note">Vừa ly duyên, có thể kết duyên lại sau ${live(soc.partnerRebindAt)}.</p>` : '';
      const list = FRIENDS.map(f => {
        const st = soc.friends[f.id], aff = st?.affinity || 0, met = !!st?.metAt, ok = met && aff >= PARTNER.minAffinity && now >= soc.partnerRebindAt;
        return `<article class="social-card compact ${met ? '' : 'is-locked'}">
          <div class="social-portrait small"><img src="${portrait(f)}" alt="${esc(f.name)}" loading="lazy" decoding="async"></div>
          <div class="social-copy"><span class="eyebrow">${esc(f.title)}</span><h3>${esc(f.name)}</h3>
            <p class="info-note">${met ? `Tình nghĩa <b>${aff}/100</b>${aff >= PARTNER.minAffinity ? '' : ` · cần ${PARTNER.minAffinity} để kết duyên`}` : 'Chưa kết giao · bấm Kết giao để làm quen.'}</p></div>
          ${met ? milestones(f, st) : ''}
          <div class="social-actions">${met ? btn(aff >= 100 ? 'Tình nghĩa viên mãn' : `Tặng lễ · ${moneyHTML(giftCost(f))}`, 'moreGift', `data-id="${f.id}"`, aff >= 100, 'btn-outline') : btn('Kết giao', 'moreMeet', `data-id="${f.id}"`)}${met ? btn(`Kết duyên · ${moneyHTML(g.bindCost(f.id))}`, 'moreBind', `data-id="${f.id}"`, !ok) : ''}</div>
        </article>`;
      }).join('');
      body = `${wait}<div class="social-list">${list}</div>`;
    }
    return `<p class="screen-lead">Đạo lữ là một vị đạo hữu mô phỏng đã đủ tình nghĩa, cùng bạn tu hành. Có đạo lữ sẽ tăng tốc độ tu theo tình nghĩa, và mỗi lần song tu nhận thêm tu vi.</p>
      ${card('Quy tắc đạo lữ', `${row('Điều kiện', 'Tình nghĩa từ ' + PARTNER.minAffinity)}${row('Tăng tốc độ tu', '+' + (PARTNER.rateBase * 100) + '% đến +' + ((PARTNER.rateBase + PARTNER.rateAffinity) * 100) + '%')}${row('Song tu', 'Hồi ' + Math.round(PARTNER.songTuCd / 60000) + ' phút, +1 tình nghĩa')}${row('Ly duyên', 'Tình nghĩa tụt về ' + PARTNER.breakAffinity + ', chờ ' + Math.round(PARTNER.rebindCd / 36e5) + ' giờ mới kết lại')}`)}
      ${body}`;
  }

  function pvp() {
    const s = UI.s(), pvp = s.social.pvp, g = UI.g(), my = g.stats().CP, ready = Date.now() >= pvp.lastAt + PVP_CD;
    return `<p class="screen-lead">Sinh Tử Đài: giao đấu với đối thủ NPC, không phải người chơi thật. Thắng tăng danh vọng, nhận linh thạch và tu vi; thua mất một ít danh vọng.</p>
      <div class="screen-grid">
        ${card('Sinh Tử Đài', `<div class="pvp-rating"><b>${num(pvp.rating)}</b><span>${pvpTier(pvp.rating)}</span></div>
          ${row('Thắng / Thua', num(pvp.wins) + ' / ' + num(pvp.losses))}${row('Chuỗi thắng', num(pvp.streak))}${row('Danh vọng cao nhất', num(pvp.best))}${row('Chiến lực của bạn', num(my))}
          <p class="info-note">Sau mỗi trận cần điều tức ${Math.round(PVP_CD / 1000)} giây trước khi tái đấu. Thắng nhận 18–25 danh vọng; thua hao tổn 12–19 danh vọng.</p>`, { eyebrow: 'DANH VỌNG' })}
        ${card('Quy tắc', `<p>Đối thủ trên Sinh Tử Đài tương ứng với chiến lực hiện tại của bạn. Mỗi cảnh giới đều có những thử thách riêng.</p>${row('Thắng', 'Linh thạch · tu vi · danh vọng')}${row('Thua', 'Mất danh vọng, không mất tu vi')}${row('Trạng thái', ready ? 'Sẵn sàng' : live(pvp.lastAt + PVP_CD))}`, { eyebrow: 'LUẬT ĐẤU' })}
      </div>
      <div class="social-list pvp-list">${RIVALS.map(f => {
        const power = g.rivalPower(f.id), chance = F.win_probability(my, power);
        return `<article class="social-card compact">
          <div class="social-portrait small"><img src="${portrait(f)}" alt="${esc(f.name)}" loading="lazy" decoding="async"></div>
          <div class="social-copy"><span class="eyebrow">${esc(f.school)} · ${esc(F.REALMS[f.realm])}</span><h3>${esc(f.name)}</h3>
            <p>Chiến lực đối thủ <b>${num(power)}</b> · kỳ vọng thắng <b>${pct(chance)}</b></p>
            <p class="info-note">Danh vọng khởi đầu ${num(f.rating)} · phần thưởng theo cảnh giới hiện tại.</p></div>
          <div class="social-actions">${btn('Khiêu chiến', 'moreDuel', `data-id="${f.id}"`, !ready)}<p class="cooldown">${ready ? 'Sẵn sàng' : live(pvp.lastAt + PVP_CD)}</p></div>
        </article>`;
      }).join('')}</div>`;
  }

  function ranking() {
    const mode = leaderboardState.mode, data = leaderboardState.data;
    const entries = data?.entries || [], me = data?.me;
    const modeNav = '<div class="ranking-modes" role="group" aria-label="Loại bảng xếp hạng">' +
      [['power','Lực chiến'],['realm','Cảnh giới']].map(([id,label]) =>
        '<button type="button" data-act="rankingMode" data-mode="' + id +
        '" aria-pressed="' + (mode === id) + '" class="btn ' + (mode === id ? 'btn-gold' : 'btn-outline') +
        '">' + label + '</button>').join('') + '</div>';
    const value = e => mode === 'realm'
      ? esc(F.REALMS[e.realm] || '') + ' · tầng ' + num(e.stage)
      : num(e.power) + ' lực chiến';
    const myCard = me ? card('Thứ hạng của bạn',
      '<div class="rank-me"><b>#' + num(me.rank) + '</b><span>' + esc(me.name) +
      '</span><em>' + value(me) + '</em></div>' +
      row('Lực chiến', num(me.power)) +
      row('Cảnh giới', esc(F.REALMS[me.realm] || '') + ' · tầng ' + num(me.stage)),
      { eyebrow: 'NHÂN VẬT HIỆN TẠI' }) : '';
    const items = entries.map((e,i) => '<div class="rank-row ' + (e.you ? 'you' : '') + ' ' +
      (i < 3 ? 'top' : '') + '"><span class="rank-no">' +
      (i < 3 ? ['Ⅰ','Ⅱ','Ⅲ'][i] : '#' + (i + 1)) + '</span><span class="rank-name"><b>' +
      esc(e.name) + '</b><small>' + esc(F.REALMS[e.realm] || '') + ' · tầng ' + num(e.stage) +
      (e.you ? ' · Bạn' : '') + '</small></span><span class="rank-rating">' +
      (mode === 'realm' ? esc(F.REALMS[e.realm] || '') : num(e.power)) +
      '<small>' + (mode === 'realm' ? 'tầng ' + num(e.stage) : 'lực chiến') + '</small></span></div>').join('');
    return '<p class="screen-lead">Bảng xếp hạng người chơi thật · Top 50 Lực chiến hoặc Cảnh giới. Khi tọa hóa và bắt đầu lại, nhân vật cũ không còn trên bảng xếp hạng.</p>' +
      modeNav +
      (leaderboardState.error ? '<p class="info-note" role="alert">' + esc(leaderboardState.error) + '</p>' : '') +
      (!data && !leaderboardState.error ? '<p class="info-note" role="status">Đang tải bảng xếp hạng…</p>' : '') +
      myCard + '<div class="rank-list">' + (items || (data ? '<p class="empty-note">Chưa có tu sĩ trong bảng xếp hạng.</p>' : '')) + '</div>' +
      '<button type="button" class="btn btn-outline" data-act="rankingRefresh">Làm mới thứ hạng</button>';
  }

  const body = { online, partner, pvp, ranking };
  function lockedBuddy() {
    return card('Chưa mở', empty('Kết bạn với người chơi thật mở từ Luyện Khí viên mãn. Hiện bạn ở ' + esc(F.REALMS[UI.s().realm]) + ' tầng ' + num(UI.s().stage) + '/' + F.STAGES[UI.s().realm] + '.'), { eyebrow: 'CHƯA ĐỦ ĐẠO HẠNH' });
  }
  function lockedMore() {
    const f = H.FEATURES.social;
    return card('Chưa mở', empty(esc(UI.release.socialFeatureLabel(f.label)) + ' mở ở cảnh giới ' + esc(F.REALMS[f.realm]) + '. Hiện bạn đang ở ' + esc(F.REALMS[UI.s().realm]) + '.'), { eyebrow: 'CHƯA ĐỦ ĐẠO HẠNH' });
  }

  UI.register({
    id: 'more', label: 'Giao du', icon: '♡', eyebrow: 'GIAO DU', tabs: TABS,
    render: tab => {
      const active = UI.release.allowed('more:' + tab) && body[tab] ? tab : 'online';
      return `<header class="screen-title"><span class="eyebrow gold">GIAO DU</span><h2>Giao du</h2></header>${tabs(UI.release.tabs(TABS), active)}<div class="screen-body">${UI.release.notice(active)}${(active === 'ranking' || (active === 'online' ? buddyOpen() : UI.g().featureOpen('social'))) ? body[active]() : (active === 'online' ? lockedBuddy() : lockedMore())}</div>`;
    },
    mount: tab => { if (tab === 'ranking') void loadLeaderboard(); if (tab === 'online') { void loadBuddies(false); void loadSuggest(false); } },
    signature: tab => {
      const s = UI.s(), now = Date.now(), pvp = s.social.pvp;
      const f = Object.values(s.social.friends).map(v => v.affinity + ':' + (v.discussAt <= now ? 1 : 0) + ':' + (v.claimed || []).join('.')).join(',') + '|' + (s.social.partner ? s.social.partner.id + ':' + s.social.partner.sessions + ':' + (s.social.partner.songTuAt <= now ? 1 : 0) : '-') + '|' + (s.social.partnerRebindAt <= now ? 1 : 0);
      return (tab === 'ranking' ? leaderboardState.at + ':' + leaderboardState.owner : tab === 'online' ? buddy.at + ':' + buddy.suggAt + ':' + buddy.owner + ':' + buddy.busy + ':' + (Date.now() >= buddy.nextAt ? 1 : 0) : '') + '|' + s.realm + '|' + f + '|' + pvp.rating + '|' + pvp.wins + '|' + pvp.losses + '|' + pvp.streak + '|' + pvp.best + '|' + (pvp.lastAt + PVP_CD <= now ? 1 : 0);
    }
  });

  UI.register({
    id: 'ranking', label: 'Bảng xếp hạng', icon: '♛', eyebrow: 'THIÊN BẢNG',
    pageBg: () => UI.kit.abs(root.HU_ASSETS.BG.ranking),
    render: () => '<header class="screen-title"><span class="eyebrow gold">THIÊN BẢNG</span><h2>Bảng xếp hạng</h2></header><div class="screen-body">' + ranking() + '</div>',
    mount: () => { void loadLeaderboard(); },
    signature: () => [leaderboardState.at,leaderboardState.mode,leaderboardState.owner].join('|')
  });
  UI.action('rankingMode', (el,data) => {
    const mode = data.mode;
    if (!['power','realm'].includes(mode) || leaderboardState.mode === mode) return UI.KEEP;
    leaderboardState.mode = mode; leaderboardState.data = null;
    leaderboardState.error = ''; leaderboardState.at = 0;
    if (UI.windows?.has('ranking')) UI.windows.render('ranking');
    if (UI.windows?.has('more') && UI.tabState.more === 'ranking') UI.windows.render('more');
    return UI.KEEP;
  });
  const BUDDY_MSG = {
    sent: 'Đã gửi lời mời kết giao.', pending: 'Lời mời đã gửi, đang chờ đối phương.', accepted: 'Hai bên đã thành bạn.',
    declined: 'Đã từ chối lời mời.', cancelled: 'Đã thu hồi lời mời.', removed: 'Đã xóa khỏi danh sách bạn.',
    blocked: 'Đã chặn đạo hữu này.', unblocked: 'Đã bỏ chặn.'
  };
  async function buddyAct(body) {
    const r = await buddyCall(body);
    UI.toast(BUDDY_MSG[r?.result] || 'Đã cập nhật.', { type: r?.result === 'accepted' ? 'success' : 'info', title: 'Bạn bè' });
    return UI.KEEP;
  }
  UI.action('buddyAdd', async () => {
    const input = root.document.getElementById('buddyName');
    const name = String(input?.value || '').trim();
    if (!name) throw Error('Hãy nhập tên đạo hữu.');
    const r = await buddyAct({ action: 'request', name });
    buddy.draft = '';
    if (input) input.value = '';
    return r;
  });
  for (const [name, action] of [['buddyAccept', 'accept'], ['buddyDecline', 'decline'], ['buddyRemove', 'remove'], ['buddyBlock', 'block'], ['buddyUnblock', 'unblock'], ['buddyCancel', 'cancel']])
    UI.action(name, (el, d) => buddyAct({ action, id: d.id }));
  // Giữ chữ đang gõ: bảng được vẽ lại khi hết thời gian chờ gợi ý hoặc khi tải lại danh sách.
  root.document?.addEventListener('input', e => { if (e.target?.id === 'buddyName') buddy.draft = String(e.target.value || ''); });
  UI.action('buddyRefresh', () => { void loadBuddies(true); return UI.KEEP; });
  UI.action('buddySuggest', () => { void loadSuggest(true); return UI.KEEP; });
  UI.action('buddyInvite', async (el, d) => {
    const r = await buddyAct({ action: 'request', id: d.id });
    buddy.sugg = buddy.sugg.filter(p => p.id !== d.id);
    refreshBuddyViews();
    return r;
  });
  UI.action('rankingRefresh', () => { void loadLeaderboard(true); return UI.KEEP; });

  const findFriend = id => FRIENDS.find(f => f.id === id);
  const findDao = id => DAO.find(f => f.id === id);
  const findRival = id => RIVALS.find(f => f.id === id);

  UI.action('moreMeet', async (el, d) => {
    const f = findFriend(d.id);
    if (!f) throw Error('Không tìm thấy vị đạo hữu này.');
    await UI.command('meetFriend', { id: d.id });
    UI.toast('Đã kết giao với ' + f.name + '.', { type: 'success', title: 'Tri kỷ' });
    UI.vfx?.stage({ kind: 'chien_dau', variant: 'linh_phu', fps: 12, size: 'clamp(100px,16vw,170px)', style: { left: '50%', bottom: '24%', transform: 'translateX(-50%)' } });
  });

  UI.action('moreGift', async (el, d) => {
    const f = findFriend(d.id);
    if (!f) throw Error('Không tìm thấy vị đạo hữu này.');
    const aff = await UI.command('giftFriend', { id: d.id });
    UI.toast('Tặng lễ ' + f.name + ' · tình nghĩa ' + aff + '/100.', { type: 'gold', title: 'Tri kỷ' });
    UI.vfx?.stage({ kind: 'chien_dau', variant: 'linh_phu', fps: 12, size: 'clamp(100px,16vw,170px)', style: { left: '50%', bottom: '24%', transform: 'translateX(-50%)' } });
  });

  UI.action('moreClaimBond', async (el, d) => {
    const f = findFriend(d.id), at = Number(d.at);
    if (!f) throw Error('Không tìm thấy vị tri kỷ này.');
    const r = await UI.command('claimBond', { id: d.id, at });
    const got = [r.stone ? '+' + money(r.stone) : '', r.exp ? '+' + num(r.exp) + ' tu vi' : ''].filter(Boolean).join(' · ');
    UI.toast('Mốc ' + at + ' với ' + f.name + ' · ' + got + '.', { type: 'gold', title: 'Tri kỷ' });
  });
  UI.action('moreBind', async (el, d) => {
    const f = findFriend(d.id);
    if (!f) throw Error('Không tìm thấy vị tri kỷ này.');
    await UI.command('bindPartner', { id: d.id });
    UI.toast('Kết duyên đạo lữ cùng ' + f.name + '.', { type: 'success', title: 'Đạo lữ' });
    UI.vfx?.stage({ kind: 'chien_dau', variant: 'linh_phu', fps: 12, size: 'clamp(100px,16vw,170px)', style: { left: '50%', bottom: '24%', transform: 'translateX(-50%)' } });
  });
  UI.action('moreSongTu', async () => {
    const r = await UI.command('songTu', {});
    UI.toast('Song tu · tu vi +' + num(r.gain) + ' · tình nghĩa ' + r.affinity + '/100.', { type: 'success', title: 'Đạo lữ' });
    UI.vfx?.effect('qi'); UI.vfx?.ring('hero', '#e6a0c4');
  });
  UI.action('moreBreak', async () => {
    if (root.confirm && !root.confirm('Ly duyên sẽ làm tình nghĩa tụt xuống ' + PARTNER.breakAffinity + ' và phải chờ mới kết lại. Tiếp tục?')) return UI.KEEP;
    const r = await UI.command('breakPartner', {});
    UI.toast('Đã ly duyên · tình nghĩa còn ' + r.affinity + '.', { type: 'danger', title: 'Đạo lữ' });
  });

  UI.action('moreDiscuss', async (el, d) => {
    const f = findDao(d.id);
    if (!f) throw Error('Không tìm thấy vị đạo hữu này.');
    const r = await UI.command('discuss', { id: d.id });
    UI.toast('Luận đạo cùng ' + f.name + ' · tu vi +' + num(r.gain) + '.', { type: 'success', title: 'Đạo hữu' });
    UI.vfx?.effect('qi');
    UI.vfx?.ring('hero', '#70d4e8');
  });

  UI.action('moreDuel', async (el, d) => {
    const f = findRival(d.id);
    if (!f) throw Error('Không tìm thấy đối thủ này.');
    const r = await UI.command('duel', { id: d.id });
    UI.toast((r.win ? 'Thắng ' : 'Thua · tọa hóa vĩnh viễn trước ') + f.name + ' · danh vọng ' + (r.delta > 0 ? '+' : '') + r.delta +
      (r.win ? ' · +' + money(r.reward) + ' · +' + num(r.exp) + ' tu vi' : '') + '.',
      { type: r.win ? 'success' : 'danger', title: r.win ? 'Sinh Tử Đài · thắng' : 'Sinh Tử Đài · thua' });
    UI.vfx?.stage({ kind: 'chien_dau', variant: r.win ? 'phi_thang' : 'ha_gioi', fps: 14, size: 'clamp(120px,19vw,200px)', style: { left: '50%', bottom: '24%', transform: 'translateX(-50%)' } });
    if (r.win) UI.vfx?.ring('hero', '#e6c164');
  });
})(typeof window !== 'undefined' ? window : globalThis);
