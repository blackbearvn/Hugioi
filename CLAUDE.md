# Hư Giới · hướng dẫn làm việc

Người chủ dự án không phải lập trình viên chuyên nghiệp: giải thích bằng tiếng Việt dễ hiểu, từng bước.
Quy trình bắt buộc nằm ở [docs/quy-trinh-vibe-coding.md](docs/quy-trinh-vibe-coding.md). Tóm tắt những điều hay bị quên:

- Dự án đã chạy: xem hiện trạng trước, không làm lại từ đầu, không viết lại phần đang ổn.
- Hỏi trước khi đổi kiến trúc, đụng database, xóa hay ghi đè dữ liệu, dùng dịch vụ tốn tiền, hoặc đưa lên production (đẩy lên `main` có thể tự deploy).
- Sửa nhỏ nhất có thể, đọc code liên quan trước khi sửa.
- Báo cáo đúng mức đã đạt: đã viết code, đã chạy thử, đã kiểm thử, đã triển khai, đã được nghiệm thu. Không nói "xong" khi chưa kiểm chứng.
- Không để khóa bí mật trong source hay log.

## Lệnh thường dùng

- `npm run check` kiểm tra cú pháp; `node --test tests/*.test.cjs` chạy test.
- `npm run build:min` dựng `dist/` bản phát hành (kèm kiểm tra CSS bundle).
- `PORT=8001 node tools/online-ci-server.cjs` chạy bản thử cục bộ.

## Kiến trúc client

Không dùng bundler. Các biến toàn cục `HU_UI`, `HU_GAME`, `HU_ASSETS`; màn hình ở `client/ui/screens/*.js`,
đăng ký bằng `UI.register`; lệnh phía máy chủ qua `UI.command`. Thứ tự nạp script nằm trong `index.html`.
Phông tiêu đề: Fz Truyền Kỳ (`media/fonts/`, biến `--display`); chữ nội dung giữ nguyên phông dễ đọc.
