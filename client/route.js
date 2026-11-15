/* Ba trang của Hư Giới: login → create → game. Chỉ là điều hướng hiển thị (hash + tiêu đề + data-page);
   quyền vào trang vẫn do máy chủ và phiên đăng nhập quyết định, hash gõ tay không mở được trang chưa đủ điều kiện. */
(function (root) {
  'use strict';
  const PAGES = Object.freeze({
    login: { hash: '#/dang-nhap', title: 'Đăng nhập · Hư Giới' },
    create: { hash: '#/tao-nhan-vat', title: 'Tạo nhân vật · Hư Giới' },
    game: { hash: '#/vao-game', title: 'Hư Giới · Tiên Lộ Vô Tận' }
  });
  let page = 'login';

  function paint() {
    const p = PAGES[page];
    document.body.dataset.page = page;
    document.title = p.title;
    try {
      if (root.location.hash !== p.hash) root.history.replaceState(null, '', root.location.pathname + root.location.search + p.hash);
    } catch { /* môi trường chặn history */ }
  }
  /* Chuyển trang hiện tại. Dùng replaceState để nút Back không đưa người chơi quay lại trang đã đóng. */
  function go(next) {
    if (!PAGES[next]) return page;
    page = next;
    paint();
    return page;
  }
  /* Người dùng sửa hash tay hoặc bấm Back: đưa về đúng trang theo trạng thái thật. */
  root.addEventListener('hashchange', () => {
    if (root.location.hash !== PAGES[page].hash) paint();
  });
  root.HU_ROUTE = Object.freeze({ PAGES, go, get page() { return page; } });
  paint();
})(typeof window !== 'undefined' ? window : globalThis);
