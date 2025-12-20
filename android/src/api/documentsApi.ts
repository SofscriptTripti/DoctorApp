import api from './apiClient';

export const getDocuments = async (categoryCode?: string) => {
  const res = await api.get('/Documents', {
    params: { categoryCode, onlyActive: true },
  });
  return res.data;
};

export const getDocumentPages = async (documentId: string) => {
  const res = await api.get(`/Documents/${documentId}/pages`);
  return res.data;
};
