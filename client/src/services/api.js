import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ayusakshi_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token if expired
      const isAuthEndpoint = error.config.url?.includes('/auth/login') || error.config.url?.includes('/auth/register');
      if (!isAuthEndpoint) {
        localStorage.removeItem('ayusakshi_token');
        localStorage.removeItem('ayusakshi_user');
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile'),
  socialAuth: (data) => api.post('/auth/social', data),
  changePassword: (data) => api.post('/auth/change-password', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  verifyResetCode: (data) => api.post('/auth/verify-reset-code', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

export const chatAPI = {
  listConversations: (jurisdiction) => api.get('/chat/conversations', { params: { jurisdiction } }),
  createConversation: (data) => api.post('/chat/conversations', data),
  getMessages: (id) => api.get(`/chat/conversations/${id}`),
  // An answer from the local fallback model can take a few minutes on a laptop.
  sendMessage: (id, data) => api.post(`/chat/conversations/${id}/messages`, data, { timeout: 310000 }),
  deleteConversation: (id) => api.delete(`/chat/conversations/${id}`),
};

export const formulationAPI = {
  classify: (data) => api.post('/formulations/classify', data),
  wizardTree: () => api.get('/formulations/wizard/tree'),
  wizardStep: (data) => api.post('/formulations/wizard/step', data),
};

export const documentAPI = {
  listDocuments: (params) => api.get('/documents', { params }),
  getDocument: (id) => api.get(`/documents/${id}`),
  uploadDocument: (formData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const escalationAPI = {
  submit: (data) => api.post('/escalations', data),
  list: (params) => api.get('/escalations', { params }),
  updateStatus: (id, data) => api.patch(`/escalations/${id}`, data),
};

export const adminAPI = {
  getSummary: () => api.get('/admin/summary'),
  listFacilitators: () => api.get('/admin/facilitators'),
  createFacilitator: (data) => api.post('/admin/facilitators', data),
  toggleFacilitatorStatus: (id, data) => api.patch(`/admin/facilitators/${id}/status`, data),
  resetFacilitatorPassword: (id, data) => api.post(`/admin/facilitators/${id}/reset-password`, data),
  listUsers: () => api.get('/admin/users'),
  toggleUserStatus: (id, data) => api.patch(`/admin/users/${id}/status`, data),
  listRequests: (params) => api.get('/admin/requests', { params }),
};

export const facilitatorAPI = {
  getAssignedRequests: (params) => api.get('/facilitator/requests', { params }),
  getRequestDetail: (id) => api.get(`/facilitator/requests/${id}`),
  updateRequestStatus: (id, data) => api.patch(`/facilitator/requests/${id}/status`, data),
};

export default api;
