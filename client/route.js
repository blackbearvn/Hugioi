/* Ba trang của Hư Giới: login → create → game. Chỉ là điều hướng hiển thị (tiêu đề + data-page, địa chỉ trang giữ nguyên);
   quyền vào trang vẫn do máy chủ và phiên đăng nhập quyết định, hash gõ tay không mở được trang chưa đủ điều kiện. */
(function (root) {
  'use strict';
  const PAGES = Object.freeze({
    login: { title: 'Đăng nhập · Hư Giới' },
    create: { title: 'Tạo nhân vật · Hư Giới' },
    game: { title: 'Hư Giới · Tiên Lộ Vô Tận' }
  });
  let page = 'login';

  function paint() {
    const p = PAGES[page];
    document.body.dataset.page = page;
    document.title = p.title;
  }
  /* Chuyển trang hiện tại. Không đổi địa chỉ nên nút Back không có trang cũ để quay lại. */
  function go(next) {
    if (!PAGES[next]) return page;
    page = next;
    paint();
    return page;
  }
  root.HU_ROUTE = Object.freeze({ PAGES, go, get page() { return page; } });
  paint();
})(typeof window !== 'undefined' ? window : globalThis);
