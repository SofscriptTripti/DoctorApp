// src/api/patientDocumentsApi.ts
import api from './apiClient';
import { Buffer } from 'buffer';

/* ---------------------------------------------
   Create document instance
--------------------------------------------- */
export const createPatientDocument = async (
  patientNo: string,
  admissionNo: string,
  documentCd: string
) => {
  if (!patientNo || !admissionNo || !documentCd) {
    const errorMsg = `[createPatientDocument] Missing required params: patientNo=${patientNo}, admissionNo=${admissionNo}, documentCd=${documentCd}`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  console.log('🚀 [createPatientDocument] API called with:', {
    patientNo,
    admissionNo,
    documentCd,
    timestamp: new Date().toISOString(),
  });

  try {

    const res = await api.get('/PatientDocuments/open', {
      params: {
        patientNo,
        admissionNo,
        documentCd,
        action: 'ContinueEditing',
        versionNo: null,
      }
    });

    console.log('✅ [createPatientDocument] API response:', {
      status: res.status,
      data: res.data,
    });

    return res.data;
  } catch (error: any) {
    console.error('❌ [createPatientDocument] API error:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
};

/* ---------------------------------------------
   Create new version of document instance
--------------------------------------------- */
export const NewVersion = async (
  patientNo: string,
  admissionNo: string,
  documentCd: string
) => {
  if (!patientNo || !admissionNo || !documentCd) {
    const errorMsg = `[NewVersion] Missing required params: patientNo=${patientNo}, admissionNo=${admissionNo}, documentCd=${documentCd}`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  console.log('🚀 [NewVersion] API called with:', {
    patientNo,
    admissionNo,
    documentCd,
    timestamp: new Date().toISOString(),
  });

  try {
    const res = await api.get('/PatientDocuments/new-version', {
      params: {
        patientNo,
        admissionNo,
        documentCd,
      }
    });

    console.log('✅ [NewVersion] API response:', {
      status: res.status,
      data: res.data,
    });

    return res.data;
  } catch (error: any) {
    console.error('❌ [NewVersion] API error:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
};

/* ---------------------------------------------
   Get document versions (history)
--------------------------------------------- */
export const getPatientDocumentVersions = async (
  patientNo: string,
  admissionNo: string,
  documentCd: string
) => {
  if (!patientNo || !admissionNo || !documentCd) {
    throw new Error('Missing required params for getting document versions');
  }

  const res = await api.get('/PatientDocuments/versions', {
    params: {
      patientNo,
      admissionNo,
      documentCd,
    },
  });
  return res.data;
};

/* ---------------------------------------------
   Get document instance
--------------------------------------------- */
export const getPatientDocument = async (id: string) => {
  const res = await api.get(`/PatientDocuments/${id}`);
  return res.data;
};

/* ---------------------------------------------
   Get document pages
--------------------------------------------- */
export const getPatientDocumentPages = async (id: string) => {
  const res = await api.get(`/PatientDocuments/${id}/pages`);
  return res.data;
};

/* ---------------------------------------------
   Get document page image (Base image)
--------------------------------------------- */
export const getPatientDocumentPageImage = async (
  documentInstanceId: string,
  pageId: string
): Promise<string> => {
  const response = await api.get(
    `/PatientDocuments/${documentInstanceId}/pages/${pageId}/image`,
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'image/*',
      },
    }
  );

  const contentType = response.headers?.['content-type'] || 'image/jpeg';
  const base64 = Buffer.from(response.data, 'binary').toString('base64');
  return `data:${contentType};base64,${base64}`;
};

/* ---------------------------------------------
   Get page-wise overlay data
--------------------------------------------- */
export const getpagewiseoverlay = async (id: string) => {
  if (!id) {
    const errorMsg = `[getpagewiseoverlay] Missing required param: documentInstanceId (id) is null/undefined`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const perfStart = Date.now();
  console.log('🚀 [getpagewiseoverlay] API START:', {
    documentInstanceId: id,
    timestamp: new Date(perfStart).toISOString(),
  });

  try {
    const res = await api.get(`/PatientDocuments/${id}/pagesWithOverlay`, {
      headers: {
        Accept: 'application/json',
      },
      timeout: 15000,
      validateStatus: function (status) {
        return (status >= 200 && status < 300) || status === 404;
      },
    });

    const perfEnd = Date.now();
    const duration = perfEnd - perfStart;

    console.log(`⏱️ [PERT_METRIC] API Call Duration: ${duration}ms`);

    console.log('✅ [getpagewiseoverlay] API response:', {
      status: res.status,
      contentType: res.headers['content-type'],
      dataSize: res.data ? Object.keys(res.data).length : 0,
      hasData: !!res.data,
      duration: `${duration}ms`
    });

    // If 404, return empty object
    if (res.status === 404) {
      console.log(`⚠️ No pages with overlay found for document ${id} (404)`);
      return {};
    }

    // Handle empty responses
    if (!res.data) {
      console.log(`⚠️ Empty response for document ${id}`);
      return {};
    }

    return res.data;
  } catch (error: any) {
    console.error('❌ [getpagewiseoverlay] API error:', {
      message: error?.message,
      status: error?.response?.status,
      responseData: error?.response?.data,
    });

    // Check for network errors
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - server took too long to respond');
    }

    // Check for 404 specifically
    if (error.response?.status === 404) {
      console.log(`ℹ️ No pages with overlay found (404) for document ${id}`);
      return {};
    }

    // Re-throw with more context
    throw new Error(`Failed to fetch page-wise overlay: ${error.message || 'Unknown error'}`);
  }
};

/* ---------------------------------------------
   Get overlay image (BINARY) - UPDATED
--------------------------------------------- */
export const getPageOverlayImage = async (
  documentInstanceId: string,
  pageId: string
): Promise<ArrayBuffer> => {
  console.log('🚀 [getPageOverlayImage] API called with:', {
    documentInstanceId,
    pageId,
    timestamp: new Date().toISOString(),
  });

  try {
    const res = await api.get(
      `/PatientDocuments/${documentInstanceId}/pages/${pageId}/overlay`,
      {
        responseType: 'arraybuffer',
        headers: {
          Accept: 'image/png,image/jpeg,image/*',
        },
        timeout: 15000,
        validateStatus: function (status) {
          // Accept 200-299 and 404 (not found)
          return (status >= 200 && status < 300) || status === 404;
        },
      }
    );

    console.log('✅ [getPageOverlayImage] API response:', {
      status: res.status,
      contentType: res.headers['content-type'],
      byteLength: res.data?.byteLength,
      hasData: !!res.data,
    });

    // If 404, return empty array buffer
    if (res.status === 404) {
      console.log(`⚠️ No overlay found for page ${pageId} (404)`);
      return new ArrayBuffer(0);
    }

    // Handle empty responses
    if (!res.data || res.data.byteLength === 0) {
      console.log(`⚠️ Empty response for page ${pageId}`);
      return new ArrayBuffer(0);
    }

    // Check if response is actually an image
    const contentType = res.headers['content-type'];
    const isImage = contentType && (
      contentType.includes('image/png') ||
      contentType.includes('image/jpeg') ||
      contentType.includes('image/jpg')
    );

    if (!isImage) {
      console.warn(`⚠️ Response is not an image: ${contentType}`);

      // Try to decode as text to check for error messages
      try {
        const text = Buffer.from(res.data).toString('utf8');
        console.log('Response as text:', text.substring(0, 200));

        if (text.toLowerCase().includes('error') ||
          text.toLowerCase().includes('not found') ||
          text.toLowerCase().includes('no overlay')) {
          console.log('API returned error message, treating as no overlay');
          return new ArrayBuffer(0);
        }
      } catch (e) {
        console.log('Could not decode response as text');
      }
    }

    // Log successful image data
    console.log(`✅ Received image data for page ${pageId}:`, {
      byteLength: res.data.byteLength,
      contentType: contentType,
      base64Preview: Buffer.from(res.data).toString('base64').substring(0, 100) + '...'
    });

    return res.data as ArrayBuffer;
  } catch (error: any) {
    console.error('❌ [getPageOverlayImage] API error:', {
      message: error?.message,
      status: error?.response?.status,
      responseData: error?.response?.data ?
        Buffer.from(error.response.data).toString('utf8').substring(0, 200) : 'No data',
    });

    // Check for network errors
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - server took too long to respond');
    }

    // Check for 404 specifically
    if (error.response?.status === 404) {
      console.log(`ℹ️ Overlay not found (404) for page ${pageId}`);
      return new ArrayBuffer(0);
    }

    // Re-throw with more context
    throw new Error(`Failed to fetch overlay: ${error.message || 'Unknown error'}`);
  }
};

/* ---------------------------------------------
   Convert ArrayBuffer → Base64 (RN helper)
--------------------------------------------- */
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('Empty buffer cannot be converted to base64');
  }
  return Buffer.from(buffer).toString('base64');
};

/* ---------------------------------------------
   Save overlay image
--------------------------------------------- */
export const savePageOverlay = async (
  documentInstanceId: string,
  pageId: string,
  base64: string
) => {
  console.log('🚀 [savePageOverlay] API called with:', {
    documentInstanceId,
    pageId,
    base64Length: base64?.length,
  });

  try {
    const res = await api.post(
      `/PatientDocuments/${documentInstanceId}/pages/${pageId}/save`,
      {
        overlayDataBase64: base64,
        contentType: 'image/png',
      }
    );

    console.log('✅ [savePageOverlay] API response:', {
      status: res.status,
      data: res.data,
    });

    return res.data;
  } catch (error: any) {
    console.error('❌ [savePageOverlay] API error:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
};

/* ---------------------------------------------
   Finalize document
--------------------------------------------- */
export const finalizeDocument = async (id: string) => {
  const res = await api.post(`/PatientDocuments/${id}/finalize`, {
    createNewVersion: false,
  });
  return res.data;
};

/* ---------------------------------------------
   Sign document
--------------------------------------------- */
export const signDocument = async (
  id: string,
  signerName: string,
  signerRole: string
) => {
  const res = await api.post(`/PatientDocuments/${id}/sign`, {
    signerName,
    signerRole,
  });
  return res.data;
};

/* ---------------------------------------------
   Favourite document version
--------------------------------------------- */
export const favouritePatientDocument = async (
  documentInstanceId: string
) => {
  if (!documentInstanceId) {
    throw new Error('Missing documentInstanceId for favouriting');
  }

  console.log(`🚀 [favouritePatientDocument] API called for ${documentInstanceId}`);

  try {
    const res = await api.post(`/PatientDocuments/${documentInstanceId}/favourite`);

    console.log('✅ [favouritePatientDocument] API response:', res.data);
    return res.data;
  } catch (error: any) {
    console.error('❌ [favouritePatientDocument] API error:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
};

/* ---------------------------------------------
   Unfavourite document version
--------------------------------------------- */
export const unfavouritePatientDocument = async (
  documentInstanceId: string
) => {
  if (!documentInstanceId) {
    throw new Error('Missing documentInstanceId for unfavouriting');
  }

  console.log(`🚀 [unfavouritePatientDocument] API called for ${documentInstanceId}`);

  try {
    const res = await api.delete(`/PatientDocuments/${documentInstanceId}/favourite`);

    console.log('✅ [unfavouritePatientDocument] API response:', res.data);
    return res.data;
  } catch (error: any) {
    console.error('❌ [unfavouritePatientDocument] API error:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
};



/* ---------------------------------------------
   Archive document version
--------------------------------------------- */
export const archivePatientDocument = async (
  documentInstanceId: string,
  note?: string
) => {
  if (!documentInstanceId) {
    throw new Error('Missing documentInstanceId for archiving');
  }

  console.log('🚀 [archivePatientDocument] API called with:', {
    documentInstanceId,
    note,
    timestamp: new Date().toISOString(),
  });

  try {
    const res = await api.post(`/PatientDocuments/${documentInstanceId}/archive`, {
      note
    });

    console.log('✅ [archivePatientDocument] API response:', {
      status: res.status,
      data: res.data,
    });

    return res.data;
  } catch (error: any) {
    console.error('❌ [archivePatientDocument] API error:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
};

/* ---------------------------------------------
   Unarchive document version
--------------------------------------------- */
export const unarchivePatientDocument = async (
  documentInstanceId: string,
  note?: string
) => {
  if (!documentInstanceId) {
    throw new Error('Missing documentInstanceId for unarchiving');
  }

  try {
    const res = await api.post(`/PatientDocuments/${documentInstanceId}/unarchive`, {
      note
    });
    return res.data;
  } catch (error: any) {
    console.error('❌ [unarchivePatientDocument] API error:', error);
    throw error;
  }
};

/* ---------------------------------------------
   List archived document versions
--------------------------------------------- */
export const getArchivedPatientDocuments = async (
  patientNo: string,
  admissionNo: string,
  documentCd?: string
) => {
  if (!patientNo || !admissionNo) {
    throw new Error('Missing required params for listing archived documents');
  }

  try {
    const res = await api.get('/PatientDocuments/archived', {
      params: {
        patientNo,
        admissionNo,
        documentCd
      }
    });
    return res.data;
  } catch (error: any) {
    console.error('❌ [getArchivedPatientDocuments] API error:', error);
    throw error;
  }
};

/* ---------------------------------------------
   Permanent Delete document version
--------------------------------------------- */
export const deletePatientDocument = async (
  documentInstanceId: string,
  deletionReason: string
) => {
  if (!documentInstanceId) {
    throw new Error('Missing documentInstanceId for deletion');
  }
  if (!deletionReason) {
    throw new Error('Reason is required for permanent deletion');
  }

  console.log('🚀 [deletePatientDocument] API called with:', {
    documentInstanceId,
    deletionReason,
    timestamp: new Date().toISOString(),
  });

  try {
    const res = await api.delete(`/PatientDocuments/${documentInstanceId}`, {
      data: { deletionReason }
    });

    console.log('✅ [deletePatientDocument] API response:', {
      status: res.status,
      data: res.data,
    });

    return res.data;
  } catch (error: any) {
    console.error('❌ [deletePatientDocument] API error:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
};

/* ---------------------------------------------
   Get Archive/Action Logs
--------------------------------------------- */
export const getPatientDocumentArchiveLog = async (documentInstanceId: string) => {
  if (!documentInstanceId) {
    throw new Error('Missing documentInstanceId for fetching archive logs');
  }

  try {
    const res = await api.get(`/PatientDocuments/${documentInstanceId}/archive-log`);
    return res.data;
  } catch (error: any) {
    console.error('❌ [getPatientDocumentArchiveLog] API error:', error);
    throw error;
  }
};

/* ---------------------------------------------
   Get Deleted Document Versions
--------------------------------------------- */
export const getDeletedPatientDocuments = async (
  patientNo: string,
  admissionNo: string,
  documentCd?: string
) => {
  if (!patientNo || !admissionNo) {
    throw new Error('Missing required params patientNo/admissionNo for deleted info');
  }

  try {
    const res = await api.get('/PatientDocuments/deleted', {
      params: { patientNo, admissionNo, documentCd }
    });
    return res.data;
  } catch (error: any) {
    console.error('❌ [getDeletedPatientDocuments] API error:', error);
    throw error;
  }
};