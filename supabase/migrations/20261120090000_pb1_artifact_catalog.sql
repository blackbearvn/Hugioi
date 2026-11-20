-- Bổ sung 25 pháp bảo từ PB_1.webp vào danh mục phát thưởng. Không đổi vật phẩm cũ.
-- Tên và mã khớp data/catalog.js; không thay đổi cấu trúc bảng.

begin;

insert into game.item_catalog (code, name, category) values
  ('EQ-083', 'Thanh Long Ngọc Bội', 'Pháp bảo'),
  ('EQ-084', 'Càn Khôn Ngọc Hoàn', 'Pháp bảo'),
  ('EQ-085', 'Tử Kim Hồ Lô', 'Pháp bảo'),
  ('EQ-086', 'Thất Bảo Linh Lung Tháp', 'Pháp bảo'),
  ('EQ-087', 'Trấn Thiên Thần Ấn', 'Pháp bảo'),
  ('EQ-088', 'Bích Ngọc Giản', 'Pháp bảo'),
  ('EQ-089', 'Thái Cực Thiên Phù', 'Pháp bảo'),
  ('EQ-090', 'Cửu Long Luyện Đan Lô', 'Pháp bảo'),
  ('EQ-091', 'Hỗn Nguyên Linh Châu', 'Pháp bảo'),
  ('EQ-092', 'Phượng Hoàng Hương Lô', 'Pháp bảo'),
  ('EQ-093', 'Niết Bàn Liên Đăng', 'Pháp bảo'),
  ('EQ-094', 'Bích Hải Linh Bình', 'Pháp bảo'),
  ('EQ-095', 'Bàn Đào Tiên Quả', 'Pháp bảo'),
  ('EQ-096', 'Cửu U Băng Liên', 'Pháp bảo'),
  ('EQ-097', 'Tụ Linh Bảo Nang', 'Pháp bảo'),
  ('EQ-098', 'Thiên Cơ Tinh Bàn', 'Pháp bảo'),
  ('EQ-099', 'Chu Thiên Tinh Đồ', 'Pháp bảo'),
  ('EQ-100', 'Kim Cương Phật Châu', 'Pháp bảo'),
  ('EQ-101', 'Nhiếp Hồn Linh Chung', 'Pháp bảo'),
  ('EQ-102', 'Thiên Thư Ngọc Quyển', 'Pháp bảo'),
  ('EQ-103', 'Tử Tinh Tiên Tủy', 'Pháp bảo'),
  ('EQ-104', 'Cửu Chuyển Đan Lô', 'Pháp bảo'),
  ('EQ-105', 'Thanh Loan Ngọc Trâm', 'Pháp bảo'),
  ('EQ-106', 'Huyền Quang Bảo Kính', 'Pháp bảo'),
  ('EQ-107', 'Vạn Linh Tiên Bình', 'Pháp bảo')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category;

commit;
