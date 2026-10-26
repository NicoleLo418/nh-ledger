// Sheet layout. Row 1 = banner (「請回到帳本網頁修改」), row 2 = header, data from row 3.
export const DATA_START_ROW = 3;

export const TABS = {
  trades: {
    name: '交易',
    cols: ['編號', '日期', '類別', '代號', '名稱', '股數', '成交價', '手續費', '證交稅', '現金流', '下單人', '備註', '建立者', '建立時間', '修改者', '修改時間', '已刪除', '刪除者', '刪除時間'],
    keys: ['id', 'date', 'side', 'code', 'name', 'shares', 'price', 'fee', 'tax', 'cashflow', 'by', 'note', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'deleted', 'deletedBy', 'deletedAt'],
  },
  cash: {
    name: '資金進出',
    cols: ['編號', '日期', '類型', '每人金額', '合計', '股利金額', '股票代號', '股票名稱', '備註', '建立者', '建立時間', '修改者', '修改時間', '已刪除', '刪除者', '刪除時間'],
    keys: ['id', 'date', 'type', 'perPerson', 'total', 'amount', 'code', 'name', 'note', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'deleted', 'deletedBy', 'deletedAt'],
  },
  members: {
    name: '成員',
    cols: ['LINE使用者編號', 'LINE顯示名稱', '帳本名稱', '角色', '狀態', '申請時間', '核准者', '核准時間'],
    keys: ['lineId', 'lineName', 'name', 'role', 'status', 'appliedAt', 'approvedBy', 'approvedAt'],
  },
  settings: { name: '設定', cols: ['項目', '值'], keys: ['key', 'value'] },
  prices: {
    name: '收盤價',
    cols: ['代號', '名稱', '市場', '收盤價', '資料日期', '抓取時間'],
    keys: ['code', 'name', 'market', 'close', 'date', 'fetchedAt'],
  },
  audit: {
    name: '異動紀錄',
    cols: ['時間', '操作者', '動作', '對象分頁', '對象編號', '修改前', '修改後', '請求編號'],
    keys: ['at', 'by', 'action', 'tab', 'targetId', 'before', 'after', 'requestId'],
  },
};

export const REPORT_TABS = { overview: '總覽', holdings: '持股明細', positions: '個股損益' };

export const SIDE_TO_SHEET = { buy: '買進', sell: '賣出' };
export const SIDE_FROM_SHEET = { 買進: 'buy', 賣出: 'sell' };
export const TYPE_TO_SHEET = { in: '存入', out: '領出', div: '股利入帳' };
export const TYPE_FROM_SHEET = { 存入: 'in', 領出: 'out', 股利入帳: 'div' };

export const ROLE = { admin: '管理者', member: '成員' };
export const STATUS = { pending: '待核准', approved: '已核准', disabled: '停用' };

export const SETTING_KEYS = { goal: '目標金額', start: '起始日', end: '目標日', discount: '手續費折扣', minFee: '最低手續費', pin: '密碼雜湊', updatedBy: '最後修改者', updatedAt: '最後修改時間' };

export function colLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export function rowToObj(tabKey, row) {
  const keys = TABS[tabKey].keys, o = {};
  keys.forEach((k, i) => { o[k] = row && row[i] !== undefined ? row[i] : ''; });
  return o;
}

export function objToRow(tabKey, o) {
  return TABS[tabKey].keys.map((k) => (o[k] === undefined || o[k] === null ? '' : o[k]));
}

// Parse every tab's raw rows (banner + header + data) into objects that remember their sheet row number.
export function parseAll(raw) {
  const out = {};
  for (const key of Object.keys(TABS)) {
    const rows = raw[key] || [];
    out[key] = rows.slice(DATA_START_ROW - 1).map((r, i) => ({ ...rowToObj(key, r), _row: DATA_START_ROW + i })).filter((o) => String(o[TABS[key].keys[0]] || '').trim() !== '');
  }
  for (const t of out.trades) { t.side = SIDE_FROM_SHEET[t.side] || t.side; t.deleted = isTrue(t.deleted); t.shares = num(t.shares); t.price = num(t.price); t.fee = num(t.fee); t.tax = num(t.tax); t.cashflow = num(t.cashflow); t.code = String(t.code); t.date = String(t.date); }
  for (const c of out.cash) { c.type = TYPE_FROM_SHEET[c.type] || c.type; c.deleted = isTrue(c.deleted); c.perPerson = num(c.perPerson); c.total = num(c.total); c.amount = num(c.amount); c.code = String(c.code || ''); c.date = String(c.date); }
  for (const p of out.prices) { p.code = String(p.code); p.close = num(p.close); p.date = String(p.date); }
  return out;
}

export const isTrue = (v) => v === true || String(v).toUpperCase() === 'TRUE';
export const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v || '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
