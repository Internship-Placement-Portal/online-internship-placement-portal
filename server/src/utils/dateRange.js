const AppError = require('./AppError');

const MAX_MONTHS = 24;
const pad = (n) => String(n).padStart(2, '0');
const monthKey = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Default window = the last 12 calendar months including the current one (IPP-F-020), all in UTC.
function resolveRange({ from, to } = {}, now = new Date()) {
  const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new AppError(400, 'INVALID_RANGE', 'Invalid date range');
  if (start > end) throw new AppError(400, 'INVALID_RANGE', 'The start date must be before the end date');
  if (months(start, end).length > MAX_MONTHS) throw new AppError(400, 'INVALID_RANGE', `The date range may span at most ${MAX_MONTHS} months`);
  return { from: start, to: end };
}

// Every calendar month touched by the range, so charts get an explicit zero for months without data.
function months(from, to) {
  const out = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor <= to) {
    out.push({ key: monthKey(cursor), label: `${MONTH_NAMES[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}` });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

module.exports = { resolveRange, months, monthKey };
