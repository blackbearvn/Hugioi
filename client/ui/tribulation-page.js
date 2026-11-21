/* HƯ GIỚI · ĐỘ KIẾP ĐÀI
 * Cảnh độ kiếp toàn màn hình: tách khỏi shell.js, nạp ngay sau shell.js. */
(function (root) {
  'use strict';
  const H = root.HU_GAME, F = H.F, A = root.HU_ASSETS;
  const UI = root.HU_UI, L = root.HU_LABELS;
  const { $, $$, esc, clamp, num, money, moneyHTML, pct, duration, btn } = UI.kit;
  const store = UI.store;
  /* ======================================================================
     ĐỘ KIẾP ĐÀI
     ====================================================================== */
  const trib = {
    active: false,
    pageOpen: false,
    phase: 'closed',
    result: null,
    timers: [],
    reduced: false,
    focus: null,
    world: 'ha_gioi',
    sig: '',
    actor: null,
    setReduced(v) { this.reduced = !!v; },
    layoutScene() {
      if (!this.pageOpen) return;
      const stage = $('tribStage'), scale = Math.max(stage.clientWidth / 1280, stage.clientHeight / 720);
      // Tâm hoa văn trong dai_loi_kiep.webp là (640,432), cùng phép cover với nền.
      $('tribulationFx').style.setProperty('--altar-x', stage.clientWidth / 2 + 'px');
      $('tribulationFx').style.setProperty('--altar-y', (stage.clientHeight - 720 * scale) / 2 + 432 * scale + 'px');
    },
    heroFrame(n = 0) {
      const s = this.actor || UI.s(), el = $('tribHero');
      A.preloadHero(s.gender, s.realm);
      const src = A.heroSrc(s.gender, s.realm, 'dung_yen', this.reduced ? 0 : n);
      if (el.getAttribute('src') !== src) el.src = src;
    },
    progress(value) {
      $('tribProgress').style.width = value + '%';
      $('tribProgressBar').setAttribute('aria-valuenow', String(Math.round(value)));
    },
    updateQi() {
      const s = UI.s(), need = UI.g().need();
      $('tribQiText').textContent = num(s.qi) + ' / ' + num(need);
      $('tribQiFill').style.width = clamp(s.qi / need * 100, 0, 100) + '%';
      const ready = this.canStart();
      $('tribEligibility').textContent = s.completed ? 'Đạo quả viên mãn · không có cơ chế trọng sinh.'
        : !ready ? 'Còn ' + duration(F.time_to_goal(need, s.qi, UI.g().rate())) + ' tu luyện để đột phá.'
          : this.major() ? 'Đã đủ tu vi · mở phần chuẩn bị để dùng đan / phù hộ kiếp.' : 'Đã đủ tu vi · sẵn sàng đột phá tầng nhỏ.';
      const minorQi = $('tribMinorQi'), minorFill = $('tribMinorQiFill');
      if (minorQi) minorQi.textContent = num(s.qi) + ' / ' + num(need);
      if (minorFill) minorFill.style.width = clamp(s.qi / need * 100, 0, 100) + '%';
    },
    clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; },
    wait(fn, ms) { this.timers.push(setTimeout(fn, ms)); },
    major() { const s = UI.s(); return s.stage === F.STAGES[s.realm]; },
    canStart() { const s = UI.s(), g = UI.g(); return !s.completed && s.qi >= g.need() && !root.HU_COMMANDS?.activityConflict(s, 'breakthrough'); },
    worldOf() { return A.tribWorld ? A.tribWorld(UI.s().realm) : 'ha_gioi'; },
    preload() {
      const world = this.worldOf();
      A.preloadVfx('loi_kiep', world);
      if (A.vfxCount('phi_thang', world)) A.preloadVfx('phi_thang', world);
      A.preloadVfx('dot_pha', 'ha_gioi');
      A.preloadVfx('chien_dau', 'ho_thuan');
      A.preloadVfx('chien_dau', 'linh_phu');
      ['bolt', 'break', 'hit'].forEach(name => A.preloadVfx('hu_gioi', name));
    },
    nextLabel() {
      const s = UI.s();
      if (s.completed) return 'Đạo Tổ · đạo quả viên mãn';
      if (this.major()) return F.REALMS[s.realm] + ' → ' + (s.realm < 13 ? F.REALMS[s.realm + 1] : 'Đạo Tổ');
      const name = UI.tribulationScreen?.stageName;
      return name ? name(s.realm, s.stage) + ' → ' + name(s.realm, s.stage + 1) : UI.g().realmLabel();
    },
    renderPrep() {
      const s = UI.s(), g = UI.g(), st = g.stats(), events = g.tribulation(), odds = g.breakthroughOdds();
      const major = this.major(), can = this.canStart(), world = this.worldOf();
      this.world = world;
      $('tribRealmChip').textContent = g.realmLabel();
      $('tribEyebrow').textContent = s.completed ? 'Thiên đạo, đạo quả viên mãn' : major ? 'Thiên đạo, đại cảnh giới' : 'Tiên lộ, tiểu cảnh giới';
      $('tribTitle').textContent = s.completed ? 'Đạo Tổ viên mãn' : major ? 'Thiên kiếp' : 'Đột phá tầng';
      $('tribSubtitle').textContent = this.nextLabel();
      $('tribHeadTags').innerHTML = `<span${odds.doomed ? ' class="danger-text"' : ''}>${odds.doomed ? '0% · chưa đủ hộ kiếp' : pct(odds.chance) + ' xác suất'}</span><span>Hộ kiếp vỡ = tọa hóa</span><span>${events.reduce((n, e) => n + e.bolts, 0) || 0} đạo lôi</span><span>${pct(s.shield)} hộ thuẫn</span>`;
      this.actor = { gender: s.gender, realm: s.realm };
      this.heroFrame();
      $('tribOverlayChance').textContent = odds.doomed ? '0% (chưa đủ hộ kiếp)' : pct(odds.chance);
      $('tribOverlayChance').classList.toggle('danger-text', odds.doomed);
      $('tribReduction').textContent = pct(s.reduction);
      $('tribShieldSummary').textContent = pct(s.shield) + ' sinh lực';
      $('tribPitySummary').textContent = s.pity + '/15';
      $('tribHpText').textContent = num(s.hp) + ' / ' + num(st.HP);
      $('tribHpFill').style.width = clamp(s.hp / st.HP * 100, 0, 100) + '%';
      $('tribShieldText').textContent = pct(s.shield) + ' sinh lực';
      $('tribShieldFill').style.width = clamp(s.shield * 100, 0, 100) + '%';
      $('tribCounter').textContent = events.length ? 'Thiên kiếp · ' + events.reduce((n, e) => n + e.bolts, 0) + ' đạo lôi' : 'Không lôi kiếp · chỉ xét xác suất';
      $('tribEventCount').textContent = events.length ? events.length + ' đợt' : '0 đợt';
      $('tribEvents').innerHTML = events.length ? events.map(e =>
        `<li><b>${esc(e.name)}</b><span>${e.bolts} đạo · <em class="${e.success ? 'green-text' : 'danger-text'}">${e.success ? '✓ đủ sức' : '✗ chưa đủ sức'}</em></span></li>`).join('')
        : '<li><b>Không có lôi kiếp</b><span>Đột phá chỉ dựa vào xác suất</span></li>';
      this.progress(0);
      $('tribStatus').textContent = s.completed ? 'Đạo Tổ đã chứng đạo · kiếp này viên mãn.'
        : !major ? 'Tầng này không có lôi kiếp. Đột phá tại chỗ, ghi vào nhật ký.'
          : !can ? 'Tu vi chưa đầy. Hãy tiếp tục nhập định và chuẩn bị hộ kiếp.'
            : odds.doomed ? 'Hộ kiếp chưa đủ cho: ' + odds.failing.join(', ') + '. Dẫn lôi lúc này chắc chắn tọa hóa. Hãy dùng đan/phù hộ kiếp phẩm cao hơn trước.'
              : events.length ? 'Lôi vân đã tụ · chuẩn bị nghênh đón thiên kiếp.' : 'Tĩnh tâm vận khí · chuẩn bị vượt đại cảnh giới.';
      $('tribStageHint').textContent = s.completed ? 'Đạo quả viên mãn' : major ? 'Thiên đạo vô tình · đạo tâm bất diệt' : 'Tiểu cảnh giới · đột phá tại chỗ';
      $('tribResult').hidden = true;
      $('tribResult').className = 'trib-result';
      $('tribResult').innerHTML = '';
      $('tribStart').hidden = false;
      $('tribStart').disabled = !can;
      $('tribStart').textContent = s.completed ? 'Đã chứng đạo' : !can ? 'Chưa đủ tu vi' : !major ? 'Đột phá tầng nhỏ' : odds.doomed ? 'Dẫn lôi (chắc thất bại)' : events.length ? 'Dẫn động lôi kiếp' : 'Đột phá cảnh giới';
      $('tribStart').classList.toggle('btn-danger', odds.doomed && can && major);
      $('tribClose').hidden = false;
      $('tribClose').disabled = false;
      $('tribClose').textContent = 'Về tu luyện';
      $('tribReturn').hidden = true;
      $('tribBack').disabled = false;
      $('tribPrep').hidden = false;
      $('tribDetails').hidden = false;
      $('tribPrep').innerHTML = UI.tribulationScreen?.render() || '';
      $('tribStage').classList.remove('is-running', 'is-result', 'is-success', 'is-failure', 'struck');
      $('tribStage').classList.toggle('is-ready', can);
      $('tribStage').classList.toggle('is-minor', !major && !s.completed);
      $('tribStage').classList.toggle('is-completed', s.completed);
      $('tribulationFx').dataset.phase = 'prep';
      this.updateQi();
      this.sig = UI.screens.tribulation?.signature?.() || '';
    },
    openPage() {
      const s = UI.s();
      if (!s.created) return;
      if (this.pageOpen) { if (!this.active) this.updatePage(true); return; }
      if (this.active) return;
      UI.closeMoreMenu();
      UI.hideItemTip();
      store.catchUp();
      this.pageOpen = true;
      this.phase = 'prep';
      this.result = null;
      this.focus = document.activeElement;
      this.clearTimers();
      UI.vfx?.clear('#stageVfx');
      UI.windows.closeAll();
      $('game').hidden = true;
      $('tribulationFx').hidden = false;
      document.body.classList.add('in-tribulation');
      UI.current = 'tribulation';
      this.layoutScene();
      $('tribDetails').open = false;
      this.preload();
      this.renderPrep();
      UI.vfx?.clear('#tribVfxLayer');
      UI.vfx?.ring('trib', '#91d9ed');
      $('tribulationFx').scrollTop = 0;
      UI.markMenu();
      UI.updateStage();
      if ($('modalLayer').hidden) try { $('tribBack')?.focus({ preventScroll: true }); } catch { /* bỏ qua */ }
    },
    closePage() {
      if (!this.pageOpen) return;
      if (this.active && ['running', 'settling'].includes(this.phase)) return;
      this.clearTimers();
      UI.vfx?.clear('#tribVfxLayer');
      UI.vfx?.clear('#tribStageVfx');
      UI.vfx?.clear('#tribStage');
      this.active = false;
      this.pageOpen = false;
      this.phase = 'closed';
      this.result = null;
      this.actor = null;
      $('tribulationFx').hidden = true;
      $('game').hidden = false;
      document.body.classList.remove('in-tribulation');
      UI.current = 'idle';
      UI.markMenu();
      UI.updateSceneEffects();
      UI.updateChrome();
      UI.updateStage();
      try { this.focus?.focus?.({ preventScroll: true }); } catch { /* bỏ qua */ }
    },
    close() {
      if (!this.pageOpen || ['running', 'settling'].includes(this.phase)) return;
      const result = this.result;
      const ok = !!result?.success;
      const departedWorld = this.world;
      this.closePage();
      UI.go('idle');
      if (UI.pendingDeathReport) { const report = UI.pendingDeathReport; UI.pendingDeathReport = null; UI.onDeath?.(report); }
      if (result) UI.toast(ok ? 'Thiên kiếp thành công · ' + UI.g().realmLabel()
        : result.died ? 'Hộ kiếp vỡ · đạo thân tọa hóa vĩnh viễn.'
          : 'Lôi kiếp đã qua nhưng phá cảnh chưa thành · tu vi tổn hại, may mắn tích lũy.',
        { type: ok ? 'tribulation' : 'danger', title: ok ? 'Đột phá thành công' : 'Đột phá thất bại' });
      if (ok && H.STORY?.TRIBULATION) {
        const key = departedWorld === 'linh_gioi' ? 'linh' : departedWorld === 'tien_gioi' ? 'tien' : 'ha';
        UI.toast(H.STORY.TRIBULATION[key], { type: 'info', title: 'Thiên Thư · Vượt kiếp' });
      }
    },
    show() { UI.go('tribulation'); },
    async start(confirmed = false) {
      if (!this.pageOpen || this.active || this.phase === 'running') return;
      const s = UI.s(), g = UI.g();
      if (s.completed) { UI.toast('Đạo Tổ đã chứng đạo · kiếp này viên mãn.', { type: 'info' }); return; }
      if (!this.major()) { UI.actions.break?.({ dataset: {} }); return; }
      if (s.qi < g.need()) { UI.toast('Tu vi chưa đầy. Hãy tiếp tục nhập định.', { type: 'danger' }); this.renderPrep(); return; }
      const odds = g.breakthroughOdds();
      if (odds.doomed && !confirmed) {
        UI.modal('Hộ kiếp chưa đủ sức', `<p>${esc(odds.failing.join(', '))} vượt quá sức chịu của đạo thân. Xác suất nền ${pct(odds.base)} không còn ý nghĩa: lôi kiếp là phép thử cố định nên lần này <b>chắc chắn thất bại và đạo thân tọa hóa vĩnh viễn</b>. Toàn bộ tiến trình kiếp này bị xóa.</p><p>Hãy dùng đan hoặc phù hộ kiếp phẩm cao hơn để tăng khiên và giảm sát thương, rồi quay lại.</p>`,
          () => trib.start(true), 'Vẫn dẫn lôi', 'Thiên kiếp', { type: 'danger' });
        return;
      }
      store.catchUp();
      const world = this.worldOf(), oldStats = g.stats(), oldShield = s.shield;
      const oldRealm = s.realm, oldRoot = s.rootType, oldReduction = s.reduction;
      this.world = world;
      this.preload();
      const result = await UI.command('breakthrough');
      this.result = result;
      this.active = true;
      this.phase = 'running';
      store.write();
      $('tribStart').disabled = true;
      $('tribClose').disabled = true;
      $('tribBack').disabled = true;
      $('tribReturn').hidden = true;
      $('tribResult').hidden = true;
      $('tribPrep').hidden = true;
      $('tribDetails').open = false;
      $('tribDetails').hidden = true;
      const events = result.events || [];
      this.progress(0);
      $('tribEligibility').textContent = 'Đang đột phá · giữ vững đạo tâm.';
      $('tribStatus').textContent = events.length ? 'Thiên đạo cảm ứng · lôi vân tụ họp...' : 'Thiên đạo cảm ứng · đạo cơ chuyển hóa...';
      $('tribStageHint').textContent = events.length ? 'Thiên lôi giáng thế...' : 'Thiên đạo định đoạt · đạo cơ chuyển hóa...';
      $('tribHpText').textContent = num(oldStats.HP) + ' / ' + num(oldStats.HP);
      $('tribHpFill').style.width = '100%';
      $('tribShieldText').textContent = pct(oldShield) + ' sinh lực';
      $('tribShieldFill').style.width = clamp(oldShield * 100, 0, 100) + '%';
      $('tribStage').classList.remove('is-ready', 'is-minor', 'is-completed', 'is-result', 'is-success', 'is-failure');
      $('tribStage').classList.add('is-running');
      $('tribulationFx').dataset.phase = 'running';
      UI.vfx?.ring('trib', '#e6c164');
      if (oldShield > 0) UI.vfx?.tribStage({ kind: 'chien_dau', variant: 'ho_thuan', fps: 12 });
      // Tóm lược tối đa 6 nhịp mỗi đợt; sinh lực/khiên lấy từ cùng công thức chịu kiếp.
      const steps = [];
      events.forEach((event, wave) => {
        const bolts = wave === 1 ? F.ascension_bolts(oldRealm, oldRoot) : F.tribulation_bolts(oldRealm, oldRoot);
        const end = event.success ? bolts.length : Math.min(bolts.length, event.survived + 1);
        const beats = Math.min(end, this.reduced ? 1 : 6);
        let at = 0, remaining = oldStats.HP * (1 + oldShield);
        for (let beat = 1; beat <= beats; beat++) {
          const to = Math.ceil(end * beat / beats);
          let damage = 0;
          while (at < to) damage += bolts[at++] * (1 - oldReduction);
          remaining = Math.max(0, remaining - damage);
          steps.push({ event, wave, damage, count: Math.ceil(to / bolts.length * event.bolts),
            hp: Math.min(oldStats.HP, remaining), shield: Math.max(0, remaining - oldStats.HP) });
        }
      });
      let i = 0;
      const step = () => {
        if (i >= steps.length) { this.settle(); return; }
        const e = steps[i];
        if (UI.vfx?.effectsEnabled()) {
          const stage = $('tribStage');
          stage.classList.remove('struck'); void stage.offsetWidth; stage.classList.add('struck');
          this.wait(() => stage.classList.remove('struck'), 360);
          if (world === 'ha_gioi') UI.vfx.effect('bolt', 'trib', { size: 'calc(var(--hero-size) * 2)' });
          else UI.vfx.tribStage({ kind: 'loi_kiep', variant: world, size: 'calc(var(--hero-size) * 2.3)' });
          UI.vfx.ring('trib', '#9adcff');
          UI.vfx.burst('trib', '#bceaff', 12);
          UI.vfx.floatNumber(e.damage, 'trib', 'damage');
          UI.vfx.screenFlash('flash-blue', 350);
        }
        $('tribCounter').textContent = `Đợt ${e.wave + 1}/${events.length} · ${e.count}/${e.event.bolts} đạo lôi`;
        $('tribStageHint').textContent = e.event.name;
        $('tribStatus').textContent = e.hp <= 0 ? 'Hộ thể vỡ · đạo cơ chấn động!' : e.shield > 0 ? 'Hộ thuẫn đang hấp thu lôi kiếp.' : 'Vận công hộ thể · giữ vững đạo tâm.';
        $('tribHpText').textContent = num(e.hp) + ' / ' + num(oldStats.HP);
        $('tribHpFill').style.width = clamp(e.hp / oldStats.HP * 100, 0, 100) + '%';
        $('tribShieldText').textContent = pct(e.shield / oldStats.HP) + ' sinh lực';
        $('tribShieldFill').style.width = clamp(e.shield / oldStats.HP * 100, 0, 100) + '%';
        this.progress((i + 1) / steps.length * 100);
        i++;
        this.wait(step, this.reduced ? 180 : 720);
      };
      if (!steps.length) this.wait(() => this.settle(), this.reduced ? 200 : 900);
      else this.wait(step, this.reduced ? 180 : 600);
    },
    settle() {
      if (!this.pageOpen || !['running', 'settling'].includes(this.phase)) return;
      this.phase = 'settling';
      $('tribStatus').textContent = 'Thiên lôi tàn · đạo cơ đang tái tạo...';
      $('tribStageHint').textContent = 'Thiên đạo phán quyết · linh quang tụ hội';
      $('tribStage').classList.remove('struck');
      const settleMs = this.reduced ? 220 : 5900;
      UI.vfx?.tribStage({ kind: this.result?.success ? 'dot_pha' : 'chien_dau', variant: this.result?.success ? 'ha_gioi' : 'linh_khi', fps: 10, loop: true, duration: settleMs });
      this.wait(() => this.finish(), settleMs);
    },
    finish() {
      if (!this.pageOpen || !['running', 'settling'].includes(this.phase)) return;
      this.clearTimers();
      this.phase = 'result';
      const result = this.result, s = UI.s(), g = UI.g(), world = this.world;
      $('tribStart').hidden = true;
      $('tribClose').hidden = true;
      $('tribReturn').hidden = false;
      $('tribBack').disabled = false;
      this.progress(100);
      $('tribResult').hidden = false;
      $('tribPrep').hidden = true;
      $('tribStage').classList.remove('is-running', 'struck');
      $('tribStage').classList.add('is-result');
      $('tribulationFx').dataset.phase = 'result';
      if (result?.success) {
        $('tribTitle').textContent = 'Đột phá thành công';
        $('tribEyebrow').textContent = 'Thiên đạo, đạo cơ tái tạo';
        $('tribSubtitle').textContent = g.realmLabel() + ' · cảnh giới mới đã mở';
        $('tribStatus').textContent = result.events.length ? 'Thiên kiếp đã qua, đạo cơ tái tạo.' : 'Đạo cơ đã thành · mở ra cảnh giới mới.';
        $('tribResult').className = 'trib-result success';
        const chaosNote = result.awaken
          ? `<p class="root-awaken">✦ Lôi kiếp tẩy luyện: <b>${esc(result.awaken.from)} linh căn</b> hóa thành <b>Hỗn Độn linh căn</b>!</p>`
          : '';
        $('tribResult').innerHTML = `<h3 class="gold">${esc(g.realmLabel())}</h3><p>Xác suất ${pct(result.chance)} · hộ kiếp còn lại đã tiêu hao. Cảnh giới mới mở ra trước mắt.</p>${chaosNote}`;
        if (result.awaken) UI.toast(result.awaken.from + ' linh căn hóa thành Hỗn Độn linh căn!', { type: 'gold', title: 'Linh căn thức tỉnh' });
        $('tribHpText').textContent = num(s.hp) + ' / ' + num(g.stats().HP);
        $('tribHpFill').style.width = clamp(s.hp / g.stats().HP * 100, 0, 100) + '%';
        $('tribShieldText').textContent = 'Đã tiêu hao';
        $('tribShieldFill').style.width = '0%';
        $('tribStage').classList.add('is-success');
        $('tribStageHint').textContent = 'Thiên đạo công nhận · đạo cơ tái tạo';
        if (A.vfxCount('phi_thang', world)) UI.vfx?.tribStage({ kind: 'phi_thang', variant: world, fps: 10, size: 'calc(var(--hero-size) * 2.4)' });
        else UI.vfx?.effect('break', 'trib', { fps: 10 });
        UI.vfx?.burst('trib', '#ffe29a', 24);
        UI.vfx?.ring('trib');
        UI.vfx?.screenFlash('flash-gold', 900);
      } else if (result?.died) {
        $('tribTitle').textContent = 'Đột phá thất bại';
        $('tribEyebrow').textContent = 'Thiên đạo, lôi kiếp vô tình';
        $('tribSubtitle').textContent = g.realmLabel() + ' · đạo cơ chấn động';
        $('tribStatus').textContent = 'Hộ kiếp vỡ, đạo cơ chấn động.';
        $('tribResult').className = 'trib-result failure';
        $('tribResult').innerHTML = `<h3 class="danger">Tọa hóa</h3><p>Hộ kiếp không đủ sức chịu lôi kiếp nên đạo thân mất mạng vĩnh viễn. Kiếp này chấm dứt, không có lần thử lại.</p>`;
        $('tribHpText').textContent = num(s.hp) + ' / ' + num(g.stats().HP);
        $('tribHpFill').style.width = clamp(s.hp / g.stats().HP * 100, 0, 100) + '%';
        $('tribShieldText').textContent = 'Đã tiêu hao';
        $('tribShieldFill').style.width = '0%';
        $('tribStage').classList.add('is-failure');
        $('tribStageHint').textContent = 'Lôi kiếp xuyên thấu · đạo cơ tổn hại';
        UI.vfx?.effect('hit', 'trib');
        UI.vfx?.screenFlash('flash-red', 700);
      } else {
        $('tribTitle').textContent = 'Đột phá chưa thành';
        $('tribEyebrow').textContent = 'Thiên đạo, đạo tâm chưa viên';
        $('tribSubtitle').textContent = g.realmLabel() + ' · đạo cơ chấn động';
        $('tribStatus').textContent = 'Lôi kiếp đã qua, nhưng đạo cơ chưa chuyển hóa.';
        $('tribResult').className = 'trib-result failure';
        $('tribResult').innerHTML = `<h3 class="danger">Tu vi tổn hại</h3><p>Đạo thân giữ được mạng nhưng mất ${pct(F.P.FAIL_EXP_LOSS)} tu vi. May mắn đột phá tích lũy thêm; lần sau xác suất sẽ cao hơn.</p>`;
        $('tribHpText').textContent = num(s.hp) + ' / ' + num(g.stats().HP);
        $('tribHpFill').style.width = clamp(s.hp / g.stats().HP * 100, 0, 100) + '%';
        $('tribShieldText').textContent = 'Đã tiêu hao';
        $('tribShieldFill').style.width = '0%';
        $('tribStage').classList.add('is-failure');
        $('tribStageHint').textContent = 'Phá cảnh chưa thành · tiếp tục tích lũy';
        UI.vfx?.effect('hit', 'trib');
        UI.vfx?.screenFlash('flash-red', 420);
      }
      $('tribRealmChip').textContent = g.realmLabel();
      this.actor = { gender: s.gender, realm: s.realm };
      this.heroFrame();
      const events = result?.events || [];
      $('tribHeadTags').innerHTML = `<span>${pct(result.chance)} xác suất</span><span>${result.died ? 'Hộ kiếp vỡ = tọa hóa' : result.success ? 'Thiên kiếp đã qua' : 'Lỡ xác suất = mất tu vi'}</span><span>${events.reduce((n, e) => n + e.bolts, 0)} đạo lôi</span><span>Hộ kiếp đã tiêu hao</span>`;
      $('tribOverlayChance').textContent = pct(result?.chance ?? g.chance());
      $('tribReduction').textContent = pct(s.reduction);
      $('tribShieldSummary').textContent = 'Đã tiêu hao';
      $('tribPitySummary').textContent = s.pity + '/15';
      $('tribCounter').textContent = result.success ? 'Đạo tâm bất diệt' : 'Tĩnh tâm dưỡng sức';
      this.updateQi();
      $('tribEligibility').textContent = result.success ? 'Kết quả đã lưu · trở lại tu luyện.'
        : result.died ? 'Đạo thân đã tọa hóa · khép lại kiếp này.'
          : 'Đạo thân còn sống · tiếp tục tích lũy tu vi và may mắn đột phá.';
      $('tribResult').focus({ preventScroll: true });
      store.write();
    },
    updatePage(force = false) {
      if (!this.pageOpen || this.active) return;
      const sig = UI.screens.tribulation?.signature?.() || '';
      if (force || sig !== this.sig) { this.renderPrep(); return; }
      const s = UI.s(), g = UI.g(), can = this.canStart();
      $('tribOverlayChance').textContent = pct(g.chance());
      $('tribReduction').textContent = pct(s.reduction);
      $('tribShieldSummary').textContent = pct(s.shield) + ' sinh lực';
      $('tribPitySummary').textContent = s.pity + '/15';
      $('tribStart').disabled = !can;
      this.updateQi();
      const hp = g.stats().HP;
      $('tribHpText').textContent = num(s.hp) + ' / ' + num(hp);
      $('tribHpFill').style.width = clamp(s.hp / hp * 100, 0, 100) + '%';
    },
    refreshPage() { this.updatePage(true); }
  };
  UI.tribulation = trib;
})(typeof window !== 'undefined' ? window : globalThis);
