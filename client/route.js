/* Điều hướng Hư Giới: login → menu → create/game. Chỉ là điều hướng hiển thị (đường dẫn /login, /create, /game + tiêu đề + data-page);
   quyền vào trang vẫn do máy chủ và phiên đăng nhập quyết định, gõ tay đường dẫn không mở được trang chưa đủ điều kiện. */
(function (root) {
  'use strict';
  const PAGES = Object.freeze({
    login: { path: '/login', title: 'Đăng nhập · Hư Giới' },
    menu: { path: '/menu', title: 'Menu chính · Hư Giới' },
    create: { path: '/create', title: 'Tạo nhân vật · Hư Giới' },
    game: { path: '/game', title: 'Hư Giới · Tiên Lộ Vô Tận' }
  });
  let page = 'login';

  function paint() {
    const p = PAGES[page];
    document.body.dataset.page = page;
    document.title = p.title;
    try {
      // Giữ nguyên query và hash: đăng nhập Google và email xác nhận trả tham số về trang hiện tại.
      if (root.location.pathname !== p.path) root.history.replaceState(null, '', p.path + root.location.search + root.location.hash);
    } catch { /* môi trường chặn history */ }
  }
  /* Chuyển trang hiện tại. Dùng replaceState nên nút Back không đưa người chơi về trang đã đóng. */
  function go(next) {
    if (!PAGES[next]) return page;
    page = next;
    paint();
    return page;
  }
  root.HU_ROUTE = Object.freeze({ PAGES, go, get page() { return page; } });
  paint();
})(typeof window !== 'undefined' ? window : globalThis);
