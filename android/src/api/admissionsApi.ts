import api from './apiClient';

export const getAdmittedPatients = async (params: {
  wardCode?: string;
  doctorCode?: string;
  admissionDateFrom?: string;
  admissionDateTo?: string;
  page?: number;
  pageSize?: number;
}) => {
  console.log('➡️ [API] getAdmittedPatients called with params:', params);

  const res = await api.get('/Admissions/admitted', { params });

  console.log('✅ [API] getAdmittedPatients response:', res.data);

  return res.data;
};

export const getAllowedDocuments = async (                                                                                              
  admissionNo: string,
  loginUserId: string
) => {
  console.log('➡️ [API] getAllowedDocuments called');
  console.log('   admissionNo:', admissionNo);
  console.log('   loginUserId:', loginUserId);

  const res = await api.get(
    `/Admissions/${admissionNo}/documents`,
    { params: { loginUserId } }
  );

  console.log('✅ [API] getAllowedDocuments response:', res.data);

  return res.data;
};
