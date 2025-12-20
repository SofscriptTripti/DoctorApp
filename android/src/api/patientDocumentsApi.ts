import api from './apiClient';

/* Create document instance */
export const createPatientDocument = async (
  patientNo: string,
  admissionNo: string,
  documentCd: string
) => {
  const res = await api.post('/PatientDocuments', {
    patientNo,
    admissionNo,
    documentCd,
  });
  return res.data;
};

/* Get document instance */
export const getPatientDocument = async (id: string) => {
  const res = await api.get(`/PatientDocuments/${id}`);
  return res.data;
};

/* Get pages + overlays */
export const getPatientDocumentPages = async (id: string) => {
  const res = await api.get(`/PatientDocuments/${id}/pages`);
  return res.data;
};

/* Download overlay image */
export const getPageOverlay = async (
  id: string,
  pageId: string
) => {
  return api.get(
    `/PatientDocuments/${id}/pages/${pageId}/overlay`,
    { responseType: 'arraybuffer' }
  );
};

/* Save overlay */
export const savePageOverlay = async (
  id: string,
  pageId: string,
  base64: string
) => {
  const res = await api.post(
    `/PatientDocuments/${id}/pages/${pageId}/save`,
    {
      overlayDataBase64: base64,
      contentType: 'image/png',
    }
  );
  return res.data;
};

/* Finalize */
export const finalizeDocument = async (id: string) => {
  const res = await api.post(`/PatientDocuments/${id}/finalize`, {
    createNewVersion: false,
  });
  return res.data;
};

/* Sign */
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
