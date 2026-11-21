/* HƯ GIỚI · MÀN NHÂN VẬT */
(function (root) {
  'use strict';
  const H = root.HU_GAME, F = H.F, A = root.HU_ASSETS;
  const UI = root.HU_UI, L = root.HU_LABELS;
  const { abs, $, esc, num, money, moneyHTML, pct, duration, row, btn, img, codeAttr, bar, card, empty, tabs } = UI.kit;
  const { ELEMENTS } = UI.data;
  const { lists } = UI;
  const S = UI.statNames;

  const TABS = [
    { id: 'stats', label: 'Đạo thể', icon: '☯' },
    { id: 'skills', label: 'Công pháp', icon: '✧' },
    { id: 'talents', label: 'Thiên phú', icon: '✦' },
    { id: 'roots', label: 'Kinh mạch', icon: '❋' },
    { id: 'bag', label: 'Hành trang', icon: '◈' }
  ];

  /* Nhãn linh căn dùng chung cho đầu màn, hành trang và kinh mạch.
     Dị linh căn lấy màu của hệ biến thể; Hỗn Độn giữ hiệu ứng đa sắc. */
  function rootLabel(type, sub, { variant = 'badge', upper = false } = {}) {
    const text = upper ? H.rootLabel(type, sub).toUpperCase() : H.rootLabel(type, sub);
    if (!L) return esc(text);
    if (type === 'Dị' && H.DI_LINH_CAN[sub]) return L.span(text, 'element', sub, { variant });
    return L.span(text, 'root', type, { variant });
  }

  /* Thanh tiến độ nhỏ kèm nhãn; dùng chung cho tu vi và thọ nguyên ở đầu màn. */
  function meter(label, text, percent, cls) {
    return `<div class="char-meter"><div class="char-meter-top"><span>${label}</span><b>${text}</b></div>${bar(percent, cls)}</div>`;
  }

  function header() {
    const s = UI.s(), g = UI.g();
    const need = g.need(), life = H.raceLife(s.race, s.realm) + s.extraLife;
    const qiPct = need > 0 ? s.qi / need * 100 : 0, agePct = life > 0 ? s.age / life * 100 : 0;
    return `<header class="char-header">
      <div class="portrait"><img src="${A.heroPortrait(s.gender, s.realm)}" alt="${esc(s.name)}" decoding="async"></div>
      <div class="char-id">
        <h2>${esc(s.name)}</h2>
        <p class="char-realm">${g.realmLabel()} · ${F.realm_map(s.zone)}</p>
        <p class="muted">${H.raceName(s.race)} · ${rootLabel(s.rootType, s.rootSub)}</p>
      </div>
      <div class="char-meters">
        ${meter('Tu vi', num(s.qi) + ' / ' + num(need), qiPct, 'qi')}
        ${meter('Thọ nguyên', num(Math.floor(s.age)) + ' / ' + num(life) + ' năm', agePct, 'age')}
      </div>
    </header>`;
  }

  /* Ô chỉ số: nhãn nhỏ phía trên, giá trị lớn phía dưới.
     `key` tra màu nhãn trong HU_LABELS; không truyền key thì dùng màu chữ thường. */
  const tile = (label, value, cls = '', key = '') => {
    const name = key && L ? L.span(label, 'stat', key) : esc(label);
    return `<div class="stat-tile ${cls}"><span>${name}</span><b>${value}</b></div>`;
  };

  function stats() {
    const s = UI.s(), g = UI.g(), st = g.stats();
    const glossary = Object.entries(S).map(([key, label]) =>
      '<div class="stat-definition"><dt>' + esc(label) + '</dt><dd>' + esc(UI.statDescriptions[key] || '') + '</dd></div>'
    ).join('');
    const power = [[S.hp, num(st.HP), 'hp'], [S.mp, num(g.maxMp()), 'mp'], [S.sta, num(st.STA), 'sta'], [S.atk, num(st.ATK), 'atk'],
      [S.def, num(st.DEF), 'def'], [S.spd, num(st.SPD), 'spd'], [S.cp, num(st.CP), 'cp'], [S.crit, pct(st.CRIT), 'crit'],
      [S.critDamage, pct(st.CRIT_DMG), 'critDamage'], [S.dodge, pct(st.DODGE), 'dodge']];
    const pillCap = .25 * F.realm_exp_total(s.realm);
    return `<div class="char-sheet has-figure"><figure class="sheet-figure"><img src="${esc(A.heroSrc(s.gender, s.zone, 'dung_yen', 0))}" alt="${esc(s.name)} đang ngồi thiền" decoding="async"></figure><div class="sheet-main">
      ${card('Chiến lực', `<div class="stat-tiles">${power.map(([k, v, key]) => tile(k, v, '', key)).join('')}</div>`, { eyebrow: 'Chỉ số', cls: 'sheet-power' })}
      ${card('Tu luyện', `<div class="stat-tiles tiles-4">${tile(S.qiRate, num(g.rate()) + '<small>/giây</small>', '', 'qiRate')}${tile('Tu vi từ đan', num(s.pillRealmExp) + '<small>/ ' + num(pillCap) + '</small>')}${tile('Đan đã dùng', s.pillUses + '<small>viên · tầng này</small>')}${tile('Tâm ma', num(s.tamMa || 0) + '<small>/ ' + (H.TAM_MA_MAX || 100) + ' · đột phá −' + Math.min(15, (s.tamMa || 0) * (H.TAM_MA_BREAK_PENALTY || .0015) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%</small>', s.tamMa >= 50 ? 'tile-warn' : '')}</div>`, { eyebrow: 'Đạo cảnh', cls: 'sheet-cultivate' })}
      ${card('Giải nghĩa chỉ số', `<details class="stat-glossary"><summary>Xem ý nghĩa các chỉ số</summary><dl>${glossary}</dl></details>`, { eyebrow: 'Đạo thể', cls: 'sheet-glossary' })}
    </div></div>`;
  }

  /* Tab Thiên phú: điểm khởi nguyên của nhân vật và tác dụng hiện tại của từng điểm. */
  function talents() {
    const s = UI.s();
    const list = H.TALENT_INFO.map(t => {
      const v = s.talent?.[t.key] || 0;
      const name = L ? L.span(t.name, 'talent', t.key) : esc(t.name);
      return `<li class="talent-chip"><b>${name}</b><span>${v} điểm</span><small>${esc(t.effect(v))}</small></li>`;
    }).join('');
    return `<div class="char-sheet">${card('Thiên phú khởi nguyên', `<ul class="talent-list">${list}</ul>`, { eyebrow: 'Khởi nguyên', cls: 'sheet-talent' })}</div>`;
  }

  function skills() {
    const s = UI.s();
    const room = H.MANUALS.slots(s.realm);
    const entry = key => {
      const x = H.item(key), sc = H.MANUALS.school(x), on = s.activeManuals.includes(key);
      const state = sc === 'nghe' ? '<span class="gold">Đã mở nghề</span>' : btn(on ? 'Dừng vận hành' : 'Vận hành', 'activate', codeAttr(key));
      const cast = sc === 'ngoai' && on ? btn('Thi triển', 'castManual', codeAttr(key), false, 'btn-outline') : '';
      const q = F.SUBPHAM[x.sub];
      return `<div class="technique-item technique-compact">${img(key)}<div><h3>${UI.kit.itemName(x)}</h3>
        <p>${x.realm} · ${L ? L.span(q, 'quality', q) : esc(q)} · thuần thục ${pct(s.learned[key])}</p><p class="technique-desc">${esc(H.MANUALS.describe(x))}</p></div>
        <div class="technique-actions">${cast}${state}</div></div>`;
    };
    const group = (sc, title, hint) => {
      const keys = Object.keys(s.learned).filter(k => H.item(k) && H.MANUALS.school(H.item(k)) === sc);
      const used = s.activeManuals.filter(k => H.MANUALS.school(H.item(k)) === sc).length;
      const count = sc === 'nghe' ? `${keys.length} bí tịch` : `${used}/${room[sc]} ô`;
      return `<h3 class="section-title">${title}<small class="title-count"> · ${count}</small></h3><p class="info-note">${hint}</p>
        <div class="skill-list">${keys.map(entry).join('') || empty('Chưa lĩnh ngộ sách nào thuộc hệ này.')}</div>`;
    };
    const learned = group('ngoai', 'Ngoại tu · chủ động', 'Đặt vào ô để thi triển khi chiến đấu; khi tự động chiến đấu, skill sẵn sàng sẽ tự được thi triển. Tốn linh lực và có hồi chiêu.')
      + group('noi', 'Nội tu · bị động', 'Đặt vào ô, luôn có hiệu lực: tăng tốc độ hấp thụ linh khí, sinh lực và phòng ngự.')
      + group('nghe', 'Bí tịch nghề', 'Không chiếm ô. Học xong là mở nghề; sách phẩm cao tăng tỉ lệ thành công, chất lượng thành phẩm và mở đan hiếm.');
    return `<p class="screen-lead">Ngoại tu là skill chủ động, nội tu là skill bị động, mỗi hệ có số ô riêng mở dần theo cảnh giới. Thuần thục tăng khi tu luyện; thấp hơn một cảnh giới giảm hiệu quả. Phẩm chất sách quyết định độ mạnh.</p>
      ${learned}`;
  }

  /* Sơ đồ trực quan, chỉ tra cứu kinh mạch dự kiến, chưa tạo trạng thái mới trên máy chủ. */
  const MERIDIAN_POSITIONS = Object.freeze({
    chinh: [[38,39],[29,49],[46,60],[41,67],[58,39],[70,49],[66,77],[56,68],[51,44],[51,54],[35,76],[60,60]],
    ky: [[50,34],[50,22],[50,61],[50,70],[34,86],[66,86],[42,50],[59,50]]
  });

  function meridianPanel() {
    const M = root.HU_MERIDIANS;
    if (!M) return '';
    const state = UI.s(), ui = UI.view, media = root.HU_CUSTOM_MEDIA;
    const group = ui.meridianGroup === 'ky' ? 'ky' : 'chinh';
    // Chính Kinh luôn màu xanh, Kỳ Kinh luôn màu vàng.
    const tone = group === 'ky' ? 'vang' : 'xanh';
    const list = group === 'ky' ? M.KY_KINH : M.CHINH_KINH;
    const picked = Number.isInteger(ui.meridianIndex) && ui.meridianIndex >= 0 && ui.meridianIndex < list.length
      ? ui.meridianIndex : 0;
    const current = list[picked];
    const points = list.map((item, i) => {
      const [x, y] = MERIDIAN_POSITIONS[group][i];
      return '<button type="button" class="meridian-point" data-act="meridianPick" data-index="' + i +
        '" data-label="' + esc(item.short) + '" aria-label="Xem ' + esc(item.name) +
        '" aria-pressed="' + (i === picked) + '" title="' + esc(item.name) +
        '" style="--point-x:' + x + '%;--point-y:' + y + '%;--point-color:' +
        (group === 'ky' ? '#e5c458' : '#75bfed') + '"></button>';
    }).join('');
    // Danh sách theo thứ tự tuần hoàn kinh mạch, từ Phế (01) đến Can (12).
    // Giúp chọn đúng tên khi các điểm trên hình nằm sát nhau.
    const ordered = list.map((item, i) =>
      '<button type="button" class="meridian-sequence-item' + (i === picked ? ' selected' : '') +
      '" data-act="meridianPick" data-index="' + i + '" aria-pressed="' + (i === picked) +
      '" title="' + esc(item.name) + '"><b>' + String(i + 1).padStart(2, '0') + '</b><span>' +
      esc(item.short) + '</span></button>').join('');
    const preview = M.preview(state.roots, state.rootType, state.rootSub);
    const relation = M.relation(current.he, preview.heList);
    const connection = current.he === 'Trung hòa' ? 'Trung hòa'
      : relation === 'same' ? 'Cùng hệ linh căn' : relation === 'sinh' ? 'Hệ tương sinh' : 'Chưa có liên hệ cùng hệ';
    // WebP chất lượng cao chỉ có khi đã cài gói ảnh; SVG minh họa có sẵn trên web.
    const person = media?.installed
      ? media.meridian(state.gender, tone)
      : media?.meridianFallback?.(state.gender, tone);
    const figure = person
      ? '<img class="meridian-person" src="' + esc(abs(person)) + '" alt="Tu sĩ ' +
        (state.gender === 'nu' ? 'nữ' : 'nam') + ' ngồi thiền · ' +
        (tone === 'vang' ? 'Kim quang' : 'Thanh quang') + '" loading="eager" decoding="async">'
      : '<div class="meridian-map-fallback" aria-hidden="true">☯</div>';
    const option = (action, key, val, label, pressed) =>
      '<button type="button" data-act="' + action + '" data-' + key + '="' + val +
      '" aria-pressed="' + pressed + '">' + label + '</button>';
    return '<section class="meridian-panel" aria-label="Sơ đồ kinh mạch tham khảo">' +
      '<div class="meridian-board"><span class="eyebrow gold">Kinh mạch đồ</span>' +
      '<h3>Huyệt vị trên đạo thể</h3>' +
      '<p class="info-note">Chọn các điểm sáng để xem thông tin. Vị trí chỉ mang tính minh họa, chưa phải cơ chế thông mạch đang hoạt động.</p>' +
      '<div class="meridian-toolbar" role="group" aria-label="Loại kinh mạch">' +
      option('meridianGroup', 'group', 'chinh', '12 Chính Kinh', group === 'chinh') +
      option('meridianGroup', 'group', 'ky', '8 Kỳ Kinh', group === 'ky') + '</div>' +
      '<div class="meridian-map">' + figure + points + '</div>' +
      '<div class="meridian-map-legend"><span>● Chạm điểm sáng để tra cứu</span><span>' +
      (group === 'chinh' ? '12 Chính Kinh · Màu xanh' : '8 Kỳ Kinh · Màu vàng') + '</span></div>' +
      '<div class="meridian-sequence" role="group" aria-label="Danh sách kinh mạch theo thứ tự">' + ordered + '</div></div>' +
      '<div class="meridian-info"><span class="meridian-kind">' + esc(current.kind) + '</span>' +
      '<h4>' + esc(current.name) + '</h4>' +
      row('Ngũ hành', esc(current.he)) +
      row('Độ hiếm dự kiến', L ? L.span(M.RARITY[current.rarity]?.name || current.rarity, 'rarity', current.rarity) : esc(M.RARITY[current.rarity]?.name || current.rarity)) +
      row('Mở theo thiết kế', esc(current.opens)) +
      (current.points ? row('Số huyệt theo thiết kế', String(current.points)) : '') +
      row('Liên hệ với linh căn', esc(connection)) +
      '<p class="meridian-effect"><b>Hiệu ứng thiết kế:</b> ' + esc(current.stat) + '</p>' +
      '<p class="meridian-effect"><b>Khi viên mãn:</b> ' + esc(current.perfect) + '</p>' +
      '<p class="meridian-hint">Các hiệu ứng trên là thông tin tham khảo từ bản thiết kế kinh mạch; chưa cộng vào chỉ số nhân vật. Tu luyện linh căn hiện tại vẫn thực hiện ở phần bên dưới.</p>' +
      '</div></section>';
  }

  function roots() {
    return meridianPanel() + UI.adventure.roots();
  }

  /* ---------- Cửa sổ nổi: trang bị, công pháp, chi tiết vật phẩm ---------- */
  const popup = (title, eyebrow, body, opts = {}) => UI.modal(title, `<div class="pop">${body}</div>`, null, 'Đóng', eyebrow, { vfx: false, ...opts });
  const qualityOf = x => F.SUBPHAM[x.sub];
  const popCell = (key, from, note = '') => {
    const x = H.item(key), q = qualityOf(x), qClass = L ? ' ' + L.keyClass('quality', q) : '';
    return `<button type="button" class="pop-item inventory-cell${qClass}" data-select="${esc(key)}" data-popup="1" data-from="${from}" data-sub="${x.sub}" aria-label="${esc(x.name)} · ${q} phẩm${note ? ' · ' + esc(note) : ''}">${img(key)}<span class="pop-name">${UI.kit.itemName(x)}</span>${note ? `<span class="pop-note">${esc(note)}</span>` : ''}</button>`;
  };

  function itemDetail(key, back) {
    const s = UI.s(), g = UI.g(), x = H.item(key);
    if (!x) return empty('Vật phẩm không còn tồn tại.');
    const equipped = s.equipment.includes(key), learned = key in s.learned, active = s.activeManuals.includes(key);
    const usable = ['PILL', 'TAL', 'GFT', 'CAT', 'FERT', 'SEED'].includes(x.kind) || (x.kind === 'HERB' && x.design?.['cách dùng']?.includes('ăn trực tiếp'));
    let primary = '';
    if (x.kind === 'EQ') primary = btn(equipped ? 'Tháo' : 'Trang bị', 'equip', codeAttr(key));
    else if (x.kind === 'BT') primary = learned ? (H.MANUALS.school(x) === 'nghe' ? '<span class="gold">Đã học bí tịch nghề</span>' : btn(active ? 'Dừng vận hành' : 'Vận hành', 'activate', codeAttr(key))) : btn('Lĩnh ngộ', 'learn', codeAttr(key));
    else primary = btn(usable ? 'Sử dụng' : 'Công dụng', usable ? 'consume' : 'info', codeAttr(key));
    const count = g.count(key);
    const sell = count > 0 ? btn('Bán 1', 'sell', codeAttr(key), equipped && count <= 1, 'btn-outline') : '';
    const back_ = back ? `<button type="button" class="btn btn-outline" data-act="${back}">‹ Quay lại</button>` : '';
    const d = x.design, e = H.DESIGN.effects[x.code], scale = 2 ** (x.sub - H.BY_ID[x.code].sub);
    let detail = '', effect = '';
    if (d?.group === 'pháp bảo') {
      detail = row('Thuộc tính', 'Sinh lực +' + num(d['hp cộng'] * scale) + ' · Linh lực +' + num(d['mp cộng'] * scale) + ' · Công kích +' + num(d['atk cộng'] * scale) + ' · Phòng thủ +' + num(d['def cộng'] * scale)) +
        row('Né tránh / bạo kích', '+' + num(d['eva cộng (%)'] * scale) + '% / +' + num(d['crit cộng (%)'] * scale) + '%') +
        (e ? row('Hiệu ứng', esc(e['hiệu ứng']) + ' · ' + esc(e['điều kiện kích hoạt'])) : '');
    } else if (d?.group === 'công pháp') {
      detail = row('Hệ', esc(d['hệ'])) + row('Kỹ năng', esc(d['công dụng']) + ' · ' + d['tiêu hao mp'] + ' linh lực · ' + d['hồi chiêu (giây)'] + ' giây');
    } else if (d?.group === 'bí tịch') {
      detail = row('Thể loại', esc(d['thể loại'])) + row('Công dụng', esc(d['công dụng']));
    } else if (x.kind === 'PILL' || x.kind === 'TAL') {
      effect = UI.kit.pillEffectText ? UI.kit.pillEffectText(x) : '';
    } else {
      effect = UI.kit.itemEffectText ? UI.kit.itemEffectText(x) : '';
      if (effect === x.description) effect = '';
    }
    const requiredRealm = Number.isInteger(x.useReq?.realmMin) ? F.REALMS[x.useReq.realmMin] : x.realm;
    const condition = UI.kit.useCondition ? UI.kit.useCondition(x) : (x.kind === 'QITEM' ? 'Vật phẩm nhiệm vụ, không bán' : 'Không có điều kiện đặc biệt');
    const sellPrice = count > 0 ? F.shop_sell_price(g.price(key)) : 0;
    const facts = [
      ['Cảnh giới yêu cầu', requiredRealm || '—'],
      count ? ['Số lượng', '×' + num(count)] : null,
      learned ? ['Thuần thục', pct(s.learned[key])] : null,
      sellPrice ? ['Giá bán', moneyHTML(sellPrice), true] : null,
      x.age ? ['Tuổi dược liệu', x.age] : null
    ].filter(Boolean);
    const notes = [['Điều kiện', condition]];
    if (x.kind === 'PILL' && x.effect === 'TU_VI') notes.push(['Lưu ý', 'Đan tăng tu vi giảm dần theo số viên đã dùng trong tầng hiện tại; tổng tu vi từ đan mỗi cảnh giới có trần.']);
    return UI.kit.itemSheet(x, {
      effect, facts, notes, detail, hideDesc: !!detail,
      actions: back_ + primary + sell
    });
  }

  function gearWindow() {
    const s = UI.s(), g = UI.g();
    const worn = Array.from({ length: 4 }, (_, i) => {
      const key = s.equipment[i];
      return key ? `<div class="pop-worn">${popCell(key, 'gearOpen', 'Đang mặc')}<button type="button" class="btn btn-outline pop-unequip" data-act="equip" ${codeAttr(key)} aria-label="Tháo ${esc(H.item(key).name)}">Tháo</button></div>` : `<div class="pop-item pop-empty" aria-label="Ô pháp bảo ${i + 1} trống"><span>＋</span><span class="pop-name">Ô ${i + 1}</span></div>`;
    }).join('');
    const spare = Object.keys(s.bag).map(H.item).filter(x => x && x.kind === 'EQ' && g.count(x.key) > (s.equipment.includes(x.key) ? 1 : 0))
      .sort((a, b) => a.tier - b.tier || a.code.localeCompare(b.code) || a.sub - b.sub)
      .map(x => popCell(x.key, 'gearOpen', '×' + (g.count(x.key) - (s.equipment.includes(x.key) ? 1 : 0)))).join('');
    popup('Pháp bảo', 'Đạo thân', `<h4 class="pop-title">Đang trang bị <span class="title-count">${s.equipment.length}/4</span></h4><div class="pop-grid">${worn}</div>
      <h4 class="pop-title">Trong túi trữ vật</h4><div class="pop-grid">${spare || empty('Không còn pháp bảo nào trong túi.')}</div>`);
  }

  function manualWindow() {
    const s = UI.s(), room = H.MANUALS.slots(s.realm);
    const keys = Object.keys(s.learned).filter(k => H.item(k));
    const part = (sc, title) => {
      const mine = keys.filter(k => H.MANUALS.school(H.item(k)) === sc);
      const used = s.activeManuals.filter(k => H.MANUALS.school(H.item(k)) === sc).length;
      const count = sc === 'nghe' ? mine.length + ' sách' : `đang vận ${used}/${room[sc]}`;
      const cells = mine.map(k => popCell(k, 'manualOpen', (s.activeManuals.includes(k) ? 'Đang vận · ' : '') + pct(s.learned[k]))).join('');
      return `<h4 class="pop-title">${title} <span class="title-count">${count}</span></h4><div class="pop-grid">${cells || empty('Chưa có.')}</div>`;
    };
    popup('Công pháp', 'Truyền thừa', keys.length ? part('ngoai', 'Ngoại tu') + part('noi', 'Nội tu') + part('nghe', 'Bí tịch nghề')
      : `<div class="pop-grid">${empty('Chưa lĩnh ngộ công pháp nào. Mở một bí tịch trong Hành trang để lĩnh ngộ.')}</div>`);
  }

  function bagOrder() {
    const player = UI.session?.playerId;
    if (!player) return [];
    if (UI.view.bagOrderPlayer !== player) {
      UI.view.bagOrderPlayer = player;
      try { const saved = JSON.parse(root.localStorage?.getItem('hugioi.bag-order.' + player) || '[]'); UI.view.bagOrder = Array.isArray(saved) ? saved.filter(x => typeof x === 'string').slice(0, 1000) : []; }
      catch { UI.view.bagOrder = []; }
    }
    return UI.view.bagOrder || [];
  }

  function bag() {
    const s = UI.s(), g = UI.g(), v = UI.view;
    const slots = Array.from({ length: 4 }, (_, i) => {
      const key = s.equipment[i], item = key && H.item(key);
      return `<button type="button" class="gear-slot ${key ? '' : 'empty'} gear-corner-${i}" data-gear-drop="${i}" data-act="gearOpen" aria-label="${key ? 'Mở cửa sổ pháp bảo, đang mặc ' + esc(item.name) : 'Ô pháp bảo ' + (i + 1) + ' trống, mở cửa sổ pháp bảo'}">${key ? img(key) : '<span>＋</span>'}<small>${key ? esc(item.name) : 'Ô ' + (i + 1)}</small></button>`;
    }).join('');
    /* Hành trang chứa cả các ô trang bị và toàn bộ vật phẩm trong túi. */
    const xs = Object.keys(s.bag).map(H.item).filter(x => x && g.count(x.key) > (s.equipment.includes(x.key) ? 1 : 0))
      .sort((a, b) => a.tier - b.tier || a.kind.localeCompare(b.kind) || a.code.localeCompare(b.code) || a.sub - b.sub);
    const order = bagOrder();
    const visible = xs.slice().sort((a,b) => { const ai=order.indexOf(a.key), bi=order.indexOf(b.key); return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi); });
    const room = H.MANUALS.slots(s.realm);
    const manualCells = (sc, mark) => {
      const mine = s.activeManuals.filter(k => H.MANUALS.school(H.item(k)) === sc);
      return Array.from({ length: room[sc] }, (_, i) => {
        const key = mine[i];
        return key ? `<button type="button" class="manual-gear-slot" data-act="manualOpen" aria-label="Mở cửa sổ công pháp, ${mark} đang vận ${esc(H.item(key).name)}">${img(key)}<small>${esc(H.item(key).name)}</small></button>`
          : `<button type="button" class="manual-gear-slot empty" data-act="manualOpen" aria-label="Ô ${mark} ${i + 1} trống, mở cửa sổ công pháp"><span>＋</span><small>${mark} ${i + 1}</small></button>`;
      }).join('');
    };
    const used = sc => s.activeManuals.filter(k => H.MANUALS.school(H.item(k)) === sc).length;
    const manualRow = (sc, label, note) => `<div class="manual-gear-row ${sc}" role="group" aria-label="${label}: ${used(sc)}/${room[sc]} ô"><header><b>${label}</b><small>${note} · ${used(sc)}/${room[sc]}</small></header><div class="manual-gear-grid">${manualCells(sc, label)}</div></div>`;
    const manuals = manualRow('ngoai', 'Ngoại tu', 'chủ động') + manualRow('noi', 'Nội tu', 'bị động');
    return `<div class="inventory-scene-layout">
      <div class="inventory-hero-column"><section id="equippedItems" class="gear-stage" aria-label="Đạo thân và pháp bảo"><div class="gear-stage-heading"><span class="eyebrow gold">Đạo thân</span><h3>Pháp bảo<small class="title-count"> · ${s.equipment.length}/4</small></h3></div><img class="gear-hero" src="${esc(A.heroSrc(s.gender, s.zone, 'dung_yen', 0))}" alt="${esc(s.name)} đang ngồi thiền">${slots}<p class="gear-stage-hint">Chạm ô pháp bảo để mở cửa sổ trang bị, hoặc kéo pháp bảo vào ô trống.</p></section><section class="manual-gear-panel"><div><span class="eyebrow gold">Truyền thừa</span><h3>Công pháp · 4 ngoại · 4 nội</h3></div>${manuals}</section></div>
      <section class="inventory-pouch card"><header class="card-head"><div><span class="eyebrow gold">Túi trữ vật</span><h3>Hành trang</h3></div><small>${xs.length} loại</small></header><p class="rarity-legend">${F.SUBPHAM.map(q => L ? L.span(q, 'quality', q) : esc(q)).join('')}</p><div class="inventory-items">${visible.map(i => {
        const quality = F.SUBPHAM[i.sub];
        const qClass = L ? ' ' + L.keyClass('quality', quality) : '';
        return `<button class="inventory-cell ${v.selected === i.key ? 'selected' : ''}${qClass}" data-select="${esc(i.key)}" data-popup="1" data-drag-item="${esc(i.key)}" draggable="true" data-sub="${i.sub}" aria-label="${esc(i.name)} · ${quality} phẩm · số lượng ${num(g.count(i.key))}">${img(i.key)}<span class="inv-count">×${num(g.count(i.key) - (s.equipment.includes(i.key) ? 1 : 0))}</span><span class="inv-sub" aria-hidden="true">${quality}</span></button>`;
      }).join('') || empty('Túi trữ vật đang trống.')}</div></section>
    </div>`;

  }

  UI.register({
    id: 'character', label: 'Nhân vật', icon: 'ICON-MENU-003', eyebrow: 'Đạo thể',
    tabs: TABS,
    pageBg: () => UI.kit.abs(root.HU_ASSETS.BG.character),
    render: tab => header() + tabs(TABS, tab) + `<div class="screen-body">${{ stats, skills, talents, roots, bag }[tab]()}</div>`,
    signature: () => {
      const s = UI.s();
      return [s.realm, s.stage, UI.session.pavilion?.balance || 0, s.meta?.points || 0, Object.keys(s.meta?.achievements || {}).length, s.sect.id].join('|');
    }
  });

  /* Mọi thao tác trong cửa sổ nổi chạy được dù cửa sổ đang mở; shell tự đóng cửa sổ trước khi chạy. */
  ['itemPop', 'gearOpen', 'manualOpen', 'equip', 'learn', 'activate', 'castManual', 'consume', 'sell', 'info'].forEach(name => UI.modalActions?.add(name));
  UI.action('gearOpen', () => { gearWindow(); return UI.KEEP; });
  UI.action('manualOpen', () => { manualWindow(); return UI.KEEP; });
  UI.action('itemPop', (el, d) => {
    if (!H.item(d.select)) return UI.KEEP;
    popup(H.item(d.select).name, d.from === 'manualOpen' ? 'Công pháp' : d.from === 'gearOpen' ? 'Pháp bảo' : 'Vật phẩm', itemDetail(d.select, d.from));
    return UI.KEEP;
  });

  /* Vuốt xuống trên cửa sổ nổi (khi đã cuộn tới đầu) để đóng, cho điện thoại. */
  let swipe = null;
  document.addEventListener('touchstart', e => {
    const box = e.target.closest?.('.game-modal');
    swipe = box?.querySelector('.pop') && box.scrollTop <= 0 && e.touches.length === 1 ? { box, y: e.touches[0].clientY } : null;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!swipe) return;
    const dy = (e.changedTouches[0]?.clientY ?? 0) - swipe.y; swipe = null;
    if (dy > 110) UI.closeModal?.();
  }, { passive: true });

  let draggedEquip = '';
  const moveItem = (key, before) => {
    if (!key || !before || key === before) return;
    const keys = Array.from(document.querySelectorAll('.inventory-items [data-drag-item]'), el => el.dataset.dragItem);
    const from = keys.indexOf(key), to = keys.indexOf(before);
    if (from < 0 || to < 0) return;
    keys.splice(from, 1); keys.splice(keys.indexOf(before), 0, key); UI.view.bagOrder = keys;
    try { if (UI.session?.playerId) root.localStorage?.setItem('hugioi.bag-order.' + UI.session.playerId, JSON.stringify(keys)); } catch { /* vị trí vẫn dùng được trong phiên hiện tại */ }
    UI.refresh();
  };
  const dropEquip = async (key, target) => {
    if (!key || !target?.matches('[data-gear-drop].empty')) return;
    if (H.item(key)?.kind !== 'EQ') { UI.toast('Chỉ pháp bảo mới có thể trang bị.', { type: 'info' }); return; }
    if (UI.s().equipment.includes(key)) { UI.toast('Pháp bảo này đang trang bị.', { type: 'info' }); return; }
    try { await UI.command('equip', { code: key }); UI.toast('Đã trang bị ' + H.item(key).name + '.', { type: 'success', title: 'Pháp bảo' }); UI.refresh(); }
    catch (error) { UI.toast(error.message || 'Không thể trang bị.', { type: 'danger' }); }
  };
  document.addEventListener('dragstart', e => {
    const item = e.target.closest?.('[data-drag-item]');
    if (!item) return;
    draggedEquip = item.dataset.dragItem;
    e.dataTransfer?.setData('text/plain', draggedEquip);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragover', e => { if (draggedEquip && e.target.closest?.('[data-gear-drop].empty, [data-drag-item]')) e.preventDefault(); });
  document.addEventListener('drop', e => {
    const target = e.target.closest?.('[data-gear-drop].empty, [data-drag-item]');
    if (!target || !draggedEquip) return;
    e.preventDefault(); const key = draggedEquip; draggedEquip = '';
    if (target.dataset.dragItem) moveItem(key, target.dataset.dragItem); else void dropEquip(key, target);
  });
  document.addEventListener('dragend', () => { draggedEquip = ''; });
  let touchDrag = null;
  document.addEventListener('pointerdown', e => {
    const item = e.target.closest?.('[data-drag-item]');
    if (item && e.pointerType === 'touch') touchDrag = { id: e.pointerId, key: item.dataset.dragItem, x: e.clientX, y: e.clientY, moved: false };
  });
  document.addEventListener('pointermove', e => {
    if (!touchDrag || e.pointerId !== touchDrag.id) return;
    if (Math.hypot(e.clientX - touchDrag.x, e.clientY - touchDrag.y) > 12) touchDrag.moved = true;
    if (touchDrag.moved && e.cancelable) e.preventDefault();
  }, { passive: false });
  document.addEventListener('pointerup', e => {
    if (!touchDrag || e.pointerId !== touchDrag.id) return;
    const drag = touchDrag; touchDrag = null;
    if (!drag.moved) return;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-gear-drop].empty, [data-drag-item]');
    if (target) { e.preventDefault(); if (target.dataset.dragItem) moveItem(drag.key, target.dataset.dragItem); else void dropEquip(drag.key, target); }
  });
  document.addEventListener('pointercancel', () => { touchDrag = null; });

  UI.action('meridianPick', (el, d) => { const n = Number(d.index); if (Number.isInteger(n)) UI.view.meridianIndex = n; });
  UI.action('meridianGroup', (el, d) => { UI.view.meridianGroup = d.group === 'ky' ? 'ky' : 'chinh'; UI.view.meridianIndex = 0; });

  UI.action('equip', async (el, d) => {
    await UI.command('equip', { code: d.code });
    const equipped = UI.s().equipment.includes(d.code);
    UI.toast((equipped ? 'Đã trang bị ' : 'Đã tháo ') + H.item(d.code).name + '.', { type: 'success', title: 'Pháp bảo' });
    UI.vfx?.stage({ kind: 'chien_dau', variant: 'linh_phu', fps: 12, size: 'clamp(100px,16vw,170px)', style: { left: '50%', bottom: '24%', transform: 'translateX(-50%)' } });
  });
  UI.action('learn', async (el, d) => {
    await UI.command('learn', { code: d.code });
    UI.toast('Đã lĩnh ngộ ' + H.item(d.code).name + '.', { type: 'success', title: 'Công pháp' });
    UI.vfx?.stage({ kind: 'chien_dau', variant: 'linh_phu', fps: 12, size: 'clamp(110px,17vw,180px)', style: { left: '50%', bottom: '24%', transform: 'translateX(-50%)' } });
  });
  UI.action('activate', async (el, d) => {
    await UI.command('activate', { code: d.code });
    const on = UI.s().activeManuals.includes(d.code);
    UI.toast((on ? 'Đang vận hành ' : 'Đã dừng ') + H.item(d.code).name + '.', { type: on ? 'success' : 'info', title: 'Công pháp' });
    if (on) UI.vfx?.stage({ kind: 'chien_dau', variant: 'linh_phu', fps: 12, size: 'clamp(100px,16vw,170px)', style: { left: '50%', bottom: '24%', transform: 'translateX(-50%)' } });
  });
  UI.action('castManual', async (el, d) => {
    await UI.command('castManual', { code: d.code });
    UI.toast('Thi triển ' + H.item(d.code).name + '.', { type: 'success', title: 'Ngoại tu' });
  });
  UI.action('consume', async (el, d) => {
    const x = H.item(d.code), msg = await UI.command('use', { code: d.code });
    const bad = /thất bại|không thể|không đủ|chưa đủ/i.test(msg);
    UI.toast(msg, { type: bad ? 'danger' : 'success', title: bad ? 'Không thể dùng' : 'Sử dụng vật phẩm' });
    if (['PILL', 'TAL'].includes(x?.kind)) {
      const healing = ['HOI_PHUC', 'HOI_HP', 'HOI_MP'].includes(x.effect);
      if (x.effect === 'KIEP') UI.vfx?.hero({ kind: 'chien_dau', variant: 'ho_thuan', fps: 12 });
      else if (healing) UI.vfx?.effect('heal');
      else UI.vfx?.effect(x.effect === 'DOT_PHA' ? 'break' : 'qi');
      UI.vfx?.ring('hero', healing ? '#63d6a3' : '#e6c164');
    }
  });
  UI.action('sell', async (el, d) => {
    const price = money(F.shop_sell_price(UI.g().price(d.code)));
    await UI.command('sell', { code: d.code });
    UI.toast('Đã bán ' + H.item(d.code).name + ' · +' + price + '.', { type: 'loot', title: 'Bán vật phẩm' });
  });
  UI.action('info', async (el, d) => { UI.toast(H.item(d.code).description, { type: 'info', title: H.item(d.code).name }); return UI.KEEP; });
})(typeof window !== 'undefined' ? window : globalThis);
