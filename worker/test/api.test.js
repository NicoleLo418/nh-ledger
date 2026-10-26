import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, updatePrices } from '../src/app.js';
import { FakeSheets } from '../src/sheets.js';
import { pinHash } from '../src/core.js';
import { parseTwse, parseTpex, parseTpexOpenApi, parseMis, rocToIso, fetchCloses } from '../src/prices.js';

const ORIGIN = 'https://nicole.github.io';
const CH = '2000000001';
const NOW = Date.parse('2026-10-26T10:00:00Z'); // 18:00 Taipei
const env = (x = {}) => ({ ENVIRONMENT: 'production', DEV_MODE: 'false', ALLOWED_ORIGIN: ORIGIN, LINE_CHANNEL_ID: CH, PIN_PEPPER: 'test-pepper', ...x });

const TOKENS = { 'tok-nicole': 'U-nicole', 'tok-hsiao': 'U-hsiao', 'tok-pending': 'U-pending', 'tok-disabled': 'U-disabled', 'tok-stranger': 'U-stranger' };
const lineFetch = async (url, init) => {
  if (url !== 'https://api.line.me/oauth2/v2.1/verify') throw new Error('unexpected fetch ' + url);
  const p = new URLSearchParams(init.body); const tok = p.get('id_token');
  if (tok === 'tok-expired') return new Response(JSON.stringify({ sub: 'U-nicole', aud: CH, name: 'x', exp: Math.floor(NOW / 1000) - 600 }), { status: 200 });
  if (tok === 'tok-other-channel') return new Response(JSON.stringify({ sub: 'U-nicole', aud: '999', name: 'x' }), { status: 200 });
  if (!TOKENS[tok]) return new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400 });
  return new Response(JSON.stringify({ sub: TOKENS[tok], aud: CH, name: tok.slice(4), exp: Math.floor(NOW / 1000) + 3600 }), { status: 200 });
};

async function seed() {
  const salt = 'abc123';
  const hash = await pinHash('2468', salt, 'test-pepper');
  return new FakeSheets({
    members: [
      { lineId: 'U-nicole', lineName: 'Nicole', name: 'Nicole', role: '管理者', status: '已核准', appliedAt: '2026-10-26 09:00:00' },
      { lineId: 'U-hsiao', lineName: 'HSIAO', name: 'HSIAO', role: '成員', status: '已核准', appliedAt: '2026-10-26 09:05:00' },
      { lineId: 'U-pending', lineName: '王小明', name: '', role: '成員', status: '待核准', appliedAt: '2026-10-26 09:10:00' },
      { lineId: 'U-disabled', lineName: '舊帳號', name: '', role: '成員', status: '停用', appliedAt: '2026-10-26 09:20:00' },
    ],
    settings: [{ key: '目標金額', value: 1000000 }, { key: '起始日', value: '2026-10-26' }, { key: '目標日', value: '2028-10-26' }, { key: '密碼雜湊', value: `${salt}:${hash}` }],
    trades: [
      { id: 'T-1', date: '2026-10-20', side: '買進', code: '0050', name: '元大台50', shares: 100, price: 107.3, fee: 2, tax: 0, cashflow: -10732, by: 'Nicole', createdAt: '2026-10-26 13:05:04', deleted: false },
      { id: 'T-2', date: '2026-10-22', side: '買進', code: '0050', name: '元大台50', shares: 100, price: 107, fee: 2, tax: 0, cashflow: -10702, by: 'Nicole', createdAt: '2026-10-26 13:05:31', deleted: false },
    ],
    cash: [
      { id: 'C-1', date: '2026-10-20', type: '存入', perPerson: 15000, total: 30000, amount: 0, createdAt: '2026-10-26 13:00:53', deleted: false },
      { id: 'C-2', date: '2026-10-26', type: '存入', perPerson: 30000, total: 60000, amount: 0, createdAt: '2026-10-26 14:24:46', deleted: false },
    ],
  });
}

let rid = 0;
const reqId = () => `req-test-${++rid}-abcdef`;
async function call(sheets, method, path, { token, body, origin = ORIGIN, e = env(), headers = {} } = {}) {
  const h = { origin, 'content-type': 'application/json', ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  const res = await handle(new Request('https://api.example' + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined }), e, { sheets, fetchImpl: lineFetch, now: () => NOW, waitUntil: (p) => p });
  return { status: res.status, body: await res.json() };
}
const writes = (s) => s.calls.filter((c) => c !== 'readAll');
const leaks = (b) => ['trades', 'cash', 'ledger', 'members', 'settings', 'prices'].some((k) => k in b);

const ENDPOINTS = [
  ['GET', '/api/ledger', null],
  ['GET', '/api/members', null],
  ['POST', '/api/pin/verify', { pin: '2468' }],
  ['POST', '/api/pin/set', { pin: '1111', current: '2468', requestId: 'req-perm-pin' }],
  ['POST', '/api/trades/save', { requestId: 'req-perm-1', trade: { date: '2026-10-26', side: 'buy', code: '2330', name: '台積電', shares: 1, price: 1000, fee: 20, tax: 0, by: 'Nicole' } }],
  ['POST', '/api/trades/delete', { requestId: 'req-perm-2', id: 'T-1' }],
  ['POST', '/api/cash/save', { requestId: 'req-perm-3', entry: { date: '2026-10-26', type: 'in', perPerson: 1000 } }],
  ['POST', '/api/cash/delete', { requestId: 'req-perm-4', id: 'C-1' }],
  ['POST', '/api/settings', { requestId: 'req-perm-5', settings: { goal: 2000000, start: '2026-10-26', end: '2028-10-26', discount: 1, minFee: 20 } }],
  ['POST', '/api/members/update', { requestId: 'req-perm-6', userId: 'U-pending', status: 'approved', name: '小明' }],
];

for (const [who, token, expect] of [['未登入', null, 401], ['無效憑證', 'tok-bad', 401], ['別的 LINE channel', 'tok-other-channel', 401], ['過期憑證', 'tok-expired', 401], ['待核准', 'tok-pending', 403], ['停用', 'tok-disabled', 403], ['不在名單', 'tok-stranger', 403]]) {
  test(`權限：${who} 呼叫每個 API 都拿不到資料、也寫不進去`, async () => {
    for (const [m, p, b] of ENDPOINTS) {
      const s = await seed();
      const r = await call(s, m, p, { token, body: b });
      assert.equal(r.status, expect, `${m} ${p}`);
      assert.ok(!leaks(r.body), `${m} ${p} 不應回傳帳本資料`);
      assert.deepEqual(writes(s), [], `${m} ${p} 不應寫入`);
    }
  });
}

test('權限：一般成員不能看成員名單、不能核准成員', async () => {
  const s = await seed();
  assert.equal((await call(s, 'GET', '/api/members', { token: 'tok-hsiao' })).status, 403);
  const r = await call(s, 'POST', '/api/members/update', { token: 'tok-hsiao', body: { requestId: reqId(), userId: 'U-pending', status: 'approved', name: '小明' } });
  assert.equal(r.status, 403);
  assert.deepEqual(writes(s), []);
});

test('權限：管理者可以核准，被核准的人才看得到帳本', async () => {
  const s = await seed();
  assert.equal((await call(s, 'GET', '/api/ledger', { token: 'tok-pending' })).status, 403);
  const r = await call(s, 'POST', '/api/members/update', { token: 'tok-nicole', body: { requestId: reqId(), userId: 'U-pending', status: 'approved', name: '小明' } });
  assert.equal(r.status, 200);
  assert.equal((await call(s, 'GET', '/api/ledger', { token: 'tok-pending' })).status, 200);
});

test('權限：管理者不能停用自己', async () => {
  const s = await seed();
  const r = await call(s, 'POST', '/api/members/update', { token: 'tok-nicole', body: { requestId: reqId(), userId: 'U-nicole', status: 'disabled' } });
  assert.equal(r.status, 400);
});

test('查詢狀態：待核准只看到自己的狀態', async () => {
  const s = await seed();
  const r = await call(s, 'GET', '/api/me', { token: 'tok-pending' });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ['name', 'role', 'status']);
  assert.equal(r.body.status, 'pending');
});

test('申請加入：陌生人變成待核准；名單是空的時候第一位成為管理者', async () => {
  const s = await seed();
  assert.equal((await call(s, 'POST', '/api/join', { token: 'tok-stranger', body: {} })).body.status, 'pending');
  assert.equal((await call(s, 'GET', '/api/ledger', { token: 'tok-stranger' })).status, 403);
  const empty = new FakeSheets();
  assert.equal((await call(empty, 'POST', '/api/join', { token: 'tok-nicole', body: { name: 'Nicole' } })).body.status, 'member');
  assert.equal((await call(empty, 'POST', '/api/join', { token: 'tok-hsiao', body: {} })).body.status, 'pending');
});

test('來源：其他網站呼叫一律拒絕', async () => {
  const s = await seed();
  const r = await call(s, 'GET', '/api/ledger', { token: 'tok-nicole', origin: 'https://evil.example' });
  assert.equal(r.status, 403);
  assert.ok(!leaks(r.body));
});

test('DEV_MODE：正式環境開啟時拒絕服務；正式環境不吃開發用身分', async () => {
  const s = await seed();
  assert.equal((await call(s, 'GET', '/api/ledger', { token: 'tok-nicole', e: env({ DEV_MODE: 'true' }) })).status, 500);
  const r = await call(s, 'GET', '/api/ledger', { headers: { 'x-dev-user': 'U-nicole' } });
  assert.equal(r.status, 401);
});

test('讀取帳本：不含已刪除紀錄、不含密碼雜湊', async () => {
  const s = await seed();
  await call(s, 'POST', '/api/trades/delete', { token: 'tok-nicole', body: { requestId: reqId(), id: 'T-2' } });
  const r = await call(s, 'GET', '/api/ledger', { token: 'tok-hsiao' });
  assert.deepEqual(r.body.trades.map((t) => t.id), ['T-1']);
  assert.ok(!JSON.stringify(r.body).includes('abc123'));
  assert.equal(r.body.pinSet, true);
});

test('資料檢查：未來日期、負數、賣超、買進帶稅、超長備註、非成員下單人都被拒絕', async () => {
  const base = { date: '2026-10-26', side: 'buy', code: '2330', name: '台積電', shares: 10, price: 1000, fee: 20, tax: 0, by: 'Nicole' };
  const cases = [{ date: '2026-10-27' }, { shares: -1 }, { shares: 1.5 }, { price: 0 }, { price: 10.123 }, { tax: 5 }, { note: 'x'.repeat(201) }, { by: '王小明' }, { code: '00 50' }, { side: 'hold' }];
  for (const c of cases) {
    const s = await seed();
    const r = await call(s, 'POST', '/api/trades/save', { token: 'tok-nicole', body: { requestId: reqId(), trade: { ...base, ...c } } });
    assert.equal(r.status, 400, JSON.stringify(c));
    assert.deepEqual(writes(s), [], JSON.stringify(c));
  }
  const s = await seed();
  const r = await call(s, 'POST', '/api/trades/save', { token: 'tok-nicole', body: { requestId: reqId(), trade: { ...base, side: 'sell', code: '0050', name: '元大台50', shares: 300, price: 110, tax: 99 } } });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'oversell');
});

test('資料檢查：刪除買進後會造成之前的賣出超賣，也要擋下', async () => {
  const s = await seed();
  assert.equal((await call(s, 'POST', '/api/trades/save', { token: 'tok-nicole', body: { requestId: reqId(), trade: { date: '2026-10-26', side: 'sell', code: '0050', name: '元大台50', shares: 150, price: 110, fee: 20, tax: 49, by: 'HSIAO' } } })).status, 200);
  const r = await call(s, 'POST', '/api/trades/delete', { token: 'tok-nicole', body: { requestId: reqId(), id: 'T-2' } });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'oversell');
});

test('資金：領出超過可用餘額要先確認', async () => {
  const s = await seed();
  const entry = { date: '2026-10-26', type: 'out', perPerson: 50000 };
  const r1 = await call(s, 'POST', '/api/cash/save', { token: 'tok-hsiao', body: { requestId: reqId(), entry } });
  assert.equal(r1.status, 409);
  assert.equal(r1.body.error, 'overdraw');
  const r2 = await call(s, 'POST', '/api/cash/save', { token: 'tok-hsiao', body: { requestId: reqId(), entry, confirmOverdraw: true } });
  assert.equal(r2.status, 200);
});

test('去重：同一個請求編號送兩次只記一筆', async () => {
  const s = await seed();
  const body = { requestId: 'req-dup-123456', entry: { date: '2026-10-26', type: 'in', perPerson: 1000 } };
  const a = await call(s, 'POST', '/api/cash/save', { token: 'tok-nicole', body });
  const b = await call(s, 'POST', '/api/cash/save', { token: 'tok-nicole', body });
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(b.body.duplicate, true);
  assert.equal(s.calls.filter((c) => c === 'append:cash').length, 1);
  assert.equal(b.body.ledger.cash.length, 3);
});

test('軟刪除與異動紀錄：資料還在、標記已刪除，前後內容都有記錄', async () => {
  const s = await seed();
  await call(s, 'POST', '/api/trades/save', { token: 'tok-hsiao', body: { requestId: reqId(), id: 'T-1', trade: { date: '2026-10-20', side: 'buy', code: '0050', name: '元大台灣50', shares: 100, price: 107.3, fee: 15, tax: 0, by: 'Nicole' } } });
  await call(s, 'POST', '/api/trades/delete', { token: 'tok-hsiao', body: { requestId: reqId(), id: 'T-2' } });
  const row = s.tabs.trades.find((r) => r[0] === 'T-2');
  assert.equal(row[16], true);
  assert.equal(row[17], 'HSIAO');
  const audits = s.tabs.audit.slice(2);
  assert.equal(audits.length, 2);
  assert.equal(audits[0][2], '修改');
  assert.equal(JSON.parse(audits[0][5]).fee, 2);
  assert.equal(JSON.parse(audits[0][6]).fee, 15);
  assert.equal(audits[1][2], '刪除');
  assert.equal(audits[1][1], 'HSIAO');
});

test('計算：用現有 4 筆真實資料，數字和舊帳本一致', async () => {
  const s = await seed();
  await call(s, 'POST', '/api/settings', { token: 'tok-nicole', body: { requestId: reqId(), settings: { goal: 1000000, start: '2026-10-26', end: '2028-10-26', discount: 1, minFee: 20 } } });
  const ov = Object.fromEntries(s.reports.overview.slice(1));
  assert.equal(ov['淨投入'], 90000);
  assert.equal(ov['可用餘額'], 68566);
  assert.equal(ov['持股市值'], 21400);
  assert.equal(ov['總資產'], 89966);
  assert.equal(ov['總損益'], -34);
  assert.deepEqual(s.reports.holdings[1].slice(0, 5), ['0050', '元大台50', 200, 107.17, 21434]);
});

test('密碼：正確通過、錯誤計次，連錯 5 次鎖 10 分鐘', async () => {
  const s = await seed();
  assert.equal((await call(s, 'POST', '/api/pin/verify', { token: 'tok-hsiao', body: { pin: '2468' } })).body.ok, true);
  for (let i = 0; i < 5; i++) assert.equal((await call(s, 'POST', '/api/pin/verify', { token: 'tok-hsiao', body: { pin: '0000' } })).body.ok, false);
  const r = await call(s, 'POST', '/api/pin/verify', { token: 'tok-hsiao', body: { pin: '2468' } });
  assert.equal(r.status, 429);
  assert.equal((await call(s, 'POST', '/api/pin/verify', { token: 'tok-nicole', body: { pin: '2468' } })).body.ok, true);
});

test('密碼：更換密碼要先輸入目前的密碼', async () => {
  const s = await seed();
  assert.equal((await call(s, 'POST', '/api/pin/set', { token: 'tok-hsiao', body: { requestId: reqId(), pin: '1357', current: '0000' } })).status, 403);
  assert.equal((await call(s, 'POST', '/api/pin/set', { token: 'tok-hsiao', body: { requestId: reqId(), pin: '1357', current: '2468' } })).status, 200);
  assert.equal((await call(s, 'POST', '/api/pin/verify', { token: 'tok-nicole', body: { pin: '1357' } })).body.ok, true);
});

test('收盤價：證交所與櫃買中心格式解析，欄位改變時報錯', () => {
  assert.equal(rocToIso('1151026'), '2026-10-26');
  assert.deepEqual(parseTwse([{ Date: '1151026', Code: '2330', Name: '台積電', ClosingPrice: '2,385.00' }, { Date: '1151026', Code: '9999', ClosingPrice: '' }]), { 2330: { close: 2385, date: '2026-10-26', market: '上市', name: '台積電' } });
  assert.equal(parseTpex({ date: '20261026', tables: [{ fields: ['代號', '名稱', '收盤 '], data: [['6488', '環球晶', '412.50'], ['1234', 'x', '----']] }] })['6488'].close, 412.5);
  assert.throws(() => parseTwse([{ Code: '2330', Price: '1' }]));
  assert.throws(() => parseTpex({ tables: [{ fields: ['股票', '價格'], data: [['1', '2']] }] }));
});

test('收盤價：排程只更新曾經交易過的股票，並重新產生報表', async () => {
  const s = await seed();
  const fetchImpl = async (url) => url.includes('twse')
    ? new Response(JSON.stringify([{ Date: '1151026', Code: '0050', Name: '元大台灣50', ClosingPrice: '106.90' }, { Date: '1151026', Code: '2330', Name: '台積電', ClosingPrice: '2385' }]))
    : new Response(JSON.stringify({ date: '20261026', tables: [{ fields: ['代號', '名稱', '收盤'], data: [] }] }));
  const r = await updatePrices(env(), { sheets: s, fetchImpl, now: () => NOW });
  assert.equal(r.updated, 1);
  assert.equal(s.tabs.prices.length, 3);
  assert.equal(s.tabs.prices[2][0], '0050');
  assert.equal(Object.fromEntries(s.reports.overview.slice(1))['持股市值'], 21380);
});

test('健康檢查：公開但不含任何帳本資料、不讀試算表', async () => {
  const sheets = await seed();
  let read = 0; const orig = sheets.readAll.bind(sheets); sheets.readAll = async () => { read++; return orig(); };
  const res = await handle(new Request('https://w/health'), env(), { sheets, fetchImpl: lineFetch, now: () => NOW });
  assert.equal(res.status, 200);
  const txt = await res.text();
  assert.equal(read, 0);
  for (const s of ['U-nicole', 'Nicole', 'HSIAO', '0050', '15000', '密碼']) assert.ok(!txt.includes(s), s);
  assert.deepEqual(JSON.parse(txt).config, { sheet: false, pin: true, line: true });
});

test('收盤價：櫃買中心 OpenAPI 解析；OpenAPI 失敗時改用網站資料', async () => {
  const rows = [{ Date: '1151026', SecuritiesCompanyCode: '6488', CompanyName: '環球晶', Close: '412.50' }, { Date: '1151026', SecuritiesCompanyCode: '1234', CompanyName: 'x', Close: '---' }];
  assert.deepEqual(parseTpexOpenApi(rows), { 6488: { close: 412.5, date: '2026-10-26', market: '上櫃', name: '環球晶' } });
  assert.throws(() => parseTpexOpenApi([{ foo: 1 }]));
  const okOpenApi = async (url) => url.includes('twse') ? new Response('[]') : url.includes('openapi') ? new Response(JSON.stringify(rows)) : new Response('', { status: 500 });
  assert.equal((await fetchCloses(okOpenApi)).closes['6488'].close, 412.5);
  const fallback = async (url) => url.includes('twse') ? new Response('[]') : url.includes('openapi') ? new Response('', { status: 403 })
    : new Response(JSON.stringify({ date: '20261026', tables: [{ fields: ['代號', '名稱', '收盤'], data: [['6488', '環球晶', '410']] }] }));
  const r = await fetchCloses(fallback);
  assert.equal(r.closes['6488'].close, 410);
  assert.deepEqual(r.errors, []);
  const bothFail = async (url) => url.includes('twse') ? new Response('[]') : new Response('', { status: 403 });
  assert.equal((await fetchCloses(bothFail)).errors.length, 1);
});

test('收盤價：行情系統補上櫃股票與較新的價格，只查持有過的代號', async () => {
  assert.deepEqual(parseMis({ msgArray: [{ c: '6488', n: '環球晶', z: '415.0', d: '20261023', ex: 'otc' }, { c: '0050', z: '-', d: '20261023', ex: 'tse' }] }), { 6488: { close: 415, date: '2026-10-23', market: '上櫃', name: '環球晶' } });
  assert.throws(() => parseMis({ foo: 1 }));
  let misUrl = '';
  const f = async (url) => {
    if (url.includes('mis.twse')) { misUrl = url; return new Response(JSON.stringify({ msgArray: [{ c: '0050', n: '元大台灣50', z: '107.50', d: '20261023', ex: 'tse' }, { c: '6488', n: '環球晶', z: '415', d: '20261023', ex: 'otc' }] })); }
    if (url.includes('openapi.twse')) return new Response(JSON.stringify([{ Date: '1151022', Code: '0050', Name: '元大台灣50', ClosingPrice: '106.90' }, { Date: '1151022', Code: '2330', Name: '台積電', ClosingPrice: '2385' }]));
    return new Response('', { status: 403 });
  };
  const r = await fetchCloses(f, new Set(['0050', '6488']));
  assert.equal(r.closes['0050'].close, 107.5);      // 行情系統日期較新 → 用它
  assert.equal(r.closes['6488'].market, '上櫃');     // 櫃買中心擋住時靠行情系統
  assert.equal(r.closes['2330'].close, 2385);       // 其他股票照用證交所
  assert.ok(decodeURIComponent(misUrl).includes('tse_0050.tw|otc_0050.tw|tse_6488.tw|otc_6488.tw'));
});

test('服務帳號：整份 JSON 或分開設定都能用，並能簽出 JWT', async () => {
  const { serviceAccount, googleJwt } = await import('../src/sheets.js');
  const { generateKeyPairSync } = await import('node:crypto');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const json = JSON.stringify({ type: 'service_account', client_email: 'nh@x.iam.gserviceaccount.com', private_key: pem });
  const sa = serviceAccount({ GOOGLE_SA_JSON: json });
  assert.equal(sa.email, 'nh@x.iam.gserviceaccount.com');
  const jwt = await googleJwt(sa.email, sa.key, 'scope', 1000);
  assert.equal(jwt.split('.').length, 3);
  assert.equal(serviceAccount({ GOOGLE_SA_EMAIL: 'a', GOOGLE_SA_KEY: 'b' }).email, 'a');
  assert.throws(() => serviceAccount({ GOOGLE_SA_JSON: '{"client_email":"a"' }));
});
