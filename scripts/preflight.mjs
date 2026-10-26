// 部署前檢查：DEV_MODE 必須關閉、不能留佔位字、程式碼裡不能有金鑰
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const errors = [];
const warnings = [];
const toml = readFileSync('worker/wrangler.toml', 'utf8');
const cfg = readFileSync('web/config.js', 'utf8');

if (!/^\s*DEV_MODE\s*=\s*"false"/m.test(toml)) errors.push('wrangler.toml 的 DEV_MODE 不是 "false"');
if (!/^\s*ENVIRONMENT\s*=\s*"production"/m.test(toml)) errors.push('wrangler.toml 的 ENVIRONMENT 不是 "production"');
if (!/^\s*FAKE_SHEETS\s*=\s*"false"/m.test(toml)) errors.push('wrangler.toml 的 FAKE_SHEETS 不是 "false"');
// 必填：沒填就不部署
const required = [
  [toml, /GITHUB_USER/, 'wrangler.toml 的 ALLOWED_ORIGIN（GitHub 帳號）'],
  [cfg, /WORKERS_SUBDOMAIN/, 'config.js 的 api（workers.dev 子網域）'],
];
for (const [text, re, label] of required) if (re.test(text)) errors.push(`還沒填：${label}`);
// LINE 設定：沒填時沒有人能登入（安全地失敗），可以先部署；正式上線前必須填（STRICT=1 時視為錯誤）
const line = [
  [toml, /LINE_CHANNEL_ID\s*=\s*"(LINE_CHANNEL_ID)?"/, 'wrangler.toml 的 LINE_CHANNEL_ID'],
  [cfg, /liffId:\s*'(LIFF_ID)?'/, 'config.js 的 liffId'],
];
for (const [text, re, label] of line) if (re.test(text)) (process.env.STRICT === '1' ? errors : warnings).push(`還沒填：${label}`);

const secretPatterns = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /"private_key"\s*:/, /AIza[0-9A-Za-z_-]{30,}/];
function walk(dir) {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === '.git') continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|mjs|html|toml|json|md|yml)$/.test(f) && !p.endsWith('preflight.mjs')) {
      const s = readFileSync(p, 'utf8');
      for (const re of secretPatterns) if (re.test(s)) errors.push(`${p} 疑似含有金鑰`);
    }
  }
}
walk('.');

if (warnings.length) console.warn('⚠ 提醒（上線前要處理）：\n- ' + warnings.join('\n- '));
if (errors.length) { console.error('❌ 上線前檢查沒過：\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('✅ 上線前檢查通過');
