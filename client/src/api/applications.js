import { http } from './http.js';

// Empty filter values must not be sent (the API validates them strictly).
const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));

export function applyApi(listingId, file) {
  const form = new FormData();
  form.append('listingId', listingId);
  form.append('resume', file);
  return http.post('/applications', form).then((r) => r.data.application);
}
export const myApplicationsApi = (params = {}) => http.get('/applications/mine', { params: clean(params) }).then((r) => r.data);
export const getApplicationApi = (id) => http.get(`/applications/${id}`).then((r) => r.data.application);
export const listingApplicantsApi = (listingId, params = {}) => http.get(`/listings/${listingId}/applications`, { params: clean(params) }).then((r) => r.data);
export const updateStatusApi = (id, status) => http.patch(`/applications/${id}/status`, { status }).then((r) => r.data.application);
export const scheduleInterviewApi = (id, body) => http.put(`/applications/${id}/interview`, body).then((r) => r.data.application);

// The resume endpoint needs the Authorization header, so fetch it as a blob and open it from an object URL.
export async function openResume(id) {
  const res = await http.get(`/applications/${id}/resume`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const notificationsApi = (params = {}) => http.get('/notifications', { params: clean(params) }).then((r) => r.data);
export const markNotificationReadApi = (id) => http.patch(`/notifications/${id}/read`).then((r) => r.data.notification);
export const markAllNotificationsReadApi = () => http.post('/notifications/read-all').then((r) => r.data);
