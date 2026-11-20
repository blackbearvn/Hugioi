// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const styles = source.match(/<link rel="stylesheet"[^>]+>/g).join('');
  const gate = source.match(/<section id="authGate"[\s\S]*?<\/section>/)[0];
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_BIN
  });
  try {
    const page = await browser.newPage();
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://auth.test') return route.abort();
      if (url.pathname === '/') return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${styles}${gate}
          <section id="welcome" hidden></section><section id="game" hidden></section>
          <button id="switchAccount" hidden></button><button id="accountExit" hidden></button>`
      });
      const asset = path.join(root, url.pathname);
      if (!fs.existsSync(asset)) return route.abort();
      return route.fulfill({ path: asset });
    });
    for (const [width, height] of [[320,568],[360,640],[390,844],[768,1024],[1024,768],[1366,768],[844,390]]) {
      await page.setViewportSize({ width, height });
      await page.goto('http://auth.test/');
      await page.evaluate(() => {
        window.HU_SUPABASE = {
          user: async () => null,
          validEmail: () => true,
          rememberOnThisDevice: value => { window.remembered = value; },
          signup: () => new Promise((resolve, reject) => { window.failSignup = reject; }),
          loginGoogle: async () => { throw Error('Lỗi Google mô phỏng'); }
        };
        window.HU_CAPTCHA = {
          enabled: true,
          token: () => 'fixture',
          mount: async container => {
            container.hidden = false;
            container.innerHTML = '<div style="width:303px;height:78px"><iframe title="CAPTCHA mô phỏng" width="303" height="78" style="border:0" srcdoc="<label><input type=checkbox> CAPTCHA mô phỏng</label>"></iframe></div>';
          }
        };
      });
      await page.addScriptTag({ path: path.join(root, 'client/auth/auth.js') });
      await page.evaluate(() => window.HU_AUTH.boot());
      const login = page.locator('#authLoginTab');
      const signup = page.locator('#authSignupTab');
      await login.focus();
      for (const [mode, controls] of [
        ['login', ['#authSubmit', '#authRemember', '#authGoogle']],
        ['signup', ['#authPrivacy', '#authRelease', '#authSubmit', '#authRemember', '#authGoogle']]
      ]) {
        if (mode === 'signup') {
          await page.keyboard.press('ArrowRight');
          assert.equal(await signup.getAttribute('aria-selected'), 'true');
          assert.equal(await login.getAttribute('tabindex'), '-1');
          assert.equal(await signup.evaluate(el => el === document.activeElement), true);
          await page.keyboard.press('Tab');
          assert.equal(await page.locator('#authEmail').evaluate(el => el === document.activeElement), true);
        }
        for (const selector of ['#authCaptcha iframe', ...controls]) {
          const locator = page.locator(selector);
          await locator.scrollIntoViewIfNeeded();
          const box = await locator.boundingBox();
          assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1 &&
            box.y >= -1 && box.y + box.height <= height + 1, `${width}x${height} ${mode} ${selector}: ${JSON.stringify(box)}`);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
        if (process.env.AUTH_SCREENSHOTS) {
          await page.screenshot({ path: path.join(process.env.AUTH_SCREENSHOTS, `auth-${width}x${height}-${mode}.png`), fullPage: true });
        }
      }
      await page.locator('#authEmail').fill('fixture@example.invalid');
      await page.locator('#authPassword').fill('fixture-password');
      await page.locator('#authConfirm').fill('fixture-password');
      await page.locator('#authPrivacy').check();
      await page.locator('#authRelease').check();
      await page.locator('#authRemember').check();
      await page.locator('#authSubmit').click();
      assert.ok(await page.locator('#authSubmit').isDisabled());
      assert.match(await page.locator('#authStatus').textContent(), /Đang gửi/);
      assert.equal(await page.evaluate(() => window.remembered), true);
      await page.evaluate(() => window.failSignup(Error('Lỗi đăng ký mô phỏng')));
      assert.match(await page.locator('#authMessage').textContent(), /Lỗi đăng ký/);
      assert.ok(await page.locator('#authSubmit').isEnabled());
      await page.locator('#authGoogle').click();
      assert.match(await page.locator('#authMessage').textContent(), /Lỗi Google/);
      await signup.focus();
      await page.keyboard.press('Home');
      assert.equal(await login.getAttribute('aria-selected'), 'true');
      console.log(`PASS ${width}x${height}`);
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
