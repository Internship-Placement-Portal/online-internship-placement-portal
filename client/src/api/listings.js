import { http } from './http.js';

const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null));

export const searchListingsApi = (params) => http.get('/listings', { params: clean(params) }).then((r) => r.data);
export const domainsApi = () => http.get('/listings/domains').then((r) => r.data.domains);
export const getListingApi = (id) => http.get(`/listings/${id}`).then((r) => r.data.listing);
export const myListingsApi = (params = {}) => http.get('/listings/mine', { params: clean(params) }).then((r) => r.data);
export const createListingApi = (body) => http.post('/listings', body).then((r) => r.data.listing);
export const updateListingApi = (id, body) => http.patch(`/listings/${id}`, body).then((r) => r.data.listing);
export const closeListingApi = (id) => http.post(`/listings/${id}/close`).then((r) => r.data.listing);
