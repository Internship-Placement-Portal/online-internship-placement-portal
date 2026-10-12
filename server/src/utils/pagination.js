// Shared paging helper: clamps user-supplied page/limit and shapes the response envelope.
const parsePaging = ({ page, limit } = {}, { defaultLimit = 10, maxLimit = 50 } = {}) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || defaultLimit));
  return { page: p, limit: l, skip: (p - 1) * l };
};

const pageResult = (items, total, { page, limit }) => ({
  items,
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { parsePaging, pageResult, escapeRegex };
