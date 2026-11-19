/* HƯ GIỚI · TRANG GIAO CHIẾN RIÊNG
 * Trận Lịch luyện và trận Bí cảnh tự tay chiến đấu mở thành một trang toàn màn hình, như trang Độ kiếp.
 * Trang không giữ trạng thái trận: nội dung lấy từ UI.exploreBattle.html() / UI.adventure.runPanel(),
 * nên mọi lệnh (battleAct, dungeonAct), tự động và hoạt ảnh vẫn chạy qua đúng đường cũ.
 * Rời trang chỉ là ẩn đi; trận vẫn nằm trong trạng thái máy chủ và sảnh có nút "Quay lại trận". */
(function (root) {
  'use strict';
  const UI = root.HU_UI;
  if (!UI) return;
  const { $ } = UI.kit;
  const st = { open: false, kind: '', key: '', dismissed: '', sig: '' };

  /* Trận đang diễn ra, hoặc null. key phân biệt từng trận để "tạm rời" không chặn trận kế tiếp. */
  function wanted() {
    const s = UI.s();
    if (!s?.created || UI.intro?.active || UI.tribulation?.pageOpen || UI.tribulation?.active) return null;
    const e = s.exploration?.active;
    if (e?.battle) return { kind: 'explore', key: 'x:' + e.start, meta: UI.exploreBattle.meta() };
    if (s.dungeon?.run) return { kind: 'dungeon', key: 'd:' + s.dungeon.run.id, meta: UI.adventure.runMeta() };
    return null;
  }
  const htmlOf = kind => kind === 'explore' ? UI.exploreBattle.html() : UI.adventure.runPanel();
  const sigOf = kind => kind === 'explore' ? UI.screens.combat.signature() : UI.adventure.runSignature();
  const lobbyOf = kind => kind === 'explore' ? 'sect:exploration' : 'sect:dungeons';

  function draw(w) {
    const body = $('battlePageBody');
    $('bpTitle').textContent = w.meta?.title || 'Giao chiến';
    $('bpSub').textContent = w.meta?.sub || '';
    body.innerHTML = htmlOf(w.kind);
    if (w.kind === 'explore') UI.battleFx?.mount?.(); else UI.adventure.mountRun?.();
  }

  function show(w) {
    st.open = true; st.kind = w.kind; st.key = w.key; st.sig = '';
    $('game').hidden = true;
    $('battlePage').hidden = false;
    document.body.classList.add('in-battle');
    $('battlePage').scrollTop = 0;
  }

  function hide(goLobby) {
    if (!st.open) return;
    const kind = st.kind;
    st.open = false; st.sig = '';
    $('battlePage').hidden = true;
    $('battlePageBody').innerHTML = '';
    $('game').hidden = false;
    document.body.classList.remove('in-battle');
    if (goLobby) UI.go(lobbyOf(kind));
  }

  /* force: vẽ lại ngay (sau một lệnh của người chơi). Không force: chỉ vẽ khi chữ ký đổi và tiêu điểm
     không nằm trong trang, giống cách cửa sổ thường làm mỗi nhịp tick. */
  function sync(force) {
    if (!UI.s?.() || !$('battlePage')) return;
    const w = wanted();
    if (!w) { st.dismissed = ''; if (st.open) hide(true); return; }
    if (!st.open) {
      if (st.dismissed === w.key) return;
      show(w);
      force = true;
    } else if (st.key !== w.key) { st.key = w.key; st.kind = w.kind; force = true; }
    const body = $('battlePageBody');
    if (w.kind === 'explore') UI.screens.combat.update?.();
    const sig = sigOf(w.kind);
    if (!force && (sig === st.sig || body.contains(document.activeElement))) return;
    st.sig = sig;
    draw(w);
  }

  UI.battlePage = {
    sync, isOpen: () => st.open,
    leave() { const w = wanted(); if (w) st.dismissed = w.key; hide(true); },
    resume() { st.dismissed = ''; sync(true); }
  };
  UI.action('battlePageLeave', () => { UI.battlePage.leave(); return UI.KEEP; });
  UI.action('battlePageResume', () => { UI.battlePage.resume(); return UI.KEEP; });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && st.open && $('modalLayer')?.hidden !== false) { e.preventDefault(); UI.battlePage.leave(); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
