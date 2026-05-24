import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
  }
  config.headers['X-Device-Id'] = deviceId;
  return config;
});

export const eventsApi = {
  create: (data: { bookingId: string; title: string; description?: string; maxAttendees: number }) =>
    api.post('/events', data).then((r) => r.data),

  getByToken: (token: string) =>
    api.get(`/events/invite/${token}`).then((r) => r.data),

  joinByToken: (token: string) =>
    api.post(`/events/invite/${token}/join`).then((r) => r.data),

  getById: (id: string) =>
    api.get(`/events/${id}`).then((r) => r.data),

  checkIn: (id: string) =>
    api.post(`/events/${id}/checkin`).then((r) => r.data),
};

export const loyaltyApi = {
  getAccount: () => api.get('/loyalty/account').then((r) => r.data),
  getRewards: () => api.get('/loyalty/rewards').then((r) => r.data),
  redeem:     (rewardId: string, venueId?: string) =>
    api.post('/loyalty/redeem', { rewardId, venueId }).then((r) => r.data),
  getVouchers: () => api.get('/loyalty/vouchers').then((r) => r.data),
};

export const venuesApi = {
  list: (params?: { category?: string; search?: string }) =>
    api.get('/venues', { params }).then((r) => r.data),
  getById: (id: string) =>
    api.get(`/venues/${id}`).then((r) => r.data),
};

export const bookingsApi = {
  create: (data: {
    venueId: string;
    partySize: number;
    bookingType: string;
    scheduledAt?: string;
    notes?: string;
  }) => api.post('/bookings', data).then((r) => r.data),

  getById: (id: string) =>
    api.get(`/bookings/${id}`).then((r) => r.data),

  cancel: (id: string) =>
    api.delete(`/bookings/${id}`).then((r) => r.data),
};

export default api;
