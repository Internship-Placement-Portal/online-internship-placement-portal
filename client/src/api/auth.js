import { http, refreshSession } from './http.js';

export const registerApi = (body) => http.post('/auth/register', body).then((r) => r.data);
export const verifyEmailApi = (body) => http.post('/auth/verify-email', body).then((r) => r.data);
export const resendOtpApi = (body) => http.post('/auth/resend-otp', body).then((r) => r.data);
export const loginApi = (body) => http.post('/auth/login', body).then((r) => r.data);
export const logoutApi = () => http.post('/auth/logout');
export { refreshSession };
