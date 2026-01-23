import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'ACCESS_TOKEN';
const REFRESH_TOKEN_KEY = 'REFRESH_TOKEN';
const USER_INFO_KEY = 'USER_INFO';

export const saveAuth = async (token: string, refreshToken: string, userInfo: any) => {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, token],
    [REFRESH_TOKEN_KEY, refreshToken],
    [USER_INFO_KEY, JSON.stringify(userInfo)],
  ]);
};

export const getAccessToken = async () => {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = async () => {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
};

export const getUserInfo = async () => {
  const data = await AsyncStorage.getItem(USER_INFO_KEY);
  return data ? JSON.parse(data) : null;
};

export const clearAuth = async () => {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_INFO_KEY]);
};

