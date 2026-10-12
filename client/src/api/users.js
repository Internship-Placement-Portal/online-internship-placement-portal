import { http } from './http.js';

export const updateProfileApi = (body) => http.patch('/users/me', body).then((r) => r.data.user);
export const getMeApi = () => http.get('/users/me').then((r) => r.data.user);
