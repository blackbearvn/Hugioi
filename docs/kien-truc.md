# Bản đồ kiến trúc Hư Giới

Tài liệu này giúp người mới (và các công cụ AI) biết mỗi thứ nằm ở đâu trước khi sửa. Khi đổi cấu trúc, sửa luôn tệp này.

## Các lớp

| Thư mục | Vai trò | Chạy ở đâu |
| --- | --- | --- |
| `data/` | Bảng dữ liệu: vật phẩm, công pháp, linh căn, nhiệm vụ, công thức, cân bằng. | Trình duyệt, máy chủ, Edge Function |
| `engine/` | Luật chơi thuần (không chạm giao diện hay mạng). `state/player.js` chuẩn hóa bản lưu; `rules/*.js` là các miền luật cài vào `Game.prototype`; `protocol/commands.js` là danh sách lệnh; `game.js` ghép tất cả. | Cả ba nơi trên |
| `server/` | Dịch vụ phía máy chủ: người chơi, hàng ngày, kho dữ liệu Postgres, xác thực. | Node / Edge |
| `supabase/functions/api/` | Edge Function `api` (TypeScript, Deno): cổng HTTP cho mọi lệnh. Luật thay đổi phải dựng lại (`npm run build:edge`) và triển khai lại. | Supabase |
| `client/` | Giao diện và phiên chơi trên trình duyệt. | Trình duyệt |
| `css/` | Giao diện. Tệp nạp sau ghi đè tệp nạp trước (xem thứ tự `<link>` trong `index.html`). | Trình duyệt |
| `tests/`, `tools/` | Kiểm thử, công cụ dựng và kiểm tra. | Máy phát triển, CI |

**Nguyên tắc quan trọng:** luật chơi do máy chủ quyết định. Giao diện chỉ gửi lệnh qua `UI.command` rồi vẽ kết quả; không tự tính thưởng, xác suất hay thời gian.

## Cách nạp mã giao diện

Không dùng bundler cho mã trò chơi. `client/startup.ts` (do Vite dựng) đọc danh sách trong `client/classic-scripts.json` và nạp từng tệp theo **đúng thứ tự đó**. Mọi tệp dùng các biến toàn cục:

- `HU_GAME` (luật), `HU_ASSETS` (ảnh, âm), `HU_UI` (giao diện), `HU_LABELS` (nhãn).
- Thứ tự quan trọng: `data/` → `engine/` → `client/assets` → phiên và xác thực → `client/ui/core.js` → … → `screens/*` → `boot.js`. Thêm tệp mới thì thêm vào `classic-scripts.json` đúng chỗ phụ thuộc.

## Giao diện (`client/ui/`)

- `core.js`: bộ dựng HTML dùng chung (`UI.kit`), bộ lọc, cầu nối phiên (`UI.command`, `UI.s()`, `UI.g()`).
- `shell.js`: khung ứng dụng (định tuyến, bố cục, menu, cửa sổ nổi, vòng lặp 1 giây và vòng lặp hình ảnh). Đã tách bớt: `log-panel.js` (nhật ký, nạp **trước** `shell.js`, lấy qua `UI.logPanel`) và `tribulation-page.js` (độ kiếp đài, nạp **sau**, gắn `UI.tribulation`).
- `screens/*.js`: mỗi màn hình đăng ký bằng `UI.register({ id, render, mount, ... })`; hành động bấm nút đăng ký bằng `UI.action(tên, hàm)` và trả `UI.KEEP` để giữ trạng thái.
- Trang toàn màn hình: `battle-page.js`, `craft-page.js` (đan phòng), `forge-page.js` (lò rèn, phù án).
- Trận đánh: `battle-stage.js` (sân khấu, hoạt cảnh, nhịp `PACE`), `bout-script.js`, `auto-battle.js`, `vfx.js`.
- `boot.js`: đăng nhập, menu bắt đầu, tạo nhân vật, vào game.

## Kiểm kiểu và kiểm thử

- `npm run check`: kiểm dữ liệu, kiểm nguồn và **kiểm kiểu**. Kiểm kiểu gồm `tsconfig.json` (các tệp `.ts` ở `client/`) và `tsconfig.engine.json` (`checkJs` cho `engine/`, mức nền: `this` của miền luật chấp nhận mọi thuộc tính, xem `engine/host.d.ts`; các bảng trong `data/` có `// @ts-nocheck`).
- `node --test tests/*.test.cjs`: kiểm thử đơn vị và nguồn.
- `npm run build:min`: dựng bản phát hành vào `dist/` (gộp CSS, có kiểm tra). Cần `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` (xem `cau-hinh-frontend.md`).
- Thử trình duyệt giống CI: `npx vite build --mode ci` rồi `HU_CI_DIST=1 PORT=8001 node tools/online-ci-server.cjs`. Máy chủ thử đọc tiêu đề bảo mật lúc khởi động, dựng lại thì phải chạy lại máy chủ.

## Nợ kỹ thuật đã biết

- `client/ui/shell.js` vẫn còn khoảng 1.500 dòng; nên tiếp tục cắt theo các khối (bố cục, cửa sổ nổi, menu, sân khấu).
- Phần lớn `client/` và `server/` chưa được kiểm kiểu. Mở rộng `checkJs` dần, từng thư mục.
- Chưa dùng ES module cho mã trò chơi; chuyển một lần là rủi ro cao, nên làm theo từng cụm có test.

## Quy ước cộng tác (người và AI)

- Mọi thay đổi vào `main` đi qua PR có mẫu ở `.github/pull_request_template.md`; CODEOWNERS yêu cầu chủ dự án duyệt.
- Báo cáo đúng mức đã đạt: đã viết, đã chạy thử, đã kiểm thử, đã triển khai. Quy trình đầy đủ: `quy-trinh-vibe-coding.md`.
