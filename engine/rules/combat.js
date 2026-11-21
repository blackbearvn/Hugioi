/* Miền luật: combat — lịch luyện, kỹ năng, công pháp, pháp bảo và di chuyển.
   Thời gian/RNG do phiên chơi cung cấp; các helper nội bộ dùng tên riêng. */
(function (root) {
  'use strict';
  const domain = 'combat';
  const commands = Object.freeze(['strike', 'skill', 'castManual', 'activateArtifact', 'setEnemyKind', 'travel', 'startExploration', 'exploreChoice', 'battleAct']);

  function install(API) {
    const H = API, F = H.F, { ITEMS, ENEMY_NAMES, DESIGN, item } = H;
    const pick = (xs, rng) => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
    const at = (game, now) => Number.isFinite(now) ? now : game.s.lastUpdate;
    const effects = s => s.designCombat;

    /* Nhịp độ giao chiến theo lượt trong Lịch luyện. Chỉ số địch suy ra từ
       F.stats(zone, tầng hiện tại) rồi nhân hệ số riêng của chế độ lượt; không dùng
       MONSTER_MULT hay HP/ATK tuyệt đối trong design-raw (dữ liệu nguyên mẫu).
       Một lượt được quy ước khoảng 6 giây để đổi hồi chiêu/giây sang số lượt. */
    const BATTLE = Object.freeze({
      hp: { 'thường': .6, 'tinh anh': .85, boss: 1.0, 'boss kiếp': 1.3 },
      atk: { 'thường': .5, 'tinh anh': .65, boss: 1.05, 'boss kiếp': 1.1 },
      def: { 'thường': .55, 'tinh anh': .75, boss: .9, 'boss kiếp': 1 },
      heavy: { 'thường': .22, 'tinh anh': .28, boss: .4, 'boss kiếp': .45 },
      heavyMult: 1.8, guardCut: .7, powerMult: 2.2, powerMp: .12, powerCd: 2,
      healMp: .18, healPct: .26, healCd: 2, flee: .55, logMax: 8, secondsPerTurn: 6
    });
    H.BATTLE = BATTLE;
    const BATTLE_LABELS = Object.freeze({ 'thường': 'Yêu thú', 'tinh anh': 'Tinh anh', boss: 'Thủ lĩnh', 'boss kiếp': 'Kiếp chủ' });
    H.BATTLE_LABELS = BATTLE_LABELS;

    Object.assign(H.Game.prototype, /** @type {ThisType<GameHost>} */ ({
      startExploration(payload, now) {
        now = at(this, now);
        // Kết toán tu hành trước khi bước vào bí cảnh để không làm mất thời gian
        // giữa hai lần lưu, kể cả khi mở Lịch luyện qua phím tắt/đường dẫn.
        if (now > this.s.lastUpdate) this.advance(now, false);
        const s = this.s;
        if (s.exploration?.active) throw Error('Lịch luyện đang diễn ra. Hãy đợi chuyến đi kết thúc.');
        if (s.dungeon?.active || s.dungeon?.run) throw Error('Cần hoàn tất hành trình bí cảnh trước khi lịch luyện.');
        const roll = this.rng();
        let acc = 0, kind = H.EXPLORE_WEIGHTS[H.EXPLORE_WEIGHTS.length - 1][0];
        for (const [k, weight] of H.EXPLORE_WEIGHTS) { acc += weight; if (roll < acc) { kind = k; break; } }
        const e = { kind, start: now, end: now + 600000, npcId: '', name: '', text: '', cleared: false, choice: -1 };
        if (kind === 'monster') {
          const monsterKinds = ['thường', 'tinh anh', 'boss'];
          s.enemyKind = monsterKinds[Math.min(2, Math.floor(this.rng() * 3))];
          s.enemyHp = 0;
          e.name = this.enemy().name;
          e.text = 'Yêu thú chặn đường. Hãy chọn giao chiến, né tránh hoặc thương lượng.';
        } else if (kind === 'npc') {
          const ids = Object.keys(H.DESIGN.npc);
          e.npcId = ids[Math.min(ids.length - 1, Math.floor(this.rng() * ids.length))] || '';
          e.name = H.DESIGN.npc[e.npcId]?.['tên NPC'] || 'Kỳ nhân';
          e.text = 'Hữu duyên gặp một vị đạo hữu trên đường lịch luyện. Cách bạn đối đáp sẽ ảnh hưởng tâm ma.';
        } else {
          const events = H.ENCOUNTERS.filter(v => v.rarity <= Math.max(0, Math.min(4, s.realm)));
          const ev = events[Math.min(events.length - 1, Math.floor(this.rng() * events.length))] || H.ENCOUNTERS[0];
          e.name = ev.name;
          e.eventId = ev.id;
          e.text = ev.desc;
        }
        s.auto = false;
        s.exploration = { ...(s.exploration || {}), active: e };
        this.log('Khởi hành lịch luyện · ' + e.name + ' · 10 phút.');
        return e;
      },
      /* Chọn cách ứng phó cho sự kiện NPC hoặc quái đang diễn ra. Kết quả chỉ được tính khi chuyến đi kết thúc. */
      exploreChoice(payload, now) {
        now = at(this, now);
        const e = this.s.exploration?.active;
        if (!e) throw Error('Chưa có chuyến lịch luyện nào đang diễn ra.');
        const options = H.EXPLORE_CHOICES[e.kind];
        if (!options) throw Error('Sự kiện này không có lựa chọn.');
        if (e.choice >= 0) throw Error('Bạn đã chọn cách ứng phó cho sự kiện này.');
        const option = options[payload.index];
        if (!option) throw Error('Lựa chọn không hợp lệ.');
        e.choice = payload.index;
        this.log('Lịch luyện · ' + e.name + ': chọn "' + option.label + '".');
        if (option.id === 'fight') this.startBattle(e, now);
        return option.id;
      },
      addTamMa(n) {
        const before = this.s.tamMa;
        this.s.tamMa = Math.max(0, Math.min(H.TAM_MA_MAX, before + n));
        return this.s.tamMa - before;
      },
      /* Kết toán sự kiện NPC khi hết chuyến: không chọn thì chỉ lướt qua, không đổi tâm ma. */
      resolveExplorationNpc(e) {
        const s = this.s, option = H.EXPLORE_CHOICES.npc[e.choice];
        if (!option) return 'Lướt qua ' + e.name + ', không để lại dấu vết trong tâm trí.';
        const delta = this.addTamMa(option.tamMa);
        const exp = this.gainExp(F.base_rate(s.realm) * option.exp);
        const mind = delta === 0 ? 'tâm ma không đổi' : 'tâm ma ' + (delta > 0 ? '+' : '') + delta;
        return 'Đàm đạo cùng ' + e.name + ' (' + option.label + '): tu vi +' + F.fmt(exp) + ', ' + mind + '.';
      },
      /* Kết toán sự kiện quái khi hết chuyến. Mặc định (không chọn) là giao chiến như trước. */
      resolveExplorationMonster(e) {
        const s = this.s, option = H.EXPLORE_CHOICES.monster[e.choice >= 0 ? e.choice : 0];
        if (option.id === 'evade') return 'Né tránh ' + e.name + ', bình yên vô sự nhưng không thu được gì.';
        if (option.id === 'bargain') {
          const chance = Math.max(.15, Math.min(.75, .4 + (s.talent?.phucDuyen || 0) * .015 - s.tamMa * .002));
          if (this.rng() < chance) {
            const gain = F.loot_linh_thach(s.zone, s.enemyKind) * .6;
            s.stone += gain;
            e.cleared = true;
            return 'Thương lượng thành công, ' + e.name + ' nhường đường và tặng ' + F.format_linh_thach(gain, s.realm) + '.';
          }
          const loss = Math.min(Math.max(0, s.hp - 1), this.stats(e.end).HP * .06);
          s.hp -= loss;
          return 'Thương lượng với ' + e.name + ' đổ vỡ, sinh lực −' + F.fmt(loss) + '.';
        }
        const foe = this.enemy(), chance = F.win_probability(this.stats(e.end).CP, foe.CP);
        if (this.rng() < chance) {
          this.collectLoot(1, false);
          e.cleared = true;
          return 'Đã vượt qua ' + e.name + ', thu nhận chiến lợi phẩm.';
        }
        return 'Gặp ' + e.name + ', đạo thân tránh được hiểm họa nhưng chưa thể thu được chiến lợi phẩm.';
      },
      /* ===== Giao chiến theo lượt trong Lịch luyện =====
         Trạng thái trận nằm trong exploration.active.battle để không trộn với
         designCombat (vốn dùng mốc thời gian thực). Mỗi lượt là một quyết định;
         đồng hồ lịch luyện được đóng băng trong lúc trận đấu diễn ra. */
      battleEnemy() {
        const s = this.s, info = this.enemy();
        const st = F.stats(s.zone, Math.min(s.stage - 1, F.STAGES[s.zone] - 1));
        const kind = Object.hasOwn(BATTLE.hp, s.enemyKind) ? s.enemyKind : 'thường';
        return {
          name: info.name, kind, element: Number.isInteger(info.element) ? info.element : -1,
          level: info.level || s.stage, designId: info.designId || '', skill: info.skill || '',
          maxHp: Math.max(1, st.HP * BATTLE.hp[kind]),
          atk: st.ATK * BATTLE.atk[kind], def: st.DEF * BATTLE.def[kind],
          crit: info.CRIT || .05, critDmg: info.CRIT_DMG || 1.5, dodge: info.DODGE || 0
        };
      },
      rollBattleIntent(kind) {
        const chance = BATTLE.heavy[kind] ?? BATTLE.heavy['thường'];
        return this.rng() < chance ? 'heavy' : 'light';
      },
      /* Giai đoạn của thủ lĩnh: ưu tiên dữ liệu thiết kế, nếu không có thì dùng
         ba mốc chung để trận boss vẫn có nhịp căng dần. */
      battlePhase(enemy, ratio) {
        if (!String(enemy.kind).startsWith('boss')) return 1;
        const designed = enemy.designId ? DESIGN.phase(enemy.designId, ratio)?.multiplier : 0;
        if (designed) return designed;
        return ratio > .5 ? 1.3 : ratio > .2 ? 1.6 : 2;
      },
      battleLog(b, text) {
        b.log.unshift(text);
        b.log.length = Math.min(BATTLE.logMax, b.log.length);
      },
      startBattle(e, now) {
        const s = this.s;
        if (e.battle) return e.battle;
        const enemy = this.battleEnemy();
        const b = {
          state: 'active', turn: 1, enemyMax: enemy.maxHp, enemyHp: enemy.maxHp,
          intent: this.rollBattleIntent(enemy.kind), guard: false, healCd: 0, powerCd: 0,
          shield: 0, bonusDef: 0, bonusDodge: 0, cd: {}, statuses: [], enemyStatuses: [],
          remaining: Math.max(0, e.end - now), result: '', log: []
        };
        this.battleLog(b, enemy.name + ' (' + (BATTLE_LABELS[enemy.kind] || 'Yêu thú') + ') chặn đường. Đến lượt bạn.');
        e.battle = b;
        s.enemyHp = 0;
        s.designCombat.enemyEffects = [];
        return b;
      },
      /* Hệ số nguyên tố dùng chung cho đòn thường, trọng kích và công pháp ngoại tu. */
      battleElemental(enemy, element) {
        const s = this.s, advantage = enemy.element >= 0 ? this.affinity(enemy.element) : 0;
        let elemental = 1 + advantage;
        if (!element) return elemental;
        const source = H.ELEMENT_NAMES.findIndex(x => x.toLowerCase() === element), target = enemy.element;
        if (element === 'không hệ') return 1;
        if (s.rootType === 'Hỗn Độn') {
          elemental = target >= 0 ? 1.1 : 1;
          if (this.activeElements().includes(source)) elemental *= 1.2;
        } else if (s.rootType === 'Dị' && H.DI_LINH_CAN[s.rootSub]?.name.toLowerCase() === element)
          elemental = target >= 0 && this.activeElements().includes(target) ? 1.2 : 1;
        else if (source >= 0 && target >= 0) elemental = H.BEATS[source] === target ? 1.2 : H.BEATS[target] === source ? .8 : 1;
        else elemental = 1;
        if (s.rootType !== 'Dị' && s.rootType !== 'Hỗn Độn' && [0, 3].includes(source) && this.activeElements().includes(source)) elemental *= 1.1;
        return elemental;
      },
      /* Hiệu ứng khi đánh trúng của pháp bảo và linh căn Dị, quy đổi thời gian sang lượt. */
      battleOnHit(b) {
        const s = this.s, names = { 'đóng băng': 'đóng băng', 'gây choáng': 'choáng', 'gây độc': 'độc', 'chảy máu': 'chảy máu' };
        const add = (type, source, turns, extra = {}) => {
          const old = b.enemyStatuses.find(e => e.type === type && e.source === source);
          if (old) { old.turns = Math.max(old.turns, turns); old.stacks = Math.min(9, (old.stacks || 1) + 1); }
          else b.enemyStatuses.push({ type, source, turns: Math.max(1, turns), stacks: 1, ...extra });
        };
        for (const key of s.equipment) {
          const x = item(key), d = DESIGN.effects[x.code];
          if (!d || d['điều kiện kích hoạt'] !== 'khi đánh trúng' || this.rng() >= d['tỉ lệ kích hoạt (%)'] / 100) continue;
          const type = names[d['hiệu ứng']];
          if (!type) continue;
          const turns = Math.max(1, Math.ceil(d['thời gian (giây)'] / BATTLE.secondsPerTurn));
          add(type, key, turns, { damage: (d['độc (sát thương/giây)'] || 0) * BATTLE.secondsPerTurn, pct: (d['chảy máu (% hp hiện tại/giây)'] || 0) / 100 });
        }
        if (s.rootType === 'Dị' && ['bang', 'loi', 'doc'].includes(s.rootSub)) {
          const chance = s.rootSub === 'doc' ? .15 : .10;
          if (this.rng() < chance) {
            const type = { bang: 'đóng băng', loi: 'choáng', doc: 'độc' }[s.rootSub];
            add(type, 'root', s.rootSub === 'bang' ? 1 : s.rootSub === 'loi' ? 1 : 2, { damage: s.rootSub === 'doc' ? this.stats().ATK * .15 : 0, pct: 0 });
          }
        }
      },
      /* Địch gây hiệu ứng xấu theo mô tả kỹ năng; kháng hiệu ứng giảm số lượt. */
      battleEnemyStatus(b, enemy, now) {
        const s = this.s, skill = String(enemy.skill || '');
        if (!skill) return;
        const ward = b.ward && b.ward.turns > 0 ? b.ward.reduce
          : s.designCombat.ward && s.designCombat.ward.end > now ? s.designCombat.ward.reduce : 0;
        const add = (type, turns, extra = {}) => {
          const n = Math.max(0, Math.round(turns * (1 - ward)));
          if (n <= 0) return;
          const old = b.statuses.find(e => e.type === type);
          if (old) old.turns = Math.max(old.turns, n);
          else b.statuses.push({ type, turns: n, ...extra });
        };
        let m = skill.match(/chảy máu\s+(\d+(?:[.,]\d+)?)%\s*hp hiện tại\/giây trong\s+(\d+(?:[.,]\d+)?)\s*giây/i);
        if (m) add('chảy máu', Math.ceil(Number(m[2].replace(',', '.')) / BATTLE.secondsPerTurn), { pct: Number(m[1].replace(',', '.')) / 100 });
        if (/đóng băng/i.test(skill)) add('đóng băng', 2);
        if (/choáng/i.test(skill)) add('choáng', 1);
        if (/gây độc/i.test(skill)) add('độc', 2, { damage: this.stats(now).HP * .02 });
      },
      /* Vật phẩm dùng được trong trận. Trả về { text, healed, dealt } để UI phản hồi. */
      battleUseItem(b, code) {
        const s = this.s, x = item(code);
        if (!x || !this.count(code)) throw Error('Vật phẩm không có trong túi.');
        if (x.tier > s.realm + 1) throw Error('Vật phẩm vượt quá một bậc cảnh giới.');
        if (x.kind === 'PILL') {
          const diff = Math.max(0, s.realm - x.tier);
          const e = F.dan_effect(x.effect, s.realm, s.stage - 1, x.sub, s.pillUses, diff);
          if (['HOI_PHUC', 'HOI_HP', 'HOI_MP'].includes(x.effect)) {
            const max = this.stats().HP, maxMp = this.maxMp();
            let healed = 0, mp = 0;
            if (e.hoi_phan_tram_HP) { healed = Math.max(0, Math.min(max - s.hp, max * e.hoi_phan_tram_HP * (1 + this.rootEffects().heal))); s.hp = Math.min(max, s.hp + healed); }
            if (e.hoi_phan_tram_MP) { mp = Math.max(0, Math.min(maxMp - s.mp, maxMp * e.hoi_phan_tram_MP)); s.mp = Math.min(maxMp, s.mp + mp); }
            if (healed <= 0 && mp <= 0) throw Error('Sinh lực và linh lực đã đầy.');
            this.take(code);
            return { text: 'Dùng ' + x.name + ': sinh lực +' + F.fmt(healed) + ', linh lực +' + F.fmt(mp) + '.', healed };
          }
          if (x.effect === 'GIAI_DOC') {
            s.debuffs = []; s.designCombat.bleed = null; b.statuses = [];
            this.take(code);
            return { text: 'Dùng ' + x.name + ': giải toàn bộ hiệu ứng xấu.' };
          }
          if (x.effect === 'KHANG_HIEU_UNG') {
            s.debuffs = []; s.designCombat.bleed = null; b.statuses = [];
            b.ward = { turns: Math.max(1, Math.round(e.thoi_luong / BATTLE.secondsPerTurn)) + 1, reduce: e.giam_thoi_gian };
            this.take(code);
            return { text: 'Dùng ' + x.name + ': giải hiệu ứng xấu, giảm ' + Math.round(e.giam_thoi_gian * 100) + '% thời gian hiệu ứng mới trong ' + b.ward.turns + ' lượt.' };
          }
          if (x.effect === 'CHIEN_DAU') {
            b.atkBuff = { turns: Math.max(1, Math.round(e.thoi_luong / BATTLE.secondsPerTurn)), points: e.tang_ATK };
            this.take(code);
            return { text: 'Dùng ' + x.name + ': sát thương +' + Math.round(e.tang_ATK * 100) + '% trong ' + b.atkBuff.turns + ' lượt.' };
          }
          if (x.effect === 'KIEP') {
            const shield = this.stats().HP * e.khien_theo_HP;
            b.shield = (b.shield || 0) + shield;
            /* Phù/đan hộ kiếp còn giảm sát thương nhận vào; giữ mức tốt nhất
               nếu người chơi dùng thêm vật phẩm khác trong cùng trận. */
            b.damageCut = Math.max(b.damageCut || 0, e.giam_sat_thuong || 0);
            this.take(code);
            return { text: 'Dùng ' + x.name + ': hộ thuẫn +' + F.fmt(shield) +
              (e.giam_sat_thuong > 0 ? ', giảm ' + Math.round(e.giam_sat_thuong * 100) + '% sát thương nhận.' : '.') };
          }
          throw Error('Đan này không dùng trong giao chiến.');
        }
        if (x.kind === 'TAL') {
          if (x.effect === 'KIEP') {
            const e = F.dan_effect('KIEP', s.realm, s.stage - 1, x.sub, 0, Math.max(0, s.realm - x.tier));
            const shield = this.stats().HP * e.khien_theo_HP;
            b.shield = (b.shield || 0) + shield;
            b.damageCut = Math.max(b.damageCut || 0, e.giam_sat_thuong || 0);
            this.take(code);
            return { text: 'Dùng ' + x.name + ': hộ thuẫn +' + F.fmt(shield) +
              (e.giam_sat_thuong > 0 ? ', giảm ' + Math.round(e.giam_sat_thuong * 100) + '% sát thương nhận.' : '.') };
          }
          const enemy = this.battleEnemy(), mult = (x.code === 'TAL-PL-001' ? 1.2 : 2) * 2 ** x.sub;
          let dealt = 0, crit = false;
          if (this.rng() >= enemy.dodge) {
            const st = this.stats();
            crit = this.rng() < st.CRIT;
            dealt = F.damage(st.ATK, enemy.def, mult * this.battleElemental(enemy, null), 0, crit, st.CRIT_DMG);
            b.enemyHp = Math.max(0, b.enemyHp - dealt);
          }
          this.take(code);
          return { text: 'Dùng ' + x.name + ': sát thương ' + F.fmt(dealt) + '.', dealt, crit };
        }
        throw Error('Vật phẩm này không dùng trong giao chiến.');
      },
      /* Thi triển công pháp ngoại tu trong trận, hồi chiêu quy đổi sang lượt. */
      battleManual(b, key) {
        const s = this.s, x = item(key), st = this.stats();
        if (!x || H.MANUALS.school(x) !== 'ngoai' || !(key in s.learned) || !s.activeManuals.includes(key))
          throw Error('Hãy đặt công pháp ngoại tu vào ô trước khi dùng.');
        if ((b.cd['m:' + key] || 0) > 0) throw Error('Công pháp còn ' + b.cd['m:' + key] + ' lượt hồi.');
        const k = H.MANUALS.skillOf(x);
        if (!k) throw Error('Công pháp này không có chiêu thức.');
        const cost = this.maxMp() * k.mpPct;
        if (s.mp < cost) throw Error('Linh lực không đủ để thi triển chiêu thức.');
        s.mp -= cost;
        b.cd['m:' + key] = Math.max(1, Math.ceil(k.cooldown / BATTLE.secondsPerTurn)) + 1;
        if (k.kind === 'attack') {
          const enemy = this.battleEnemy(), power = this.manualPower(key);
          if (this.rng() < enemy.dodge) return { text: enemy.name + ' né được ' + x.name + '.' };
          const crit = this.rng() < st.CRIT;
          const dealt = F.damage(st.ATK, enemy.def, k.multiplier * power * this.battleElemental(enemy, k.element), 0, crit, st.CRIT_DMG);
          b.enemyHp = Math.max(0, b.enemyHp - dealt);
          this.battleOnHit(b);
          return { text: 'Thi triển ' + x.name + (crit ? ' (bạo kích)' : '') + ': −' + F.fmt(dealt) + '.', dealt, crit };
        }
        if (k.kind === 'heal') {
          const max = this.stats().HP, healed = Math.max(0, Math.min(max - s.hp, k.value * this.manualPower(key) * (1 + this.rootEffects().heal)));
          s.hp = Math.min(max, s.hp + healed);
          return { text: 'Thi triển ' + x.name + ': sinh lực +' + F.fmt(healed) + '.', healed };
        }
        if (k.kind === 'guard') {
          b.bonusDef += k.value * this.manualPower(key);
          return { text: 'Thi triển ' + x.name + ': phòng ngự tăng cho lượt này.' };
        }
        b.bonusDodge += k.value * this.manualPower(key) / 100;
        return { text: 'Thi triển ' + x.name + ': né tránh tăng cho lượt này.' };
      },
      _battleWin(e, b) {
        if (b.state === 'won') return;
        b.state = 'won';
        b.enemyHp = 0;
        this.collectLoot(1, false);
        e.cleared = true;
        b.result = 'Đánh bại ' + e.name + ', thu nhận chiến lợi phẩm.';
        e.text = b.result;
        this.battleLog(b, 'Hạ gục ' + e.name + '!');
        this.log('Lịch luyện · ' + b.result);
      },
      _battleEnemyTurn(e, b, enemy, st, now) {
        const s = this.s;
        let taken = 0, counter = false, takenCrit = false;
        const locked = b.enemyStatuses.find(x => ['đóng băng', 'choáng'].includes(x.type) && x.turns > 0);
        if (locked) this.battleLog(b, enemy.name + ' đang bị ' + locked.type + ', không thể phản kích.');
        else {
          counter = true;
          const heavy = b.intent === 'heavy', phase = this.battlePhase(enemy, b.enemyHp / b.enemyMax);
          const dodge = Math.min(.8, st.DODGE + (b.bonusDodge || 0));
          if (this.rng() >= dodge) {
            takenCrit = this.rng() < enemy.crit;
            let hit = F.damage(enemy.atk, st.DEF + (b.bonusDef || 0),
              (heavy ? BATTLE.heavyMult : 1) * phase * (1 - this.rootEffects().reduction), 0, takenCrit, enemy.critDmg);
            if (b.damageCut > 0) hit *= 1 - b.damageCut;
            if (b.guard) hit *= 1 - BATTLE.guardCut;
            const blocked = Math.min(b.shield || 0, hit);
            b.shield = Math.max(0, (b.shield || 0) - blocked);
            taken = Math.max(0, hit - blocked);
            s.hp = Math.max(0, s.hp - taken);
            this.battleLog(b, enemy.name + (heavy ? ' tung đòn nặng' : ' tấn công') + (b.guard ? ' (bị thủ thế)' : '') +
              ': −' + F.fmt(taken) + ' sinh lực' + (blocked > 0 ? ' (hộ thuẫn chặn ' + F.fmt(blocked) + ')' : '') + '.');
            this.battleEnemyStatus(b, enemy, now);
          } else this.battleLog(b, 'Bạn né được đòn của ' + enemy.name + '.');
        }
        for (const x of b.statuses) {
          if (x.type === 'chảy máu') s.hp = Math.max(0, s.hp - s.hp * (x.pct || 0));
          else if (x.type === 'độc') s.hp = Math.max(0, s.hp - (x.damage || 0));
          x.turns--;
        }
        b.statuses = b.statuses.filter(x => x.turns > 0);
        for (const x of b.enemyStatuses) {
          if (x.type === 'độc') b.enemyHp = Math.max(0, b.enemyHp - (x.damage || 0) * (x.stacks || 1));
          else if (x.type === 'chảy máu') b.enemyHp = Math.max(0, b.enemyHp - b.enemyHp * (x.pct || 0));
          x.turns--;
        }
        b.enemyStatuses = b.enemyStatuses.filter(x => x.turns > 0);
        if (b.regen && b.regen.turns > 0) {
          const max = this.stats(now).HP;
          s.hp = Math.min(max, s.hp + b.regen.amount);
          b.regen.turns--;
          if (b.regen.turns <= 0) b.regen = null;
        }
        b.healCd = Math.max(0, b.healCd - 1);
        b.powerCd = Math.max(0, b.powerCd - 1);
        for (const k of Object.keys(b.cd)) b.cd[k] = Math.max(0, b.cd[k] - 1);
        if (b.ward && b.ward.turns > 0 && --b.ward.turns <= 0) b.ward = null;
        if (b.atkBuff && b.atkBuff.turns > 0 && --b.atkBuff.turns <= 0) b.atkBuff = null;
        b.guard = false; b.bonusDef = 0; b.bonusDodge = 0;
        b.turn++;
        b.intent = this.rollBattleIntent(enemy.kind);
        if (s.hp <= 0) {
          s.hp = 0;
          b.state = 'lost';
          b.result = 'Sinh lực cạn trong giao chiến với ' + enemy.name + '.';
          e.cleared = true; e.text = b.result;
          this.battleLog(b, 'Sinh lực cạn. Đạo thân tọa hóa.');
          this.markDeath('combat', now);
          return { counter, taken, takenCrit, died: true, state: b.state };
        }
        if (b.enemyHp <= 0) { this._battleWin(e, b); return { counter, taken, takenCrit, won: true, state: b.state }; }
        return { counter, taken, takenCrit, state: b.state };
      },
      battleAct(payload, now) {
        now = at(this, now);
        if (now > this.s.lastUpdate) this.advance(now, false);
        const s = this.s, e = s.exploration?.active, b = e?.battle;
        if (!e || !b) throw Error('Không có trận chiến nào đang diễn ra.');
        const action = payload.action;
        if (action === 'continue') {
          if (b.state === 'active') throw Error('Trận chiến chưa kết thúc.');
          const out = { state: b.state, text: b.result || e.text, finished: true };
          e.battle = null;
          s.enemyHp = 0;
          s.designCombat.enemyEffects = [];
          return out;
        }
        if (b.state !== 'active') throw Error('Trận chiến đã kết thúc, hãy xác nhận kết quả.');
        const st = this.stats(now), enemy = this.battleEnemy();
        let dealt = 0, healed = 0, crit = false;
        const controlled = b.statuses.find(x => ['đóng băng', 'choáng'].includes(x.type) && x.turns > 0);
        if (controlled) {
          this.battleLog(b, 'Bạn đang bị ' + controlled.type + ' nên mất lượt.');
          const out = this._battleEnemyTurn(e, b, enemy, st, now);
          return { dealt: 0, healed: 0, crit: false, ...out, turn: b.turn, state: b.state };
        }
        b.guard = false; b.bonusDef = 0; b.bonusDodge = 0;
        const atkBuff = b.atkBuff && b.atkBuff.turns > 0 ? 1 + b.atkBuff.points : 1;
        if (action === 'attack' || action === 'power') {
          if (action === 'power') {
            if (b.powerCd > 0) throw Error('Trọng kích còn ' + b.powerCd + ' lượt hồi.');
            const cost = this.maxMp() * BATTLE.powerMp;
            if (s.mp < cost) throw Error('Linh lực không đủ để tung trọng kích.');
            s.mp -= cost;
            b.powerCd = BATTLE.powerCd + 1;
          }
          if (this.rng() < enemy.dodge) this.battleLog(b, enemy.name + ' né được đòn của bạn.');
          else {
            const critical = this.rng() < st.CRIT, mult = (action === 'power' ? BATTLE.powerMult : 1) * atkBuff;
            crit = critical;
            dealt = F.damage(st.ATK, enemy.def, mult * this.battleElemental(enemy, null), 0, critical, st.CRIT_DMG);
            b.enemyHp = Math.max(0, b.enemyHp - dealt);
            this.battleLog(b, (action === 'power' ? 'Bạn tung trọng kích' : 'Bạn đánh') + (critical ? ' bạo kích' : '') + ' ' + enemy.name + ': −' + F.fmt(dealt) + '.');
            this.battleOnHit(b);
          }
        } else if (action === 'guard') {
          b.guard = true;
          this.battleLog(b, 'Bạn thủ thế, giảm ' + Math.round(BATTLE.guardCut * 100) + '% sát thương nhận vào lượt này.');
        } else if (action === 'heal') {
          if (b.healCd > 0) throw Error('Hồi phục còn ' + b.healCd + ' lượt hồi.');
          const cost = this.maxMp() * BATTLE.healMp, max = this.stats(now).HP;
          if (s.mp < cost) throw Error('Linh lực không đủ để hồi phục.');
          healed = Math.max(0, Math.min(max - s.hp, max * BATTLE.healPct * (1 + this.rootEffects().heal)));
          if (healed <= 0) throw Error('Sinh lực đã đầy.');
          s.mp -= cost;
          s.hp = Math.min(max, s.hp + healed);
          b.healCd = BATTLE.healCd + 1;
          this.battleLog(b, 'Vận công hồi phục: sinh lực +' + F.fmt(healed) + '.');
        } else if (action === 'manual') {
          const out = this.battleManual(b, payload.code);
          dealt = out.dealt || 0; healed = out.healed || 0; crit = !!out.crit;
          this.battleLog(b, out.text);
        } else if (action === 'artifact') {
          const key = payload.code, x = item(key), d = x && DESIGN.effects[x.code];
          if (!x || !s.equipment.includes(key) || !d || d['điều kiện kích hoạt'] !== 'khi kích hoạt')
            throw Error('Pháp bảo này không có kỹ năng kích hoạt.');
          if ((b.cd['a:' + key] || 0) > 0) throw Error('Pháp bảo còn ' + b.cd['a:' + key] + ' lượt hồi.');
          if (d['hiệu ứng'] === 'giáp ảo') {
            const shield = this.stats(now).HP * d['lá chắn (% hp tối đa)'] / 100;
            b.shield = (b.shield || 0) + shield;
            this.battleLog(b, 'Kích hoạt ' + x.name + ': hộ thuẫn ' + F.fmt(shield) + '.');
          } else if (d['hiệu ứng'] === 'hồi máu') {
            b.regen = { amount: d['hồi máu (hp)'] / d['chu kỳ hồi (giây)'] * BATTLE.secondsPerTurn, turns: Math.max(1, Math.ceil(d['thời gian (giây)'] / BATTLE.secondsPerTurn)) };
            this.battleLog(b, 'Kích hoạt ' + x.name + ': hồi phục theo lượt.');
          } else throw Error('Hiệu ứng kích hoạt chưa hỗ trợ.');
          b.cd['a:' + key] = Math.max(1, Math.ceil(d['hồi chiêu (giây)'] / BATTLE.secondsPerTurn)) + 1;
        } else if (action === 'item') {
          const out = this.battleUseItem(b, payload.code);
          dealt = out.dealt || 0; healed = out.healed || 0; crit = !!out.crit;
          this.battleLog(b, out.text);
        } else if (action === 'flee') {
          const chance = Math.max(.25, Math.min(.85, BATTLE.flee + (s.talent?.phucDuyen || 0) * .005 - (s.tamMa || 0) * .002));
          if (this.rng() < chance) {
            b.state = 'fled';
            b.result = 'Bạn né tránh ' + e.name + ', bình yên vô sự nhưng không thu được gì.';
            e.choice = 1; e.cleared = true; e.text = b.result;
            this.battleLog(b, 'Rút lui thành công.');
            this.log('Lịch luyện · ' + b.result);
            return { dealt: 0, healed: 0, crit: false, taken: 0, fled: true, turn: b.turn, state: b.state };
          }
          this.battleLog(b, 'Rút lui thất bại, ' + enemy.name + ' chặn đường.');
        } else throw Error('Hành động không hợp lệ.');
        if (b.enemyHp <= 0) {
          this._battleWin(e, b);
          return { dealt, healed, crit, taken: 0, won: true, turn: b.turn, state: b.state };
        }
        const out = this._battleEnemyTurn(e, b, enemy, st, now);
        return { dealt, healed, crit, ...out, turn: b.turn, state: b.state };
      },

      /* Chỉ số đối thủ luôn suy ra từ cảnh giới/khu vực hiện tại. Dữ liệu thiết kế
         (tên, hệ, kỹ năng, bạo kích, né) chỉ giữ vai trò hồ sơ; HP/ATK/DEF tuyệt đối
         trong design-raw được tạo cho bản thử nghiệm cấp thấp nên không dùng trực tiếp. */
      enemy() {
        const s = this.s;
        let d = null;
        if (s.zone < 5 && s.enemyKind === 'thường') d = DESIGN.raw['quái vật'].find(x => x['khu vực'] === H.ZONES[s.zone].name);
        else if (s.zone === 4 && ['boss', 'boss kiếp'].includes(s.enemyKind)) d = DESIGN.raw.boss.find(x => x['mã boss'] === 'BS001');
        const st = F.stats(s.zone, Math.min(s.stage - 1, F.STAGES[s.zone] - 1)), m = F.MONSTER_MULT[s.enemyKind];
        for (const k of ['HP', 'ATK', 'DEF']) st[k] *= m;
        st.CRIT = d ? d['crit (%)'] / 100 : .05;
        st.DODGE = d ? d['eva (%)'] / 100 : 0;
        st.CRIT_DMG = d ? d['crit_dame (%)'] / 100 : 1.5;
        st.CP = F.combat_power(st.HP, st.ATK, st.DEF, st.CRIT, st.CRIT_DMG);
        st.name = d ? (d['tên quái'] || d['tên boss']) : ENEMY_NAMES[s.zone];
        st.designId = d ? (d['mã quái'] || d['mã boss']) : '';
        if (d) Object.assign(st, {
          level: d['cấp'], elementName: d['hệ'], skill: d['kỹ năng'],
          element: ['kim', 'mộc', 'thủy', 'hỏa', 'thổ'].indexOf(d['hệ'])
        });
        return st;
      },
      rewardDefinedEnemy(id, count = 1, rng = this.rng) {
        const def = DESIGN.raw['quái vật'].find(x => x['mã quái'] === id) || DESIGN.raw.boss.find(x => x['mã boss'] === id);
        if (!def) return { exp: 0, items: {} };
        const exp = this.gainExp(def.exp * count), items = {};
        for (const drop of DESIGN.raw['vật phẩm rơi'].filter(x => x['mã đối thủ'] === id)) {
          const code = DESIGN.legacy(drop['mã vật phẩm']);
          if (!code) continue;
          let n = 0;
          for (let i = 0; i < count; i++) if (rng() < drop['tỉ lệ (%)'] / 100) n += drop['số lượng tối thiểu'] + Math.floor(rng() * (drop['số lượng tối đa'] - drop['số lượng tối thiểu'] + 1));
          if (n) { this.add(code, n); items[code] = (items[code] || 0) + n; }
        }
        return { exp, items };
      },
      attackInterval() {
        return Math.max(.5, F.kill_time(this.s.zone) / 10) / (this.s.rootType === 'Dị' && this.s.rootSub === 'phong' ? 1.1 : 1);
      },
      collectLoot(count = 1, offline = false) {
        const s = this.s, r = s.zone, kind = s.enemyKind;
        const fortune = (1 + (s.talent?.phucDuyen || 0) * .02) * (1 + H.PAVILION.bonus(s.pavilion?.phucDuyen)), herbFortune = (1 + (s.talent?.phucDuyen || 0) * .015) * (1 + H.PAVILION.bonus(s.pavilion?.phucDuyen));
        s.enemyNum += count; s.progress.kill += count;
        s.stone += F.loot_linh_thach(r, kind) * count * fortune;
        const cores = offline ? count * F.yeu_dan_drop_chance(r, kind) : (this.rng() < F.yeu_dan_drop_chance(r, kind) ? 1 : 0);
        s.yaoValue += cores * F.yeu_dan_value(r, kind);
        const enemy = this.enemy();
        if (enemy.designId) this.rewardDefinedEnemy(enemy.designId, count);
        else {
          const herbs = ITEMS.filter(x => x.kind === 'HERB' && x.tier === r);
          const drops = offline ? Math.floor(count * .3 * herbFortune) : (this.rng() < Math.min(1, .3 * herbFortune) ? 1 : 0);
          if (drops && herbs.length) this.add(pick(herbs, this.rng).code, drops);
        }
        if (!offline) this.log('Hạ ' + this.enemy().name + ', nhận ' + F.format_linh_thach(F.loot_linh_thach(r, kind) * fortune, s.realm) + '.');
      },
      _strike(mult = 1, now = this.s.lastUpdate, free = false, element = null) {
        now = at(this, now);
        const s = this.s, interval = this.attackInterval();
        if (!free && now < s.manualAt + interval * 1000) throw Error('Chưa đến lượt công kích.');
        if (!free) s.manualAt = now;
        this.tickDefinedCombat(now);
        const enemy = this.enemy(), st = this.stats(now);
        if (s.enemyHp <= 0) s.enemyHp = enemy.HP;
        const advantage = enemy.element >= 0 ? this.affinity(enemy.element) : 0;
        let damage = 0;
        if (this.rng() >= (enemy.DODGE || 0)) {
          let elemental = 1 + advantage;
          if (element) {
            const source = H.ELEMENT_NAMES.findIndex(x => x.toLowerCase() === element), target = enemy.element;
            if (element === 'không hệ') elemental = 1;
            else if (s.rootType === 'Hỗn Độn') {
              elemental = target >= 0 ? 1.1 : 1;
              if (this.activeElements().includes(source)) elemental *= 1.2;
            } else if (s.rootType === 'Dị' && H.DI_LINH_CAN[s.rootSub]?.name.toLowerCase() === element) elemental = target >= 0 && this.activeElements().includes(target) ? 1.2 : 1;
            else if (source >= 0 && target >= 0) elemental = H.BEATS[source] === target ? 1.2 : H.BEATS[target] === source ? .8 : 1;
            else elemental = 1;
            if (s.rootType !== 'Dị' && s.rootType !== 'Hỗn Độn' && [0, 3].includes(source) && this.activeElements().includes(source)) elemental *= 1.1;
          }
          const pen = s.rootType === 'Dị' && s.rootSub === 'loi' && element === 'lôi' ? .10 : 0;
          damage = F.damage(st.ATK, enemy.DEF, mult * elemental, pen, this.rng() < st.CRIT, st.CRIT_DMG);
          s.enemyHp = Math.max(0, s.enemyHp - damage);
        }
        if (s.enemyHp === 0) {
          this.collectLoot();
          if (s.exploration?.active?.kind === 'monster') s.exploration.active.cleared = true;
          s.designCombat.enemyEffects = [];
          s.enemyHp = this.enemy().HP;
          return { damage, won: true };
        }
        if (damage > 0) this.applyArtifactHit(now);
        const controlled = s.designCombat.enemyEffects.some(e => ['freeze', 'stun'].includes(e.type) && e.end > now);
        if (!controlled && this.rng() >= st.DODGE) {
          const phase = enemy.designId?.startsWith('BS') ? DESIGN.phase(enemy.designId, s.enemyHp / enemy.HP)?.multiplier || 1 : DESIGN.multiplier(enemy.skill);
          const hit = F.damage(enemy.ATK, st.DEF, phase * (advantage < 0 ? 1.2 : 1) * (1 - this.rootEffects().reduction), 0, this.rng() < (enemy.CRIT || 0), enemy.CRIT_DMG || 1.5);
          s.hp -= this.absorbCombatDamage(hit, now);
          const bleed = String(enemy.skill || '').match(/chảy máu\s+(\d+(?:[.,]\d+)?)%\s*hp hiện tại\/giây trong\s+(\d+(?:[.,]\d+)?)\s*giây/i);
          if (bleed) {
            const ward = s.designCombat.ward, reduction = ward && ward.end > now ? ward.reduce : 0;
            const seconds = Number(bleed[2].replace(',', '.')) * (1 - reduction);
            if (seconds > 0) s.designCombat.bleed = { pct: Number(bleed[1].replace(',', '.')) / 100, last: now, end: now + seconds * 1000 };
          }
        }
        if (s.hp <= 0) {
          s.hp = 0; s.auto = false; s.designCombat.enemyEffects = [];
          this.markDeath('combat', now);
          this.log('Sinh lực cạn trong giao chiến. Đạo thân tọa hóa.');
        }
        return { damage, won: false, died: this.isDead() };
      },
      strike(payload, now) { this.assertNoRun(); return this._strike(1, at(this, now), false); },
      assertNoRun() { if (this.s.dungeon.run) throw Error('Đang chiến đấu trong bí cảnh, chưa thể lịch luyện.');
        if (this.s.exploration?.active) throw Error('Đang lịch luyện, không thể chủ động giao chiến. Kết quả sẽ được luận định khi trở về.'); },
      skill(payload, now) {
        this.assertNoRun();
        now = at(this, now);
        const index = payload.index, s = this.s;
        if (!Number.isInteger(index) || index < 0 || index > 3) throw Error('Kỹ năng không hợp lệ.');
        if (now < s.cooldowns[index]) throw Error('Chiêu thức chưa kịp tụ đủ linh lực để thi triển.');
        const costs = [.12, .15, .18, .26], cd = [5, 7, 12, 15], cost = this.maxMp() * costs[index];
        if (s.mp < cost) throw Error('Linh lực không đủ để thi triển chiêu thức.');
        s.mp -= cost;
        s.cooldowns[index] = now + Math.max(cd[index], this.attackInterval()) * 1000;
        if (index === 2) s.hp = Math.min(this.stats().HP, s.hp + this.stats().HP * .26 * (1 + this.rootEffects().heal));
        else this._strike([2, 1.5, 1, 3.6][index], now, true);
      },
      activateArtifact(payload, now) {
        now = at(this, now);
        const key = payload.code, s = this.s, x = item(key), d = x && DESIGN.effects[x.code];
        if (!x || !s.equipment.includes(key) || !d || d['điều kiện kích hoạt'] !== 'khi kích hoạt') throw Error('Pháp bảo này không có kỹ năng kích hoạt.');
        const c = effects(s);
        if (now < (c.itemCooldowns[key] || 0)) throw Error('Pháp bảo đang hồi chiêu.');
        const end = now + d['thời gian (giây)'] * 1000;
        if (d['hiệu ứng'] === 'giáp ảo') { c.shield = this.stats(now).HP * d['lá chắn (% hp tối đa)'] / 100; c.shieldEnd = end; }
        else if (d['hiệu ứng'] === 'hồi máu') { c.heal = { amount: d['hồi máu (hp)'] / d['chu kỳ hồi (giây)'], last: now, end }; }
        else throw Error('Hiệu ứng kích hoạt chưa hỗ trợ.');
        c.itemCooldowns[key] = now + d['hồi chiêu (giây)'] * 1000;
        this.log('Kích hoạt ' + x.name + ' · ' + d['hiệu ứng'] + '.');
        return d['hiệu ứng'];
      },
      castManual(payload, now) {
        this.assertNoRun();
        now = at(this, now);
        const key = payload.code, s = this.s, x = item(key);
        if (H.MANUALS.school(x) !== 'ngoai' || !(key in s.learned) || !s.activeManuals.includes(key)) throw Error('Hãy lĩnh ngộ và đặt công pháp ngoại tu vào ô.');
        return this._cast(key, now);
      },
      /* Thi triển một skill ngoại tu: kiểm tra hồi chiêu và linh lực, rồi áp dụng hiệu ứng theo phẩm chất sách. */
      _cast(key, now) {
        const s = this.s, x = item(key), k = H.MANUALS.skillOf(x), c = effects(s), power = this.manualPower(key);
        if (now < (c.manualCooldowns[key] || 0)) throw Error('Công pháp đang hồi chiêu.');
        const cost = this.maxMp() * k.mpPct;
        if (s.mp < cost) throw Error('Linh lực không đủ để thi triển chiêu thức.');
        s.mp -= cost;
        c.manualCooldowns[key] = now + k.cooldown * 1000;
        if (k.kind === 'attack') return this._strike(k.multiplier * power, now, true, k.element);
        if (k.kind === 'heal') s.hp = Math.min(this.stats(now).HP, s.hp + k.value * power * (1 + this.rootEffects().heal));
        else if (k.kind === 'guard') c.buffs.push({ type: 'def', value: k.value * power, end: now + k.seconds * 1000 });
        else if (k.kind === 'evade') c.buffs.push({ type: 'dodge', value: k.value * power / 100, end: now + k.seconds * 1000 });
        this.log('Vận dụng ' + x.name + '.');
        return { support: true };
      },
      /* Khi tự động chiến đấu, các skill ngoại tu sẵn sàng được thi triển trước đòn thường. */
      _autoCast(now) {
        const s = this.s, c = effects(s);
        for (const key of s.activeManuals) {
          const k = H.MANUALS.skillOf(item(key));
          if (!k || now < (c.manualCooldowns[key] || 0) || s.mp < this.maxMp() * k.mpPct) continue;
          if (k.kind === 'heal' && s.hp > this.stats(now).HP * .6) continue;
          const out = this._cast(key, now);
          if (out?.won || this.isDead()) return out;
        }
        return null;
      },
      applyArtifactHit(now) {
        const s = this.s, c = effects(s);
        for (const key of s.equipment) {
          const x = item(key), d = DESIGN.effects[x.code];
          if (!d || d['điều kiện kích hoạt'] !== 'khi đánh trúng' || this.rng() >= d['tỉ lệ kích hoạt (%)'] / 100) continue;
          const names = { 'đóng băng': 'freeze', 'gây choáng': 'stun', 'gây độc': 'poison', 'chảy máu': 'bleed' }, type = names[d['hiệu ứng']];
          if (!type) continue;
          const old = c.enemyEffects.find(e => e.type === type && e.source === key);
          if (old) { old.end = now + d['thời gian (giây)'] * 1000; old.stacks = type === 'poison' ? Math.min(d['số lớp tối đa'], old.stacks + 1) : 1; old.last = now; }
          else c.enemyEffects.push({ type, source: key, end: now + d['thời gian (giây)'] * 1000, last: now, stacks: 1, damage: d['độc (sát thương/giây)'] || 0, pct: (d['chảy máu (% hp hiện tại/giây)'] || 0) / 100 });
        }
        if (s.rootType === 'Dị' && ['bang', 'loi', 'doc'].includes(s.rootSub)) {
          const chance = s.rootSub === 'doc' ? .15 : .10;
          if (this.rng() < chance) {
            const type = { bang: 'freeze', loi: 'stun', doc: 'poison' }[s.rootSub];
            const duration = s.rootSub === 'bang' ? 1.5 : s.rootSub === 'loi' ? 1 : 3;
            const old = c.enemyEffects.find(e => e.source === 'root' && e.type === type);
            const entry = { type, source: 'root', end: now + duration * 1000, last: now, stacks: 1, damage: s.rootSub === 'doc' ? this.stats(now).ATK * .05 : 0, pct: 0 };
            if (old) Object.assign(old, entry); else c.enemyEffects.push(entry);
          }
        }
      },
      tickDefinedCombat(now, offline = false) {
        now = at(this, now);
        const s = this.s, c = effects(s);
        if (c.shieldEnd <= now) { c.shield = 0; c.shieldEnd = 0; }
        if (c.heal) {
          const h = c.heal, seconds = Math.max(0, (Math.min(now, h.end) - h.last) / 1000);
          if (seconds) s.hp = Math.min(this.stats(now).HP, s.hp + seconds * h.amount * (1 + this.rootEffects().heal));
          h.last = Math.max(h.last, Math.min(now, h.end));
          if (now >= h.end) c.heal = null;
        }
        c.buffs = c.buffs.filter(b => b.end > now);
        if (c.ward && c.ward.end <= now) c.ward = null;
        if (offline) { c.enemyEffects = []; c.bleed = null; return; }
        if (c.bleed) {
          const b = c.bleed, seconds = Math.max(0, (Math.min(now, b.end) - b.last) / 1000);
          if (seconds) s.hp *= Math.pow(1 - b.pct, seconds);
          b.last = Math.max(b.last, Math.min(now, b.end));
          if (now >= b.end) c.bleed = null;
        }
        const hadEnemy = s.enemyHp > 0;
        if (hadEnemy) for (const e of c.enemyEffects) {
          const seconds = Math.max(0, (Math.min(now, e.end) - e.last) / 1000);
          if (e.type === 'poison') s.enemyHp = Math.max(0, s.enemyHp - seconds * e.damage * e.stacks);
          else if (e.type === 'bleed') s.enemyHp = Math.max(0, s.enemyHp * Math.pow(1 - e.pct, seconds));
          e.last = Math.max(e.last, Math.min(now, e.end));
        }
        c.enemyEffects = c.enemyEffects.filter(e => e.end > now);
        if (s.hp <= 0) { s.hp = 0; this.markDeath('combat', now); return; }
        if (hadEnemy && s.enemyHp === 0) {
          this.collectLoot();
          c.enemyEffects = [];
          s.enemyHp = this.enemy().HP;
        }
      },
      absorbCombatDamage(amount, now) {
        const c = effects(this.s);
        if (c.shieldEnd <= now) { c.shield = 0; c.shieldEnd = 0; }
        const blocked = Math.min(c.shield, amount);
        c.shield -= blocked;
        return amount - blocked;
      },
      setEnemyKind(payload) {
        const kind = payload.kind;
        if (!Object.hasOwn(F.MONSTER_MULT, kind)) throw Error('Loại đối thủ không hợp lệ.');
        if (this.s.exploration?.active?.battle) throw Error('Đang giao chiến, không thể đổi loại đối thủ.');
        this.s.enemyKind = kind;
        this.s.enemyHp = 0;
        this.s.combatClock = 0;
        this.s.designCombat.enemyEffects = [];
        return kind;
      },
      travel(payload) {
        if (this.s.exploration?.active) throw Error('Đang lịch luyện; chưa thể đổi địa điểm trước khi trở về.');
        const zone = payload.zone;
        if (!Number.isInteger(zone) || !H.ZONES[zone] || zone > this.s.realm) throw Error('Cảnh giới chưa đủ.');
        const s = this.s;
        s.zone = zone;
        s.enemyHp = 0;
        s.combatClock = 0;
        s.auto = false;
        s.designCombat.enemyEffects = [];
        if (!s.locations.includes(zone)) { s.locations.push(zone); s.progress.travel++; }
        this.log('Đến ' + H.ZONES[zone].name + '.');
        return zone;
      }
    }));
  }

  const mod = Object.freeze({ domain, commands, install });
  (root.HU_RULES = root.HU_RULES || {})[domain] = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : globalThis);
