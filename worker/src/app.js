// Request handling. Every decision about who may see or change what is made here, never in the browser.
import { parseAll, SIDE_TO_SHEET, TYPE_TO_SHEET, ROLE, STATUS, SETTING_KEYS } from './schema.js';
import { ApiError, taipei, randomId, settingsOf, approvedMembers, validateTrade, validateCash, checkHoldings, compute, reportRows, pinHash, newSalt, safeEqual } from './core.js';
import { fetchCloses } from './prices.js';

const REQ_RE = /^[A-Za-z0-9-]{8,64}$/;
const PIN_RE = /^\d{4}$/;
const LOCK_PREFIX = '密碼鎖定:';

export function devModeProblem(env) {
  return env.DEV_MODE === 'true' && env.ENVIRONMENT === 'production' ? 'DEV_MODE 不可在正式環境開啟' : '';
}

export async function verifyLineIdToken(idToken, channelId, fetchImpl, nowMs = Date.now()) {
  if (!idToken || !channelId) return null;
  const res = await fetchImpl('https://api.line.me/oauth2/v2.1/verify', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ id_token: idToken, client_id: channelId }).toString() });
  if (!res.ok) return null;
  const j = await res.json();
  if (!j || !j.sub || j.aud !== channelId) return null;
  if (j.exp && j.exp * 1000 < nowMs - 60000) return null;
  return { userId: String(j.sub), name: String(j.name || '') };
}

function cors(env, origin) {
  const h = { 'access-control-allow-headers': 'authorization, content-type, x-dev-user', 'access-control-allow-methods': 'GET, POST, OPTIONS', vary: 'origin' };
  if (origin && origin === env.ALLOWED_ORIGIN) h['access-control-allow-origin'] = origin;
  return h;
}
const json = (status, body, headers) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

async function identify(req, env, fetchImpl, nowMs) {
  if (env.DEV_MODE === 'true' && env.ENVIRONMENT !== 'production') {
    const u = req.headers.get('x-dev-user');
    if (u) return { userId: u, name: u };
  }
  const auth = req.headers.get('authorization') || '';
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return verifyLineIdToken(tok, env.LINE_CHANNEL_ID, fetchImpl, nowMs);
}

function publicLedger(D, me, nowMs) {
  const s = settingsOf(D.settings);
  const names = approvedMembers(D.members).map((m) => m.name);
  const trade = (t) => ({ id: t.id, date: t.date, side: t.side, code: t.code, name: t.name, shares: t.shares, price: t.price, fee: t.fee, tax: t.tax, cashflow: t.cashflow, by: t.by, note: t.note, createdAt: t.createdAt, createdBy: t.createdBy });
  const cash = (c) => ({ id: c.id, date: c.date, type: c.type, perPerson: c.perPerson, amount: c.amount, total: c.total, code: c.code, name: c.name, note: c.note, createdAt: c.createdAt, createdBy: c.createdBy });
  const prices = {}; for (const p of D.prices) prices[p.code] = { close: p.close, date: p.date, market: p.market };
  return {
    me: { name: me.name, role: me.role === ROLE.admin ? 'admin' : 'member' },
    names, pinSet: !!s.pinHash,
    settings: { goal: s.goal, start: s.start, end: s.end, discount: s.discount, minFee: s.minFee },
    trades: D.trades.filter((t) => !t.deleted).map(trade),
    cash: D.cash.filter((c) => !c.deleted).map(cash),
    prices, serverDate: taipei(nowMs).date,
  };
}

async function regenerateReports(sheets, D, nowMs) {
  const s = settingsOf(D.settings);
  const R = compute(D.trades, D.cash, D.prices, s, nowMs);
  await sheets.writeReports(reportRows(R, s, taipei(nowMs).stamp));
}

async function audit(sheets, D, { at, by, action, tab, targetId, before, after, requestId }) {
  const row = { at, by, action, tab, targetId, before: before ? JSON.stringify(before) : '', after: after ? JSON.stringify(after) : '', requestId };
  await sheets.append('audit', row);
  D.audit.push(row);
}

async function setSetting(sheets, D, key, value) {
  const row = D.settings.find((r) => String(r.key) === key);
  if (row) { row.value = value; await sheets.updateRow('settings', row._row, row); }
  else { const r = { key, value, _row: 3 + D.settings.length }; D.settings.push(r); await sheets.append('settings', r); }
}

const strip = (o) => { const c = { ...o }; delete c._row; return c; };

let sourceCache = null;
async function sourceCheck(fetchImpl, nowMs) {
  if (sourceCache && nowMs - sourceCache.at < 10 * 60 * 1000) return sourceCache.value;
  const { closes, errors } = await fetchCloses(fetchImpl, new Set(['0050', '6488']));
  const value = { count: Object.keys(closes).length, otcCount: Object.values(closes).filter((c) => c.market === '上櫃').length, sample: closes['0050'] || null, otcSample: closes['00679B'] || closes['6488'] || null, errors };
  sourceCache = { at: nowMs, value };
  return value;
}

export async function handle(req, env, deps) {
  const { sheets, fetchImpl = fetch, now = () => Date.now(), waitUntil = (p) => p } = deps;
  const origin = req.headers.get('origin') || '';
  const H = cors(env, origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: origin === env.ALLOWED_ORIGIN ? 204 : 403, headers: H });
  const problem = devModeProblem(env);
  if (problem) return json(500, { error: 'config', message: problem }, H);
  if (origin && origin !== env.ALLOWED_ORIGIN) return json(403, { error: 'origin', message: '不接受這個網站的請求' }, H);

  const url = new URL(req.url), path = url.pathname;
  if (path === '/health') {
    // 公開的健康檢查：只回報設定是否齊全與公開的市場資料狀態，不含任何帳本資料
    const body = { ok: true, config: { sheet: !!(env.GOOGLE_SA_EMAIL && env.GOOGLE_SA_KEY && env.SHEET_ID), pin: !!env.PIN_PEPPER, line: /^\d+$/.test(env.LINE_CHANNEL_ID || '') } };
    if (url.searchParams.get('sources') === '1') body.sources = await sourceCheck(fetchImpl, now());
    return json(200, body, H);
  }
  if (!path.startsWith('/api/')) return json(404, { error: 'not_found' }, H);

  try {
    const who = await identify(req, env, fetchImpl, now());
    if (!who) throw new ApiError(401, 'unauthenticated', '請先用 LINE 登入');
    const nowMs = now(), T = taipei(nowMs);
    const D = parseAll(await sheets.readAll());
    const me = D.members.find((m) => m.lineId === who.userId);
    const status = !me ? 'none' : me.status === STATUS.approved ? 'member' : me.status === STATUS.disabled ? 'disabled' : 'pending';

    if (path === '/api/me' && req.method === 'GET') {
      return json(200, { status, name: me ? me.name || me.lineName : '', role: me && me.status === STATUS.approved && me.role === ROLE.admin ? 'admin' : status === 'member' ? 'member' : '' }, H);
    }
    const body = req.method === 'POST' ? await req.json().catch(() => { throw new ApiError(400, 'bad_json', '資料格式不正確'); }) : {};

    if (path === '/api/join' && req.method === 'POST') {
      if (me) return json(200, { status }, H);
      const first = D.members.length === 0;
      const name = String(body.name || who.name || '').trim().slice(0, 12) || '成員';
      const row = { lineId: who.userId, lineName: who.name, name: first ? name : '', role: first ? ROLE.admin : ROLE.member, status: first ? STATUS.approved : STATUS.pending, appliedAt: T.stamp, approvedBy: first ? '首位成員自動成為管理者' : '', approvedAt: first ? T.stamp : '' };
      await sheets.append('members', row);
      return json(200, { status: first ? 'member' : 'pending' }, H);
    }

    if (status !== 'member') throw new ApiError(403, 'not_member', status === 'pending' ? '還在等待管理者核准' : status === 'disabled' ? '這個帳號已停用' : '請先申請加入');
    const isAdmin = me.role === ROLE.admin;

    if (path === '/api/ledger' && req.method === 'GET') return json(200, publicLedger(D, me, nowMs), H);

    if (path === '/api/members' && req.method === 'GET') {
      if (!isAdmin) throw new ApiError(403, 'not_admin', '只有管理者可以管理成員');
      const st = { [STATUS.approved]: 'approved', [STATUS.pending]: 'pending', [STATUS.disabled]: 'disabled' };
      return json(200, { members: D.members.map((m) => ({ userId: m.lineId, lineName: m.lineName, name: m.name, role: m.role === ROLE.admin ? 'admin' : 'member', status: st[m.status] || 'pending', appliedAt: m.appliedAt, self: m.lineId === me.lineId })) }, H);
    }

    if (path === '/api/pin/verify' && req.method === 'POST') {
      const s = settingsOf(D.settings);
      if (!s.pinHash) throw new ApiError(409, 'pin_not_set', '還沒有設定密碼');
      const lockKey = LOCK_PREFIX + who.userId;
      const [fails, until] = String(s.raw[lockKey] || '0|0').split('|').map(Number);
      if (until > nowMs) throw new ApiError(429, 'locked', `密碼錯太多次，請 ${Math.ceil((until - nowMs) / 60000)} 分鐘後再試`, { until });
      const pin = String(body.pin || '');
      const [salt, hash] = s.pinHash.split(':');
      const ok = PIN_RE.test(pin) && safeEqual(await pinHash(pin, salt, env.PIN_PEPPER), hash || '');
      if (ok) { if (fails || until) await setSetting(sheets, D, lockKey, '0|0'); return json(200, { ok: true }, H); }
      const n = (fails || 0) + 1;
      await setSetting(sheets, D, lockKey, n >= 5 ? `0|${nowMs + 10 * 60000}` : `${n}|0`);
      return json(200, { ok: false, remaining: n >= 5 ? 0 : 5 - n }, H);
    }

    // ----- writes: request id, dedupe, validate, write, audit, reports -----
    const requestId = String(body.requestId || '');
    if (!REQ_RE.test(requestId)) throw new ApiError(400, 'request_id', '缺少請求編號');
    const dup = D.audit.find((a) => String(a.requestId) === requestId);
    if (dup) return json(200, { ok: true, duplicate: true, ledger: publicLedger(D, me, nowMs) }, H);
    const actor = me.name || me.lineName;
    const names = approvedMembers(D.members).map((m) => m.name);
    let action = '', reports = true;

    if (path === '/api/pin/set' && req.method === 'POST') {
      const s = settingsOf(D.settings);
      if (!PIN_RE.test(String(body.pin || ''))) throw new ApiError(400, 'invalid', '密碼要是 4 位數字');
      if (s.pinHash) {
        const [salt, hash] = s.pinHash.split(':');
        if (!safeEqual(await pinHash(String(body.current || ''), salt, env.PIN_PEPPER), hash || '')) throw new ApiError(403, 'wrong_pin', '目前的密碼不正確');
      }
      const salt = newSalt();
      await setSetting(sheets, D, SETTING_KEYS.pin, `${salt}:${await pinHash(String(body.pin), salt, env.PIN_PEPPER)}`);
      await audit(sheets, D, { at: T.stamp, by: actor, action: '密碼變更', tab: '設定', targetId: SETTING_KEYS.pin, requestId });
      return json(200, { ok: true, ledger: publicLedger(D, me, nowMs) }, H);
    }

    if (path === '/api/trades/save' && req.method === 'POST') {
      const t = validateTrade(body.trade || {}, { today: T.date, names });
      let row, before = null;
      if (body.id) {
        row = D.trades.find((x) => x.id === body.id);
        if (!row || row.deleted) throw new ApiError(404, 'not_found', '找不到這筆交易，可能已被刪除');
        before = strip(row);
        Object.assign(row, t, { updatedBy: actor, updatedAt: T.stamp });
      } else {
        row = { ...t, id: randomId('T', nowMs), createdBy: actor, createdAt: T.stamp, updatedBy: '', updatedAt: '', deleted: false, deletedBy: '', deletedAt: '' };
        D.trades.push(row);
      }
      checkHoldings(D.trades);
      const sheetRow = { ...row, side: SIDE_TO_SHEET[row.side] };
      if (before) await sheets.updateRow('trades', row._row, sheetRow); else await sheets.append('trades', sheetRow);
      action = before ? '修改' : '新增';
      await audit(sheets, D, { at: T.stamp, by: actor, action, tab: '交易', targetId: row.id, before, after: strip(row), requestId });
    } else if (path === '/api/trades/delete' && req.method === 'POST') {
      const row = D.trades.find((x) => x.id === body.id);
      if (!row || row.deleted) throw new ApiError(404, 'not_found', '找不到這筆交易，可能已被刪除');
      const before = strip(row);
      Object.assign(row, { deleted: true, deletedBy: actor, deletedAt: T.stamp });
      checkHoldings(D.trades);
      await sheets.updateRow('trades', row._row, { ...row, side: SIDE_TO_SHEET[row.side] });
      await audit(sheets, D, { at: T.stamp, by: actor, action: '刪除', tab: '交易', targetId: row.id, before, after: strip(row), requestId });
    } else if (path === '/api/cash/save' && req.method === 'POST') {
      const c = validateCash(body.entry || {}, { today: T.date });
      let row, before = null;
      if (body.id) {
        row = D.cash.find((x) => x.id === body.id);
        if (!row || row.deleted) throw new ApiError(404, 'not_found', '找不到這筆紀錄，可能已被刪除');
        before = strip(row);
        Object.assign(row, c, { updatedBy: actor, updatedAt: T.stamp });
      } else {
        row = { ...c, id: randomId('C', nowMs), createdBy: actor, createdAt: T.stamp, updatedBy: '', updatedAt: '', deleted: false, deletedBy: '', deletedAt: '' };
        D.cash.push(row);
      }
      if (c.type === 'out') {
        const R = compute(D.trades, D.cash, D.prices, settingsOf(D.settings), nowMs);
        if (R.cash < 0 && body.confirmOverdraw !== true) throw new ApiError(409, 'overdraw', `領出後可用餘額會變成 ${Math.round(R.cash).toLocaleString("en-US")} 元，確定要記錄嗎？`, { cashAfter: Math.round(R.cash) });
      }
      const sheetRow = { ...row, type: TYPE_TO_SHEET[row.type] };
      if (before) await sheets.updateRow('cash', row._row, sheetRow); else await sheets.append('cash', sheetRow);
      action = before ? '修改' : '新增';
      await audit(sheets, D, { at: T.stamp, by: actor, action, tab: '資金進出', targetId: row.id, before, after: strip(row), requestId });
    } else if (path === '/api/cash/delete' && req.method === 'POST') {
      const row = D.cash.find((x) => x.id === body.id);
      if (!row || row.deleted) throw new ApiError(404, 'not_found', '找不到這筆紀錄，可能已被刪除');
      const before = strip(row);
      Object.assign(row, { deleted: true, deletedBy: actor, deletedAt: T.stamp });
      await sheets.updateRow('cash', row._row, { ...row, type: TYPE_TO_SHEET[row.type] });
      await audit(sheets, D, { at: T.stamp, by: actor, action: '刪除', tab: '資金進出', targetId: row.id, before, after: strip(row), requestId });
    } else if (path === '/api/settings' && req.method === 'POST') {
      const x = body.settings || {};
      const goal = Number(x.goal), discount = Number(x.discount), minFee = Number(x.minFee);
      if (!Number.isInteger(goal) || goal < 10000 || goal > 1e9) throw new ApiError(400, 'invalid', '目標金額要是 1 萬以上的整數');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x.start)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(x.end)) || String(x.end) <= String(x.start)) throw new ApiError(400, 'invalid', '目標日要晚於起始日');
      if (!(discount > 0 && discount <= 1)) throw new ApiError(400, 'invalid', '手續費折扣要介於 0 到 1');
      if (!Number.isInteger(minFee) || minFee < 0 || minFee > 1000) throw new ApiError(400, 'invalid', '最低手續費要是 0 到 1000 的整數');
      const before = settingsOf(D.settings);
      for (const [k, v] of [[SETTING_KEYS.goal, goal], [SETTING_KEYS.start, String(x.start)], [SETTING_KEYS.end, String(x.end)], [SETTING_KEYS.discount, discount], [SETTING_KEYS.minFee, minFee], [SETTING_KEYS.updatedBy, actor], [SETTING_KEYS.updatedAt, T.stamp]]) await setSetting(sheets, D, k, v);
      await audit(sheets, D, { at: T.stamp, by: actor, action: '設定變更', tab: '設定', targetId: '', before: { goal: before.goal, start: before.start, end: before.end, discount: before.discount, minFee: before.minFee }, after: { goal, start: x.start, end: x.end, discount, minFee }, requestId });
    } else if (path === '/api/members/update' && req.method === 'POST') {
      if (!isAdmin) throw new ApiError(403, 'not_admin', '只有管理者可以管理成員');
      const row = D.members.find((m) => m.lineId === body.userId);
      if (!row) throw new ApiError(404, 'not_found', '找不到這位成員');
      if (row.lineId === me.lineId) throw new ApiError(400, 'self', '不能變更自己的狀態');
      const before = strip(row);
      if (body.status === 'approved') {
        const name = String(body.name || row.name || row.lineName || '').trim();
        if (name.length < 1 || name.length > 12) throw new ApiError(400, 'invalid', '帳本名稱要 1 到 12 個字');
        if (approvedMembers(D.members).some((m) => m.lineId !== row.lineId && m.name === name)) throw new ApiError(400, 'invalid', '這個帳本名稱已經有人用了');
        Object.assign(row, { name, status: STATUS.approved, approvedBy: actor, approvedAt: T.stamp });
      } else if (body.status === 'disabled') Object.assign(row, { status: STATUS.disabled });
      else throw new ApiError(400, 'invalid', '不支援的操作');
      await sheets.updateRow('members', row._row, row);
      await audit(sheets, D, { at: T.stamp, by: actor, action: body.status === 'approved' ? '成員核准' : '成員停用', tab: '成員', targetId: row.lineName, before, after: strip(row), requestId });
      reports = false;
    } else {
      throw new ApiError(404, 'not_found', '沒有這個功能');
    }

    if (reports) waitUntil(regenerateReports(sheets, D, nowMs).catch(() => {}));
    return json(200, { ok: true, ledger: publicLedger(D, me, nowMs) }, H);
  } catch (e) {
    if (e instanceof ApiError) return json(e.status, { error: e.code, message: e.message, ...e.extra }, H);
    return json(500, { error: 'server', message: '系統暫時有問題，資料沒有寫入，請稍後再試' }, H);
  }
}

export async function updatePrices(env, deps) {
  const { sheets, fetchImpl = fetch, now = () => Date.now() } = deps;
  const D = parseAll(await sheets.readAll());
  const codes = new Set([...D.trades.map((t) => String(t.code)), ...D.cash.filter((c) => c.code).map((c) => String(c.code))]);
  if (!codes.size) return { updated: 0, errors: [] };
  const { closes, errors } = await fetchCloses(fetchImpl, codes);
  const stamp = taipei(now()).stamp;
  let updated = 0;
  for (const code of codes) {
    const c = closes[code];
    if (!c) continue;
    const row = D.prices.find((p) => p.code === code);
    const obj = { code, name: c.name || (row && row.name) || '', market: c.market, close: c.close, date: c.date, fetchedAt: stamp };
    if (row) { if (row.date === c.date && row.close === c.close) continue; await sheets.updateRow('prices', row._row, obj); Object.assign(row, obj); }
    else { await sheets.append('prices', obj); D.prices.push(obj); }
    updated++;
  }
  if (updated) await regenerateReports(sheets, D, now());
  return { updated, errors };
}
