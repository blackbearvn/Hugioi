# Cấu hình frontend với Vite

Ở thư mục gốc, chạy `cp -n .env.example .env.local` để tạo cấu hình local mà không ghi đè file đã có. Git bỏ qua `.env.local` và các file `.env` thật. Điền các biến sau rồi khởi động lại Vite:

| Biến | Giá trị |
| --- | --- |
| `VITE_SUPABASE_URL` | Bắt buộc. URL HTTPS gốc của dự án Supabase, dạng `https://<project>.supabase.co`. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Bắt buộc. Khóa publishable của cùng dự án (hoặc khóa anon JWT cũ). |
| `VITE_HCAPTCHA_SITEKEY` | Tùy chọn. Sitekey công khai dạng UUID. Rỗng hoặc sai định dạng thì widget không tải. Nếu bật CAPTCHA trong Supabase Auth, cấu hình sitekey cho cả game và dashboard. |

Trong CI hoặc hosting, đặt các biến này cho bước chạy **build Vite** của từng môi trường; dựng lại khi thay đổi. Cấu hình sau khi đã xuất `dist/` không thay đổi bundle. Kiểm tra CSP của bản xuất cho phép đúng origin dự án.

Các biến `VITE_` là dữ liệu **công khai**, vẫn có thể đọc được từ bundle. Giữ khóa secret, service role, thông tin kết nối database và hCaptcha secret trong môi trường server/Edge hoặc cấu hình Supabase Auth tương ứng. Kiểm tra kiểu/định dạng trong trình duyệt chỉ giúp báo lỗi cấu hình; nó không ngăn giá trị đã cấp cho Vite xuất hiện trong bản build.
