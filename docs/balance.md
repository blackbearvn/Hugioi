# Mô hình thuộc tính và cân bằng

Tài liệu này mô tả cách Hư Giới tính thuộc tính, sức mạnh đối thủ, lôi kiếp, đột phá và kinh tế.
Nguồn số liệu duy nhất là `data/balance.js` (hằng số) và `data/formulas.js` (hàm số). Không chép lại
công thức vào UI hay server; mọi nơi đọc qua `H.F`.

Chạy `npm run balance` để in báo cáo cân bằng hiện tại. Thêm `--json` để lấy dữ liệu máy đọc.

## 1. Nguyên tắc

- Chỉ số đối thủ **luôn suy ra từ cảnh giới/khu vực**, không dùng HP/ATK/DEF tuyệt đối trong
  `data/design-raw.js`. Dữ liệu thiết kế chỉ giữ tên, hệ, kỹ năng, bạo kích, né và hồ sơ thưởng.
- Một cảnh giới = một khu vực (`zone`). Đột phá đại cảnh giới đưa `zone` theo `realm`.
- Mọi thang sức mạnh dùng chung `F.stats` và `F.combat_power`; không có bảng chỉ số thứ hai.
- Lôi kiếp chỉ giết khi **hộ kiếp vỡ**. Trượt xác suất phá cảnh sau khi đã qua lôi kiếp chỉ mất tu vi.
- Hằng số cân bằng nằm trong `P` của `data/balance.js`; sửa ở đó rồi chạy lại mô phỏng.

## 2. Cảnh giới, tầng và thời gian

`data/balance.js` giữ 14 cảnh giới, 69 tầng, số đạo lôi và dữ liệu Phi Thăng. Không đổi các bảng này
khi cân bằng; chỉ đổi hằng số trong `P`.

Thời gian một tầng:

```text
stage_time(r, s) = T0 × (1 + r)^T_POW × (W_MIN + (W_MAX − W_MIN) × s / (n − 1))
realm_time(r)    = Σ stage_time(r, s) cho s = 0..n−1
```

| Hằng số | Giá trị | Ý nghĩa |
|---|---:|---|
| `T0` | 150 | Giây nền cho tầng đầu |
| `T_POW` | 2.8 | Độ dốc thời gian theo cảnh giới |
| `W_MIN`, `W_MAX` | 0.75, 1.25 | Trọng số tầng đầu/cuối trong một đại cảnh giới |
| `R0` | 1 | Tốc độ tu luyện nền |
| `K_RATE` | 12 | Tốc độ tu luyện tăng theo cảnh giới |
| `U` | 3 | Tốc độ tăng thêm theo tầng trong cảnh giới |

Hành trình lý thuyết không có thưởng: **≈ 1.164 giờ (48,5 ngày)**. Đây là mốc tham chiếu, không phải
thời gian thực tế vì còn đan, công pháp, linh căn, sự kiện và thời gian offline bị đóng băng.

Tu vi cần cho một tầng:

```text
ref_rate(r, s) = R0 × K_RATE^r × U^(s / n)
exp_need(r, s) = stage_time(r, s) × ref_rate(r, s)
```

## 3. Thuộc tính gốc

```text
stat_scale(r, s) = K_STAT^r × K_STAGE^(s / n)
HP  = HP0  × stat_scale
ATK = ATK0 × stat_scale
DEF = DEF0 × stat_scale
SPD = SPD0 × K_SPD^(r + s / n)
```

| Hằng số | Giá trị |
|---|---:|
| `HP0` | 100 |
| `ATK0` | 10 |
| `DEF0` | 5 |
| `SPD0` | 10 |
| `K_STAT` | 8 |
| `K_STAGE` | 3 |
| `K_SPD` | 1.5 |

`F.stats(r, s, rootType)` nhận thêm hệ số linh căn chiến đấu. Hiện `LINH_CAN_COMBAT` để mọi loại ở 1,
nên linh căn không cộng trực tiếp HP/ATK/DEF; ảnh hưởng của linh căn nằm ở tốc độ tu, bạo kích, né và
lôi kiếp.

### Nguồn cộng thêm

Thứ tự cộng trong `Game.stats()`:

1. Trang bị pháp bảo: HP/ATK/DEF/MP cộng theo phẩm chất `2^(sub − sub gốc)`.
2. Trang bị khác: `F.item_flat_bonus(tier, sub) = stat_scale(tier, 0) × 0.05 × 2^sub`.
3. Buff chiến đấu còn hạn (DEF, né).
4. Huyết mạch: Nhân +5% HP/ATK/tốc độ; Ma +20% ATK; Yêu +25% HP; Linh +10% tốc độ;
   Tiên Duệ +15% tốc độ; Thú +10% HP/ATK, −10% tốc độ.
5. Thiên phú Căn Cốt: +2% HP và ATK mỗi điểm (tối đa 8 điểm gốc).
6. Thiên Mệnh Các Căn Cốt: +2,5% mỗi tầng, tối đa 20 tầng (+50%).
7. Công pháp nội tu, tông môn, buff đan.
8. Bạo kích: nền + Vận Khí ×0,5% + may mắn tài khoản ×0,5% + linh căn + tông môn + pháp bảo,
   giới hạn 75%.
9. Né: nền + linh căn + pháp bảo, giới hạn 60%.

## 4. Sát thương và sức mạnh chiến đấu

```text
damage        = max(1, skill × ATK² / (ATK + DEF × (1 − pen)) × crit_mult)
combat_power  = sqrt(HP × (1 + DEF / ATK) × ATK × (1 + CRIT × (CRIT_DMG − 1)))
win_probability(player, enemy) = 1 / (1 + (enemy / player)^3)
```

`pen` là xuyên giáp 0–1; `crit_mult` là 1 hoặc `CRIT_DMG` (nền 1,5). `win_probability` chỉ là mốc
tham chiếu để so sánh, không phải công thức trận đấu thật.

## 5. Đối thủ

### Quái theo khu vực

`Game.enemy()` lấy `F.stats(zone, stage − 1)`, nhân `MONSTER_MULT`, rồi gắn hồ sơ thiết kế:

| Loại | Hệ số | Tỉ lệ CP so với người cùng tầng | Xác suất thắng tham chiếu |
|---|---:|---:|---:|
| Thường | 0.6 | 0.60 | 82,2% |
| Tinh anh | 1.2 | 1.20 | 36,7% |
| Boss | 2.0 | 2.00 | 11,1% |
| Boss kiếp | 3.0 | 3.00 | 3,6% |

Vì cả hai bên cùng dùng `F.stats(zone, stage − 1)`, tỉ lệ này **không đổi theo cảnh giới**. Đây là
khác biệt cốt lõi so với bản cũ: quái có tên từng tụt từ 0,81× sức người chơi ở khu 0 xuống 0,004× ở
khu 4 vì dùng HP/ATK tuyệt đối của bản thử nghiệm.

Quái có tên hiện chỉ xuất hiện ở 5 khu đầu (theo `design-raw.js`). Từ cảnh giới 5 trở đi, tên lấy từ
`ENEMY_NAMES`; chỉ số vẫn theo công thức.

### Bí cảnh

```text
dungeonEnemy(d, floor) = combat_power(F.stats(d.realm, 0)) × (0.48 + 0.12 × (floor − 1)) × (floor cuối ? 1.5 : 1)
```

- Mô phỏng tự động: HP quái thường = `dungeonEnemy × 3`, HP thủ lĩnh = `dungeonEnemy × 4`.
- Đánh tay: `runEnemy` dùng `mult = 0.5 + 0.08 × (floor − 1)`;
  HP = `stats.HP × mult × (thủ lĩnh ? 1.8 : 0.6)`, ATK = `stats.ATK × mult × (thủ lĩnh ? 0.8 : 0.75)`.
- Thủ lĩnh giữ né/bạo kích/pha và bảng thưởng thiết kế, nhưng không dùng HP tuyệt đối.

### Giao chiến theo lượt trong lịch luyện

Chọn “Giao chiến” ở sự kiện yêu thú sẽ mở trận theo lượt (`exploration.active.battle`). HP/ATK/DEF
địch vẫn suy từ `F.stats(zone, stage − 1)` rồi nhân hệ số riêng của trận, không dùng số tuyệt đối
trong `design-raw.js`:

| Loại | HP | ATK | DEF | Đòn nặng | Hệ số giai đoạn boss |
|---|---:|---:|---:|---:|---|
| Thường | 0.60 | 0.50 | 0.55 | 22% | — |
| Tinh anh | 0.85 | 0.65 | 0.75 | 28% | — |
| Boss | 1.00 | 1.05 | 0.90 | 40% | 1.3 / 1.6 / 2.0 |
| Boss kiếp | 1.30 | 1.10 | 1.00 | 45% | 1.3 / 1.6 / 2.0 |

- Đòn nặng ×1.8; thủ thế giảm 70% sát thương nhận; trọng kích ×2.2, tốn 12% linh lực, hồi 2 lượt.
- Hồi phục tốn 18% linh lực, hồi 26% HP tối đa, hồi 2 lượt. Rút lui thành công khoảng 55%.
- Mỗi lượt quy đổi 6 giây (`BATTLE.secondsPerTurn`) để hồi chiêu công pháp/pháp bảo dùng chung đơn vị lượt.
- Đồng hồ lịch luyện **đóng băng** khi có trận; `advance` dời `exploration.start/end` theo `battle.remaining`
  nên người chơi không mất thời gian suy nghĩ.
- Mô phỏng 120 trận mỗi cảnh giới: quái thường ≈ 5 lượt/100% thắng, tinh anh ≈ 8,5 lượt/100%,
  boss ≈ 15 lượt/75% (không rút lui). Boss kiếp không xuất hiện trong lịch luyện thường.

## 6. Lôi kiếp và hộ kiếp

```text
tribulation_total(r) = F.stats(r, n − 1).HP × TRIB_MULT × LINH_CAN_TRIB[rootType]
bolts(r)             = total / min(BOLTS[r], 999) × (0.5 + k / min(BOLTS[r], 999))
```

Tổng sát thương thực của các tia là `total × (n − 0.5) / n`, không phải `total`. Với `TRIB_MULT = 1.1`,
cảnh giới 1–2 sống sót nền; từ Nguyên Anh trở đi cần khiên hoặc giảm sát thương.

- `LINH_CAN_TRIB`: Thiên/Dị ×1.25, Hỗn Độn ×1.5, còn lại ×1.
- Phi Thăng dùng `ASCEND_TRIB_MULT = 1.25` và số tia riêng trong `ASCEND_BOLTS`.
- Mỗi đợt được kiểm tra độc lập trên toàn bộ HP + khiên (không cộng dồn giữa các đợt).

Hộ kiếp từ đan/phù (`effect === 'KIEP'`):

```text
k       = 2^(quality − 1)
shield  = KIEP_SHIELD × k        // 10% HP mỗi phẩm chất gốc
reduction = min(KIEP_RED_MAX, KIEP_RED × k)
```

| Phẩm chất | Khiên (% HP) | Giảm sát thương |
|---|---:|---:|
| Hạ (1) | 10% | 5% |
| Trung (2) | 20% | 10% |
| Thượng (3) | 40% | 20% |
| Cực (4) | 80% | 40% |
| Tuyệt (5) | 160% | 40% |

Hộ kiếp **bỏ qua hình phạt lệch cảnh giới** (`DAN_MISMATCH`). Đan/phù phẩm thấp vẫn là vật dự phòng
hợp lệ khi đã lên cảnh giới cao; giá trị của chúng nằm ở phẩm chất, không ở cảnh giới yêu cầu.

Đan kháng hiệu ứng xấu (`KHANG_HIEU_UNG`) dùng `P.WARD_DUR = 12` giây, giảm
`P.WARD_RED = 15%` thời gian hiệu ứng xấu mỗi bậc phẩm chất, trần
`P.WARD_RED_MAX = 80%`. Cơ chế này cũng bỏ qua hình phạt lệch cảnh giới để đan
phòng thân cấp thấp vẫn dùng được như phương án dự phòng. `GIAI_DOC` xóa ngay
hiệu ứng đang có và giảm Tâm ma, còn `KHANG_HIEU_UNG` xóa hiệu ứng hiện có rồi
đặt khiên giảm thời gian cho các hiệu ứng mới.

## 7. Đột phá, may mắn và tử vong

Tại đỉnh đại cảnh giới:

```text
p_base(r)        = max(0.30, 0.95 − 0.05 × r)
p_peak(r)        = p_base(r) × 0.85
pity_bonus       = min(pity, 15) × 0.02
chance           = clamp((p_peak + diminishing(bonus, 0.35, 0.5) + pity_bonus
                          + Vận Khí × 0.003 + may mắn tài khoản × 0.003
                          − Tâm Ma × 0.0015) × (1 + Thiên Mệnh Các), 0, 0.98)
```

Tiểu cảnh giới tự động đột phá khi đầy tu vi, không gieo xác suất. Đại cảnh giới mới mở lôi kiếp.

Kết quả một lần đột phá đại cảnh giới:

| Điều kiện | Kết quả |
|---|---|
| Hộ kiếp vỡ (một đợt lôi kiếp thất bại) | **Tử vong vĩnh viễn**, xóa tiến trình kiếp này |
| Qua lôi kiếp nhưng trượt xác suất phá cảnh | Mất `FAIL_EXP_LOSS = 15%` tu vi hiện tại, `pity +1`, hồi đầy HP/MP, **không chết** |
| Qua lôi kiếp và trúng xác suất | Lên tầng/cảnh giới, `pity = 0`, nhận thưởng Thiên Tinh theo cảnh giới |

Nhờ vậy cơ chế may mắn mới có tác dụng: người chơi thất bại có thể tích lũy dần thay vì mất toàn bộ
nhân vật. Tử vong chỉ còn đến từ hộ kiếp không đủ, thọ nguyên hoặc chiến đấu.

## 8. Kinh tế

### Tiền tệ theo đại giới

| Đại giới của nhân vật | Cảnh giới | Tiền tệ | Giá trị theo đơn vị lưu trữ |
|---|---|---|---:|
| Hạ Giới | Luyện Khí – Hóa Thần (0–4) | Linh thạch hạ phẩm | 1 |
| Linh Giới | Luyện Hư – Độ Kiếp (5–8) | Linh thạch cực phẩm | 1.000.000 |
| Tiên Giới | Chân Tiên – Đạo Tổ (9–13) | Tiên ngọc | 10¹⁸ |

`COINS` và `COIN_OF_REALM` trong `data/balance.js` quy định ba loại tiền. Mọi nơi đọc
`F.currency(realm)`; loại tiền không thay đổi theo độ lớn số dư hoặc khu vực đang đánh quái.
Ví `state.stone`, giá, chi phí và phần thưởng vẫn tính bằng đơn vị hạ phẩm cũ. Khi chuyển đại giới,
chỉ đổi đơn vị hiển thị: không sửa bản lưu, không cộng/trừ số dư và không thay giá trị giao dịch.
Tỷ lệ giữ từ mô hình cũ: 1 cực phẩm = 10⁶ hạ phẩm; 1 tiên ngọc = 10¹² cực phẩm.
Thiên Tinh của tài khoản tiếp tục dùng riêng ở Thiên Mệnh Các.

`F.money_amount` rút gọn số theo vạn (10⁴), ức (10⁸), triệu (10¹²), kinh (10¹⁶)…;
`F.format_linh_thach(value, realm)` kèm tên tiền. Ví dụ 125.000 ở Hạ Giới hiển thị
`12,5 vạn linh thạch hạ phẩm`. Tooltip và nhãn hỗ trợ đọc dùng số đầy đủ.
Số dương nhỏ hơn 0,01 đơn vị hiển thị `<0,01` để không nhầm thành hết tiền.

Mỗi đại giới chỉ hấp thu loại tiền đang dùng, hiệu suất 15%, với các mức 1, 100, 1 vạn, 1 ức.
`absorb.count` là số nguyên 1–10⁸; máy chủ tính và trừ chi phí, không nhận giá từ client.
Lệnh cũ không có `count` tiếp tục hấp thu một đơn vị.
Mã payload `absorb.index` giữ 0 (hạ phẩm), 3 (cực phẩm), 4 (tiên ngọc) như trước để
không đổi chi phí của lệnh từ client cũ; các mã tiền đã bỏ và tiền khác đại giới bị từ chối.

### Giá và thu nhập

```text
price_ha(r, sub) = PRICE0 × PRICE_STEP^r × 2^sub
income_rate(r)   = INC_DAN_PER_STAGE × price_ha(r) / avg_stage_time(r)
```

| Hằng số | Giá trị |
|---|---:|
| `PRICE0` | 50 |
| `PRICE_STEP` | 100 |
| `INC_DAN_PER_STAGE` | 5 |
| `KILLS_PER_STAGE` | 8 |
| `INCOME_SHARE` | quái 50%, bán đồ 30%, tông môn 20% |

- Bán vật phẩm: 40% giá trị; mua cửa hàng: ×1,2; đấu giá phí 10%.
- Đan tu vi: `DAN_F0 = 3%` tu vi tầng hiện tại × `2^sub`, suy giảm theo số lần dùng
  (`1 + used / 5`), lệch cảnh giới ×0,5 mỗi bậc.
- Tỉ lệ rơi yêu đan và linh thạch lấy từ `loot_ev`, không có bảng riêng trong UI.

## 9. Điểm chỉnh cân bằng

| Muốn đổi | Sửa trong `data/balance.js` | Ảnh hưởng |
|---|---|---|
| Toàn bộ đường cong sức mạnh | `P.K_STAT`, `P.K_STAGE` | HP/ATK/DEF của cả người chơi và quái |
| Độ khó quái | `MONSTER_MULT` | Tỉ lệ CP và xác suất thắng của từng loại quái |
| Độ khó bí cảnh | `RUN.*` trong `engine/rules/adventures.js` | HP/ATK quái và thủ lĩnh đánh tay |
| Giao chiến theo lượt | `BATTLE` trong `engine/rules/combat.js` | HP/ATK/DEF, đòn nặng, thủ thế, trọng kích, hồi phục, rút lui |
| Lôi kiếp | `P.TRIB_MULT`, `P.ASCEND_TRIB_MULT` | Sát thương nền của lôi kiếp |
| Hộ kiếp | `P.KIEP_SHIELD`, `P.KIEP_RED`, `P.KIEP_RED_MAX` | Khiên/giảm sát thương theo phẩm chất |
| Đột phá | `P.P_START`, `P.P_DROP`, `P.P_REALM_FACTOR`, `P.PITY_*` | Xác suất và may mắn |
| Hình phạt thất bại | `P.FAIL_EXP_LOSS` | Tu vi mất khi trượt xác suất (không chết) |
| Tốc độ hành trình | `P.T0`, `P.T_POW`, `P.K_RATE`, `P.U` | Thời gian và tu vi cần mỗi tầng |
| Kinh tế | `P.PRICE0`, `P.PRICE_STEP`, `P.INC_DAN_PER_STAGE` | Thu nhập, giá, đan |

Sau mỗi lần đổi, chạy:

```sh
npm run balance
npm test
npm run check
```

## 10. Rủi ro còn lại

- 497 vật phẩm hiện chỉ có phẩm chất 1–4; phẩm chất 5 đến từ chế tạo/linh điền. Cần theo dõi tỉ lệ
  rơi thực tế trước khi mở rộng.
- Quái có tên chỉ phủ 5 khu đầu; từ khu 5 trở đi người chơi gặp tên chung. Nếu muốn đa dạng hơn,
  thêm hồ sơ thiết kế mới thay vì hạ cấp chỉ số.
- `BOLTS[1]` trong `balance.js` là 0 nhưng `formulas.js` ghi đè Trúc Cơ thành 3. Bảng mô phỏng dùng
  giá trị engine thực tế; không sửa `BOLTS` nếu chưa kiểm tra lại lôi kiếp.
- `win_probability` là mốc so sánh, không mô phỏng né/bạo kích/kỹ năng. Cân bằng thực chiến vẫn cần
  chơi thử hoặc mô phỏng trận đấu đầy đủ.
- Kinh tế chưa tính chi phí cơ hội của thời gian offline (bị đóng băng theo thiết kế).
