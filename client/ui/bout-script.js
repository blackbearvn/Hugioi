/* HƯ GIỚI · KỊCH BẢN TRẬN ĐẤU THEO LƯỢT (PvP, tỷ thí)
 * Máy chủ chỉ quyết định thắng hay thua. Hàm này dựng từ kết quả đó một chuỗi lượt đấu để sân khấu
 * diễn lại: mỗi lượt là một hành động của ta, kèm đòn phản kích của đối thủ.
 * Thuần hàm, cùng seed cho cùng kịch bản; không đọc DOM hay trạng thái chơi.
 * Bảo đảm: thắng thì lượt cuối ta hạ gục đối thủ, đối thủ chưa từng đánh gục ta; thua thì ngược lại,
 * và bên còn sống luôn còn ít nhất 1 sinh lực ở mọi lượt trước lượt kết thúc. */
(function (root) {
  'use strict';

  const rngFrom = seed => {
    let a = (Number(seed) || 1) >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* Chuỗi bất kỳ → seed số nguyên, để cùng một trận luôn diễn lại giống nhau. */
  const seedOf = (...parts) => {
    let h = 2166136261;
    for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return h || 1;
  };

  const share = (rng, n) => {
    const w = Array.from({ length: n }, () => .6 + rng() * .8), sum = w.reduce((a, b) => a + b, 0);
    return w.map(x => x / sum);
  };

  /* opts: { win, seed, myHp, foeHp, skills: [{ code, name, kind }] }
     kind của kỹ năng: attack | guard | heal | evade. Trả về { rounds, heroMax, foeMax }. */
  function build(opts) {
    const rng = rngFrom(opts.seed), win = !!opts.win;
    const heroMax = Math.max(10, Math.round(Number(opts.myHp) || 100));
    const foeMax = Math.max(10, Math.round(Number(opts.foeHp) || heroMax));
    const skills = (opts.skills || []).filter(x => x && x.code && x.name);
    const n = 4 + Math.floor(rng() * 4);
    const dealShare = share(rng, n), takeShare = share(rng, n);
    /* Thắng: đối thủ gây khoảng 35–75% sinh lực của ta. Thua: ta gây 40–85% sinh lực của đối thủ. */
    const takeBudget = heroMax * (win ? .35 + rng() * .4 : 1);
    const dealBudget = foeMax * (win ? 1 : .4 + rng() * .45);
    const cd = new Map();
    let hero = heroMax, foe = foeMax, healTotal = 0;
    const rounds = [];

    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      let action = 'attack', code = '', cry = 'Tấn công', kind = '';
      const ready = skills.filter(x => !(cd.get(x.code) > 0));
      for (const k of cd.keys()) cd.set(k, Math.max(0, cd.get(k) - 1));
      /* Lượt cuối của người thắng luôn là một đòn đánh; còn lại xen kỹ năng, trọng kích, thủ thế. */
      const roll = rng();
      if (ready.length && roll < .5 && !(win && last)) {
        const sk = ready[Math.floor(rng() * ready.length)];
        action = 'manual'; code = sk.code; cry = sk.name; kind = sk.kind || 'attack';
        cd.set(sk.code, 3);
      } else if (roll < .72 || (win && last)) { action = 'power'; cry = 'Trọng kích'; }
      else if (roll < .8 && !last && hero < heroMax * .6) { action = 'guard'; cry = 'Thủ thế'; }

      const hits = action === 'attack' || action === 'power' || (action === 'manual' && kind === 'attack');
      let dealt = 0, healed = 0, crit = false;
      if (hits) {
        dealt = Math.max(1, Math.round(dealBudget * dealShare[i] * (action === 'power' ? 1.25 : 1)));
        crit = rng() < .22;
        if (crit) dealt = Math.round(dealt * 1.4);
        dealt = win && last ? foe : Math.min(dealt, Math.max(0, foe - 1));
      } else if (action === 'manual' && kind === 'heal') {
        healed = Math.min(heroMax - hero, Math.round(heroMax * .1));
        hero += healed; healTotal += healed;
      }
      foe -= dealt;

      let taken = 0, takenCrit = false, counter = false;
      if (!(win && last)) {
        counter = true;
        const evaded = action === 'manual' && kind === 'evade' && !last;
        takenCrit = rng() < .18;
        taken = Math.round((takeBudget + (win ? 0 : healTotal)) * takeShare[i] * (takenCrit ? 1.4 : 1));
        if (action === 'guard') taken = Math.round(taken * .3);
        if (evaded) taken = 0;
        taken = !win && last ? hero : Math.min(Math.max(0, taken), Math.max(0, hero - 1));
        takenCrit = takenCrit && taken > 0;
        hero -= taken;
      }
      const state = win && last ? 'won' : !win && last ? 'lost' : 'active';
      rounds.push({ turn: i + 1, action, code, cry, kind, dealt, healed, taken, crit, takenCrit, counter,
        won: state === 'won', state, heroHp: hero, foeHp: foe });
    }
    return { rounds, heroMax, foeMax, win };
  }

  const API = Object.freeze({ build, seedOf, rngFrom });
  root.HU_BOUT_SCRIPT = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
