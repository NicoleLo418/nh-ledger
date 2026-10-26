// Pure ledger logic: Taipei time, validation, calculations, report rows. No I/O here.
import { SETTING_KEYS, STATUS, ROLE } from './schema.js';

export const DEFAULTS = { goal: 1000000, start: '2026-10-26', end: '2028-10-26', discount: 1, minFee: 20 };

export function taipei(nowMs) {
  const d = new Date(nowMs + 8 * 3600 * 1000).toISOString();
  return { date: d.slice(0, 10), stamp: `${d.slice(0, 10)} ${d.slice(11, 19)}` };
}

export function randomId(prefix, nowMs) {
  const b = new Uint8Array(3);
  crypto.getRandomValues(b);
  return `${prefix}-${taipei(nowMs).date.replace(/-/g, '')}-${[...b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

export class ApiError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra || {}; }
}
const bad = (msg, code = 'invalid', extra) => new ApiError(400, code, msg, extra);

export function settingsOf(rows) {
  const m = {};
  for (const r of rows) m[String(r.key)] = r.value;
  const n = (k, d) => { const v = parseFloat(m[k]); return Number.isFinite(v) ? v : d; };
  return {
    goal: n(SETTING_KEYS.goal, DEFAULTS.goal),
    start: String(m[SETTING_KEYS.start] || DEFAULTS.start),
    end: String(m[SETTING_KEYS.end] || DEFAULTS.end),
    discount: n(SETTING_KEYS.discount, DEFAULTS.discount),
    minFee: n(SETTING_KEYS.minFee, DEFAULTS.minFee),
    pinHash: String(m[SETTING_KEYS.pin] || ''),
    raw: m,
  };
}

// Approved members, admin first, then by application time; their ledger names are the only valid 下單人.
export function approvedMembers(members) {
  return members.filter((m) => m.status === STATUS.approved)
    .sort((a, b) => (a.role === ROLE.admin ? 0 : 1) - (b.role === ROLE.admin ? 0 : 1) || String(a.appliedAt).localeCompare(String(b.appliedAt)));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function checkDate(d, today, label = '日期') {
  if (!DATE_RE.test(String(d || '')) || Number.isNaN(Date.parse(d + 'T00:00:00Z'))) throw bad(`${label}格式不正確`);
  if (d > today) throw bad(`${label}不能晚於今天（${today}）`, 'future_date');
  if (d < '2000-01-01') throw bad(`${label}太早了`);
}
const isInt = (v) => Number.isInteger(v);
function checkNote(n) { if (String(n || '').length > 200) throw bad('備註最多 200 字'); }
function cleanCode(c) { return String(c || '').trim().toUpperCase(); }

export function validateTrade(input, { today, names }) {
  const t = {
    date: String(input.date || ''), side: input.side, code: cleanCode(input.code), name: String(input.name || '').trim(),
    shares: Number(input.shares), price: Number(input.price), fee: Number(input.fee ?? 0), tax: Number(input.tax ?? 0),
    by: String(input.by || ''), note: String(input.note || '').trim(),
  };
  checkDate(t.date, today);
  if (t.side !== 'buy' && t.side !== 'sell') throw bad('請選擇買進或賣出');
  if (!/^[0-9A-Z]{2,6}$/.test(t.code)) throw bad('股票代號格式不正確');
  if (t.name.length < 1 || t.name.length > 30) throw bad('請填股票名稱（最多 30 字）');
  if (!isInt(t.shares) || t.shares < 1 || t.shares > 10000000) throw bad('股數要是 1 以上的整數');
  if (!(t.price > 0) || t.price > 100000 || Math.abs(Math.round(t.price * 100) - t.price * 100) > 1e-6) throw bad('成交價要大於 0，最多兩位小數');
  if (!isInt(t.fee) || t.fee < 0 || t.fee > 1000000) throw bad('手續費要是 0 以上的整數');
  if (!isInt(t.tax) || t.tax < 0 || t.tax > 1000000) throw bad('證交稅要是 0 以上的整數');
  if (t.side === 'buy' && t.tax !== 0) throw bad('買進不會有證交稅');
  if (!names.includes(t.by)) throw bad('下單人必須是帳本成員');
  checkNote(t.note);
  const gross = t.shares * t.price;
  t.cashflow = Math.round(t.side === 'buy' ? -(gross + t.fee) : gross - t.fee - t.tax);
  return t;
}

export function validateCash(input, { today }) {
  const c = {
    date: String(input.date || ''), type: input.type, perPerson: Number(input.perPerson ?? 0), amount: Number(input.amount ?? 0),
    code: cleanCode(input.code), name: String(input.name || '').trim(), note: String(input.note || '').trim(),
  };
  checkDate(c.date, today);
  if (!['in', 'out', 'div'].includes(c.type)) throw bad('請選擇存入、領出或股利入帳');
  if (c.type === 'div') {
    if (!isInt(c.amount) || c.amount < 1 || c.amount > 10000000) throw bad('股利金額要是 1 以上的整數');
    if (c.code && !/^[0-9A-Z]{2,6}$/.test(c.code)) throw bad('股票代號格式不正確');
    if (c.name.length > 30) throw bad('股票名稱最多 30 字');
    c.perPerson = 0; c.total = c.amount;
  } else {
    if (!isInt(c.perPerson) || c.perPerson < 1 || c.perPerson > 10000000) throw bad('每人金額要是 1 以上的整數');
    c.amount = 0; c.code = ''; c.name = '';
    c.total = c.type === 'out' ? -2 * c.perPerson : 2 * c.perPerson;
  }
  checkNote(c.note);
  return c;
}

const order = (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdAt).localeCompare(String(b.createdAt));

// Replays every live trade in date order; throws if any sale would exceed the shares held at that point.
export function checkHoldings(trades) {
  const held = {};
  for (const t of trades.filter((x) => !x.deleted).sort(order)) {
    const h = held[t.code] || 0;
    if (t.side === 'sell' && t.shares > h + 1e-9) {
      throw bad(`${t.date} 賣出 ${t.code} ${t.shares} 股，超過當時持股 ${h} 股`, 'oversell', { code: t.code, held: h, date: t.date });
    }
    held[t.code] = t.side === 'buy' ? h + t.shares : h - t.shares;
  }
}

export function compute(trades, cash, prices, settings, nowMs) {
  const live = trades.filter((t) => !t.deleted), liveCash = cash.filter((c) => !c.deleted);
  const ev = [...liveCash.map((c) => ({ ...c, kind: 'cash' })), ...live.map((t) => ({ ...t, kind: 'trade' }))].sort(order);
  let money = 0, totalIn = 0, totalOut = 0, realized = 0, divs = 0;
  const pos = {};
  const P = (code, name) => pos[code] || (pos[code] = { code, name: name || '', shares: 0, cost: 0, bSh: 0, sSh: 0, real: 0, div: 0, lastPrice: 0, lastDate: '' });
  for (const e of ev) {
    if (e.kind === 'cash') {
      if (e.type === 'in') { money += 2 * e.perPerson; totalIn += 2 * e.perPerson; }
      else if (e.type === 'out') { money -= 2 * e.perPerson; totalOut += 2 * e.perPerson; }
      else { money += e.amount; divs += e.amount; realized += e.amount; if (e.code) { const p = P(e.code, e.name); p.div += e.amount; if (e.name && !p.name) p.name = e.name; } }
      continue;
    }
    const p = P(e.code, e.name); if (e.name) p.name = e.name;
    const gross = e.shares * e.price;
    if (e.side === 'buy') { money -= gross + e.fee; p.shares += e.shares; p.cost += gross + e.fee; p.bSh += e.shares; }
    else {
      const net = gross - e.fee - e.tax, avg = p.shares ? p.cost / p.shares : 0, cb = avg * Math.min(e.shares, p.shares);
      money += net; realized += net - cb; p.real += net - cb; p.cost -= cb; p.shares -= e.shares; p.sSh += e.shares;
      if (p.shares <= 0) { p.shares = 0; p.cost = 0; }
    }
    if (e.date >= p.lastDate) { p.lastPrice = e.price; p.lastDate = e.date; }
  }
  const px = {}; for (const r of prices) px[r.code] = r;
  const holdings = Object.values(pos).filter((p) => p.shares > 0).map((p) => {
    let price = p.lastPrice, pdate = p.lastDate, src = 'trade';
    const q = px[p.code];
    if (q && q.close > 0 && String(q.date) >= pdate) { price = q.close; pdate = String(q.date); src = 'close'; }
    const mv = p.shares * price;
    return { ...p, price, pdate, src, mv, avg: p.cost / p.shares, unreal: mv - p.cost };
  }).sort((a, b) => b.mv - a.mv);
  const mv = holdings.reduce((s, h) => s + h.mv, 0), total = money + mv, netIn = totalIn - totalOut, pnl = total - netIn;
  const positions = Object.values(pos).map((p) => { const h = holdings.find((x) => x.code === p.code); const un = h ? h.unreal : 0; return { ...p, status: p.shares > 0 ? '持有中' : '已出清', unreal: un, totalPL: p.real + p.div + un }; });
  return { cash: money, totalIn, totalOut, netIn, realized, divs, holdings, positions, mv, total, pnl, ret: netIn > 0 ? pnl / netIn : 0, prog: Math.max(0, Math.min(1, total / settings.goal)) };
}

const r0 = Math.round;
export function reportRows(R, settings, stamp) {
  const overview = [['項目', '金額'], ['最後更新', stamp], ['累計存入', r0(R.totalIn)], ['累計領出', r0(R.totalOut)], ['淨投入', r0(R.netIn)], ['可用餘額', r0(R.cash)], ['持股市值', r0(R.mv)], ['總資產', r0(R.total)], ['總損益', r0(R.pnl)], ['報酬率', R.ret], ['已實現損益', r0(R.realized)], ['累計股利', r0(R.divs)], ['每人資產', r0(R.total / 2)], ['目標', settings.goal], ['目標進度', R.prog]];
  const holdings = [['代號', '名稱', '股數', '平均成本', '成本', '現價', '現價日期', '市值', '未實現損益', '報酬率']]
    .concat(R.holdings.map((h) => [h.code, h.name, h.shares, +h.avg.toFixed(2), r0(h.cost), h.price, h.pdate, r0(h.mv), r0(h.unreal), h.cost ? h.unreal / h.cost : 0]));
  const positions = [['代號', '名稱', '狀態', '目前股數', '累計買進股數', '累計賣出股數', '已實現損益', '股利', '未實現損益', '總損益']]
    .concat([...R.positions].sort((a, b) => a.status.localeCompare(b.status) || a.code.localeCompare(b.code)).map((p) => [p.code, p.name, p.status, p.shares, p.bSh, p.sSh, r0(p.real), r0(p.div), r0(p.unreal), r0(p.totalPL)]));
  return { overview, holdings, positions };
}

// PIN: HMAC-SHA256(pepper, salt + pin). The pepper is a Worker secret; the hash never leaves the Worker.
export async function pinHash(pin, salt, pepper) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export function newSalt() { const b = new Uint8Array(12); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); }
export function safeEqual(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
