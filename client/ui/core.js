/* HƯ GIỚI · LÕI GIAO DIỆN
 * Kit dựng HTML, bộ lọc và cầu nối đến phiên chơi.
 * Chạy bằng script cổ điển để mở thẳng file:// được. */
(function (root) {
  'use strict';
  const H = root.HU_GAME, F = H.F, A = root.HU_ASSETS;
  if (!H || !F || !A) throw new Error('Thiếu lõi game. Kiểm tra thứ tự thẻ script.');
  const UI = root.HU_UI = root.HU_UI || {};
  // Một cấu hình phát hành cho các điểm vào UI và nhãn nội dung giả lập.
  // Chat/ranking người chơi thật đi qua Edge API JWT + schema game private.
  const release = UI.release = {
    chat: true,
    ranking: true,
    labels: Object.freeze({
      friends: 'NPC · mô phỏng',
      partner: 'NPC · mô phỏng',
      dao: 'NPC · mô phỏng',
      pvp: 'NPC · mô phỏng',
      auction: 'Phiên mô phỏng · không có người mua/bán khác',
      sect: 'Tông môn cá nhân · chưa có thành viên khác'
    }),
    allowed(target) {
      const [screen, tab] = String(target || '').replace(/^#/, '').replace('/', ':').split(':');
      return !(screen === 'chat' && !this.chat || screen === 'more' && tab === 'ranking' && !this.ranking);
    },
    tabs(items) { return items.filter(item => this.allowed('more:' + item.id)); },
    socialFeatureLabel(original) {
      return this.ranking ? original : 'Giao du NPC: tri kỷ, đạo hữu, luận kiếm';
    },
    notice(key) {
      const label = this.labels[key];
      return label ? '<p class="info-note release-label" role="note">' + esc(label) + '</p>' : '';
    },
    syncMoreMenu() {
      const menu = document.getElementById('moreMenu');
      if (!menu) return;
      const existing = menu.querySelector('[data-more-go="more:ranking"]');
      if (!this.ranking) { existing?.remove(); return; }
      if (existing) return;
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.setAttribute('role', 'menuitem');
      entry.dataset.moreGo = 'more:ranking';
      entry.innerHTML = '<span class="more-ico" aria-hidden="true">♛</span><span><b>Bảng xếp hạng</b><small>Người chơi trực tuyến</small></span>';
      menu.appendChild(entry);
    }
  };

  // Tên chỉ số dùng thống nhất trên mọi màn. Chỉ đổi cách gọi, không sửa công thức.
  UI.statNames = Object.freeze({
    qi: 'Tu vi',
    qiRate: 'Tốc độ hấp thụ linh khí',
    hp: 'Sinh lực',
    mp: 'Linh lực tối đa',
    sta: 'Thể lực',
    atk: 'Công kích',
    def: 'Phòng thủ',
    spd: 'Thân pháp',
    cp: 'Chiến lực',
    crit: 'Tỷ lệ bạo kích',
    critDamage: 'Sát thương bạo kích',
    dodge: 'Tỷ lệ né tránh'
  });

  UI.statDescriptions = Object.freeze({
    qi: 'Tu vi tích lũy để đạt bình cảnh và đột phá tầng tu luyện.',
    qiRate: 'Lượng tu vi tích lũy mỗi giây khi hấp thụ linh khí thiên địa.',
    hp: 'Sinh lực tối đa của đạo thân; cạn sinh lực sẽ bất lợi khi giao chiến.',
    mp: 'Linh lực tối đa dùng để thi triển kỹ năng và công pháp.',
    sta: 'Nền tảng sức bền thể chất của đạo thân.',
    atk: 'Uy lực của những đòn tấn công lên đối thủ.',
    def: 'Khả năng chống đỡ sát thương khi giao chiến.',
    spd: 'Độ linh hoạt và tốc độ ứng biến của đạo thân.',
    cp: 'Mức chiến lực tổng hợp từ các thuộc tính chiến đấu.',
    crit: 'Khả năng tạo ra đòn công kích bạo kích.',
    critDamage: 'Mức sát thương của đòn bạo kích.',
    dodge: 'Khả năng né tránh đòn đánh của đối thủ.'
  });


  /* ======================================================================
     1. KIT
     ====================================================================== */
  const $ = id => document.getElementById(id);
  const $$ = q => [...document.querySelectorAll(q)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const num = F.fmt;
  const currency = (realm = UI.s?.()?.realm ?? 0) => F.currency(realm);
  const money = (value, realm = UI.s?.()?.realm ?? 0, compact = true) => F.format_linh_thach(value, realm, compact);
  const coinImg = (coin, cls = 'coin') => `<img class="${cls}" src="${esc(A.moneyIcon(coin.icon))}" alt="" aria-hidden="true" decoding="async">`;
  const coinLabel = (coin = currency()) => `<span class="coin-label">${coinImg(coin)}${esc(coin.name.toLocaleLowerCase('vi-VN'))}</span>`;
  const moneyHTML = (value, realm = UI.s?.()?.realm ?? 0) => {
    const text = money(value, realm), exact = money(value, realm, false);
    return `<span class="coin-value" title="${esc(exact)}" aria-label="${esc(exact)}">${coinImg(currency(realm))}<span>${esc(text)}</span></span>`;
  };
  const pct = x => (x * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%';
  const duration = x => !Number.isFinite(x) ? '—'
    : x >= 86400 ? num(x / 86400) + ' ngày'
      : x >= 3600 ? num(x / 3600) + ' giờ'
        : x >= 60 ? num(x / 60) + ' phút'
          : Math.ceil(x) + ' giây';
  const abs = path => { try { return new URL(path, document.baseURI).href; } catch { return path; } };

  const row = (label, value) => `<div class="stat-line"><span>${label}</span><b>${value}</b></div>`;
  const btn = (label, act, data = '', disabled = false, style = 'btn-gold') =>
    `<button class="btn ${style}" data-act="${act}" ${data} ${disabled ? 'disabled' : ''}>${label}</button>`;
  const img = (key, cls = '') => {
    const x = H.item(key);
    const v = A.itemImg(x);
    const q = x && Number.isInteger(x.sub) && x.sub >= 0 && x.sub <= 4 ? ` data-q="${x.sub}"` : '';
    return `<img class="${cls}"${q} loading="lazy" decoding="async" src="${v.src}"${v.style ? ` style="${esc(v.style)}"` : ''} alt="${esc(x?.name || '')}">`;
  };
  /* Tên vật phẩm có hiệu ứng theo phẩm chất (hạ lục, trung tím, thượng vàng, cực ngũ sắc, tuyệt đen trắng). */
  const itemName = x => {
    const L = root.HU_LABELS;
    return L && x && Number.isInteger(x.sub) && F.SUBPHAM[x.sub] ? L.span(x.name, 'quality', F.SUBPHAM[x.sub]) : esc(x?.name || '');
  };
  /* Hai trục độc lập: rank 1-7 và quality 1-5. Luôn đọc qua schema tập trung,
     không tự suy lại từ grade/quality cũ trong từng màn hình. */
  const rankOf = x => H.SCHEMA?.rankOf?.(x) || x?.rank || 1;
  const rankLabelOf = x => H.SCHEMA?.rankLabel?.(rankOf(x)) || 'Phàm giai';
  const qualityOf = x => H.SCHEMA?.qualityOf?.(x) || (Number.isInteger(x?.sub) ? x.sub + 1 : 1);
  const qualityLabelOf = x => H.SCHEMA?.qualityLabel?.(qualityOf(x)) || (F.SUBPHAM[qualityOf(x) - 1] || 'Hạ') + ' phẩm';
  const useCondition = x => {
    if (!x) return '';
    const parts = [];
    if (Number.isInteger(x.useReq?.realmMin) && F.REALMS[x.useReq.realmMin]) parts.push('Cảnh giới tối thiểu: ' + F.REALMS[x.useReq.realmMin]);
    if (x.kind === 'EQ') parts.push('Tối đa cao hơn cảnh giới hiện tại 1 bậc');
    if (x.kind === 'BT') parts.push('Cần lĩnh ngộ; tối đa cao hơn cảnh giới hiện tại 1 bậc');
    if (x.kind === 'QITEM') parts.push('Vật phẩm nhiệm vụ, không bán');
    if (Array.isArray(x.tags) && x.tags.includes('dan-hiem')) parts.push('Cần bí tịch luyện đan cấp cao');
    return parts.join(' · ') || 'Không có điều kiện đặc biệt';
  };
  /* Giá trị thực của đan/phù ở cảnh giới hiện tại. Dùng đúng F.dan_effect
     như lúc sử dụng nên tooltip, cửa hàng và kết quả dùng luôn khớp nhau.
     `state` chỉ để kiểm thử; mặc định đọc nhân vật đang chơi. */
  const pillEffectText = (x, state) => {
    if (!x || (x.kind !== 'PILL' && x.kind !== 'TAL')) return '';
    let s = state;
    if (!s) { try { s = UI.s?.(); } catch { s = null; } }
    const realm = Number.isInteger(s?.realm) ? s.realm : x.tier;
    const stage = Number.isInteger(s?.stage) ? Math.max(0, s.stage - 1) : 0;
    const diff = Math.max(0, realm - x.tier);
    const used = Number.isFinite(s?.pillUses) ? s.pillUses : 0;
    const levelled = diff > 0 ? ` · lệch ${diff} cảnh giới` : '';
    if (x.kind === 'TAL') {
      if (x.effect === 'KIEP') {
        const e = F.dan_effect('KIEP', realm, stage, x.sub, 0, diff);
        return `Khiên ${pct(e.khien_theo_HP)} sinh lực · giảm ${pct(e.giam_sat_thuong)} sát thương · không giảm vì lệch cảnh giới`;
      }
      if (x.effect === 'STRIKE') {
        const mult = (x.code === 'TAL-PL-001' ? 1.2 : 2) * 2 ** x.sub;
        return `Sát thương ×${num(mult)} một đòn đánh thường`;
      }
      return H.SCHEMA?.EFFECTS?.[x.effect] || x.description || '—';
    }
    const e = F.dan_effect(x.effect, realm, stage, x.sub, used, diff);
    switch (x.effect) {
      case 'TU_VI': {
        const base = F.dan_exp_gain(realm, stage, x.sub, used, diff);
        const gain = Number.isFinite(s?.pillRealmExp)
          ? F.dan_exp_gain_capped(realm, stage, x.sub, used, s.pillRealmExp, diff) : base;
        return `Tu vi +${num(gain)}${gain < base ? ' · đã chạm trần đan cảnh giới' : ''}${levelled}`;
      }
      case 'HOI_PHUC':
        return `Hồi ${pct(e.hoi_phan_tram_HP)} sinh lực và linh lực${levelled}`;
      case 'HOI_HP':
        return `Hồi ${pct(e.hoi_phan_tram_HP)} sinh lực${levelled}`;
      case 'HOI_MP':
        return `Hồi ${pct(e.hoi_phan_tram_MP)} linh lực${levelled}`;
      case 'BUFF_TOC':
        return `Tốc độ hấp thụ linh khí +${pct(e.buff_neu_mot_minh)} trong ${duration(e.thoi_luong)}${levelled}`;
      case 'DOT_PHA':
        return `Xác suất đột phá +${pct(e.cong_xac_suat)} (trợ lực ${num(e.diem)} điểm)${levelled}`;
      case 'KIEP':
        return `Khiên ${pct(e.khien_theo_HP)} sinh lực · giảm ${pct(e.giam_sat_thuong)} sát thương${diff > 0 ? ' · không giảm vì lệch cảnh giới' : ''}`;
      case 'THO_NGUYEN':
        return `Thọ nguyên +${num(e.nam)} năm${levelled}`;
      case 'CUNG_CO': {
        const have = Number.isFinite(s?.permanent) ? s.permanent : 0;
        const gain = Math.min(e.cong_gop, Math.max(0, e.tran_moi_canh_gioi - have));
        return gain > 0
          ? `Củng cố vĩnh viễn +${pct(gain)} · trần ${pct(e.tran_moi_canh_gioi)} mỗi cảnh giới${levelled}`
          : `Đã đạt trần củng cố ${pct(e.tran_moi_canh_gioi)} của cảnh giới này`;
      }
      case 'GIAI_DOC':
        return `Giải đóng băng, choáng, độc, chảy máu · giảm ${num(H.TAM_MA_CLEANSE || 20)} Tâm ma`;
      case 'KHANG_HIEU_UNG':
        return `Giải hiệu ứng xấu · giảm ${pct(e.giam_thoi_gian)} thời gian đóng băng/choáng/độc/chảy máu trong ${duration(e.thoi_luong)}${diff > 0 ? ' · không giảm vì lệch cảnh giới' : ''}`;
      case 'CHIEN_DAU':
        return `Công kích +${pct(e.tang_ATK)} trong ${duration(e.thoi_luong)}${levelled}`;
      case 'TRONG_SINH':
        return `Giữ ${pct(e.giu_tien_do)} tiến độ khi trọng sinh${levelled}`;
      default:
        return H.SCHEMA?.EFFECTS?.[x.effect] || x.description || '—';
    }
  };

  /* Một dòng thuộc tính/công dụng ngắn cho tooltip. Chi tiết đầy đủ vẫn nằm
     trong cửa sổ vật phẩm; ở đây chỉ lấy dữ liệu thiết kế đang có và bỏ qua
     trường thiếu thay vì in "NaN". */
  const itemEffectText = x => {
    if (!x) return '';
    if (x.kind === 'PILL' || x.kind === 'TAL') return pillEffectText(x) || H.SCHEMA?.EFFECTS?.[x.effect] || x.description || '—';
    const d = x.design, base = H.BY_ID?.[x.code];
    const scale = Number.isInteger(x.sub) && Number.isInteger(base?.sub) ? 2 ** (x.sub - base.sub) : 1;
    const stats = (pairs, suffix = '') => pairs
      .filter(([, v]) => Number.isFinite(v))
      .map(([k, v]) => `${k} +${num(v * scale)}${suffix}`)
      .join(' · ');
    if (d?.group === 'pháp bảo') {
      const main = stats([['Sinh lực', d['hp cộng']], ['Linh lực', d['mp cộng']], ['Công kích', d['atk cộng']], ['Phòng thủ', d['def cộng']]]);
      const extra = stats([['Né tránh', d['eva cộng (%)']], ['Bạo kích', d['crit cộng (%)']]], '%');
      const e = H.DESIGN?.effects?.[x.code];
      return [main, extra, e ? `${e['hiệu ứng']} · ${e['điều kiện kích hoạt']}` : ''].filter(Boolean).join(' · ');
    }
    if (d?.group === 'công pháp') return [d['hệ'], d['công dụng'], Number.isFinite(d['tiêu hao mp']) ? d['tiêu hao mp'] + ' linh lực' : '', Number.isFinite(d['hồi chiêu (giây)']) ? d['hồi chiêu (giây)'] + ' giây' : ''].filter(Boolean).join(' · ');
    if (d?.group === 'bí tịch') return [d['thể loại'], d['công dụng']].filter(Boolean).join(' · ');
    if (d?.group === 'linh thảo') return [d['cách dùng'], d['hiệu quả']].filter(Boolean).join(' · ');
    if (d?.group === 'hạt giống') return [d['độ khó'], Number.isFinite(d['thời gian trồng (phút)']) ? d['thời gian trồng (phút)'] + ' phút' : '', Number.isFinite(d['sản lượng tối đa']) ? 'tối đa ' + d['sản lượng tối đa'] + ' cây' : ''].filter(Boolean).join(' · ');
    if (d?.group === 'phù lục') return [d['hệ'], d['hiệu quả']].filter(Boolean).join(' · ');
    return x.description || '—';
  };
  /* Khung thông tin vật phẩm dùng chung cho Hành trang và Tàng bảo các.
     `facts`: mảng [nhãn, giá trị, làHtml]; `notes`: [nhãn, giá trị] một dòng;
     `detail`: HTML các dòng chỉ số riêng; `footer` chen trước hành động. */
  const itemSheet = (x, { effect = '', facts = [], notes = [], detail = '', footer = '', actions = '', source = '', lore = true } = {}) => {
    if (!x) return '';
    const L = root.HU_LABELS;
    const quality = qualityLabelOf(x), rank = rankLabelOf(x);
    const qualityHtml = L ? L.span(quality, 'quality', quality, { variant: 'badge' }) : esc(quality);
    const rankHtml = L ? L.span(rank, 'rank', rank, { variant: 'badge' }) : esc(rank);
    const fact = ([label, value, isHtml]) => `<div class="item-fact"><span>${esc(label)}</span><b>${isHtml ? value : esc(value)}</b></div>`;
    const note = ([label, value]) => `<p class="item-sheet-note"><span>${esc(label)}</span> ${esc(value)}</p>`;
    return `<div class="item-sheet">
      <header class="item-sheet-hero">
        <div class="item-sheet-art">${img(x.key)}</div>
        <div class="item-sheet-head">
          <div class="item-sheet-badges">${rankHtml}${qualityHtml}</div>
          <p class="item-sheet-sub">${esc(x.category || 'Vật phẩm')}</p>
          ${x.nameZh ? `<p class="item-sheet-sub" lang="zh-Hans">${esc(x.nameZh)}</p>` : ''}
          <p class="item-sheet-desc">${esc(x.description || 'Không có mô tả.')}</p>
        </div>
      </header>
      ${effect ? `<div class="item-sheet-effect"><span>Thuộc tính / công dụng</span><p>${esc(effect)}</p></div>` : ''}
      ${lore && x.lore && x.lore !== x.description ? `<p class="item-sheet-lore">${esc(x.lore)}</p>` : ''}
      ${facts.length ? `<div class="item-facts">${facts.map(fact).join('')}</div>` : ''}
      ${notes.length ? `<div class="item-sheet-notes">${notes.map(note).join('')}</div>` : ''}
      ${detail ? `<div class="item-sheet-detail">${detail}</div>` : ''}
      ${source ? `<p class="item-sheet-source">${source}</p>` : ''}
      ${footer}
      ${actions ? `<div class="item-sheet-actions">${actions}</div>` : ''}
    </div>`;
  };
  const codeAttr = key => `data-code="${esc(key)}"`;
  const bar = (percent, cls = '', id = '') =>
    `<div class="meter-bar ${cls}"><i ${id ? `id="${id}"` : ''} style="width:${clamp(percent, 0, 100)}%"></i></div>`;
  const card = (title, body, { cls = '', eyebrow = '', aside = '' } = {}) =>
    `<section class="card ${cls}">${eyebrow || title || aside ? `<header class="card-head"><div>${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ''}${title ? `<h3>${title}</h3>` : ''}</div>${aside}</header>` : ''}${body}</section>`;
  const empty = text => `<p class="empty-note">${text}</p>`;
  let tabbarSeq = 0;
  const tabs = (items, active) => {
    const current = items.find(t => t.id === active) || items[0] || { label: 'Chọn mục', icon: '☰' };
    const menuId = 'tabbarMenu' + (++tabbarSeq);
    return `<div class="tabbar">` +
      `<button type="button" class="tabbar-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="${menuId}" aria-label="Chọn mục, đang xem ${esc(current.label)}">` +
      `<span class="tabbar-toggle-current">${esc(current.label)}</span><span class="tabbar-toggle-chevron" aria-hidden="true">⌄</span></button>` +
      `<div id="${menuId}" class="tabbar-menu" role="tablist">${items.map(t =>
      `<button role="tab" class="tab ${t.id === active ? 'active' : ''}" aria-selected="${t.id === active}" data-tab="${t.id}">${t.label}${t.badge ? `<em>${t.badge}</em>` : ''}</button>`).join('')}</div></div>`;
  };
  const live = end => `<span class="live" data-end="${end}"></span>`;

  /* Mô tả một bảng hiệu ứng {attack,hp,guard,rate,crit,dodge,regen} thành chữ: "Phòng thủ +12% · Sinh lực +5%". */
  UI.rootEffectText = (effects, weight = 1) => {
    const labels = { attack: 'Công kích', hp: 'Sinh lực', mp: 'Linh lực', sta: 'Thể lực', guard: 'Phòng thủ', rate: 'Tốc độ hấp thụ linh khí', crit: 'Bạo kích', dodge: 'Né tránh', regen: 'Hồi sinh lực/giây' };
    return Object.entries(effects || {}).map(([k, v]) => (labels[k] || k) + ' +' + (v * weight * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) +
      (['crit', 'dodge', 'regen'].includes(k) ? ' điểm %' : '%')).join(' · ');
  };
  UI.kit = { itemName, rankOf, rankLabelOf, qualityOf, qualityLabelOf, useCondition, itemEffectText, pillEffectText, itemSheet, $, $$, esc, clamp, num, currency, money, moneyHTML, coinLabel, pct, duration, abs, row, btn, img, codeAttr, bar, card, empty, tabs, live };

  /* ======================================================================
     2. DỮ LIỆU HIỂN THỊ
     ====================================================================== */
  UI.data = {
    ELEMENTS: [['Kim', '#edca62'], ['Mộc', '#69dba0'], ['Thủy', '#65ceff'], ['Hỏa', '#f28e64'], ['Thổ', '#c2a779']],
    SKILLS: [
      { name: 'Thanh Vân Kiếm Quyết', desc: 'Kiếm khí gây sát thương.', mp: .12, cd: 5 },
      { name: 'Thái Hư Chân Kinh', desc: 'Chân khí xuyên phá phòng ngự.', mp: .15, cd: 7 },
      { name: 'Hộ Thể Kim Quang', desc: 'Hồi 26% sinh lực.', mp: .18, cd: 12 },
      { name: 'Cửu Thiên Lôi Động', desc: 'Lôi pháp sát thương lớn.', mp: .26, cd: 15 }
    ],
    QUESTS: H.QUESTS,
    ART: {
      workshop: A.BG.forge,
      talisman: A.BG.talisman,
      storm: A.BG.tribulation,
      world: A.BG.home
    },
    INK: tier => 'INK-' + (tier < 5 ? 'HG' : tier < 9 ? 'LG' : 'TG'),
    FARM: n => A.farm(n)
  };

  /* ======================================================================
     3. BỘ LỌC & PHÂN TRANG
     ====================================================================== */
  const PAGE_SIZE = 30;
  const fold = v => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
  const lists = {
    PAGE_SIZE,
    matches(x) {
      const v = UI.view;
      return (v.category === 'Tất cả' || x.category === v.category)
        && (!v.query || fold(x.name + ' ' + x.code + ' ' + x.originalName).includes(fold(v.query)));
    },
    controls({ categories = null, quality = false, placeholder = 'Tên hoặc mã' } = {}) {
      const v = UI.view;
      const cats = categories || ['Tất cả', ...new Set(H.ITEMS.map(x => x.category))];
      return `<div class="catalog-controls">
        <label>Tìm vật phẩm<input id="itemSearch" value="${esc(v.query)}" placeholder="${esc(placeholder)}"></label>
        ${cats.length > 2 ? `<label>Nhóm<select id="categoryFilter">${cats.map(c => `<option ${c === v.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>` : ''}
        ${quality ? `<label>Phẩm chất<select id="qualityFilter">${F.SUBPHAM.map((n, i) => `<option value="${i}" ${i === v.quality ? 'selected' : ''}>${n} phẩm</option>`).join('')}</select></label>` : ''}
        ${btn('Tìm', 'search', '', false, 'btn-outline')}
      </div>`;
    },
    pager(total) {
      const max = Math.max(1, Math.ceil(total / PAGE_SIZE));
      UI.view.page = clamp(UI.view.page, 0, max - 1);
      const page = UI.view.page;
      return `<div class="pagination">${btn('Trước', 'prev', '', page === 0, 'btn-outline')}<span>${total} mục · Trang ${page + 1}/${max}</span>${btn('Sau', 'next', '', page >= max - 1, 'btn-outline')}</div>`;
    },
    slice: xs => xs.slice(UI.view.page * PAGE_SIZE, UI.view.page * PAGE_SIZE + PAGE_SIZE)
  };
  UI.lists = lists;

  /* ======================================================================
     4. PHIÊN CHƠI
     ====================================================================== */
  const session = new root.HU_REMOTE_SESSION.RemoteSession();
  UI.session = session;
  UI.store = root.HU_REMOTE_STORE.createStore(session, message => UI.toast(message));
  // Chỉ đọc khi render; mọi thay đổi gameplay đi qua command().
  UI.g = () => session.game;
  UI.s = () => session.game.s;
  UI.command = (type, payload = {}) => UI.store.dispatch(type, payload);
  UI.preference = (key, value) => UI.store.preference(key, value);
  session.subscribe(event => { if (event.type === 'death') UI.onDeath?.(event.report); });

  /* ======================================================================
     5. TRẠNG THÁI GIAO DIỆN
     ====================================================================== */
  UI.view = { category: 'Tất cả', query: '', page: 0, quality: 0, selected: '', onlyReady: false };
  UI.screens = {};
  UI.actions = {};
  UI.modalActions = new Set(); /* hành động cho phép chạy khi cửa sổ nổi đang mở (shell đóng cửa sổ trước) */
  UI.modalKeepOpen = new Set(); /* hành động chạy ngay trong cửa sổ nổi mà không đóng nó */
  UI.tabState = {};
  UI.current = 'idle';
  UI.KEEP = Symbol('keep');
  UI.SOFT = Symbol('soft');
  UI.register = def => { UI.screens[def.id] = def; };
  UI.action = (name, fn) => { UI.actions[name] = fn; };

  /* Danh sách thu gọn: mỗi mục chỉ hiện tên; bấm mới mở cửa sổ nổi chi tiết.
     peekRow lưu nội dung chi tiết theo id lúc vẽ; mọi thao tác trong cửa sổ này đều được phép chạy
     (shell tự đóng cửa sổ trước khi chạy hành động). */
  UI.peek = new Map();
  UI.kit.peekRow = (id, title, { mark = '○', cls = '', eyebrow = 'Chi tiết', body = '', img = '', titleHtml = '' } = {}) => {
    UI.peek.set(id, { title, eyebrow, body });
    const e = UI.kit.esc;
    return `<button type="button" class="peek-row ${cls}" data-act="peek" data-peek="${e(id)}">${img}<span class="peek-name">${titleHtml || e(title)}</span><i class="peek-mark" aria-hidden="true">${mark || '○'}</i></button>`;
  };
  UI.action('peek', (el, d) => {
    const p = UI.peek.get(d.peek);
    if (p) UI.modal(p.title, `<div class="pop peek-pop">${p.body}</div>`, null, 'Đóng', p.eyebrow, { vfx: false });
    return UI.KEEP;
  });

  UI.action('search', () => {
    const v = UI.view;
    v.query = $('itemSearch')?.value || '';
    v.category = $('categoryFilter')?.value || 'Tất cả';
    v.quality = Number($('qualityFilter')?.value || 0);
    v.page = 0;
  });
  UI.action('prev', () => { UI.view.page = Math.max(0, UI.view.page - 1); });
  UI.action('next', () => { UI.view.page++; });
})(typeof window !== 'undefined' ? window : globalThis);
