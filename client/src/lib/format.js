export const formatStipend = (n) => (n === 0 ? 'Unpaid' : `₹${Number(n).toLocaleString('en-IN')}/mo`);

export const formatDate = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('en-IN', opts) : '—';

export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export function daysLeft(deadline) {
  const ms = new Date(deadline) - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (days < 0) return 'Closed';
  if (days === 0) return 'Closes today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
