import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type UserState = {
  userId: string | null;
  username: string | null;
  fullName: string | null;
  tenantCode: string | null;
  role: string | null;
  department: string | null;
  isLoggedIn: boolean;
};

const initialState: UserState = {
  userId: null,
  username: null,
  fullName: null,
  tenantCode: null,
  role: null,
  department: null,
  isLoggedIn: false,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<Omit<UserState, 'isLoggedIn'>>) {
      return {
        ...action.payload,
        isLoggedIn: true,
      };
    },
    logout(state) {
      return initialState;
    },
  },
});

export const { setUser, logout } = userSlice.actions;
export default userSlice.reducer;
