const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const origin = 'http://127.0.0.1:8001';
const fixture = 'https://ci-fixture.supabase.co';
const output = path.resolve(process.env.AUTH_MENU_SCREENSHOTS || '../reports/auth-menu-screens');
const sizes = [[320,568], [360,640], [390,844], [768,1024], [1024,768], [1366,768], [844,390]];

async function smoke(browser, width, height) {
  const label = width + 'x' + height;
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', acceptDownloads: false });
  const problems = [];
  let gameRequests = 0;
  const token = 'ci-access-token-' + randomUUID();
  const cors = {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'apikey, authorization, content-type, x-request-id, prefer'
  };
  try {
    await context.routeWebSocket('**/*', socket => {
      problems.push('Unexpected WebSocket');
      socket.close();
    });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      try {
        if (url.origin === origin) return await route.continue();
        if (url.origin !== fixture) throw Error('External request blocked: ' + url.origin);
        if (request.method() === 'OPTIONS') return await route.fulfill({ status: 204, headers: cors });
        if (url.pathname.startsWith('/functions/v1/api/')) {
          const target = new URL(origin);
          target.pathname = url.pathname.replace('/functions/v1/api/', '/api/v1/');
          target.search = url.search;
          assert.ok(await request.headerValue('authorization') === 'Bearer ' + token, 'Missing fixture authorization');
          gameRequests++;
          const response = await route.fetch({ url: target.href, maxRedirects: 0 });
          if (response.status() >= 300 && response.status() < 400) throw Error('Unexpected API redirect');
          return await route.fulfill({ response, headers: { ...response.headers(), ...cors } });
        }
        const handlers = {
          'POST /auth/v1/token': { access_token: token, refresh_token: 'ci-refresh', expires_in: 3600 },
          'GET /auth/v1/user': { id: '11111111-2222-4333-8444-555555555555', email: 'ci@example.invalid' },
          'GET /rest/v1/policy_acceptances': [{ policy_kind: 'privacy' }, { policy_kind: 'release_terms' }],
          'POST /auth/v1/logout': {}
        };
        const key = request.method() + ' ' + url.pathname;
        if (!Object.hasOwn(handlers, key)) throw Error('Unexpected fixture request: ' + key);
        await route.fulfill({ headers: cors, json: handlers[key] });
      } catch (error) {
        problems.push(error.message);
        await route.abort().catch(() => {});
      }
    });

    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    let phase = 'initial load';
    page.on('requestfailed', request => {
      problems.push(phase + ': ' + request.failure().errorText + ' ' + new URL(request.url()).pathname);
    });
    page.on('pageerror', error => problems.push('Page error: ' + error.message));
    page.on('console', message => {
      if (message.type() === 'error' || /content.security.policy|violates.*directive/i.test(message.text()))
        problems.push('Console: ' + message.text());
    });
    page.on('response', response => {
      if (response.status() >= 300 && response.status() !== 304)
        problems.push(phase + ': HTTP ' + response.status() + ' ' + new URL(response.url()).pathname);
    });
    async function booted() {
      await page.waitForFunction(() => window.HU_UI?.booted === true && !!window.HU_AUTH);
      await page.locator('#loading').waitFor({ state: 'hidden' });
    }
    const screens = ['#authGate', '#mainMenu', '#welcome', '#game'];
    async function screen(selector) {
      await page.locator(selector).waitFor({ state: 'visible' });
      for (const other of screens.filter(id => id !== selector))
        assert.equal(await page.locator(other).isVisible(), false, other + ' also visible');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
    }
    async function reachable(selector) {
      const control = page.locator(selector);
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 &&
        box.y + box.height <= height + 1, selector + ' clipped');
      assert.ok(await control.evaluate(el => {
        const box = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      }), selector + ' covered or clipped by a scroll container');
    }
    const shot = name => page.screenshot({ path: path.join(output, label + '-' + name + '.png') });

    await page.goto(origin);
    await booted();
    await screen('#authGate');
    await shot('login');
    await reachable('#authSubmit');
    await page.locator('#authSignupTab').click();
    await screen('#authGate');
    await shot('signup');
    for (const id of ['#authConfirm', '#authPrivacy', '#authRelease', '#authSubmit', '#authGoogle'])
      await reachable(id);
    await page.locator('#authLoginTab').click();
    await page.locator('#authEmail').fill('ci@example.invalid');
    await page.locator('#authPassword').fill('ci-test-password-1234');
    await page.locator('#authSubmit').click();
    await screen('#mainMenu');
    assert.ok(gameRequests > 0, 'Production game API was not routed through the fixture');
    await shot('menu');
    assert.deepEqual(await page.locator('#mainMenu nav button:visible').allTextContents(),
      ['Bước vào Hư giới', 'Thiết lập thế giới', 'Trở về Lam Tinh']);
    await reachable('#menuExit');
    await reachable('#menuSettings');
    await page.locator('#menuSettings').click();
    await reachable('#menuReduceMotion');
    await reachable('#menuSettingsBack');
    await page.locator('#menuReduceMotion').check();
    await shot('settings');
    await page.keyboard.press('Escape');
    await page.locator('#menuSettingsDialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#menuSettings').evaluate(el => el === document.activeElement), true);
    await reachable('#menuStart');
    await page.locator('#menuStart').click();
    await screen('#welcome');
    assert.equal(await page.locator('.scene-photo').evaluate(el => getComputedStyle(el).animationName), 'none');
    await shot('create');
    await reachable('#startNew');
    await reachable('#backToMenu');
    await page.locator('#backToMenu').click();
    await screen('#mainMenu');
    phase = 'session restore reload';
    await page.reload();
    await booted();
    await screen('#mainMenu');
    await page.locator('#menuSettings').click();
    assert.equal(await page.locator('#menuReduceMotion').isChecked(), true);
    await page.locator('#menuSettingsBack').click();
    assert.equal(await page.locator('#menuSettingsDialog').isVisible(), false);
    await page.locator('#menuExit').click();
    await screen('#authGate');
    phase = 'signed-out reload';
    await page.reload();
    await booted();
    await screen('#authGate');
    assert.equal(await page.evaluate(() => window.HU_SUPABASE.hasSession()), false);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
  } catch (error) {
    problems.push(error.message);
  } finally {
    await context.close();
  }
  return { viewport: label, passed: problems.length === 0, problems };
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const results = [];
  let browser, startupError;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN });
    for (const [width, height] of sizes) {
      const result = await smoke(browser, width, height);
      results.push(result);
      console.log(result.viewport + ': ' + (result.passed ? 'PASS' : 'FAIL'));
    }
  } catch (error) {
    startupError = error.message;
  } finally {
    await browser?.close();
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ origin, startupError, results }, null, 2) + '\n');
  }
  if (startupError || results.length !== sizes.length || results.some(result => !result.passed)) process.exitCode = 1;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
