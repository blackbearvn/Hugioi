/* Enum chuẩn cho dữ liệu vật phẩm, đặc biệt là đan dược.
   Thuần dữ liệu, không giữ trạng thái, không đọc DOM/mạng. Dùng chung cho
   tools/check-data.mjs, tests và các script migrate; không bắt buộc client load. */
(function (root) {
  'use strict';

  /* 9 effect đang dùng cho PILL. TRONG_SINH là effect cũ của hệ trọng sinh,
     không có viên đan nào dùng, nên tách khỏi enum đan để validator không
     vô tình cho phép một viên đan mang effect này. */
  const EFFECTS = Object.freeze({
    TU_VI: 'cộng thẳng tu vi (C3.6a)',
    BUFF_TOC: 'buff tốc độ tu luyện có thời hạn (C3.6b)',
    DOT_PHA: 'tăng xác suất đột phá (bonus_raw của C5.2)',
    KIEP: 'khiên + giảm sát thương khi độ kiếp (C6.3)',
    HOI_PHUC: 'hồi sinh lực / linh khí',
    HOI_HP: 'hồi riêng sinh lực',
    HOI_MP: 'hồi riêng linh khí',
    THO_NGUYEN: 'cộng thọ nguyên (C10.3)',
    CUNG_CO: 'cộng gộp vĩnh viễn nhỏ (tính vào ngân sách nâng cấp)',
    GIAI_DOC: 'giải hiệu ứng xấu / tâm ma (B3 Cleanse)',
    KHANG_HIEU_UNG: 'kháng / giảm thời gian hiệu ứng xấu có thời hạn',
    CHIEN_DAU: 'buff chiến đấu tạm thời'
  });
  const NON_PILL_EFFECTS = Object.freeze({
    TRONG_SINH: 'giữ lại một phần tiến độ khi trọng sinh (C9)'
  });
  const ALL_EFFECTS = Object.freeze({ ...EFFECTS, ...NON_PILL_EFFECTS });

  /* 14 bậc phẩm chất, xếp từ thấp đến cao. `label` là chuỗi hiển thị chuẩn;
     `aliases` nhận cả chuỗi cũ trong items.js (Nhất phẩm...) và chuỗi đã
     được catalog ghép từ design (phàm, linh, huyền, địa, thiên). */
  const GRADES = Object.freeze([
    Object.freeze({ id: 'pham', label: 'Phàm phẩm', aliases: ['phàm', 'Nhất phẩm'] }),
    Object.freeze({ id: 'linh', label: 'Linh phẩm', aliases: ['linh', 'Nhị phẩm'] }),
    Object.freeze({ id: 'huyen', label: 'Huyền phẩm', aliases: ['huyền', 'Tam phẩm'] }),
    Object.freeze({ id: 'dia', label: 'Địa phẩm', aliases: ['địa', 'Tứ phẩm'] }),
    Object.freeze({ id: 'thien', label: 'Thiên phẩm', aliases: ['thiên', 'Ngũ phẩm'] }),
    Object.freeze({ id: 'luc_pham', label: 'Lục phẩm', aliases: [] }),
    Object.freeze({ id: 'that_pham', label: 'Thất phẩm', aliases: [] }),
    Object.freeze({ id: 'bat_pham', label: 'Bát phẩm', aliases: [] }),
    Object.freeze({ id: 'cuu_pham', label: 'Cửu phẩm', aliases: [] }),
    Object.freeze({ id: 'tien_dan_ha', label: 'Tiên đan Hạ', aliases: [] }),
    Object.freeze({ id: 'tien_dan_trung', label: 'Tiên đan Trung', aliases: [] }),
    Object.freeze({ id: 'tien_dan_thuong', label: 'Tiên đan Thượng', aliases: [] }),
    Object.freeze({ id: 'than_dan', label: 'Thần đan', aliases: [] }),
    Object.freeze({ id: 'thanh_dan', label: 'Thánh đan', aliases: [] })
  ]);
  const GRADE_BY_ID = Object.freeze(Object.fromEntries(GRADES.map(g => [g.id, g])));
  const GRADE_BY_ALIAS = Object.create(null);
  for (const grade of GRADES) {
    GRADE_BY_ALIAS[grade.label] = grade.id;
    for (const alias of grade.aliases) GRADE_BY_ALIAS[alias] = grade.id;
  }
  const gradeIdFor = label => GRADE_BY_ALIAS[String(label == null ? '' : label).trim()] || null;
  const gradeLabel = id => GRADE_BY_ID[id]?.label || null;

  /* 8 bậc độ hiếm dùng cho mọi vật phẩm không phải đan dược. Đan dược giữ
     thang 14 bậc riêng ở GRADES; các loại khác chỉ có một thang này.
     `Hoàng` là tên cũ của bậc thứ hai trong balance.PHAM; dữ liệu thiết kế
     dùng `linh`, nên nhận cả hai và chuẩn hóa về `Linh phẩm`. */
  const RARITIES = Object.freeze([
    Object.freeze({ id: 'pham', label: 'Phàm phẩm', aliases: ['phàm', 'Phàm'] }),
    Object.freeze({ id: 'linh', label: 'Linh phẩm', aliases: ['linh', 'Linh', 'hoàng', 'Hoàng'] }),
    Object.freeze({ id: 'huyen', label: 'Huyền phẩm', aliases: ['huyền', 'Huyền'] }),
    Object.freeze({ id: 'dia', label: 'Địa phẩm', aliases: ['địa', 'Địa'] }),
    Object.freeze({ id: 'thien', label: 'Thiên phẩm', aliases: ['thiên', 'Thiên'] }),
    Object.freeze({ id: 'tien', label: 'Tiên phẩm', aliases: ['tiên', 'Tiên'] }),
    Object.freeze({ id: 'than', label: 'Thần phẩm', aliases: ['thần', 'Thần'] }),
    Object.freeze({ id: 'thanh', label: 'Thánh phẩm', aliases: ['thánh', 'Thánh'] })
  ]);
  const RARITY_BY_ID = Object.freeze(Object.fromEntries(RARITIES.map(r => [r.id, r])));
  const RARITY_BY_ALIAS = Object.create(null);
  for (const rarity of RARITIES) {
    RARITY_BY_ALIAS[rarity.label] = rarity.id;
    for (const alias of rarity.aliases) RARITY_BY_ALIAS[alias] = rarity.id;
  }
  const rarityIdFor = label => RARITY_BY_ALIAS[String(label == null ? '' : label).trim()] || null;
  const rarityLabel = id => RARITY_BY_ID[id]?.label || null;

  /* 7 cấp bậc vật phẩm chính thức. Đây là trục sức mạnh/tu luyện, độc lập với
     phẩm chất. `tierMin`/`tierMax` là dải cảnh giới (chỉ số 0-13) mà cấp bậc
     phục vụ; dải này khớp đúng bảng phân bổ trong new_schema.txt. */
  const RANKS = Object.freeze([
    Object.freeze({
      rank: 1, id: 'pham', label: 'Phàm giai', short: 'Phàm',
      tierMin: 0, tierMax: 0, realms: ['Luyện Khí'],
      energy: 'Linh khí mỏng, chưa ngưng tụ ổn định',
      material: 'Vật liệu nền, tạp chất còn nhiều',
      refinement: 'Thủ công, ít tôi luyện',
      cap: 'Chỉ phát huy trọn vẹn ở Luyện Khí',
      use: 'Trang bị nhập môn, đan thường, nguyên liệu cấp thấp',
      economy: 'Giá nền, dễ thay thế, vẫn cần cho chế tạo và nhiệm vụ đầu',
      lore: 'Dấu chân đầu tiên trên con đường tiên đạo; vật phẩm đủ dùng để bước qua ngưỡng cửa.'
    }),
    Object.freeze({
      rank: 2, id: 'linh', label: 'Linh giai', short: 'Linh',
      tierMin: 1, tierMax: 2, realms: ['Trúc Cơ', 'Kết Đan'],
      energy: 'Linh khí ổn định, đã hình thành vòng tuần hoàn nhỏ',
      material: 'Khoáng thạch, linh thảo có linh tính',
      refinement: 'Rèn theo quy phạm, có dấu ấn người chế tác',
      cap: 'Phát huy tốt từ Trúc Cơ đến Kết Đan',
      use: 'Trang bị chuyển tiếp, đan bổ trợ tu luyện, nguyên liệu chế tạo cấp thấp',
      economy: 'Hàng phổ thông của tu sĩ có căn cơ; giá ổn định, nguồn cung rộng',
      lore: 'Vật phẩm bắt đầu chứa linh khí thật sự, đủ để tu sĩ có căn cơ dùng lâu dài.'
    }),
    Object.freeze({
      rank: 3, id: 'huyen', label: 'Huyền giai', short: 'Huyền',
      tierMin: 3, tierMax: 4, realms: ['Nguyên Anh', 'Hóa Thần'],
      energy: 'Linh tính tự sinh, có thể tự hấp thu thiên địa chi khí',
      material: 'Vật liệu huyền thiết, linh mộc, yêu đan tinh luyện',
      refinement: 'Có trận văn, hỏa hầu và linh tính riêng',
      cap: 'Tác động đến thần thức và nguyên anh của người dùng',
      use: 'Pháp bảo chủ lực, đan hộ kiếp, công pháp trung cấp',
      economy: 'Hàng cao cấp của tông môn; cần thợ lành nghề hoặc sách nghề',
      lore: 'Vượt xa vật phẩm thông thường: mỗi món đã có linh tính và quy luật riêng.'
    }),
    Object.freeze({
      rank: 4, id: 'dia', label: 'Địa giai', short: 'Địa',
      tierMin: 5, tierMax: 6, realms: ['Luyện Hư', 'Hợp Thể'],
      energy: 'Sức mạnh bám vào địa mạch, không gian và quy luật cục bộ',
      material: 'Tinh hoa địa mạch, vật liệu dị giới, lõi yêu thú cổ',
      refinement: 'Cần trận pháp và lò luyện đặc biệt, thời gian dài',
      cap: 'Ảnh hưởng môi trường tu luyện và chiến trường diện rộng',
      use: 'Pháp bảo chiến lược, đan đột phá, nguyên liệu chế tạo cao cấp',
      economy: 'Tài sản của trưởng lão/tông môn; trao đổi bằng công huân hoặc đấu giá',
      lore: 'Nền tảng sức mạnh sâu, đủ để uốn cong quy luật của một vùng trời đất.'
    }),
    Object.freeze({
      rank: 5, id: 'thien', label: 'Thiên giai', short: 'Thiên',
      tierMin: 7, tierMax: 8, realms: ['Đại Thừa', 'Độ Kiếp'],
      energy: 'Uy năng thiên địa, chạm đến lôi kiếp và thiên cơ',
      material: 'Thiên tài địa bảo, tinh hoa lôi kiếp, vật liệu Tiên Giới còn sót',
      refinement: 'Cần đạo văn, thiên hỏa hoặc cơ duyên đặc biệt',
      cap: 'Đủ sức đồng hành cùng cường giả đỉnh cao Linh Giới',
      use: 'Bảo vật hộ kiếp, công pháp tối thượng, đan chuẩn bị phi thăng',
      economy: 'Cực hiếm; mỗi món thường gắn với một cơ duyên hoặc thế lực lớn',
      lore: 'Mang uy năng vượt trội, dành cho những người đứng trước cửa thiên kiếp.'
    }),
    Object.freeze({
      rank: 6, id: 'tien', label: 'Tiên giai', short: 'Tiên',
      tierMin: 9, tierMax: 12, realms: ['Chân Tiên', 'Kim Tiên', 'Thái Ất', 'Đại La'],
      energy: 'Tiên lực, thoát khỏi giới hạn linh lực phàm tục',
      material: 'Tiên kim, tiên mộc, đạo văn bản nguyên',
      refinement: 'Tiên hỏa, tiên trận; không thể chế tạo bằng lò phàm',
      cap: 'Phát huy từ Chân Tiên đến Đại La',
      use: 'Trang bị tiên nhân, đan tiên, công pháp tiên đạo',
      economy: 'Bảo vật cấp Tiên Giới; trao đổi bằng tiên thạch/công trạng đặc biệt',
      lore: 'Đã thoát khỏi giới hạn linh lực thông thường, mang bản chất tiên lực.'
    }),
    Object.freeze({
      rank: 7, id: 'than', label: 'Thần giai', short: 'Thần',
      tierMin: 13, tierMax: 13, realms: ['Đạo Tổ'],
      energy: 'Đạo vận, sức mạnh gần với quy luật gốc của trời đất',
      material: 'Đạo tắc, hỗn độn tinh hoa, di vật của Đạo Tổ',
      refinement: 'Không còn là chế tạo thông thường; cần ngộ đạo và đánh đổi',
      cap: 'Chỉ phát huy trọn vẹn ở Đạo Tổ',
      use: 'Bảo vật chí tôn, đan đạo vận, vật phẩm kết thúc hành trình',
      economy: 'Truyền thuyết; không có nguồn cung ổn định, không bán đại trà',
      lore: 'Cấp bậc cao nhất của hệ thống vật phẩm, gắn với Đạo Tổ và đạo vận. Không đại diện cho một Thần Giới hay cảnh giới sau Đạo Tổ.'
    })
  ]);
  const RANK_BY_NUMBER = Object.freeze(Object.fromEntries(RANKS.map(r => [r.rank, r])));
  const RANK_BY_ID = Object.freeze(Object.fromEntries(RANKS.map(r => [r.id, r])));
  const RANK_BY_ALIAS = Object.create(null);
  for (const rank of RANKS) {
    RANK_BY_ALIAS[rank.label] = rank.rank;
    RANK_BY_ALIAS[rank.short] = rank.rank;
    RANK_BY_ALIAS[String(rank.rank)] = rank.rank;
    RANK_BY_ALIAS[rank.id] = rank.rank;
  }
  const rankIdFor = label => RANK_BY_ALIAS[String(label == null ? '' : label).trim()] || null;
  const rankLabel = rank => RANK_BY_NUMBER[rank]?.label || null;
  const rankShort = rank => RANK_BY_NUMBER[rank]?.short || null;

  /* Tier 0-13 -> cấp bậc. Dải này là nguồn duy nhất; mọi module suy rank từ
     tier bằng hàm dưới đây, không tự viết lại bảng. */
  const RANK_BY_TIER = Object.freeze([1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 6, 6, 7]);
  const rankForTier = tier => Number.isInteger(tier) && tier >= 0 && tier < RANK_BY_TIER.length ? RANK_BY_TIER[tier] : null;
  const rankOf = x => {
    const explicit = Number.isInteger(x?.rank) ? x.rank : null;
    return explicit && RANK_BY_NUMBER[explicit] ? explicit : rankForTier(x?.tier);
  };

  /* 5 phẩm chất chính thức. `sub` là chỉ số 0-4 đang dùng trong inventory,
     giá, chế tạo và công thức cũ; `quality` là số 1-5 theo schema mới.
     Màu ở đây chỉ là dữ liệu tham chiếu; nguồn màu giao diện vẫn là
     client/ui/labels.js. */
  const QUALITIES = Object.freeze([
    Object.freeze({
      quality: 1, id: 'ha', label: 'Hạ phẩm', short: 'Hạ', sub: 0, colorName: 'Lục', color: '#6fcf7a',
      purity: 'Tạp chất nhiều, chỉ đạt công dụng cơ bản',
      bonus: 'Không có thuộc tính phụ; hiệu ứng đặc biệt gần như không xuất hiện',
      stability: 'Dễ hỏng khi cường hóa, giá trị thu hồi thấp',
      economy: 'Phổ biến, giá thấp, dùng làm nguyên liệu nền'
    }),
    Object.freeze({
      quality: 2, id: 'trung', label: 'Trung phẩm', short: 'Trung', sub: 1, colorName: 'Tím', color: '#b98cff',
      purity: 'Đã loại bớt tạp chất, công dụng ổn định',
      bonus: 'Có thể có một thuộc tính phụ nhỏ',
      stability: 'Ổn định, hao hụt thấp khi nâng cấp',
      economy: 'Phổ thông trong giao dịch giữa tu sĩ'
    }),
    Object.freeze({
      quality: 3, id: 'thuong', label: 'Thượng phẩm', short: 'Thượng', sub: 2, colorName: 'Vàng', color: '#f3ca72',
      purity: 'Tinh thuần, hoàn thiện tốt',
      bonus: 'Nhiều thuộc tính phụ hơn, hiệu ứng đặc biệt bắt đầu xuất hiện',
      stability: 'Bền, ít hao hụt, dễ bán lại',
      economy: 'Hàng cao cấp, người chơi có thể đầu tư lâu dài'
    }),
    Object.freeze({
      quality: 4, id: 'cuc', label: 'Cực phẩm', short: 'Cực', sub: 3, colorName: 'Ngũ sắc', color: '#ffe6a8',
      purity: 'Gần như không tạp chất, đạt giới hạn của cấp bậc',
      bonus: 'Nhiều thuộc tính phụ, hiệu ứng đặc biệt rõ rệt',
      stability: 'Rất bền; cường hóa ít rủi ro',
      economy: 'Khan hiếm, giá cao, thường là mục tiêu săn đuổi'
    }),
    Object.freeze({
      quality: 5, id: 'tuyet', label: 'Tuyệt phẩm', short: 'Tuyệt', sub: 4, colorName: 'Đen trắng', color: '#f4f4f2',
      purity: 'Hoàn mỹ trong giới hạn cấp bậc, không thể tinh luyện thêm',
      bonus: 'Tối đa thuộc tính phụ và hiệu ứng đặc biệt của cấp bậc',
      stability: 'Cực bền; là bản hoàn thiện hiếm có',
      economy: 'Cực hiếm, thường chỉ xuất hiện từ chế tạo bậc thầy hoặc cơ duyên'
    })
  ]);
  const QUALITY_BY_NUMBER = Object.freeze(Object.fromEntries(QUALITIES.map(q => [q.quality, q])));
  const QUALITY_BY_ID = Object.freeze(Object.fromEntries(QUALITIES.map(q => [q.id, q])));
  const QUALITY_BY_ALIAS = Object.create(null);
  for (const quality of QUALITIES) {
    QUALITY_BY_ALIAS[quality.label] = quality.quality;
    QUALITY_BY_ALIAS[quality.short] = quality.quality;
    QUALITY_BY_ALIAS[String(quality.quality)] = quality.quality;
    QUALITY_BY_ALIAS[quality.id] = quality.quality;
  }
  const qualityIdFor = label => QUALITY_BY_ALIAS[String(label == null ? '' : label).trim()] || null;
  const qualityLabel = quality => QUALITY_BY_NUMBER[quality]?.label || null;
  const qualityShort = quality => QUALITY_BY_NUMBER[quality]?.short || null;
  const qualityForSub = sub => Number.isInteger(sub) && sub >= 0 && sub <= 4 ? sub + 1 : null;
  const subForQuality = quality => Number.isInteger(quality) && quality >= 1 && quality <= 5 ? quality - 1 : null;
  const qualityOf = x => {
    const explicit = Number.isInteger(x?.quality) ? x.quality : null;
    if (explicit && QUALITY_BY_NUMBER[explicit]) return explicit;
    return qualityForSub(x?.sub);
  };
  /* Ngưỡng quay phẩm chất dùng chung cho luyện đan/linh điền. Giá trị là
     điểm 0-1; trả về quality 1-5. Bảng này thay cho các mốc 0.4/0.7/0.9 rải
     rác trong formulas.js cũ. */
  const QUALITY_ROLL_THRESHOLDS = Object.freeze([.40, .65, .85, .96]);
  const qualityForRoll = roll => {
    const value = Number(roll);
    if (!Number.isFinite(value)) return null;
    let quality = 1;
    for (const threshold of QUALITY_ROLL_THRESHOLDS)
      if (value >= threshold) quality++;
    return quality;
  };

  /* Tier 0-13 -> bậc độ hiếm khi dữ liệu gốc không ghi độ hiếm.
     Giữ đúng các dải đang có của pháp bảo: 4-7 Thiên, 8-11 Tiên, 12 Thần, 13 Thánh. */
  const RARITY_BY_TIER = Object.freeze([
    'pham', 'linh', 'huyen', 'dia', 'thien', 'thien', 'thien', 'thien',
    'tien', 'tien', 'tien', 'tien', 'than', 'thanh'
  ]);
  const rarityForTier = tier => Number.isInteger(tier) ? RARITY_BY_TIER[tier] || null : null;

  /* Tag dùng để tra cứu, làm sự kiện và lọc phần thưởng. Mọi tag của PILL
     đều suy ra được từ effect + tier + độ hiếm, không cần gán tay. */
  const TAGS = Object.freeze({
    'tu-vi': 'Đan bồi tu vi',
    'hoi-phuc': 'Đan hồi sinh lực / linh khí',
    'toc-do': 'Đan tăng tốc tu luyện',
    'chien-dau': 'Đan buff chiến đấu',
    'dot-pha': 'Đan hỗ trợ đột phá',
    'giai-doc': 'Đan giải độc / tẩy tâm ma',
    'khang-hieu-ung': 'Đan kháng hiệu ứng xấu',
    'do-kiep': 'Đan hộ kiếp',
    'tho-nguyen': 'Đan tăng thọ nguyên',
    'cung-co': 'Đan củng cố vĩnh viễn',
    'ha-gioi': 'Đan Hạ Giới (tier 0-4)',
    'linh-gioi': 'Đan Linh Giới (tier 5-8)',
    'tien-gioi': 'Đan Tiên Giới (tier 9-13)',
    'dan-thuong': 'Đan thường',
    'dan-hiem': 'Đan hiếm, cần bí tịch luyện đan cấp cao'
  });
  const EFFECT_TAGS = Object.freeze({
    TU_VI: 'tu-vi',
    HOI_PHUC: 'hoi-phuc',
    HOI_HP: 'hoi-phuc',
    HOI_MP: 'hoi-phuc',
    BUFF_TOC: 'toc-do',
    CHIEN_DAU: 'chien-dau',
    DOT_PHA: 'dot-pha',
    GIAI_DOC: 'giai-doc',
    KHANG_HIEU_UNG: 'khang-hieu-ung',
    KIEP: 'do-kiep',
    THO_NGUYEN: 'tho-nguyen',
    CUNG_CO: 'cung-co'
  });
  const tierTag = tier => Number(tier) <= 4 ? 'ha-gioi' : Number(tier) <= 8 ? 'linh-gioi' : 'tien-gioi';
  const tagsFor = (effect, tier, rare = false) => {
    const effectTag = EFFECT_TAGS[effect];
    if (!effectTag) throw Error('Effect không có tag chuẩn: ' + effect);
    return [effectTag, tierTag(tier), rare ? 'dan-hiem' : 'dan-thuong'];
  };

  const API = Object.freeze({
    EFFECTS, NON_PILL_EFFECTS, ALL_EFFECTS,
    GRADES, GRADE_BY_ID, gradeIdFor, gradeLabel,
    RARITIES, RARITY_BY_ID, rarityIdFor, rarityLabel, RARITY_BY_TIER, rarityForTier,
    RANKS, RANK_BY_NUMBER, RANK_BY_ID, rankIdFor, rankLabel, rankShort,
    RANK_BY_TIER, rankForTier, rankOf,
    QUALITIES, QUALITY_BY_NUMBER, QUALITY_BY_ID, qualityIdFor, qualityLabel, qualityShort,
    qualityForSub, subForQuality, qualityOf,
    QUALITY_ROLL_THRESHOLDS, qualityForRoll,
    TAGS, EFFECT_TAGS, tierTag, tagsFor
  });
  root.HU_SCHEMA = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
