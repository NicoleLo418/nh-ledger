// Google Sheets access through a service account, plus an in-memory twin used by tests and local dev.
import { TABS, REPORT_TABS, DATA_START_ROW, colLetter, objToRow } from './schema.js';

const b64url = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
function pemToDer(pem) { const body = String(pem).replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''); const bin = atob(body); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }

export async function googleJwt(email, keyPem, scope, nowSec) {
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iss: email, scope, aud: 'https://oauth2.googleapis.com/token', iat: nowSec, exp: nowSec + 3600 })}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(keyPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(new Uint8Array(sig))}`;
}

// 服務帳號：可以整份 JSON 放進 GOOGLE_SA_JSON，或分開放 GOOGLE_SA_EMAIL / GOOGLE_SA_KEY
export function serviceAccount(env) {
  if (env.GOOGLE_SA_JSON) {
    let j; try { j = JSON.parse(env.GOOGLE_SA_JSON); } catch { throw new Error('GOOGLE_SA_JSON 不是完整的 JSON'); }
    if (!j.client_email || !j.private_key) throw new Error('GOOGLE_SA_JSON 缺少 client_email 或 private_key');
    return { email: j.client_email, key: j.private_key };
  }
  return { email: env.GOOGLE_SA_EMAIL, key: env.GOOGLE_SA_KEY };
}

const q = (name) => `'${name}'`;
const tokenCache = { value: '', exp: 0 };

export class GoogleSheets {
  constructor(env, fetchImpl = (...a) => fetch(...a)) { this.env = env; this.fetch = (...a) => fetchImpl(...a); this.id = env.SHEET_ID; }

  async token() {
    const now = Math.floor(Date.now() / 1000);
    if (tokenCache.value && tokenCache.exp - 60 > now) return tokenCache.value;
    const sa = serviceAccount(this.env);
    let jwt;
    try { jwt = await googleJwt(sa.email, sa.key, 'https://www.googleapis.com/auth/spreadsheets', now); }
    catch (e) { throw new Error('服務帳號金鑰格式錯誤（private_key 讀不出來）'); }
    const res = await this.fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}` });
    if (!res.ok) { let code = ''; try { code = (await res.json()).error || ''; } catch {} throw new Error(`Google 登入失敗（${res.status} ${String(code).slice(0, 40)}）`); }
    const j = await res.json();
    tokenCache.value = j.access_token; tokenCache.exp = now + (j.expires_in || 3600);
    return tokenCache.value;
  }

  async api(path, init = {}) {
    const res = await this.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.id}${path}`, { ...init, headers: { authorization: `Bearer ${await this.token()}`, 'content-type': 'application/json' } });
    if (!res.ok) throw new Error(`試算表存取失敗（${res.status}）：${(await res.text()).slice(0, 200)}`);
    return res.json();
  }

  async readAll() {
    const keys = Object.keys(TABS);
    const ranges = keys.map((k) => `${q(TABS[k].name)}!A1:${colLetter(TABS[k].cols.length)}`);
    const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
    const j = await this.api(`/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`);
    const out = {};
    keys.forEach((k, i) => { out[k] = (j.valueRanges && j.valueRanges[i] && j.valueRanges[i].values) || []; });
    return out;
  }

  async append(tabKey, obj) {
    const range = encodeURIComponent(`${q(TABS[tabKey].name)}!A${DATA_START_ROW}`);
    await this.api(`/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: [objToRow(tabKey, obj)] }) });
  }

  async updateRow(tabKey, rowNum, obj) {
    const t = TABS[tabKey];
    const range = encodeURIComponent(`${q(t.name)}!A${rowNum}:${colLetter(t.cols.length)}${rowNum}`);
    await this.api(`/values/${range}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [objToRow(tabKey, obj)] }) });
  }

  async writeReports(rep) {
    const map = { [REPORT_TABS.overview]: rep.overview, [REPORT_TABS.holdings]: rep.holdings, [REPORT_TABS.positions]: rep.positions };
    await this.api('/values:batchClear', { method: 'POST', body: JSON.stringify({ ranges: Object.keys(map).map((n) => `${q(n)}!A2:Z1000`) }) });
    await this.api('/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: Object.entries(map).map(([n, values]) => ({ range: `${q(n)}!A2`, values })) }) });
  }
}

// Same interface, kept in memory: tests and `wrangler dev` with FAKE_SHEETS=true.
export class FakeSheets {
  constructor(seed = {}) {
    this.tabs = {};
    for (const k of Object.keys(TABS)) this.tabs[k] = [['請回到帳本網頁修改'], TABS[k].cols.slice(), ...(seed[k] || []).map((o) => objToRow(k, o))];
    this.reports = null; this.calls = [];
  }
  async readAll() { this.calls.push('readAll'); const o = {}; for (const k of Object.keys(this.tabs)) o[k] = this.tabs[k].map((r) => r.slice()); return o; }
  async append(k, obj) { this.calls.push(`append:${k}`); this.tabs[k].push(objToRow(k, obj)); }
  async updateRow(k, rowNum, obj) { this.calls.push(`update:${k}:${rowNum}`); this.tabs[k][rowNum - 1] = objToRow(k, obj); }
  async writeReports(rep) { this.calls.push('reports'); this.reports = rep; }
}
