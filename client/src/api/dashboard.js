import { http } from './http.js';

const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));

export const studentDashboardApi = () => http.get('/dashboard/student').then((r) => r.data);
export const placementApi = (params = {}) => http.get('/dashboard/placement', { params: clean(params) }).then((r) => r.data);
export const auditLogsApi = (params = {}) => http.get('/admin/audit-logs', { params: clean(params) }).then((r) => r.data);
export const auditActionsApi = () => http.get('/admin/audit-logs/actions').then((r) => r.data.actions);

// Downloads need the Authorization header, so fetch as a blob and save through a temporary link.
export async function downloadExport(format, params = {}) {
  const res = await http.get('/dashboard/placement/export', { params: clean({ ...params, format }), responseType: 'blob' });
  const match = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '');
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = match ? match[1] : `ipp-placement.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
