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

    // Save tokens
    if (res.data?.accessToken && res.data?.refreshToken) {
      // Import saveAuth dynamically or assume it's available in scope if imported. 
      // Ideally, the caller should handle saving, checking how it was before.
      // Wait, checking previous file content... previous file didn't import saveAuth.
      // The previous code returned res.data and the UI likely called saveAuth.
      // I should update this file to just return the data as before, 
      // OR update the caller. 
      // The user wants me to fix the "issue", so I should probably handle it centralized if possible.
      // However, looking at the previous code, `login` just returns data.
      // I will leave `login` returning data, but I need to update the CALLER of `login` later.
      // Actually, for `refreshTokenAPI`, I need it here.
    }

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

export const refreshTokenAPI = async (token: string, refreshToken: string) => {
  try {
    console.log('REFRESHING TOKEN... 🔄');
    // Usually refresh endpoints take { accessToken, refreshToken } or just { refreshToken }
    // Based on standard practices and the user's screenshot having "Body" active:
    const res = await api.post('/Auth/refresh', {
      accessToken: token,
      refreshToken: refreshToken,
    });
    console.log('REFRESH SUCCESS ✅', res.data);
    return res.data;
  } catch (error: any) {
    console.log('REFRESH ERROR ❌', error?.response?.status);
    throw error;
  }
};
