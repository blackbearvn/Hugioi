/* HƯ GIỚI · ĐAN PHÒNG (trang luyện đan toàn màn hình)
 * Ba bước: xếp linh thảo vào các ô quanh lò, canh lửa bằng một minigame ngắn, rồi xem hoạt cảnh luyện
 * với đồng hồ đếm ngược. Luật luyện chế vẫn do máy chủ quyết định (lệnh mixCraft); điểm canh lửa chỉ là
 * một con số 0–100 gửi kèm, máy chủ cho lệch phẩm chất tối đa một bậc. */
(function (root) {
  'use strict';
  const UI = root.HU_UI, H = root.HU_GAME;
  if (!UI || !H) return;
  const { $, esc, img, abs } = UI.kit;
  const SLOTS = 6, ROUNDS = 3;
  const st = { open: false, phase: 'arrange', mix: {}, game: null, note: '', watch: null, sig: '' };
  let raf = 0;

  const s = () => UI.s();
  const reduced = () => !!UI.isReduced?.();
  const herbs = () => {
    const g = UI.g(), seen = new Map();
    for (const k of Object.keys(s().bag)) {
      const x = H.item(k);
      if (x?.kind === 'HERB' && !seen.has(x.code)) seen.set(x.code, { code: x.code, name: x.name, have: g.ingredientCount(x.code) });
    }
    return [...seen.values()].filter(x => x.have > 0).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  };
  const conflict = () => root.HU_COMMANDS?.activityConflict(s(), 'craft') || '';
  const used = () => Object.keys(st.mix).length;
  const total = () => Object.values(st.mix).reduce((a, n) => a + n, 0);
  const bg = () => abs(root.HU_CUSTOM_MEDIA?.installed ? root.HU_CUSTOM_MEDIA.backgrounds.dan : UI.data.ART.workshop);
  const figure = () => {
    const m = root.HU_CUSTOM_MEDIA, g = s().gender;
    return m?.installed ? abs(m.workshop(g, 'dan', !reduced())) : '';
  };
  const clock = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  const jobName = j => H.item(j.code)?.name || j.code;

  /* ---------- bước 1: xếp nguyên liệu ---------- */
  function arrange() {
    const list = herbs(), keys = Object.keys(st.mix), off = !total() || !!conflict();
    const ring = Array.from({ length: SLOTS }, (_, i) => {
      const k = keys[i];
      return k
        ? `<button type="button" class="cp-slot on" style="--i:${i}" data-act="cpRemove" data-key="${esc(k)}" aria-label="Bớt ${esc(H.item(k).name)}, đang bỏ ${st.mix[k]}">${img(k, 'cp-img')}<b>${st.mix[k]}</b><small>${esc(H.item(k).name)}</small></button>`
        : `<div class="cp-slot" style="--i:${i}" aria-hidden="true"></div>`;
    }).join('');
    const shelf = list.length ? list.map(x => {
      const left = x.have - (st.mix[x.code] || 0), full = used() >= SLOTS && !st.mix[x.code];
      return `<button type="button" class="cp-herb" data-act="cpAdd" data-key="${esc(x.code)}" ${left < 1 || full ? 'disabled' : ''}>${img(x.code, 'cp-herb-img')}<span>${esc(x.name)}</span><em>${left}</em></button>`;
    }).join('') : '<p class="cp-empty">Túi chưa có linh thảo. Trồng ở Linh điền hoặc đi Lịch luyện để thu về.</p>';
    return `<div class="cp-stage">
      <div class="cp-ring" role="group" aria-label="Các ô nguyên liệu quanh lò">
        <div class="cp-core" aria-hidden="true"><img src="${abs(root.HU_CUSTOM_MEDIA?.furnace || '')}" alt=""></div>${ring}
      </div>
      <div class="cp-go">
        <p class="cp-hint">${conflict() ? esc(conflict()) : total() ? 'Đã xếp ' + total() + ' linh thảo trong ' + used() + ' ô. Chạm vào ô để bớt một.' : 'Chọn linh thảo ở dưới để xếp vào lò. Đan phương trong sách chỉ để tham khảo.'}</p>
        <div class="cp-actions">
          <button type="button" class="btn btn-gold cp-start" data-act="cpStart" ${off ? 'disabled' : ''}>Bắt đầu luyện</button>
          <button type="button" class="btn btn-outline" data-act="cpClear" ${total() ? '' : 'disabled'}>Đổ ra</button>
        </div>
      </div>
    </div>
    <div class="cp-shelf" aria-label="Linh thảo trong túi">${shelf}</div>`;
  }

  /* ---------- bước 2: canh lửa ---------- */
  const ZONES = [.24, .18, .13];
  function newGame() {
    const w = ZONES[0];
    return { round: 0, scores: [], pos: 0, dir: 1, w, at: .3 + Math.random() * .4, speed: reduced() ? .32 : .55, last: performance.now(), done: false, msg: '' };
  }
  function gameHtml() {
    const g = st.game;
    const pips = Array.from({ length: ROUNDS }, (_, i) => `<i class="${i < g.scores.length ? 'done' : i === g.round ? 'now' : ''}"></i>`).join('');
    return `<div class="cp-game" role="group" aria-label="Canh lửa">
      <h3>Canh lửa</h3>
      <p>Bấm khi ngọn lửa nằm trong vùng sáng. ${reduced() ? 'Đã giảm tốc độ theo cài đặt giảm chuyển động.' : ''}</p>
      <div class="cp-track" id="cpTrack" data-act="cpHit"><span class="cp-zone" id="cpZone"></span><span class="cp-flame" id="cpFlame"></span></div>
      <div class="cp-pips" aria-label="Lượt ${Math.min(g.round + 1, ROUNDS)} trên ${ROUNDS}">${pips}</div>
      <p class="cp-msg" id="cpMsg" role="status">${esc(g.msg)}</p>
      <button type="button" class="btn btn-gold cp-hit" data-act="cpHit" aria-keyshortcuts="Space">Giữ lửa</button>
    </div>`;
  }
  function layoutGame() {
    const g = st.game, zone = $('cpZone'), flame = $('cpFlame');
    if (!g || !zone || !flame) return;
    zone.style.left = (g.at - g.w / 2) * 100 + '%'; zone.style.width = g.w * 100 + '%';
    flame.style.left = g.pos * 100 + '%';
  }
  function loop(now) {
    const g = st.game;
    if (!g || st.phase !== 'game') return;
    if (!g.done) {
      const dt = Math.min(.05, (now - g.last) / 1000);
      g.pos += g.dir * g.speed * dt;
      if (g.pos >= 1) { g.pos = 1; g.dir = -1; } else if (g.pos <= 0) { g.pos = 0; g.dir = 1; }
      const f = $('cpFlame'); if (f) f.style.left = g.pos * 100 + '%';
    }
    g.last = now;
    raf = requestAnimationFrame(loop);
  }
  function hit() {
    const g = st.game;
    if (!g || g.done) return;
    const dist = Math.abs(g.pos - g.at), half = g.w / 2;
    const acc = dist <= half ? 1 - (dist / half) * .25 : Math.max(0, .75 - (dist - half) / (g.w * 1.5));
    g.scores.push(acc);
    g.msg = dist <= half * .4 ? 'Lửa đúng độ.' : dist <= half ? 'Lửa khá đều.' : 'Lửa lệch rồi.';
    if (g.scores.length >= ROUNDS) { g.done = true; finishGame(); return; }
    g.round++; g.w = ZONES[g.round]; g.at = .2 + Math.random() * .6; g.speed *= 1.25;
    draw(); layoutGame();
  }
  async function finishGame() {
    const g = st.game, focus = Math.round(g.scores.reduce((a, b) => a + b, 0) / ROUNDS * 100);
    const mix = { ...st.mix };
    draw(); layoutGame();
    const msg = $('cpMsg'); if (msg) msg.textContent = (focus >= 75 ? 'Lửa rất đều, ' : focus < 25 ? 'Lửa loạn, ' : 'Lửa tạm ổn, ') + 'đang bỏ nguyên liệu vào lò.';
    await new Promise(r => setTimeout(r, reduced() ? 400 : 900));
    let res;
    try {
      try { res = await UI.command('mixCraft', { mix, focus }); }
      /* Máy chủ cũ chưa biết trường focus thì thử lại không kèm điểm, để việc luyện không bị chặn. */
      catch (e) { if (!/không hợp lệ/.test(e.message || '')) throw e; res = await UI.command('mixCraft', { mix }); }
    } catch (e) { st.phase = 'arrange'; st.game = null; st.note = ''; UI.toast(e.message || 'Không luyện được.', { type: 'error', title: 'Luyện đan' }); draw(); return; }
    const r = res?.result || res || {};
    st.mix = {}; st.game = null;
    if (r.outcome === 'brew') {
      const q = s().craftQueue.at(-1);
      st.watch = q ? { code: q.code, end: q.end } : null;
      st.phase = 'brew'; st.note = '';
    } else {
      st.phase = 'fail';
      st.note = r.outcome === 'explode' ? 'Lò nổ. Nguyên liệu hóa tro, đạo thân mất ' + r.hpLoss + ' sinh lực.'
        : r.outcome === 'dodge' ? 'Lò nổ nhưng bạn kịp né. Nguyên liệu hóa tro, đạo thân vô sự.'
        : 'Phế đan. Nguyên liệu không hợp nhau, lò chỉ còn tro đen.';
    }
    draw();
  }

  /* ---------- bước 3: hoạt cảnh luyện và đếm ngược ---------- */
  function brew() {
    const q = s().craftQueue, now = UI.session.serverNow();
    const head = q.find(j => st.watch && j.code === st.watch.code && j.end === st.watch.end) || q[0];
    const others = q.filter(j => j !== head);
    const pic = figure();
    const top = head
      ? `<div class="cp-count" role="timer"><small>${esc(jobName(head))}</small><strong data-cp-end="${head.end}">${clock(head.end - now)}</strong></div>`
      : `<div class="cp-count done"><small>${st.watch ? esc(H.item(st.watch.code)?.name || '') : 'Lò đan'}</small><strong>Đã ra lò</strong></div>`;
    const list = others.length ? `<ul class="cp-queue">${others.map((j, i) => `<li><span>Mẻ ${i + 2}: ${esc(jobName(j))}</span><b data-cp-end="${j.end}">${clock(j.end - now)}</b></li>`).join('')}</ul>` : '';
    return `<div class="cp-stage cp-brew">${top}
      ${pic ? `<img class="cp-figure" src="${pic}" alt="Tu sĩ đang luyện đan" decoding="async">` : ''}
      ${list}
      <p class="cp-hint">${head ? 'Có thể rời đan phòng, lò vẫn chạy khi bạn đi làm việc khác.' : 'Thành phẩm đã vào hành trang nếu mẻ thành công.'}</p>
      <div class="cp-actions"><button type="button" class="btn btn-gold" data-act="cpAgain" ${q.length >= 3 || conflict() ? 'disabled' : ''}>Luyện thêm một mẻ</button></div>
    </div>`;
  }
  function fail() {
    return `<div class="cp-stage cp-fail"><div class="cp-smoke" aria-hidden="true"></div><h3>Mẻ này hỏng</h3><p>${esc(st.note)}</p>
      <div class="cp-actions"><button type="button" class="btn btn-gold" data-act="cpAgain">Thử lại</button></div></div>`;
  }

  function body() {
    if (st.phase === 'game') return `<div class="cp-stage">${gameHtml()}</div>`;
    if (st.phase === 'brew') return brew();
    if (st.phase === 'fail') return fail();
    return arrange();
  }
  function head() {
    const q = s().craftQueue.length;
    $('cpSub').textContent = 'Mẻ đang luyện ' + q + '/3';
  }
  function draw() {
    const el = $('craftPageBody');
    if (!el) return;
    el.innerHTML = body(); head();
    st.sig = signature();
    if (st.phase === 'game') layoutGame();
  }
  const signature = () => [st.phase, Object.entries(st.mix).join(','), s().craftQueue.map(j => j.code + j.end).join(','), Object.keys(s().bag).length, herbs().map(h => h.code + h.have).join(',')].join('|');

  function open() {
    if (st.open) return;
    st.open = true;
    st.mix = {}; st.game = null; st.note = '';
    st.phase = s().craftQueue.length ? 'brew' : 'arrange';
    st.watch = s().craftQueue.at(-1) ? { code: s().craftQueue.at(-1).code, end: s().craftQueue.at(-1).end } : null;
    $('game').hidden = true;
    const page = $('craftPage');
    page.style.setProperty('--cp-bg', "url('" + bg() + "')");
    page.hidden = false;
    document.body.classList.add('in-craft');
    draw();
  }
  function close() {
    if (!st.open) return;
    st.open = false; st.game = null; cancelAnimationFrame(raf);
    $('craftPage').hidden = true; $('craftPageBody').innerHTML = '';
    $('game').hidden = false;
    document.body.classList.remove('in-craft');
    UI.go('craft');
  }
  /* Mỗi nhịp: cập nhật đồng hồ; nếu hàng đợi hay túi đổi thì vẽ lại (trừ lúc đang canh lửa). */
  function sync() {
    if (!st.open) return;
    if (st.phase === 'game') return;
    if (signature() !== st.sig) { draw(); return; }
    const now = UI.session.serverNow();
    document.querySelectorAll('#craftPageBody [data-cp-end]').forEach(e => { e.textContent = clock(Number(e.dataset.cpEnd) - now); });
  }

  UI.craftPage = { open, close, sync, isOpen: () => st.open };
  UI.action('craftPageOpen', () => { open(); return UI.KEEP; });
  UI.action('craftPageClose', () => { close(); return UI.KEEP; });
  UI.action('cpAdd', (el, d) => {
    const h = herbs().find(x => x.code === d.key);
    if (!h || (st.mix[d.key] || 0) >= h.have || (!st.mix[d.key] && used() >= SLOTS)) return UI.KEEP;
    st.mix[d.key] = (st.mix[d.key] || 0) + 1; draw(); return UI.KEEP;
  });
  UI.action('cpRemove', (el, d) => { if (st.mix[d.key] && !--st.mix[d.key]) delete st.mix[d.key]; draw(); return UI.KEEP; });
  UI.action('cpClear', () => { st.mix = {}; draw(); return UI.KEEP; });
  UI.action('cpStart', () => {
    if (!total() || conflict()) return UI.KEEP;
    st.phase = 'game'; st.game = newGame(); draw(); layoutGame();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    return UI.KEEP;
  });
  UI.action('cpHit', () => { hit(); return UI.KEEP; });
  UI.action('cpAgain', () => { st.phase = 'arrange'; st.note = ''; draw(); return UI.KEEP; });
  document.addEventListener('keydown', e => {
    if (!st.open) return;
    if (e.key === 'Escape' && st.phase !== 'game' && $('modalLayer')?.hidden !== false) { e.preventDefault(); close(); }
    else if ((e.key === ' ' || e.key === 'Enter') && st.phase === 'game' && !e.target.closest?.('button')) { e.preventDefault(); hit(); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
