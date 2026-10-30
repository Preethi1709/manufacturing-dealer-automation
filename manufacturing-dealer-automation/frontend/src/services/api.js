import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Helper to trigger safe file download in browser
const downloadBlob = (blob, defaultFilename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const apiService = {
  // System Health
  getHealth: async () => {
    const res = await apiClient.get('/api/health');
    return res.data;
  },

  // Dashboard
  getDashboardMetrics: async () => {
    const res = await apiClient.get('/api/dashboard');
    return res.data;
  },

  // Requirements
  getRequirements: async () => {
    const res = await apiClient.get('/api/requirements');
    return res.data;
  },
  getRequirementById: async (id) => {
    const res = await apiClient.get(`/api/requirements/${id}`);
    return res.data;
  },
  createRequirement: async (data) => {
    const res = await apiClient.post('/api/requirements', data);
    return res.data;
  },
  updateRequirement: async (id, data) => {
    const res = await apiClient.put(`/api/requirements/${id}`, data);
    return res.data;
  },

  // Search
  searchDealers: async (searchParams) => {
    const res = await apiClient.post('/api/search', searchParams);
    return res.data;
  },
  identifyProductImage: async (imageFile) => {
    const formData = new FormData();
    formData.append('file', imageFile);
    const res = await apiClient.post('/api/search/identify-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
  getSearchRecord: async (searchId) => {
    const res = await apiClient.get(`/api/search/${searchId}`);
    return res.data;
  },
  saveSearchResults: async (requirementId, results, productName = null) => {
    const url = productName
      ? `/api/search/save-results?requirement_id=${requirementId}&product_name=${encodeURIComponent(productName)}`
      : `/api/search/save-results?requirement_id=${requirementId}`;
    const res = await apiClient.post(url, results);
    return res.data;
  },

  // Dealers
  getDealers: async (requirementId = null) => {
    const params = requirementId ? { requirement_id: requirementId } : {};
    const res = await apiClient.get('/api/dealers', { params });
    return res.data;
  },
  getDealerById: async (id) => {
    const res = await apiClient.get(`/api/dealers/${id}`);
    return res.data;
  },
  createDealer: async (data) => {
    const res = await apiClient.post('/api/dealers', data);
    return res.data;
  },
  updateDealer: async (id, data) => {
    const res = await apiClient.put(`/api/dealers/${id}`, data);
    return res.data;
  },
  uploadQuotation: async (dealerId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(`/api/dealers/${dealerId}/upload-quotation`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
  getQuotationDownloadUrl: (filename) => {
    return `${API_BASE_URL}/api/quotations/download/${encodeURIComponent(filename)}`;
  },

  // Contacts & Outreach
  getContacts: async (dealerId = null, requirementId = null) => {
    const params = {};
    if (dealerId) params.dealer_id = dealerId;
    if (requirementId) params.requirement_id = requirementId;
    const res = await apiClient.get('/api/contacts', { params });
    return res.data;
  },
  createContact: async (data) => {
    const res = await apiClient.post('/api/contacts', data);
    return res.data;
  },
  updateContact: async (id, data) => {
    const res = await apiClient.put(`/api/contacts/${id}`, data);
    return res.data;
  },
  extractPublicContact: async (payload) => {
    const res = await apiClient.post('/api/contacts/extract-public-contact', payload);
    return res.data;
  },
  generateInquiry: async (params) => {
    const res = await apiClient.post('/api/inquiry/generate', params);
    return res.data;
  },
  sendRfqEmail: async (payload) => {
    const res = await apiClient.post('/api/contacts/send-email', payload);
    return res.data;
  },
  sendRfqWhatsApp: async (payload) => {
    const res = await apiClient.post('/api/contacts/send-whatsapp', payload);
    return res.data;
  },
  recordSupplierReply: async (contactId, payload) => {
    const res = await apiClient.post(`/api/contacts/${contactId}/record-reply`, payload);
    return res.data;
  },
  extractReplyData: async (replyText) => {
    const res = await apiClient.post('/api/contacts/extract-reply-data', { reply_text: replyText });
    return res.data;
  },
  getFollowUpMetrics: async () => {
    const res = await apiClient.get('/api/contacts/followup-metrics');
    return res.data;
  },

  // Quotation Comparison
  compareQuotations: async (requirementId, dealerIds = null) => {
    const payload = { requirement_id: requirementId, dealer_ids: dealerIds };
    const res = await apiClient.post('/api/quotations/compare', payload);
    return res.data;
  },
  getQuotationHistory: async (requirementId = null) => {
    const params = requirementId ? { requirement_id: requirementId } : {};
    const res = await apiClient.get('/api/quotations', { params });
    return res.data;
  },

  // Excel Downloads
  exportDealersExcel: async (requirementId = null) => {
    const params = requirementId ? { requirement_id: requirementId } : {};
    const res = await apiClient.get('/api/export/dealers', {
      params,
      responseType: 'blob',
    });
    downloadBlob(res.data, `Dealer_Results_${requirementId || 'All'}.xlsx`);
  },
  exportRequirementsExcel: async () => {
    const res = await apiClient.get('/api/export/requirements', {
      responseType: 'blob',
    });
    downloadBlob(res.data, 'Product_Requirements.xlsx');
  },
  exportComparisonExcel: async (requirementId) => {
    const res = await apiClient.get(`/api/export/comparison?requirement_id=${requirementId}`, {
      responseType: 'blob',
    });
    downloadBlob(res.data, `Quotation_Comparison_${requirementId}.xlsx`);
  },
};

export default apiClient;
