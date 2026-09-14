const BASE_URL = '/api';

function getHeaders(isMultipart = false) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function handleResponse(response) {
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }
  return data;
}

export const api = {
  // Auth
  async login(email, password) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(res);
  },

  async getMe() {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Tasks
  async getTasks(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const res = await fetch(`${BASE_URL}/tasks?${query.toString()}`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async getTaskById(id) {
    const res = await fetch(`${BASE_URL}/tasks/${id}`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async createTask(formData) {
    const isFormData = formData instanceof FormData;
    const res = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: getHeaders(isFormData),
      body: isFormData ? formData : JSON.stringify(formData)
    });
    return handleResponse(res);
  },

  async updateTask(id, formData) {
    const isFormData = formData instanceof FormData;
    const res = await fetch(`${BASE_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: getHeaders(isFormData),
      body: isFormData ? formData : JSON.stringify(formData)
    });
    return handleResponse(res);
  },

  async updateTaskStatus(id, status) {
    const res = await fetch(`${BASE_URL}/tasks/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status })
    });
    return handleResponse(res);
  },

  async submitReview(id, formData) {
    const isFormData = formData instanceof FormData;
    const res = await fetch(`${BASE_URL}/tasks/${id}/submit-review`, {
      method: 'POST',
      headers: getHeaders(isFormData),
      body: isFormData ? formData : JSON.stringify(formData)
    });
    return handleResponse(res);
  },

  async reviewTask(id, { action, catatan_revisi }) {
    const res = await fetch(`${BASE_URL}/tasks/${id}/review`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action, catatan_revisi })
    });
    return handleResponse(res);
  },

  async deleteTask(id) {
    const res = await fetch(`${BASE_URL}/tasks/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async deleteTasks(ids) {
    const res = await fetch(`${BASE_URL}/tasks`, {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ ids })
    });
    return handleResponse(res);
  },

  // Users
  async getUsers(params = {}) {
    const query = new URLSearchParams(params);
    const res = await fetch(`${BASE_URL}/users?${query.toString()}`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async getAssignees() {
    const res = await fetch(`${BASE_URL}/users/assignees`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async createUser(data) {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async updateUser(id, data) {
    const res = await fetch(`${BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async deleteUser(id) {
    const res = await fetch(`${BASE_URL}/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Bidang
  async getBidang() {
    const res = await fetch(`${BASE_URL}/bidang`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async createBidang(data) {
    const res = await fetch(`${BASE_URL}/bidang`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async updateBidang(id, data) {
    const res = await fetch(`${BASE_URL}/bidang/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async deleteBidang(id) {
    const res = await fetch(`${BASE_URL}/bidang/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Dashboard & Reports
  async getDashboardStats(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, v);
    });
    const res = await fetch(`${BASE_URL}/reports/dashboard?${query.toString()}`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  getExportExcelUrl(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, v);
    });
    return `${BASE_URL}/reports/export/excel?${query.toString()}`;
  },

  getExportPdfUrl(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, v);
    });
    return `${BASE_URL}/reports/export/pdf?${query.toString()}`;
  },

  async downloadExportExcel(params = {}) {
    const res = await fetch(this.getExportExcelUrl(params), {
      headers: getHeaders()
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Export gagal dengan status ${res.status}`);
    }
    return res.blob();
  },

  async downloadExportPdf(params = {}) {
    const res = await fetch(this.getExportPdfUrl(params), { headers: getHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Export gagal dengan status ${res.status}`);
    }
    return res.blob();
  },

  // Excel Templates & Import
  getTemplateDownloadUrl(type) {
    return `${BASE_URL}/templates/download/${type}`;
  },

  async importFile(endpoint, file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/import/${endpoint}`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData
    });
    return handleResponse(res);
  },

  // Notifications
  async getNotifications() {
    const res = await fetch(`${BASE_URL}/notifications`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async markNotificationRead(id) {
    const res = await fetch(`${BASE_URL}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async markAllNotificationsRead() {
    const res = await fetch(`${BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Cross Department Requests
  async getCrossRequests(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, v);
    });
    const res = await fetch(`${BASE_URL}/cross-requests?${query.toString()}`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async createCrossRequest(formData) {
    const isFormData = formData instanceof FormData;
    const res = await fetch(`${BASE_URL}/cross-requests`, {
      method: 'POST',
      headers: getHeaders(isFormData),
      body: isFormData ? formData : JSON.stringify(formData)
    });
    return handleResponse(res);
  },

  async respondCrossRequest(id, data) {
    const res = await fetch(`${BASE_URL}/cross-requests/${id}/respond`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  }
};

