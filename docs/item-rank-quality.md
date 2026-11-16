# Quy chuẩn cấp bậc và phẩm chất vật phẩm

Tài liệu này là nguồn thiết kế cho hệ thống `rank` 1–7 và `quality` 1–5 của Hư Giới.
Mã cấu hình tập trung nằm ở `data/schema.js`; không định nghĩa lại bảng cấp bậc/phẩm chất ở file khác.

## 1. Đánh giá hệ thống cũ

Hệ thống cũ có ba thang khác nhau:

- `data/schema.js` → `GRADES`: 14 bậc dùng cho đan (`Phàm phẩm` … `Thánh đan`).
- `data/schema.js` → `RARITIES`: 8 bậc dùng cho mọi loại không phải đan (`Phàm phẩm` … `Thánh phẩm`).
- `quality` (chuỗi) + `sub` (0–3) dùng cho phẩm chất vật phẩm; `sub` là chỉ số thật trong giá, hiệu ứng và inventory.

Vấn đề:

- Không có trường `rank` thống nhất; `grade` vừa mang nghĩa độ hiếm, vừa mang nghĩa cảnh giới, vừa mang nghĩa phẩm chất.
- Chỉ có 4 phẩm chất, thiếu bậc cao nhất cho chế tạo bậc thầy.
- `quality` là chuỗi nên khó kiểm tra số học; `sub` 0–3 bị giới hạn ở nhiều nơi (`item()`, state, UI).
- Màu phẩm chất cũ dùng Hạ = xanh dương, không khớp quy chuẩn mới.

## 2. Xác nhận hệ thống 3 giới, 14 cảnh giới

Giữ nguyên `data/balance.js` và `data/formulas.js`:

| # | Cảnh giới | Giới | Số tầng | Lôi kiếp hiệu lực |
|---:|---|---|---:|---:|
| 0 | Luyện Khí | Hạ Giới | 13 | 0 |
| 1 | Trúc Cơ | Hạ Giới | 4 | 3 |
| 2 | Kết Đan | Hạ Giới | 4 | 3 |
| 3 | Nguyên Anh | Hạ Giới | 4 | 9 |
| 4 | Hóa Thần | Hạ Giới | 4 | 27 (+36 Phi Thăng) |
| 5 | Luyện Hư | Linh Giới | 4 | 36 |
| 6 | Hợp Thể | Linh Giới | 4 | 72 |
| 7 | Đại Thừa | Linh Giới | 4 | 81 |
| 8 | Độ Kiếp | Linh Giới | 9 | 99 |
| 9 | Chân Tiên | Tiên Giới | 4 | 108 |
| 10 | Kim Tiên | Tiên Giới | 4 | 360 |
| 11 | Thái Ất | Tiên Giới | 4 | 500 |
| 12 | Đại La | Tiên Giới | 4 | 999 |
| 13 | Đạo Tổ | Tiên Giới | 3 | 9.999 |

Ghi chú: `BOLTS[1]` trong `balance.js` là 0, nhưng `formulas.js` ghi đè Trúc Cơ thành 3. Bảng trên dùng giá trị engine thực tế, khớp đặc tả. Không sửa tên, thứ tự, số tầng, lôi kiếp hay cơ chế Phi Thăng.

## 3. Bảy cấp bậc vật phẩm

| rank | Tên | Cảnh giới phục vụ | Bản chất | Giới hạn / công dụng |
|---:|---|---|---|---|
| 1 | Phàm giai | Luyện Khí | Vật liệu nền, linh khí mỏng | Trang bị nhập môn, đan thường, nguyên liệu đầu game |
| 2 | Linh giai | Trúc Cơ – Kết Đan | Linh khí ổn định, có dấu ấn chế tác | Trang bị chuyển tiếp, đan bổ trợ, nguyên liệu phổ thông |
| 3 | Huyền giai | Nguyên Anh – Hóa Thần | Linh tính tự sinh, có trận văn | Pháp bảo chủ lực, đan hộ kiếp, công pháp trung cấp |
| 4 | Địa giai | Luyện Hư – Hợp Thể | Bám địa mạch, ảnh hưởng quy luật cục bộ | Pháp bảo chiến lược, đan đột phá, nguyên liệu cao cấp |
| 5 | Thiên giai | Đại Thừa – Độ Kiếp | Uy năng thiên địa, chạm lôi kiếp | Bảo vật hộ kiếp, công pháp tối thượng, đan phi thăng |
| 6 | Tiên giai | Chân Tiên – Đại La | Tiên lực, thoát giới hạn linh lực | Trang bị tiên nhân, đan tiên, công pháp tiên đạo |
| 7 | Thần giai | Đạo Tổ | Đạo vận, quy luật gốc | Bảo vật chí tôn, đan đạo vận, vật phẩm kết thúc hành trình |

Thần giai không đại diện cho Thần Giới hay cảnh giới sau Đạo Tổ.

## 4. Năm phẩm chất

| quality | Tên | Màu giao diện | Ý nghĩa gameplay |
|---:|---|---|---|
| 1 | Hạ phẩm | Lục | Tạp chất nhiều; công dụng cơ bản; ít/không thuộc tính phụ |
| 2 | Trung phẩm | Tím | Đã tinh luyện; có thể có một thuộc tính phụ nhỏ |
| 3 | Thượng phẩm | Vàng | Tinh thuần; nhiều thuộc tính phụ; hiệu ứng đặc biệt bắt đầu xuất hiện |
| 4 | Cực phẩm | Ngũ sắc | Gần giới hạn cấp bậc; nhiều thuộc tính phụ; hiệu ứng rõ rệt |
| 5 | Tuyệt phẩm | Đen trắng | Hoàn mỹ trong giới hạn cấp bậc; tối đa thuộc tính phụ/hiệu ứng |

Lưu ý: đặc tả có hai bảng màu khác nhau ở mục III và mục VII. Tài liệu này chọn bảng ở mục VII (Hạ = Lục, Trung = Tím, Thượng = Vàng, Cực = Ngũ sắc, Tuyệt = Đen trắng) vì đây là quy chuẩn giao diện cuối cùng. Bảng ở mục III được ghi nhận là mâu thuẫn cần thống nhất trong đặc tả.

Phẩm chất không làm đổi cấp bậc: Phàm giai Tuyệt phẩm vẫn là Phàm giai.

## 5. Liên kết cấp bậc với cảnh giới

Bảng máy đọc duy nhất: `RANK_BY_TIER` trong `data/schema.js`.

```js
// tier 0..13
[1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 6, 6, 7]
```

| rank | tier | Cảnh giới |
|---:|---|---|
| 1 | 0 | Luyện Khí |
| 2 | 1–2 | Trúc Cơ, Kết Đan |
| 3 | 3–4 | Nguyên Anh, Hóa Thần |
| 4 | 5–6 | Luyện Hư, Hợp Thể |
| 5 | 7–8 | Đại Thừa, Độ Kiếp |
| 6 | 9–12 | Chân Tiên, Kim Tiên, Thái Ất, Đại La |
| 7 | 13 | Đạo Tổ |

## 6. Quy tắc phân bổ và ngoại lệ

- `rank` của vật phẩm được suy từ `tier` (cảnh giới yêu cầu) bằng `rankForTier`. Vì vậy mọi module cũ dùng `tier` vẫn đúng.
- Không có vật phẩm nào được gán rank cao hơn cảnh giới yêu cầu. Validator chặn `rank` lệch `tier`.
- `quality` của bản ghi gốc lấy từ `sub + 1`; `sub` vẫn là chỉ số 0–4 dùng cho inventory, giá và công thức.
- Vật phẩm nhiệm vụ (`QITEM`) không được nâng rank chỉ vì quan trọng; rank vẫn theo cảnh giới. Chúng không bán được và không tham gia chợ.
- Không có ngoại lệ rank hiện tại. Nếu sau này cần một vật phẩm đặc biệt lệch rank, phải thêm bảng ngoại lệ tường minh và validator tương ứng.
- 5 vật phẩm thiết kế mới (`BT-900`, `BT-901`, `BT-CP-900`, `BT-CP-901`, `TAL-PL-001`) được suy rank/quality như mọi vật phẩm; không cần bảng tay.
- Các vật phẩm cũ không bị gán Tuyệt phẩm hàng loạt. Tuyệt phẩm xuất hiện qua chế tạo/linh điền chất lượng cao; danh sách vật phẩm độc bản nên nâng lên Tuyệt phẩm là việc cân bằng thủ công sau này.

## 7. Quy tắc theo danh mục

| Kind | Danh mục | Rank quyết định | Quality quyết định |
|---|---|---|---|
| `PILL` | Đan dược | Cảnh giới sử dụng, loại đan, độ mạnh nền | Độ tinh thuần, hiệu quả, thời lượng; bản gốc Hạ phẩm, bản chế tạo có thể lên Tuyệt phẩm |
| `HERB` | Linh thảo / dược liệu | Công thức luyện đan/phù/pháp bảo | Độ tinh khiết, giá, sản lượng tinh hoa |
| `SEED` | Hạt giống | Cấp linh điền/cây | Chất lượng cây giống, giá và sản lượng |
| `EQ` | Pháp bảo | Uy năng nền, điều kiện trang bị | Thuộc tính phụ, hiệu ứng đặc biệt, độ bền |
| `BT` | Công pháp / bí tịch | Tiềm năng tu luyện, giới hạn cảnh giới | Độ hoàn thiện, hiệu quả vận hành, độ mạnh chiêu thức |
| `TAL` | Phù lục | Cấp phù, điều kiện dùng | Độ ổn định, hiệu lực khi độ kiếp/chiến đấu |
| `MAT` | Nguyên liệu luyện chế | Phạm vi công thức | Độ tinh khiết, hiệu suất chế tạo |
| `GFT` | Quà tặng | Giá trị quà | Chất lượng phần thưởng |
| `QITEM` | Vật phẩm nhiệm vụ | Cảnh giới của nội dung | Không dùng để khóa tiến trình nhiệm vụ |
| `FERT` | Phân bón | Cấp linh điền | Mức rút ngắn thời gian, chất lượng vụ mùa |
| `CAT` | Tinh hoa | Cấp luyện đan | Mức tăng phẩm chất mẻ kế tiếp |
| `INK` | Mực luyện phù | Cấp phù | Độ ổn định và chất lượng phù |

## 8. Công thức và hệ số cân bằng

Đang giữ nguyên (tương thích dữ liệu cũ):

- `price_ha(tier, sub) = 50 × 100^tier × 2^sub`.
- Hiệu ứng đan, công pháp, pháp bảo vẫn dùng `2^sub` như trước.
- `stat_scale(realm, stage) = 8^realm × 3^stage`.
- Tỉ lệ chế tạo `craft_success(tier, skill)` không đổi.

Đã áp dụng:

- Ngưỡng quay phẩm chất dùng chung: `[0.40, 0.65, 0.85, 0.96]` → quality 1–5.
- Linh điền: tỉ lệ chăm sóc `≥1.25` → Tuyệt phẩm (sub 4), `≥1.05` → Cực phẩm, `≥0.85` → Thượng phẩm, `≥0.55` → Trung phẩm.
- Sách công pháp: hệ số phẩm chất `1 + 0.3 × sub` (Tuyệt phẩm = 2.2 thay vì 1.9).

Đề xuất nhưng **chưa áp dụng toàn cục** (cần đo lại kinh tế trước khi đổi):

- Hệ số chỉ số theo phẩm chất: `1 + 0.35 × (quality − 1) + 0.05 × (quality − 1)^2` thay cho `2^sub`.
- Hệ số giá theo phẩm chất: `1 + 0.5 × (quality − 1)` thay cho `2^sub`.
- Lý do chưa áp dụng: `2^sub` đang là nền của giá, đan, công pháp và pháp bảo; đổi ngay sẽ làm lệch toàn bộ tiến trình và test cân bằng.

## 9. Quy chuẩn màu sắc và giao diện

- Phẩm chất là màu nhận diện chính trên icon/khung: Hạ = Lục, Trung = Tím, Thượng = Vàng, Cực = Ngũ sắc, Tuyệt = Đen trắng.
- Cấp bậc dùng nhãn/huy hiệu riêng (`rank` domain trong `client/ui/labels.js`), không dùng cùng bảng màu phẩm chất.
- Tooltip hiển thị: tên, danh mục, cấp bậc, phẩm chất, cảnh giới yêu cầu, thuộc tính/công dụng, điều kiện sử dụng.
- Đan dược và phù lục hiện giá trị cụ thể ngay trong tooltip/cửa sổ chi tiết: tu vi, hồi sinh lực, hồi linh lực, hồi cả hai, tốc độ hấp thụ, xác suất đột phá, khiên hộ kiếp, thọ nguyên, củng cố, giải hiệu ứng xấu, kháng hiệu ứng xấu, buff chiến đấu. Giá trị lấy từ `F.dan_effect` theo cảnh giới, phẩm chất và số đan đã dùng nên khớp đúng lúc sử dụng; đan lệch cảnh giới ghi rõ mức giảm, riêng phù/đan hộ kiếp và đan kháng hiệu ứng xấu không bị giảm.
- Đan hồi phục chia ba nhóm rõ ràng: `HOI_HP` chỉ hồi sinh lực, `HOI_MP` chỉ hồi linh lực, `HOI_PHUC` hồi cả hai. Tooltip và hành vi dùng đan lấy cùng một trường `hoi_phan_tram_HP` / `hoi_phan_tram_MP` từ `F.dan_effect`.
- Hiệu ứng xấu dùng chung tên `đóng băng`, `choáng`, `độc`, `chảy máu`. `GIAI_DOC` xóa các hiệu ứng đang có và giảm Tâm ma; `KHANG_HIEU_UNG` xóa hiệu ứng hiện có rồi đặt khiên giảm thời gian hiệu ứng xấu mới trong một khoảng thời gian. Cả hai đều hiện mức giảm/thời gian cụ thể trong tooltip.
- Đã áp dụng ở: túi đồ, trang bị, cửa hàng, phần thưởng, chế tạo, cường hóa, luyện đan, kho, tooltip. Nguồn màu duy nhất: `client/ui/labels.js`; vầng icon: `css/shell.css` (`data-q` 0–4).

## 10. Schema dữ liệu chuẩn

```json
{
  "id": "EQ-001",
  "name": "Thanh Vân Sư Tử Ấn",
  "category": "Pháp bảo",
  "kind": "EQ",
  "tier": 0,
  "rank": 1,
  "quality": 1,
  "qualityLabel": "Hạ phẩm",
  "sub": 0,
  "grade": "Phàm phẩm"
}
```

Quy định:

- `id`/`code`: giữ nguyên, không đổi.
- `name`, `description`, `lore`: giữ nguyên.
- `rank`: số nguyên 1–7, suy từ `tier`.
- `quality`: số nguyên 1–5.
- `qualityLabel`: chuỗi hiển thị chuẩn, suy từ `quality`.
- `sub`: chỉ số 0–4 tương thích cũ, luôn bằng `quality − 1`.
- `grade`: trường cũ (14 bậc cho đan, 8 bậc cho loại khác) được giữ để tương thích; không còn là nguồn phân loại chính.

## 11. Chuyển đổi dữ liệu cũ → mới

Quy tắc chuyển đổi:

| Trường cũ | Trường mới | Quy tắc |
|---|---|---|
| `tier` | `rank` | `rankForTier(tier)` |
| `sub` 0–3 | `quality` | `sub + 1` |
| `quality` (chuỗi) | `qualityLabel` | `QUALITIES[quality − 1].label` |
| `sub` 0–3 | `sub` 0–4 | giữ nguyên với dữ liệu cũ; mở rộng 4 cho Tuyệt phẩm |
| `grade` | `grade` | giữ nguyên, chỉ chuẩn hóa chuỗi hiển thị |

Bảng đầy đủ 497 vật phẩm: `docs/item-conversion.csv`.

## 12. Danh sách file đã chỉnh sửa

- `data/schema.js`: `RANKS`, `QUALITIES`, `RANK_BY_TIER`, `rankForTier`, `rankOf`, `qualityForSub`, `subForQuality`, `qualityOf`, `qualityForRoll`, ngưỡng quay.
- `data/catalog.js`: chuẩn hóa `rank`/`quality`/`qualityLabel`; `item()` nhận `@0`–`@4`; `keyFor` giữ nguyên.
- `data/items.js`: 492 bản ghi có `rank`, `quality`, `qualityLabel`; `quality` chuyển từ chuỗi sang số.
- `data/balance.js`: `SUBPHAM` thêm `Tuyệt`.
- `data/formulas.js`: `craft_quality` dùng ngưỡng chung, trả sub 0–4.
- `data/manuals.js`: hệ số phẩm chất sách mở tới sub 4.
- `engine/rules/crafting.js`: chất lượng linh điền 0–4, sản lượng theo quality.
- `engine/state/player.js`: craft queue nhận quality 0–4.
- `engine/game.js`: expose `SCHEMA` cho client.
- `client/ui/labels.js`: 5 phẩm chất + 7 cấp bậc, màu mới.
- `client/ui/core.js`: `data-q` 0–4; helper `rankOf`, `rankLabelOf`, `qualityOf`, `qualityLabelOf`, `useCondition`, `itemEffectText`.
- `client/ui/shell.js`: tooltip đủ trường, gồm dòng thuộc tính/công dụng.
- `client/ui/screens/character.js`: tooltip/popup đủ trường.
- `client/ui/screens/craft.js`: hiển thị rank thay cho grade cũ.
- `css/shell.css`: vầng icon 5 phẩm chất.
- `tools/normalize-ranks.mjs`: migrate idempotent + `--check`.
- `tools/check-data.mjs`: validate rank/quality/qualityLabel/sub.
- `tests/data.test.cjs`, `tests/check-data.test.cjs`: test mới.
- `data/README.md`, `docs/item-rank-quality.md`, `docs/item-conversion.csv`.

## 13. Báo cáo triển khai

- Đã thêm 7 rank và 5 quality vào một nguồn duy nhất.
- Đã gán `rank`/`quality` cho 497 vật phẩm (492 raw + 5 thiết kế mới).
- Đã mở inventory/state/UI từ 4 lên 5 phẩm chất.
- Đã đổi màu giao diện theo quy chuẩn mới và thêm tooltip đầy đủ.
- Không đổi tên/ID/mô tả/lore; không đổi 14 cảnh giới, số tầng, lôi kiếp hay Phi Thăng.
- Không đổi toàn bộ công thức chỉ số; chỉ mở rộng ngưỡng phẩm chất và hệ số sách cho sub 4.
- `grade` được giữ làm trường tương thích, không còn dùng làm nguồn phân loại chính.

## 14. Kiểm thử và vấn đề chưa giải quyết

Đã chạy:

- `node tools/check-data.mjs --strict` → 497 vật phẩm hợp lệ.
- `npm test` → toàn bộ test pass.
- `npm run check` → pass.
- `npm run build` → thành công.
- `node tools/normalize-ranks.mjs --check` → dữ liệu đã chuẩn hóa.

Chưa giải quyết / cần quyết định:

- Đặc tả có hai bảng màu phẩm chất mâu thuẫn (mục III và VII); đã chọn mục VII, cần xác nhận lại.
- Chưa gán Tuyệt phẩm cho vật phẩm cũ để tránh đổi chỉ số/giá hàng loạt. Tuyệt phẩm hiện có thể xuất hiện qua chế tạo/linh điền.
- Các trường `grade` cũ vẫn tồn tại để tương thích; có thể bỏ dần sau khi xác nhận không còn client/server cũ đọc.
- Bảng chuyển đổi đầy đủ nằm ở CSV; nếu cần review từng vật phẩm độc bản (đặc biệt QITEM) nên làm thủ công.
