import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { transform } from 'esbuild';
import staticFiles from './tools/ci-server/static.js';
import media from './tools/pack-media.cjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const scripts = JSON.parse(fs.readFileSync(new URL('./client/classic-scripts.json', import.meta.url), 'utf8'));
const cspSlot = '%HU_SUPABASE_CSP%';

function jwtRole(key) {
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role; }
  catch { return undefined; }
}

export default defineConfig(({ mode, command }) => {
  const names = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'HCAPTCHA_SITEKEY'];
  const env = loadEnv(mode, root, [...names, ...names.map(name => 'VITE_' + name)]);
  const value = name => (env['VITE_' + name] ?? env[name] ?? '').trim();
  const url = value('SUPABASE_URL').replace(/\/+$/, '');
  const key = value('SUPABASE_PUBLISHABLE_KEY');
  const captcha = value('HCAPTCHA_SITEKEY');
  if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))
    throw new Error('VITE_SUPABASE_URL phải là https://<project>.supabase.co');
  if (key && !/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key) && jwtRole(key) !== 'anon')
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY phải là khóa publishable hoặc anon JWT.');
  if (key.startsWith('sb_secret_'))
    throw new Error('Không dùng khóa bí mật cho frontend.');
  if (captcha && !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(captcha))
    throw new Error('VITE_HCAPTCHA_SITEKEY không hợp lệ.');

  const minify = mode !== 'readable';
  const withCsp = html => html.replaceAll(cspSlot, url);
  return {
    root,
    publicDir: false,
    envPrefix: [],
    define: Object.fromEntries([url, key, captcha].map((value, index) => [
      'import.meta.env.VITE_' + names[index], JSON.stringify(value)
    ])),
    build: { minify, cssMinify: minify, assetsInlineLimit: 0, target: 'es2020' },
    plugins: [{
      name: 'hu-classic-frontend',
      resolveId(id) {
        if (id === 'virtual:hu-classic-scripts') return '\0' + id;
      },
      load(id) {
        if (id === '\0virtual:hu-classic-scripts')
          return 'export default ' + JSON.stringify(scripts.map(file => '/' + file));
      },
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          // Dev HMR uses a same-origin WebSocket. Production keeps the original policy.
          const page = withCsp(html);
          return command === 'serve'
            ? page.replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:* ws://localhost:*")
            : page;
        }
      },
      async writeBundle(options) {
        const out = options.dir;
        const copy = (rel, contents) => {
          const dest = path.join(out, rel);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          if (contents === undefined) fs.copyFileSync(path.join(root, rel), dest);
          else fs.writeFileSync(dest, contents);
        };
        const { ALLOWED, DENIED_PART, DENIED_PATH } = staticFiles;
        function copyMedia(dir) {
          for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
            const rel = dir + '/' + entry.name;
            const url = '/' + rel;
            if (DENIED_PART.test(url) || DENIED_PATH.test(url)) continue;
            if (entry.isDirectory()) copyMedia(rel);
            else if (entry.isFile() && ALLOWED.test(url)) copy(rel);
          }
        }
        copyMedia('media');
        for (const file of ['css/legal.css', 'client/legal/privacy.html', 'client/legal/release.html'])
          copy(file);
        media.packMedia({ root, out });
        await Promise.all(scripts.map(async file => {
          const allowed = ALLOWED.test('/' + file) && !DENIED_PART.test('/' + file)
            && !DENIED_PATH.test('/' + file);
          if (!allowed || !/^(client|data|engine)\/[\w/-]+\.js$/.test(file))
            throw new Error('Invalid classic script path: ' + file);
          const source = fs.readFileSync(file === 'client/assets/packs.js'
            ? path.join(out, file) : path.join(root, file), 'utf8');
          const code = minify ? (await transform(source, { minify, target: 'es2020' })).code : source;
          copy(file, code);
        }));
        copy('_headers', withCsp(fs.readFileSync(path.join(root, '_headers'), 'utf8')));
      }
    }]
  };
});
