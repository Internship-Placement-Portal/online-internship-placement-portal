import { http } from './http.js';

export const listRecruitersApi = (params) => http.get('/admin/recruiters', { params }).then((r) => r.data);
export const decideRecruiterApi = (id, body) => http.patch(`/admin/recruiters/${id}`, body).then((r) => r.data.recruiter);
export const listPendingListingsApi = (params) => http.get('/admin/listings', { params }).then((r) => r.data);
export const decideListingApi = (id, body) => http.patch(`/admin/listings/${id}`, body).then((r) => r.data.listing);
