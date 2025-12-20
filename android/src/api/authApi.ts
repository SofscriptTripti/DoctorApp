import api from './apiClient';

export const login = async (
  username: string,
  password: string,
  tenantCode: string
) => {
  try {
    console.log('LOGIN REQUEST 👉', {
      username,
      password: '********', // never log real password
      tenantCode,
    });

    const res = await api.post('/Auth/login', {
      username,
      password,
      tenantCode,
    });

    console.log('LOGIN RESPONSE ✅', res.data);

    return res.data;
  } catch (error: any) {
    console.log('LOGIN ERROR ❌', {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
    });

    throw error; // rethrow so UI can handle it
  }
};
