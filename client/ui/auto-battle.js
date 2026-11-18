/* HƯ GIỚI · TỰ ĐỘNG GIAO CHIẾN
 * Chính sách chọn hành động cho từng lượt, thuần hàm: không đọc DOM, không đọc trạng thái toàn cục.
 * Giao diện dựng ngữ cảnh (ctx) từ state rồi gọi choose(); mỗi lượt vẫn là một lệnh gửi lên máy chủ,
 * nên máy chủ luôn kiểm tra lại cooldown, linh lực và vật phẩm.
 *
 * ctx.mode  'explore' (Lịch luyện, có công pháp, pháp bảo, đan phù) | 'dungeon' (Bí cảnh, chỉ bốn động tác)
 * Ưu tiên mỗi lượt:
 *   1. Sắp gục: dùng đan hồi phục (nếu cho phép dùng vật phẩm), rồi tới hồi phục vận công.
 *   2. Linh lực thấp: dùng đan hồi linh.
 *   3. Địch dồn đòn nặng và sinh lực chưa dày: thủ thế.
 *   4. Công pháp ngoại tu đang sẵn sàng (nếu cho phép dùng kỹ năng): hồi → thủ → công.
 *   5. Trọng kích khi còn dư linh lực để hồi phục, cuối cùng là đánh thường.
 * Không bao giờ trả về hành động mà ctx cho biết đang bị khóa (hồi chiêu, thiếu linh lực, thiếu thể lực). */
(function (root) {
  'use strict';

  const DEFAULTS = Object.freeze({ skills: true, items: true, hpLow: .4, hpGuard: .65, mpLow: .15 });
  const ratio = (v, max) => max > 0 ? Math.max(0, Math.min(1, v / max)) : 0;
  const options = o => ({ ...DEFAULTS, ...(o || {}) });

  function chooseDungeon(c, o) {
    const hp = ratio(c.hp, c.maxHp), R = c.run;
    const healOk = !(c.healCd > 0) && c.mp >= c.maxMp * R.healMp && c.hp < c.maxHp;
    const canAttack = c.sta >= R.attack, canPower = c.sta >= R.power;
    if (hp < o.hpLow && healOk) return { action: 'heal', why: 'sinh lực thấp' };
    if (c.heavy && hp < o.hpGuard + .15) return { action: 'guard', why: 'né đòn nặng' };
    if (!canAttack) return { action: 'guard', why: 'hồi thể lực' };
    if (canPower && c.sta - R.power >= R.attack) return { action: 'power', why: 'đủ thể lực' };
    return { action: 'attack', why: 'đánh thường' };
  }

  function chooseExplore(c, o) {
    const B = c.battle, hp = ratio(c.hp, c.maxHp), mp = ratio(c.mp, c.maxMp);
    const healCost = c.maxMp * B.healMp, powerCost = c.maxMp * B.powerMp;
    const healOk = !(c.healCd > 0) && c.mp >= healCost && c.hp < c.maxHp;
    const items = o.items ? (c.items || []).filter(x => x.n > 0) : [];
    const pillHp = items.find(x => x.restores === 'hp'), pillMp = items.find(x => x.restores === 'mp');
    const skills = o.skills ? (c.manuals || []).filter(x => !(x.cd > 0) && c.mp >= x.mpCost) : [];
    /* Giữ lại phần linh lực để còn hồi phục được ở lượt sau. */
    const spare = mpAfter => mpAfter >= healCost;

    if (hp < o.hpLow) {
      if (pillHp) return { action: 'item', code: pillHp.code, why: 'đan hồi phục' };
      const healSkill = skills.find(x => x.kind === 'heal');
      if (healSkill) return { action: 'manual', code: healSkill.code, why: 'công pháp hồi phục' };
      if (healOk) return { action: 'heal', why: 'vận công hồi phục' };
    }
    if (mp < o.mpLow && pillMp) return { action: 'item', code: pillMp.code, why: 'đan hồi linh lực' };
    if (c.heavy && hp < o.hpGuard) {
      const guardSkill = skills.find(x => x.kind === 'guard');
      if (guardSkill) return { action: 'manual', code: guardSkill.code, why: 'công pháp phòng ngự' };
      return { action: 'guard', why: 'né đòn nặng' };
    }
    const attackSkill = skills.filter(x => x.kind === 'attack' && spare(c.mp - x.mpCost))
      .sort((a, b) => (b.damage || 0) - (a.damage || 0))[0];
    if (attackSkill) return { action: 'manual', code: attackSkill.code, why: 'công pháp công kích' };
    const evadeSkill = c.heavy ? skills.find(x => x.kind === 'evade') : null;
    if (evadeSkill) return { action: 'manual', code: evadeSkill.code, why: 'thân pháp' };
    const artifact = o.skills ? (c.artifacts || []).find(x => !(x.cd > 0) && (x.kind !== 'heal' || hp < .7)) : null;
    if (artifact) return { action: 'artifact', code: artifact.code, why: 'pháp bảo kích hoạt' };
    if (!(c.powerCd > 0) && c.mp >= powerCost && spare(c.mp - powerCost)) return { action: 'power', why: 'trọng kích' };
    return { action: 'attack', why: 'đánh thường' };
  }

  /* Trả về { action, code?, why } hoặc null khi không có lựa chọn hợp lệ. */
  function choose(ctx, opts) {
    if (!ctx || ctx.over) return null;
    const o = options(opts);
    return ctx.mode === 'dungeon' ? chooseDungeon(ctx, o) : chooseExplore(ctx, o);
  }

  const API = Object.freeze({ DEFAULTS, choose });
  root.HU_AUTO_BATTLE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
