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
    THO_NGUYEN: 'cộng thọ nguyên (C10.3)',
    CUNG_CO: 'cộng gộp vĩnh viễn nhỏ (tính vào ngân sách nâng cấp)',
    GIAI_DOC: 'giải hiệu ứng xấu / tâm ma (B3 Cleanse)',
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

  /* Tag dùng để tra cứu, làm sự kiện và lọc phần thưởng. Mọi tag của PILL
     đều suy ra được từ effect + tier + độ hiếm, không cần gán tay. */
  const TAGS = Object.freeze({
    'tu-vi': 'Đan bồi tu vi',
    'hoi-phuc': 'Đan hồi sinh lực / linh khí',
    'toc-do': 'Đan tăng tốc tu luyện',
    'chien-dau': 'Đan buff chiến đấu',
    'dot-pha': 'Đan hỗ trợ đột phá',
    'giai-doc': 'Đan giải độc / tẩy tâm ma',
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
    BUFF_TOC: 'toc-do',
    CHIEN_DAU: 'chien-dau',
    DOT_PHA: 'dot-pha',
    GIAI_DOC: 'giai-doc',
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
    GRADES, GRADE_BY_ID, gradeIdFor,
    TAGS, EFFECT_TAGS, tierTag, tagsFor
  });
  root.HU_SCHEMA = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
