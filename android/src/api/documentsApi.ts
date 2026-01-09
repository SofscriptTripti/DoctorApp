// src/api/documentsApi.ts
import api from './apiClient';
import { Buffer } from 'buffer';

/**
 * Get documents list
 */
export const getDocuments = async (categoryCode?: string) => {
  const res = await api.get('/Documents', {
    params: {
      categoryCode,
      onlyActive: true,
    },
  });
  return res.data;
};

/**
 * Get pages of a document
 */
export const getDocumentPages = async (documentId: string) => {
  const res = await api.get(`/Documents/${documentId}/pages`);
  return res.data;
};

/**
 * ✅ Get document page image
 * API RETURNS RAW IMAGE (binary)
 * We convert → base64 → valid RN Image URI
 */
export const getDocumentPageImage = async (
  documentId: string,
  pageId: string
): Promise<string> => {
  const response = await api.get(
    `/Documents/${documentId}/pages/${pageId}/image`,
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'image/*',
      },
    }
  );

  // Detect correct image type (VERY IMPORTANT)
  const contentType =
    response.headers?.['content-type'] || 'image/jpeg';

  // Convert binary → base64 (Android safe)
  const base64 = Buffer.from(response.data, 'binary').toString('base64');

  return `data:${contentType};base64,${base64}`;
};
