/* HƯ GIỚI · LÒ RÈN VÀ PHÙ ÁN (trang toàn màn hình cho Luyện pháp bảo và Vẽ phù)
 * Ba bước: chọn món, xem hoạt cảnh ngắn, nhận thành phẩm. Luật chế tạo vẫn do máy chủ quyết định (lệnh forge);
 * trang này chỉ gửi lệnh rồi phát hoạt cảnh, không đổi thời gian hay xác suất. Rèn và vẽ phù ra vật phẩm ngay
 * nên không có hàng đợi hay đếm ngược như đan phòng. */
(function (root) {
  'use strict';
  const UI = root.HU_UI, H = root.HU_GAME;
  if (!UI || !H) return;
  const { $, esc, img, abs, money, moneyHTML } = UI.kit;
  const F = H.F, WORK_MS = 3600, WORK_MS_REDUCED = 900;
  const TRADES = {
    khi: { kind: 'EQ', title: 'Lò rèn', leave: 'Rời lò rèn', work: 'Đang rèn', done: 'Rèn xong', verb: 'Rèn', book: 'luyện pháp bảo', alt: 'Tu sĩ đang rèn pháp bảo' },
    phu: { kind: 'TAL', title: 'Phù án', leave: 'Rời phù án', work: 'Đang vẽ phù', done: 'Vẽ xong', verb: 'Vẽ', book: 'vẽ phù', alt: 'Tu sĩ đang vẽ phù' }
  };
  const st = { open: false, trade: 'khi', phase: 'pick', code: '', note: '', token: 0, busy: false };

  const S = () => UI.s();
  const reduced = () => !!UI.isReduced?.();
  const bg = () => {
    const m = root.HU_CUSTOM_MEDIA;
    return abs(m?.installed && m.backgrounds[st.trade] ? m.backgrounds[st.trade] : st.trade === 'phu' ? UI.data.ART.talisman : UI.data.ART.workshop);
  };
  const figure = animate => {
    const m = root.HU_CUSTOM_MEDIA;
    if (!m?.installed) return '';
    return `<img class="cp-figure fp-figure" src="${abs(m.workshop(S().gender, st.trade, animate))}" alt="${esc(TRADES[st.trade].alt)}" decoding="async">`;
  };
  const hasBook = () => H.SECT_BOOKS.some(b => b.id === S().borrowedBook && b.kind === TRADES[st.trade].kind);
  const items = () => {
    const g = UI.g(), t = TRADES[st.trade];
    return H.ITEMS.filter(x => x.kind === t.kind && x.tier <= S().realm && g.hasCraftRecipe(x.code))
      .map(x => ({ x, f: UI.forgeStatus(x) }))
      .sort((a, b) => (b.f.ok - a.f.ok) || (b.x.tier - a.x.tier) || a.x.name.localeCompare(b.x.name, 'vi'));
  };

  /* ---------- bước 1: chọn món ---------- */
  function pick() {
    const t = TRADES[st.trade];
    if (!hasBook()) return `<div class="cp-stage"><p class="cp-hint">Chưa mượn sách ${t.book}. Đến Tàng Kinh Các trong Tông môn để chọn sách bằng điểm lịch luyện.</p>
      <div class="cp-actions"><button type="button" class="btn btn-gold" data-act="forgePageLibrary">Đến Tàng Kinh Các</button></div></div>`;
    const g = UI.g();
    const rows = items().map(({ x, f }) => `<article class="fp-item ${f.ok ? 'ready' : ''}">${img(x.code, 'fp-img')}
      <div class="fp-info"><h3>${esc(x.name)}</h3><p>${esc(x.realm)} · ${esc(F.SUBPHAM[x.sub])}</p>
        <p>${f.r.count} ${esc(f.mat?.name || 'linh tài')} <span class="${f.haveMat >= f.r.count ? 'green-text' : 'danger-text'}">(${f.haveMat})</span>${f.r.ink ? ` · 1 ${esc(H.item(f.r.ink)?.name || 'mực')} <span class="${f.inkOk ? 'green-text' : 'danger-text'}">(${g.ingredientCount(f.r.ink)})</span>` : ''} · ${moneyHTML(f.r.stone)}</p>
        ${f.why ? `<p class="danger-text">${esc(f.why)}</p>` : ''}</div>
      <button type="button" class="btn ${f.ok ? 'btn-gold' : 'btn-outline'}" data-act="forgePageMake" data-code="${esc(x.code)}" ${f.ok ? '' : 'disabled'}>${t.verb}</button></article>`).join('');
    return `<div class="fp-pick">${figure(false)}
      <p class="cp-hint">Công thức từ sách đang mượn. Phí 10% giá trị, chỉ chế vật cùng hoặc dưới cảnh giới. Món đủ điều kiện được xếp lên đầu.</p>
      <div class="fp-list" aria-label="Danh sách món có thể chế tạo">${rows || '<p class="cp-empty">Chưa có vật phẩm để chế tạo ở cảnh giới này.</p>'}</div></div>`;
  }

  /* ---------- bước 2: hoạt cảnh ---------- */
  function work() {
    const x = H.item(st.code), t = TRADES[st.trade], ms = reduced() ? WORK_MS_REDUCED : WORK_MS;
    return `<div class="cp-stage cp-brew fp-work"><div class="cp-count" role="status"><small>${esc(x?.name || '')}</small><strong>${t.work}…</strong></div>
      ${figure(!reduced())}<div class="fp-progress" aria-hidden="true"><i style="animation-duration:${ms}ms"></i></div></div>`;
  }

  /* ---------- bước 3: thành phẩm ---------- */
  function done() {
    const x = H.item(st.code), t = TRADES[st.trade];
    return `<div class="cp-stage cp-brew fp-done"><div class="cp-count done"><small>${t.done}</small><strong>${esc(x?.name || '')}</strong></div>
      ${img(st.code, 'fp-result')}${st.note ? `<p class="cp-hint">${esc(st.note)}</p>` : ''}
      <div class="cp-actions"><button type="button" class="btn btn-gold" data-act="forgePageAgain">Làm thêm</button>
        <button type="button" class="btn btn-outline" data-act="forgePageClose">${t.leave}</button></div></div>`;
  }

  function draw() {
    const el = $('forgePageBody');
    if (!el) return;
    el.innerHTML = st.phase === 'work' ? work() : st.phase === 'done' ? done() : pick();
    $('fpSub').textContent = 'Số dư: ' + money(S().stone);
  }

  function open(trade) {
    if (st.open || !UI.g().featureOpen('forge')) return;
    st.open = true; st.trade = trade === 'phu' ? 'phu' : 'khi';
    st.phase = 'pick'; st.code = ''; st.note = ''; st.busy = false; st.token++;
    const page = $('forgePage');
    page.style.setProperty('--cp-bg', "url('" + bg() + "')");
    $('fpTitle').textContent = TRADES[st.trade].title;
    $('forgePageBack').lastElementChild.textContent = TRADES[st.trade].leave;
    $('game').hidden = true;
    page.hidden = false;
    document.body.classList.add('in-craft');
    draw();
  }
  function close(go = true) {
    if (!st.open) return;
    const trade = st.trade;
    st.open = false; st.busy = false; st.token++;
    $('forgePage').hidden = true; $('forgePageBody').innerHTML = '';
    $('game').hidden = false;
    document.body.classList.remove('in-craft');
    if (go) UI.go('craft:' + trade);
  }
  async function make(code) {
    if (st.busy || !st.open) return;
    st.busy = true;
    const token = st.token;
    let res;
    try { res = await UI.command('forge', { code }); }
    catch (e) {
      st.busy = false;
      UI.toast(e.message || 'Không chế tạo được.', { type: 'error', title: TRADES[st.trade].title });
      if (st.open && token === st.token) draw();
      return;
    }
    if (!st.open || token !== st.token) { st.busy = false; return; }
    const r = res?.result ?? res;
    st.note = typeof r === 'string' ? r.replace(/\.?$/, '.') : '';
    st.code = code; st.phase = 'work'; draw();
    await new Promise(done => setTimeout(done, reduced() ? WORK_MS_REDUCED : WORK_MS));
    st.busy = false;
    if (!st.open || token !== st.token) return;
    st.phase = 'done'; draw();
  }

  UI.forgePage = { open, close, isOpen: () => st.open };
  UI.action('forgePageOpen', (el, d) => { open(d.trade); return UI.KEEP; });
  UI.action('forgePageClose', () => { close(); return UI.KEEP; });
  UI.action('forgePageLibrary', () => { close(false); UI.go('sect:library'); return UI.KEEP; });
  UI.action('forgePageAgain', () => { if (st.busy) return UI.KEEP; st.phase = 'pick'; st.note = ''; draw(); return UI.KEEP; });
  UI.action('forgePageMake', (el, d) => { make(d.code); return UI.KEEP; });
  document.addEventListener('keydown', e => {
    if (st.open && e.key === 'Escape' && !st.busy && $('modalLayer')?.hidden !== false) { e.preventDefault(); close(); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
